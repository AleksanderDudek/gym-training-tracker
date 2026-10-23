import { useEffect, useMemo } from 'react';
import { say } from '../../i18n';
import { SHOPS_KEY, writeCache, type ShopCache } from '../nearby/cache';
import { OSM_KEY, dropLegacyCaches, fetchOsm } from '../nearby/live';
import { shopsOf, type Element } from '../nearby/overpass';
import { queryCircle } from '../nearby/query';
import type { GeoState } from './useGeolocation';
import { useAround, type AroundState } from './useNearbyShops';
import { useStaticAround, type Coverage } from './useStaticAround';

/**
 * Where the elements on screen come from — said under the map, next to the © line:
 * the app's own copy of the data, Overpass live, or both (the Polish side of a border circle from
 * the copy, the rest live).
 */
export type OsmSource = 'static' | 'live' | 'mixed';

export interface OsmState extends AroundState<Element> {
  source: OsmSource;
  coverage: Coverage;
  /** The date of the app's copy of the data (ISO), when it is in use. */
  dataAsOf: string | null;
  /** Some of the area is from the previous data version (the new one could not be fetched). */
  olderLeaves: boolean;
}

const FAILED = say(
  'Nie udało się pobrać lokali i sklepów. Sprawdź połączenie z internetem.',
  'Couldn’t load the places and shops. Check your internet connection.',
);
const OFFLINE = say(
  'Bez internetu nie mam jeszcze danych tej okolicy — pobiorę je, gdy wróci połączenie.',
  'Offline, I don’t have this area’s data yet — I’ll load it when you’re back online.',
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
  const [stat, retryStatic] = useStaticAround(geo.position, radius);
  const goLive =
    stat.coverage === 'off' || stat.coverage === 'none' || stat.coverage === 'partial' || stat.failure === 'unavailable';
  const [live, retryLive] = useAround<Element>(goLive ? geo.position : null, radius, fetchOsm, OSM_KEY, FAILED);

  useEffect(() => dropLegacyCaches(storage()), []);

  const state = useMemo<OsmState>(() => {
    const extra = { coverage: stat.coverage, dataAsOf: stat.dataAsOf, olderLeaves: stat.olderLeaves };
    if (stat.coverage === 'partial' && stat.failure !== 'unavailable') {
      // At the border: the Polish side at once, the whole circle once Overpass has answered it.
      const useLive = live.completeWithin >= stat.completeWithin && live.items.length > 0;
      return {
        ...live,
        ...extra,
        items: useLive ? live.items : stat.items,
        completeWithin: useLive ? live.completeWithin : stat.completeWithin,
        source: 'mixed',
      };
    }
    if (goLive) return { ...live, ...extra, source: 'live' };
    const offline = globalThis.navigator?.onLine === false;
    return {
      status: stat.status,
      items: stat.items,
      completeWithin: stat.completeWithin,
      error: stat.status === 'error' ? (offline ? OFFLINE : NETWORK) : null,
      savedAt: null,
      since: stat.status === 'loading' ? stat.since : null,
      retryAt: stat.retryAt,
      ...extra,
      source: 'static',
    };
  }, [stat, live, goLive]);

  // The diary's digest: the shops of a complete answer, for the circle it covers.
  const position = geo.position;
  const complete = state.status === 'ready' && state.completeWithin >= radius;
  const circle = state.source === 'static' ? stat.circle : position ? queryCircle(position, radius) : null;
  // The circle's numbers, not its identity: a new object for the same place writes nothing new.
  const cLat = circle?.lat;
  const cLon = circle?.lon;
  const cRadius = circle?.radius;
  const items = state.items;
  useEffect(() => {
    if (!complete || cLat === undefined || cLon === undefined || cRadius === undefined) return;
    writeCache(storage(), { lat: cLat, lon: cLon, radius: cRadius }, shopsOf(items), Date.now(), SHOPS_KEY);
  }, [complete, cLat, cLon, cRadius, items]);

  const retry = goLive ? retryLive : retryStatic;
  return [state, retry];
}
