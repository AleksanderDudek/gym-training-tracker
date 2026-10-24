import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Chain } from '../restaurants/types';

export type RestaurantsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; chains: Chain[] };

/** Stan menu lokali i ponowna próba po błędzie. */
export type RestaurantsResult = RestaurantsState & { retry: () => void };

let loaded: Chain[] | null = null;
let pending: Promise<Chain[]> | null = null;
/** The chunk's import has failed on this page: in Chromium and WebKit it stays failed until a reload. */
let importFailed = false;

/**
 * Menu sieci leżą we własnej paczce (`restaurants/catalog`): dziennik rysuje się bez nich, a ich
 * kilkadziesiąt kilobajtów przychodzi przy pierwszym wyszukiwaniu albo wejściu w Lokale — raz na
 * życie strony. Nieudane wczytanie (np. offline przed pierwszym zapisaniem paczki) nie zostaje
 * zapamiętane tutaj, ale pamięta je przeglądarka: Chromium i WebKit trzymają nieudany import paczki
 * do końca życia strony, więc kolejny `import()` odrzuca od razu, bez pytania serwera (Firefox pyta
 * jeszcze raz). Pomaga dopiero przeładowanie strony — robi je „Spróbuj ponownie” (`retry`).
 */
export function loadRestaurants(): Promise<Chain[]> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import('../restaurants/catalog').then(
    (m) => {
      importFailed = false;
      return (loaded = m.CHAINS);
    },
    (error: unknown) => {
      pending = null;
      importFailed = true;
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
    // The import already failed on this page: asking again would fail at once, without the server
    // (Chromium, WebKit). Online, a reload brings the menus — the screen is in the address. Offline,
    // a page the service worker does not serve yet would reload into the browser's error page: try in
    // place (Firefox does ask again).
    if (importFailed && globalThis.navigator?.onLine !== false) {
      window.location.reload();
      return;
    }
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
