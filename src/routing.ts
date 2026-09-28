import { useEffect, useState } from 'react';
import type { IconName } from './components/icons';
import type { ExerciseId, Route, TabKey } from './types';

/**
 * Trasy trzymają się w części hash adresu, bo GitHub Pages serwuje wyłącznie pliki
 * statyczne — ścieżka `/cwiczenia/swing2` wróciłaby jako 404. Hash nie trafia na serwer,
 * więc jeden `index.html` obsługuje każdą podstronę, a ścieżka dokumentu zostaje ta sama
 * i względne adresy zasobów (`base: './'`) dalej się rozwiązują.
 */

/**
 * Zakładki dolnego paska. Sześć, nie siedem: przy siedmiu na ekranie 320 px na pozycję
 * wypada 45 px, czyli poniżej minimum 44 px z wytycznych Apple i 48 px z Material Design,
 * a etykiety trzeba ścisnąć do 9,5 px. Ustawienia schodzą do nagłówka — to ekran otwierany
 * raz na miesiąc, a dolny pasek jest od miejsc odwiedzanych codziennie.
 */
export const TABS: { key: TabKey; label: string; path: string; icon: IconName }[] = [
  { key: 'train', label: 'Twoja sesja', path: '#/sesja', icon: 'session' },
  { key: 'plan', label: 'Plan', path: '#/plan', icon: 'plan' },
  { key: 'work', label: 'Treningi', path: '#/treningi', icon: 'workouts' },
  { key: 'prog', label: 'Profil', path: '#/profil', icon: 'profile' },
  { key: 'ach', label: 'Osiągnięcia', path: '#/osiagniecia', icon: 'awards' },
  { key: 'atlas', label: 'Atlas', path: '#/cwiczenia', icon: 'atlas' },
];

/** Ustawienia mają własny przycisk w nagłówku — poza dolnym paskiem, ale wciąż jeden klik. */
export const SETTINGS_PATH = '#/ustawienia';

const TAB_BY_PATH: Record<string, TabKey> = {
  sesja: 'train',
  // Stary adres zakładki. Zostaje, żeby zapisane linki i zakładki przeglądarki dalej działały.
  trening: 'train',
  plan: 'plan',
  profil: 'prog',
  // Stary adres zakładki poziomów. Zapisane linki prowadzą teraz do profilu, w którym
  // te same liczby siedzą przy historii, zamiast obok niej.
  poziomy: 'prog',
  osiagniecia: 'ach',
  treningi: 'work',
  ustawienia: 'set',
};

export const exercisePath = (id: ExerciseId): string => `#/cwiczenia/${encodeURIComponent(id)}`;

/** Historia ćwiczenia w profilu. Osobny adres, więc da się ją wysłać albo zapisać. */
export const statsPath = (id: ExerciseId): string => `#/profil/${encodeURIComponent(id)}`;

/**
 * Przekąski ruchowe. Bez własnej zakładki — siódma zeszłaby poniżej 44 px celu dotykowego —
 * więc mają adresy i wejścia z ekranu sesji, profilu i podstrony ćwiczenia. Dwa widoki:
 * historia pod `#/przekaski` i zapis jednej przekąski. Zapis z identyfikatorem otwiera się
 * od razu z tym ćwiczeniem — tak wyglądały dawne linki, więc dalej prowadzą do celu.
 */
export const snacksPath = (): string => '#/przekaski';

export const snackAddPath = (id?: ExerciseId): string =>
  id ? `#/przekaski/${encodeURIComponent(id)}` : '#/przekaski/dodaj';

/** Czy od uruchomienia była już jakaś zmiana trasy w aplikacji. */
let movedInApp = false;

/**
 * Powrót tam, skąd ktoś przyszedł — po zapisie przekąski na ekran sesji, do atlasu albo do
 * historii ćwiczenia. Przycisk „wstecz” przeglądarki zna tę drogę lepiej niż jakakolwiek
 * zapamiętana ścieżka. Gdy ktoś otworzył adres wprost, historii w aplikacji nie ma i cofnięcie
 * wyprowadziłoby go ze strony, więc wtedy idzie na ekran zapasowy.
 */
export const goBack = (fallback: string): void => {
  if (movedInApp && window.history.length > 1) window.history.back();
  else go(fallback);
};

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, second] = parts;
  if (!head) return { kind: 'tab', tab: 'train' };
  if (head === 'cwiczenia') return second ? { kind: 'exercise', id: second } : { kind: 'atlas' };
  if (head === 'profil' && second) return { kind: 'exstats', id: second };
  if (head === 'przekaski') {
    if (!second) return { kind: 'snacks' };
    return second === 'dodaj' ? { kind: 'snackAdd' } : { kind: 'snackAdd', id: second };
  }
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
      movedInApp = true;
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

/**
 * Który przycisk nawigacji ma być podświetlony. Podstrona ćwiczenia należy do atlasu,
 * a jego historia do profilu — ten sam ruch, dwa różne pytania. Przekąski należą do sesji:
 * to ta sama odpowiedź na pytanie „co robię dzisiaj”, tylko w mniejszej porcji.
 */
export const activeTab = (route: Route): TabKey =>
  route.kind === 'tab'
    ? route.tab
    : route.kind === 'exstats'
      ? 'prog'
      : route.kind === 'snacks' || route.kind === 'snackAdd'
        ? 'train'
        : 'atlas';
