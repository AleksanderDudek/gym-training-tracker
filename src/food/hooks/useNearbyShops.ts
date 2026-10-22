import { useCallback, useEffect, useState } from 'react';
import { say } from '../../i18n';
import { PLACES_KEY, pruneCache, readCache, writeCache, type Circle, type ShopCache } from '../nearby/cache';
import { distanceMeters } from '../nearby/geo';
import { OverpassUnavailable, fetchShops, type FetchOptions } from '../nearby/overpass';
import { fetchPlaces, type Place } from '../nearby/places';
import { queryCircle } from '../nearby/query';
import type { LatLon, Shop } from '../nearby/types';

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
}

export interface ShopsState extends Omit<AroundState<Shop>, 'items'> {
  shops: Shop[];
}

interface Fetched<T> {
  status: ShopsStatus;
  items: T[];
  /** The circle these items were fetched for. */
  circle: Circle | null;
  error: string | null;
}

/** One empty list, so "nothing valid" does not change identity every render. */
const NOTHING: never[] = [];

/** Slider drags and map moves settle before a request goes to a busy server. */
const SETTLE_MS = 400;

function storage(): ShopCache | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Fetcher<T> = (center: LatLon, radius: number, options: FetchOptions) => Promise<T[]>;

/**
 * Something from Overpass around a position. What is sent and cached is the QUERY circle:
 * a centre rounded to ~100 m plus a margin, so the exact position never leaves
 * the device and a short walk reuses the same answer.
 */
export function useAround<T>(
  position: LatLon | null,
  radius: number,
  fetcher: Fetcher<T>,
  cacheKey: string | undefined,
  failed: string,
): [AroundState<T>, () => void] {
  const [fetched, setFetched] = useState<Fetched<T>>({ status: 'idle', items: [], circle: null, error: null });
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
          setFetched({ status: 'ready', items: hit, circle: { ...center, radius }, error: null });
          return;
        }
        setFetched((f) => ({ ...f, status: 'loading', error: null }));
        try {
          const items = await fetcher(circle, circle.radius, { signal: controller.signal });
          writeCache(storage(), circle, items, Date.now(), cacheKey);
          setFetched({ status: 'ready', items, circle, error: null });
        } catch (error) {
          if (controller.signal.aborted) return;
          const message = error instanceof OverpassUnavailable ? error.message : failed;
          setFetched((f) => ({ ...f, status: 'error', error: message }));
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

  // Within what distance of HERE is the last answer complete? Items fetched
  // for another place are not shown for this one (after a move they would name
  // a far shop as "the nearest"), but a smaller answer at the same place stays
  // on screen while a wider one loads - it used to vanish, for a 10 km query
  // that can take half a minute.
  const completeWithin =
    fetched.circle && lat !== undefined && lon !== undefined
      ? Math.min(radius, Math.max(0, fetched.circle.radius - distanceMeters(fetched.circle, { lat, lon })))
      : 0;
  return [
    {
      status: fetched.status,
      items: completeWithin > 0 ? fetched.items : NOTHING,
      completeWithin,
      error: fetched.error,
    },
    retry,
  ];
}

const SHOPS_FAILED = say(
  'Nie udało się pobrać sklepów. Sprawdź połączenie z internetem.',
  'Couldn’t load the shops. Check your internet connection.',
);
const PLACES_FAILED = say(
  'Nie udało się pobrać lokali. Sprawdź połączenie z internetem.',
  'Couldn’t load the places. Check your internet connection.',
);

/** Grocery shops around a position („Zakupy i przepisy”). */
export function useNearbyShops(position: LatLon | null, radius: number): [ShopsState, () => void] {
  const [{ items, ...rest }, retry] = useAround(position, radius, fetchShops, undefined, SHOPS_FAILED);
  return [{ ...rest, shops: items }, retry];
}

/** Restaurants, cafés, petrol stations and grocery shops around a position („Zjedz teraz”). */
export function useNearbyPlaces(position: LatLon | null, radius: number): [AroundState<Place>, () => void] {
  return useAround(position, radius, fetchPlaces, PLACES_KEY, PLACES_FAILED);
}
