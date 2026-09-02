import { useEffect, useState } from 'react';
import type { ExerciseId, Route, TabKey } from './types';

/**
 * Trasy trzymają się w części hash adresu, bo GitHub Pages serwuje wyłącznie pliki
 * statyczne — ścieżka `/cwiczenia/swing2` wróciłaby jako 404. Hash nie trafia na serwer,
 * więc jeden `index.html` obsługuje każdą podstronę, a ścieżka dokumentu zostaje ta sama
 * i względne adresy zasobów (`base: './'`) dalej się rozwiązują.
 */

export const TABS: { key: TabKey; label: string; path: string }[] = [
  { key: 'train', label: 'Trening', path: '#/trening' },
  { key: 'prog', label: 'Poziomy', path: '#/poziomy' },
  { key: 'work', label: 'Treningi', path: '#/treningi' },
  { key: 'atlas', label: 'Atlas', path: '#/cwiczenia' },
  { key: 'set', label: 'Ustawienia', path: '#/ustawienia' },
];

const TAB_BY_PATH: Record<string, TabKey> = {
  trening: 'train',
  poziomy: 'prog',
  treningi: 'work',
  ustawienia: 'set',
};

export const exercisePath = (id: ExerciseId): string => `#/cwiczenia/${encodeURIComponent(id)}`;

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, second] = parts;
  if (!head) return { kind: 'tab', tab: 'train' };
  if (head === 'cwiczenia') return second ? { kind: 'exercise', id: second } : { kind: 'atlas' };
  const tab = TAB_BY_PATH[head];
  return tab ? { kind: 'tab', tab } : { kind: 'tab', tab: 'train' };
}

/** Zmiana trasy przez hash, więc przycisk „wstecz” w przeglądarce działa bez dodatkowego kodu. */
export const go = (path: string): void => {
  if (window.location.hash === path) return;
  window.location.hash = path;
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

/** Który z pięciu przycisków nawigacji ma być podświetlony. */
export const activeTab = (route: Route): TabKey =>
  route.kind === 'tab' ? route.tab : 'atlas';
