import { useCallback, useEffect, useState } from 'react';
import { pruneCache, readCache, writeCache, type Circle, type ShopCache } from '../nearby/cache';
import { distanceMeters } from '../nearby/geo';
import { OverpassUnavailable, fetchShops } from '../nearby/overpass';
import { queryCircle } from '../nearby/query';
import type { LatLon, Shop } from '../nearby/types';

export type ShopsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ShopsState {
  status: ShopsStatus;
  /** Shops that are valid around the CURRENT position - never ones fetched for another place. */
  shops: Shop[];
  /**
   * How far from the current position `shops` is COMPLETE. Equal to the radius
   * once the answer for it has arrived; smaller while a wider search runs (the
   * earlier, smaller answer is still true, just not the whole picture); 0 when
   * nothing fetched covers this place.
   */
  completeWithin: number;
  error: string | null;
}

interface Fetched {
  status: ShopsStatus;
  shops: Shop[];
  /** The circle these shops were fetched for. */
  circle: Circle | null;
  error: string | null;
}

/** One empty list, so "no valid shops" does not change identity every render. */
const NO_SHOPS: Shop[] = [];

/** Slider drags and map moves settle before a request goes to a busy server. */
const SETTLE_MS = 400;

function storage(): ShopCache | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Shops around a position. What is sent and cached is the QUERY circle:
 * a centre rounded to ~100 m plus a margin, so the exact position never leaves
 * the device and a short walk reuses the same answer.
 */
export function useNearbyShops(position: LatLon | null, radius: number): [ShopsState, () => void] {
  const [fetched, setFetched] = useState<Fetched>({ status: 'idle', shops: [], circle: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const lat = position?.lat;
  const lon = position?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined) return;
    const center = { lat, lon };
    const now = Date.now();
    pruneCache(storage(), now);
    const hit = readCache(storage(), center, radius, now);
    const circle = queryCircle(center, radius);
    const controller = new AbortController();
    // A cached answer is applied on the next tick; a request waits for the
    // slider or the map to settle.
    const timer = setTimeout(
      async () => {
        if (hit) {
          setFetched({ status: 'ready', shops: hit, circle: { ...center, radius }, error: null });
          return;
        }
        setFetched((f) => ({ ...f, status: 'loading', error: null }));
        try {
          const shops = await fetchShops(circle, circle.radius, { signal: controller.signal });
          writeCache(storage(), circle, shops, Date.now());
          setFetched({ status: 'ready', shops, circle, error: null });
        } catch (error) {
          if (controller.signal.aborted) return;
          const message =
            error instanceof OverpassUnavailable
              ? error.message
              : 'Nie udało się pobrać sklepów. Sprawdź połączenie z internetem.';
          setFetched((f) => ({ ...f, status: 'error', error: message }));
        }
      },
      hit ? 0 : SETTLE_MS,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lon, radius, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Within what distance of HERE is the last answer complete? Shops fetched
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
      shops: completeWithin > 0 ? fetched.shops : NO_SHOPS,
      completeWithin,
      error: fetched.error,
    },
    retry,
  ];
}
