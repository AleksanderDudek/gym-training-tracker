import { useCallback, useEffect, useMemo, useState } from 'react';
import { say } from '../../i18n';
import { SHOPS_KEY, pruneCache, writeCache, type ShopCache } from '../nearby/cache';
import { OSM_KEY, dropLegacyCaches, fetchOsm } from '../nearby/live';
import { shopsOf, type Element } from '../nearby/overpass';
import { queryCircle } from '../nearby/query';
import type { GeoState } from './useGeolocation';
import { useAround, useOnline, type AroundState } from './useNearbyShops';
import { useStaticAround, type Coverage } from './useStaticAround';

/**
 * Where the elements on screen come from — said under the map, next to the © line:
 * the app's own copy of the data, Overpass live, or both (the Polish side of a border circle from
 * the copy, the rest live).
 */
export type OsmSource = 'static' | 'live' | 'mixed';

export interface OsmState extends AroundState<Element> {
  source: OsmSource;
  /** At the border: whose items are on screen — the Polish side from the app, or Overpass's whole circle. */
  shown: 'static' | 'live';
  coverage: Coverage;
  /** The date of the app's copy of the data (ISO), when it is in use. */
  dataAsOf: string | null;
  /** Some of the area is from the previous data version (the new one could not be fetched). */
  olderLeaves: boolean;
  /**
   * At the border, while the Polish side is what is shown: what Overpass does for the rest of the
   * circle — still asking, failed (offline too: nothing can be asked), or done (it answered, and its
   * answer adds nothing to the screen).
   */
  rest?: 'asking' | 'failed' | 'done';
}

const FAILED = say(
  'Nie udało się pobrać lokali i sklepów. Sprawdź połączenie z internetem.',
  'Couldn’t load the places and shops. Check your internet connection.',
);
const OFFLINE = say(
  'Bez internetu nie mam jeszcze danych tej okolicy — pobiorę je, gdy wróci połączenie.',
  'Offline, I don’t have this area’s data yet — I’ll load it when you’re back online.',
);
const OFFLINE_REST = say(
  'Bez internetu nie mam reszty tej okolicy — pobiorę ją, gdy wróci połączenie.',
  'Offline, I don’t have the rest of this area — I’ll load it when you’re back online.',
);
const NETWORK = say(
  'Nie udało się pobrać danych okolicy. Sprawdź połączenie z internetem.',
  'Couldn’t load this area’s data. Check your internet connection.',
);

function storage(): (ShopCache & Pick<Storage, 'removeItem'>) | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Everything „W pobliżu” shows, for BOTH views: called once by the page, so the data starts loading
 * when the page opens (not after the products for the shops view), and switching between
 * „Zjedz teraz” and „Zakupy i przepisy” neither asks again nor cancels anything.
 *
 * In Poland the answer is the app's own copy of the OpenStreetMap data (`useStaticAround`): no
 * request to Overpass at all. Overpass (`useAround`, with its pauses, retries and saved answers)
 * answers abroad, completes a circle that crosses the border, and stands in when the app's data
 * cannot be read from its server.
 *
 * A complete answer also leaves the shops around this place for the diary's suggestions
 * (`produkty-pl:shops`, read by `useNearbyChains` without asking anyone).
 */
export function useOsmAround(geo: GeoState, radius: number): [OsmState, () => void] {
  const position = geo.position;
  const [stat, retryStatic] = useStaticAround(position, radius);
  const goLive =
    stat.coverage === 'off' ||
    stat.coverage === 'none' ||
    stat.coverage === 'partial' ||
    stat.failure === 'unavailable' ||
    // No index at all (never cached, the connection failing): Overpass and its saved answers stand
    // in — abroad that is the right source anyway, and offline nothing is sent.
    (stat.coverage === 'unknown' && stat.failure !== null);
  // The place as Overpass is asked about it: the rounded circle.
  const asked = position ? queryCircle(position, radius) : null;
  const place = asked ? `${asked.lat},${asked.lon},${asked.radius}` : null;
  // The place whose READY Overpass answer is on screen. When the app's data comes back for it (the
  // index read again), that answer stays until the data is ready — no empty list in between — and
  // `useAround` keeps its position, so nothing changes for it and nothing is asked again. Only a
  // ready answer is held: no automatic tries of Overpass run meanwhile.
  const [heldPlace, setHeldPlace] = useState<string | null>(null);
  const holding = !goLive && place !== null && heldPlace === place && stat.status !== 'ready';
  const [live, retryLive, liveHere] = useAround<Element>(goLive || holding ? position : null, radius, fetchOsm, OSM_KEY, FAILED);
  // Kept up to date during render — noted, or forgotten for another place or once the app's data has
  // taken over — so the very render in which the app's data returns already knows it. Only an answer
  // asked for THIS place: right after a move `live` still holds the last place's, and holding it would
  // let the new place's search go out to Overpass although the app's data is back — or not, by where
  // in the rounding cell the user stands. An empty answer is an answer too: the same rules over the
  // same map give the app's copy nothing there either (only a place deleted since the copy differs, and
  // there Overpass is the right one), so it stays instead of a „Szukam…” flash or a failing download.
  const readyLive = (goLive || holding) && liveHere ? place : null;
  if (readyLive !== heldPlace) setHeldPlace(readyLive);
  // The border place whose Polish side has failed (and is not back yet): its automatic tries keep
  // Overpass's whole-circle answer on screen. On the first load the Polish side is awaited.
  const [polishFailed, setPolishFailed] = useState<string | null>(null);
  const failedHere =
    place !== null && stat.coverage === 'partial' && stat.status !== 'ready' && (stat.status === 'error' || polishFailed === place) ? place : null;
  if (failedHere !== polishFailed) setPolishFailed(failedHere);

  // Keep the device's trail within its week, whichever source this visit uses.
  useEffect(() => {
    const s = storage();
    dropLegacyCaches(s);
    const now = Date.now();
    pruneCache(s, now, OSM_KEY);
    pruneCache(s, now, SHOPS_KEY);
  }, []);

  // Read as a store, so that going offline or back changes the words below at once.
  const online = useOnline();

  const state = useMemo<OsmState>(() => {
    const extra = { coverage: stat.coverage, dataAsOf: stat.dataAsOf, olderLeaves: stat.olderLeaves };
    /** The app's data alone, in its own words: no server to wait for, only the connection. */
    const own = (): OsmState => ({
      status: stat.status,
      items: stat.items,
      completeWithin: stat.completeWithin,
      error: stat.status === 'error' ? (online ? NETWORK : stat.items.length > 0 ? OFFLINE_REST : OFFLINE) : null,
      savedAt: null,
      since: stat.status === 'loading' ? stat.since : null,
      retryAt: stat.retryAt,
      ...extra,
      source: 'static',
      shown: 'static',
    });
    if (stat.coverage === 'partial' && stat.failure !== 'unavailable') {
      // At the border: the Polish side at once, the whole circle once Overpass has answered it.
      // Overpass's ready answer for this very place, out to the radius: once the Polish side has
      // failed here (and while it is tried again), even an empty one says what is there — nothing, on
      // either side (the same rules over the same map), not a failure to fetch nor a „Szukam…” with
      // every try of the app's data. On its first load the app's own side is awaited.
      const whole = live.status === 'ready' && liveHere && live.completeWithin >= radius;
      const polishOut = stat.status === 'error' || failedHere !== null;
      const useLive = live.completeWithin >= stat.completeWithin && (live.items.length > 0 || (whole && polishOut));
      if (!(useLive && live.status === 'ready') && stat.status === 'ready' && stat.completeWithin >= radius) {
        // Overpass is asked when the ROUNDED circle comes near the border, but around the exact
        // position the app's data may already be complete: then nothing is missing, whatever
        // Overpass does — no error, no countdown, no „Szukam…” over a whole list.
        return {
          status: 'ready',
          items: stat.items,
          completeWithin: stat.completeWithin,
          error: null,
          savedAt: null,
          since: null,
          retryAt: null,
          ...extra,
          source: 'mixed',
          shown: 'static',
        };
      }
      // Overpass's answer (or a saved one, with its age) covers at least as much: it is what is shown.
      if (useLive) return { ...live, ...extra, source: 'mixed', shown: 'live' };
      // The Polish side itself failed: that is what is wrong here, said as away from the border —
      // not that the Polish side is on screen. The button tries it again (and Overpass, if its
      // search has failed too).
      if (stat.status === 'error') return own();
      // The Polish side, whatever Overpass does meanwhile: still looking while it loads (Overpass's
      // countdown may show under it), then Overpass's state for the rest of the circle.
      const loading = stat.status === 'loading';
      return {
        status: loading ? 'loading' : live.status,
        items: stat.items,
        completeWithin: stat.completeWithin,
        error: loading ? null : live.error,
        // A saved Overpass answer's age belongs to its items only.
        savedAt: null,
        since: live.since,
        retryAt: live.retryAt,
        ...extra,
        source: 'mixed',
        shown: 'static',
        // While the Polish side loads, the words say whether the map server is still being asked.
        rest: live.status === 'ready' && liveHere ? 'done' : !online || live.status === 'error' ? 'failed' : 'asking',
      };
    }
    if (goLive || holding) return { ...live, ...extra, source: 'live', shown: 'live' };
    return own();
  }, [stat, live, liveHere, goLive, holding, radius, online, failedHere]);

  // The diary's digest: the shops of a complete answer, for the circle it covers.
  const complete = state.status === 'ready' && state.completeWithin >= radius;
  const circle = state.shown === 'static' ? stat.circle : asked;
  // The circle's numbers, not its identity: a new object for the same place writes nothing new.
  const cLat = circle?.lat;
  const cLon = circle?.lon;
  const cRadius = circle?.radius;
  const items = state.items;
  useEffect(() => {
    if (!complete || cLat === undefined || cLon === undefined || cRadius === undefined) return;
    writeCache(storage(), { lat: cLat, lon: cLon, radius: cRadius }, shopsOf(items), Date.now(), SHOPS_KEY);
  }, [complete, cLat, cLon, cRadius, items]);

  // „Spróbuj ponownie” tries whatever failed: the app's data (its index too — Overpass may be
  // standing in for it) and Overpass once its search has ended in failure. Not a search still
  // running or waiting out a pause the server asked for — at the border the button shows for a
  // failed Polish side meanwhile: a new search would throw away the answer on its way, or ask a busy
  // server again before its pause is over.
  const staticSide = stat.failure !== null || state.source === 'static';
  const liveFailed = goLive && live.status === 'error';
  const retry = useCallback(() => {
    if (staticSide) retryStatic();
    if (liveFailed) retryLive();
  }, [staticSide, liveFailed, retryStatic, retryLive]);
  return [state, retry];
}
