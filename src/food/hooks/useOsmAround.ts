import { useEffect, useMemo } from 'react';
import { say } from '../../i18n';
import { SHOPS_KEY, writeCache, type ShopCache } from '../nearby/cache';
import { OSM_KEY, dropLegacyCaches, fetchOsm } from '../nearby/live';
import { shopsOf, type Element } from '../nearby/overpass';
import { queryCircle } from '../nearby/query';
import type { GeoState } from './useGeolocation';
import { useAround, type AroundState } from './useNearbyShops';

/** Where the elements on screen come from — said under the map, next to the © line. */
export type OsmSource = 'live';

export interface OsmState extends AroundState<Element> {
  source: OsmSource;
}

const FAILED = say(
  'Nie udało się pobrać lokali i sklepów. Sprawdź połączenie z internetem.',
  'Couldn’t load the places and shops. Check your internet connection.',
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
 * „Zjedz teraz” and „Zakupy i przepisy” neither asks again nor cancels a request in flight.
 *
 * A complete answer also leaves the shops around this place for the diary's suggestions
 * (`produkty-pl:shops`, read by `useNearbyChains` without asking anyone).
 */
export function useOsmAround(geo: GeoState, radius: number): [OsmState, () => void] {
  const [live, retry] = useAround<Element>(geo.position, radius, fetchOsm, OSM_KEY, FAILED);

  useEffect(() => dropLegacyCaches(storage()), []);

  const position = geo.position;
  const complete = live.status === 'ready' && live.completeWithin >= radius;
  useEffect(() => {
    if (!complete || !position) return;
    writeCache(storage(), queryCircle(position, radius), shopsOf(live.items), Date.now(), SHOPS_KEY);
  }, [complete, position, radius, live.items]);

  const state = useMemo<OsmState>(() => ({ ...live, source: 'live' }), [live]);
  return [state, retry];
}
