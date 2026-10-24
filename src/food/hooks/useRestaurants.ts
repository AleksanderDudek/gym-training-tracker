import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Chain } from '../restaurants/types';

export type RestaurantsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; chains: Chain[] };

/** Stan menu lokali i ponowna próba po błędzie. */
export type RestaurantsResult = RestaurantsState & { retry: () => void };

let loaded: Chain[] | null = null;
let pending: Promise<Chain[]> | null = null;

/**
 * A try that fails sooner than this after „Spróbuj ponownie” never reached the server: the browser
 * answered with the import it keeps failed (Chromium, WebKit) — a real attempt takes a round trip.
 */
const KEPT_FAILURE_MS = 250;

/**
 * Reloads the page if that can work: a page the service worker serves reloads even offline; any
 * other only when the server answers (else it would end on the browser's error page). `false`: not
 * reloaded.
 */
async function reloadIfReachable(): Promise<boolean> {
  if (!globalThis.navigator?.serviceWorker?.controller) {
    try {
      await fetch(location.href.split('#')[0]!, { method: 'HEAD', cache: 'no-store' });
    } catch {
      return false;
    }
  }
  location.reload();
  return true;
}

/**
 * Menu sieci leżą we własnej paczce (`restaurants/catalog`): dziennik rysuje się bez nich, a ich
 * kilkadziesiąt kilobajtów przychodzi przy pierwszym wyszukiwaniu albo wejściu w Lokale — raz na
 * życie strony. Nieudane wczytanie (np. offline przed pierwszym zapisaniem paczki) nie zostaje
 * zapamiętane tutaj, ale pamięta je przeglądarka: Chromium i WebKit trzymają nieudany import paczki
 * do końca życia strony, więc kolejny `import()` odrzuca od razu, bez pytania serwera (Firefox pyta
 * jeszcze raz). „Spróbuj ponownie” (`retry`) próbuje więc najpierw na miejscu, a gdy przeglądarka
 * odmówi od ręki — przeładowuje stronę (widok jest w adresie, ręcznie wybrane miejsce pamięta karta).
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
  /** When „Spróbuj ponownie” started the try under way (`null`: not a retry). */
  const retried = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    const pressed = retried.current;
    retried.current = null;
    loadRestaurants().then(
      (chains) => {
        if (live) setState({ status: 'ready', chains });
      },
      () => {
        if (!live) return;
        // Refused at once, without the server: only a reload brings the menus (online — offline the
        // try in place is all there is).
        const kept = pressed !== null && Date.now() - pressed < KEPT_FAILURE_MS && globalThis.navigator?.onLine !== false;
        if (!kept) return setState({ status: 'error' });
        void reloadIfReachable().then((reloading) => {
          if (!reloading && live) setState({ status: 'error' });
        });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    retried.current = Date.now();
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
