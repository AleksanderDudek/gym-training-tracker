import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Chain } from '../restaurants/types';

export type RestaurantsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; chains: Chain[] };

/** Stan menu lokali i ponowna próba po błędzie. */
export type RestaurantsResult = RestaurantsState & { retry: () => void };

let loaded: Chain[] | null = null;
let pending: Promise<Chain[]> | null = null;

/**
 * Menu sieci leżą we własnej paczce (`restaurants/catalog`): dziennik rysuje się bez nich, a ich
 * kilkadziesiąt kilobajtów przychodzi przy pierwszym wyszukiwaniu albo wejściu w Lokale — raz na
 * życie strony. Nieudane wczytanie (np. offline przed pierwszym zapisaniem paczki) nie zostaje
 * zapamiętane, więc „Spróbuj ponownie” pyta jeszcze raz.
 */
export function loadRestaurants(): Promise<Chain[]> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('../restaurants/catalog').then(
    (m) => (loaded = m.CHAINS),
    (error: unknown) => {
      pending = null;
      throw error;
    },
  );
  return pending;
}

export function useRestaurants(): RestaurantsResult {
  const [state, setState] = useState<RestaurantsState>(() =>
    loaded ? { status: 'ready', chains: loaded } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadRestaurants().then(
      (chains) => {
        if (live) setState({ status: 'ready', chains });
      },
      () => {
        if (live) setState({ status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
