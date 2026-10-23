import { useCallback, useEffect, useState } from 'react';
import { pruneCache, readCache, readFallback, writeCache, type Circle, type ShopCache } from '../nearby/cache';
import { distanceMeters } from '../nearby/geo';
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
};

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

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const center = { lat, lon };
    const now = Date.now();
    pruneCache(storage(), now, cacheKey);
    const hit = readCache<T>(storage(), center, radius, now, cacheKey);
    const circle = queryCircle(center, radius);
    const controller = new AbortController();
    // A cached answer is applied on the next tick; a request waits for the
    // slider or the map to settle.
    const timer = setTimeout(
      async () => {
        if (hit) {
          setFetched({ ...IDLE, status: 'ready', items: hit, circle: { ...center, radius } });
          return;
        }
        const saved = readFallback<T>(storage(), center, now, cacheKey);
        setFetched((f) => {
          const loading = { status: 'loading' as const, error: null, since: Date.now(), waitUntil: null, failedAt: null };
          if (saved) return { ...loading, items: saved.items, circle: saved.circle, savedAt: saved.fetchedAt };
          // Nothing kept (storage full or off): this visit's own answer, if it still covers here.
          return f.circle && reachOf(f.circle, center) > 0 ? { ...f, ...loading } : { ...IDLE, ...loading };
        });
        try {
          const items = await fetcher(circle, circle.radius, {
            signal: controller.signal,
            onWait: (ms) => setFetched((f) => ({ ...f, waitUntil: Date.now() + ms })),
          });
          writeCache(storage(), circle, items, Date.now(), cacheKey);
          setFetched({ ...IDLE, status: 'ready', items, circle });
        } catch (error) {
          if (controller.signal.aborted) return;
          const message = error instanceof OverpassUnavailable || error instanceof OverpassOffline ? error.message : failed;
          setFetched((f) => ({ ...f, status: 'error', error: message, since: null, waitUntil: null, failedAt: Date.now() }));
        }
      },
      hit ? 0 : SETTLE_MS,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lon, radius, attempt, fetcher, cacheKey, failed]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // The connection is back: ask at once, not at the next scheduled try.
  const failedNow = fetched.status === 'error';
  useEffect(() => {
    if (!failedNow) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failedNow, retry]);

  // Retries by itself after a failure, counted per place and radius: a new one starts afresh.
  const placeKey = `${lat},${lon},${radius}`;
  const [auto, setAuto] = useState({ key: '', used: 0 });
  const used = auto.key === placeKey ? auto.used : 0;
  const autoAt =
    fetched.status === 'error' && fetched.failedAt !== null && used < AUTO_RETRY_MS.length
      ? fetched.failedAt + AUTO_RETRY_MS[used]!
      : null;
  useEffect(() => {
    if (autoAt === null) return;
    let onVisible: (() => void) | null = null;
    const fire = () => {
      setAuto({ key: placeKey, used: used + 1 });
      setAttempt((n) => n + 1);
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
  }, [autoAt, placeKey, used]);

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
