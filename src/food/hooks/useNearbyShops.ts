import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { pruneCache, readCache, readFallback, writeCache, type Circle, type ShopCache } from '../nearby/cache';
import { distanceMeters } from '../nearby/geo';
import { roundingMargin } from '../nearby/osmGrid';
import { OverpassOffline, OverpassUnavailable, type FetchOptions } from '../nearby/overpass';
import { queryCircle } from '../nearby/query';
import type { LatLon } from '../nearby/types';

export type ShopsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AroundState<T> {
  status: ShopsStatus;
  /** What is valid around the CURRENT position - never what was fetched for another place. */
  items: T[];
  /**
   * How far from the current position `items` is COMPLETE. Equal to the radius
   * once the answer for it has arrived; smaller while a wider search runs (the
   * earlier, smaller answer is still true, just not the whole picture); 0 when
   * nothing fetched covers this place.
   */
  completeWithin: number;
  error: string | null;
  /**
   * When `items` were fetched, if they are an answer kept on this device - shown while a new one
   * loads or after it failed; `null` once the answer asked for has arrived.
   */
  savedAt: number | null;
  /** When the search on screen started (`loading`): a long one is called slow. */
  since: number | null;
  /** The end of a pause before the next try: the server asked for it, or the page tries again by itself. */
  retryAt: number | null;
}

interface Fetched<T> {
  status: ShopsStatus;
  items: T[];
  /** The circle these items were fetched for. */
  circle: Circle | null;
  error: string | null;
  savedAt: number | null;
  since: number | null;
  /** A pause inside the current search. */
  waitUntil: number | null;
  /** When the last search failed: the next automatic try is counted from it. */
  failedAt: number | null;
  /** The place (rounded centre and radius) the last search was for: its failure counts only there. */
  place: string;
}

const IDLE: Fetched<never> = {
  status: 'idle',
  items: [],
  circle: null,
  error: null,
  savedAt: null,
  since: null,
  waitUntil: null,
  failedAt: null,
  place: '',
};

/** A place as the automatic tries count it: the rounded centre and the radius. */
const placeOf = (lat: number | undefined, lon: number | undefined, radius: number) => `${lat},${lon},${radius}`;

/** One empty list, so "nothing valid" does not change identity every render. */
const NOTHING: never[] = [];

/** Slider drags and map moves settle before a request goes to a busy server. */
const SETTLE_MS = 400;

/**
 * After a failed search the page tries again by itself, this long apart, then leaves it to the
 * button - the growing pauses the busy servers ask for, never a loop that keeps them busy.
 */
export const AUTO_RETRY_MS = [30_000, 60_000, 120_000];

function storage(): ShopCache | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** How far from `point` an answer for `circle` is complete; 0 or less when it does not cover it. */
const reachOf = (circle: Circle, point: LatLon) => circle.radius - distanceMeters(circle, point);

type Fetcher<T> = (center: LatLon, radius: number, options: FetchOptions) => Promise<T[]>;

/**
 * Something from Overpass around a position. What is sent and cached is the QUERY circle:
 * a centre rounded to ~100 m plus a margin, so the exact position never leaves
 * the device and a short walk reuses the same answer.
 *
 * Whether to ask at all is decided from that rounded centre too, so every spot of one rounding cell
 * asks the same (or nothing), and GPS jitter inside it neither cancels nor repeats a search. Only
 * what is complete on screen is measured from the exact position, on the device.
 *
 * The public servers are often busy, so a search never leaves an empty map behind if anything
 * better is known: an answer kept on this device (up to a week old, or for a smaller radius) shows
 * while the new one loads and stays after a failure, with its age. A failure is retried by itself
 * a few times, further and further apart, and not while the page is hidden.
 */
export function useAround<T>(
  position: LatLon | null,
  radius: number,
  fetcher: Fetcher<T>,
  cacheKey: string | undefined,
  failed: string,
): [AroundState<T>, () => void] {
  const [fetched, setFetched] = useState<Fetched<T>>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const lat = position?.lat;
  const lon = position?.lon;
  const query = position ? queryCircle(position, radius) : null;
  const qLat = query?.lat;
  const qLon = query?.lon;

  useEffect(() => {
    if (qLat === undefined || qLon === undefined) return;
    const centre = { lat: qLat, lon: qLon };
    const place = placeOf(qLat, qLon, radius);
    // `query` again, from the numbers the effect depends on (rounding a rounded centre changes nothing).
    const circle = queryCircle(centre, radius);
    const now = Date.now();
    pruneCache(storage(), now, cacheKey);
    // A kept answer that holds the radius grown by the rounding's reach around the rounded centre
    // holds the circle around any spot of the cell, the exact position's among them.
    const reach = radius + roundingMargin(qLat);
    const hit = readCache<T>(storage(), centre, reach, now, cacheKey);
    const controller = new AbortController();
    // A cached answer is applied on the next tick; a request waits for the
    // slider or the map to settle.
    const timer = setTimeout(
      async () => {
        if (hit) {
          setFetched({ ...IDLE, status: 'ready', items: hit, circle: { ...centre, radius: reach }, place });
          return;
        }
        const saved = readFallback<T>(storage(), centre, now, cacheKey);
        setFetched((f) => {
          const loading = { status: 'loading' as const, error: null, since: Date.now(), waitUntil: null, failedAt: null, place };
          if (saved) return { ...loading, items: saved.items, circle: saved.circle, savedAt: saved.fetchedAt };
          // Nothing kept (storage full or off): this visit's own answer, if it still covers here.
          return f.circle && reachOf(f.circle, centre) > 0 ? { ...f, ...loading } : { ...IDLE, ...loading };
        });
        try {
          const items = await fetcher(circle, circle.radius, {
            signal: controller.signal,
            onWait: (ms) => setFetched((f) => ({ ...f, waitUntil: Date.now() + ms })),
          });
          writeCache(storage(), circle, items, Date.now(), cacheKey);
          setFetched({ ...IDLE, status: 'ready', items, circle, place });
        } catch (error) {
          if (controller.signal.aborted) return;
          const message = error instanceof OverpassUnavailable || error instanceof OverpassOffline ? error.message : failed;
          setFetched((f) => ({ ...f, status: 'error', error: message, since: null, waitUntil: null, failedAt: Date.now(), place }));
        }
      },
      hit ? 0 : SETTLE_MS,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [qLat, qLon, radius, attempt, fetcher, cacheKey, failed]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Retries by itself after a failure, counted per place (the rounded one: jitter is no new place)
  // and radius: a new one starts afresh. The failure of the place just left is not this one's: while
  // the new search waits to settle, nothing is tried for it on the old failure's clock.
  const placeKey = placeOf(qLat, qLon, radius);
  const failedHere = fetched.status === 'error' && fetched.place === placeKey;
  const autoAt = useAutoRetry(failedHere ? fetched.failedAt : null, placeKey, retry);

  // Within what distance of HERE is the last answer complete? Items fetched
  // for another place are not shown for this one (after a move they would name
  // a far shop as "the nearest"), but a smaller answer at the same place stays
  // on screen while a wider one loads - it used to vanish, for a 10 km query
  // that can take half a minute.
  const completeWithin =
    fetched.circle && lat !== undefined && lon !== undefined
      ? Math.min(radius, Math.max(0, reachOf(fetched.circle, { lat, lon })))
      : 0;
  const retryAt = fetched.status === 'error' ? autoAt : fetched.waitUntil;
  return [
    {
      status: fetched.status,
      items: completeWithin > 0 ? fetched.items : NOTHING,
      completeWithin,
      error: fetched.error,
      savedAt: completeWithin > 0 ? fetched.savedAt : null,
      since: fetched.status === 'loading' ? fetched.since : null,
      retryAt,
    },
    retry,
  ];
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser says it has a connection (`false` only when it knows it has none). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => globalThis.navigator?.onLine !== false,
    () => true,
  );
}

/**
 * When the connection last came back (0: not since the page opened). Stamped by a listener added as
 * the module loads, before any component's, so the render an `online` event causes already has it.
 */
let backOnlineAt = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    backOnlineAt = Date.now();
  });
}

/** The connection as a store value: `null` while offline, else when it last came back. */
const onlineSince = () => (globalThis.navigator?.onLine !== false ? backOnlineAt : null);

/**
 * `null` while offline; else when the connection came back while the caller was mounted, 0 if it did
 * not. Read from the store, not kept in a state an `online` handler sets: that state would arrive a
 * render late, after a timer counted from the old failure had already fired and spent a try.
 */
function useResumedAt(): number | null {
  const since = useSyncExternalStore(subscribeOnline, onlineSince, () => 0);
  // A comeback from before the caller mounted is older than anything it failed at - unless the
  // clock went back since (a correction, or a test's fresh clock): it does not count.
  const [before] = useState(() => backOnlineAt);
  return since === before ? 0 : since;
}

/** The automatic tries at one place. */
interface AutoTries {
  key: string;
  used: number;
  /** The `failedAt` the last try was fired for: while it stays the same, that try has not failed yet. */
  firedFor: number | null;
}

/**
 * After a failure: try again by itself, `AUTO_RETRY_MS` apart, counted per place (`placeKey`, which
 * must NOT change with each try; a new place starts afresh) and once per failure (`failedAt` must
 * change when a try fails again), never while the page is hidden (it waits to be looked at), never
 * while offline (no countdown then either), and at once when the connection comes back (a try that
 * spends no slot; the next waits from it). Returns when the next try is due, for the countdown;
 * `null` when none is.
 */
export function useAutoRetry(failedAt: number | null, placeKey: string, retry: () => void): number | null {
  const [auto, setAuto] = useState<AutoTries>({ key: '', used: 0, firedFor: null });
  const resumedAt = useResumedAt();
  const mine = auto.key === placeKey;
  const used = mine ? auto.used : 0;
  // This failure has had its try, still on its way (the index keeps its old failure while a new
  // request runs): nothing more is due, however many due times a hidden page slept through.
  const tried = mine && auto.firedFor === failedAt;
  const autoAt =
    resumedAt !== null && failedAt !== null && !tried && used < AUTO_RETRY_MS.length
      ? Math.max(failedAt, resumedAt) + AUTO_RETRY_MS[used]!
      : null;
  useEffect(() => {
    if (autoAt === null) return;
    let onVisible: (() => void) | null = null;
    const fire = () => {
      setAuto({ key: placeKey, used: used + 1, firedFor: failedAt });
      retry();
    };
    const timer = setTimeout(() => {
      // A hidden page does not keep a busy server busy: it asks again when it is looked at.
      if (document.visibilityState !== 'hidden') return fire();
      onVisible = () => {
        if (document.visibilityState === 'hidden') return;
        document.removeEventListener('visibilitychange', onVisible!);
        fire();
      };
      document.addEventListener('visibilitychange', onVisible);
    }, Math.max(0, autoAt - Date.now()));
    return () => {
      clearTimeout(timer);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, [autoAt, placeKey, used, failedAt, retry]);

  // The connection is back: ask at once, not at the next scheduled try.
  const failed = failedAt !== null;
  useEffect(() => {
    if (!failed) return;
    const onOnline = () => retry();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [failed, retry]);
  return autoAt;
}

/** The time, once a second while `active` (a countdown on screen); otherwise as it was. */
export function useSecondClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    // At once, not a second late: the clock stood still while nothing counted.
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}
