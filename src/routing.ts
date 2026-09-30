import { useEffect, useState } from 'react';
import type { IconName } from './components/icons';
import type { CardioSport, ExerciseId, Route, TabKey } from './types';

/**
 * Trasy trzymają się w części hash adresu, bo GitHub Pages serwuje wyłącznie pliki
 * statyczne — ścieżka `/cwiczenia/swing2` wróciłaby jako 404. Hash nie trafia na serwer,
 * więc jeden `index.html` obsługuje każdą podstronę, a ścieżka dokumentu zostaje ta sama
 * i względne adresy zasobów (`base: './'`) dalej się rozwiązują.
 */

/**
 * Zakładki dolnego paska. Pięć, bo tyle przewidują i wytyczne Material 3 („od trzech do
 * pięciu”), i Apple HIG (najwyżej pięć na iPhonie) — przy pięciu każda pozycja ma na ekranie
 * 320 px 64 px szerokości, a etykieta mieści się w jednym słowie.
 *
 * Kolejność idzie od codziennego do okazjonalnego, a profil stoi na końcu, jak w większości
 * aplikacji. Treningi mają zakładkę, odkąd są czymś więcej niż listą czterech zestawów:
 * biblioteka podziałów i partii, podgląd i kreator z doradcą. Atlas ćwiczeń wszedł do tej
 * samej zakładki jako druga sekcja — trening to zestaw ćwiczeń, a obie listy odpowiadają na
 * pytanie „co mogę zrobić”. Ustawienia siedzą w pasku aplikacji, bo otwiera się je raz na miesiąc.
 */
export const TABS: { key: TabKey; label: string; path: string; icon: IconName }[] = [
  { key: 'train', label: 'Dziś', path: '#/sesja', icon: 'session' },
  { key: 'work', label: 'Treningi', path: '#/treningi', icon: 'workouts' },
  { key: 'plan', label: 'Plan', path: '#/plan', icon: 'plan' },
  { key: 'ach', label: 'Osiągnięcia', path: '#/osiagniecia', icon: 'awards' },
  { key: 'prog', label: 'Profil', path: '#/profil', icon: 'profile' },
];

/** Ustawienia mają własny przycisk w pasku aplikacji — poza dolnym paskiem, ale wciąż jeden klik. */
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

/** Atlas ćwiczeń — druga sekcja zakładki Treningi. */
export const ATLAS_PATH = '#/cwiczenia';

/** Podgląd treningu: ćwiczenia z seriami, mięśnie, doradca i start. */
export const workoutPath = (id: string): string => `#/treningi/${encodeURIComponent(id)}`;

/** Kreator: pusty albo z kopią gotowego treningu. */
export const workoutNewPath = (from?: string): string =>
  from ? `#/treningi/nowy/${encodeURIComponent(from)}` : '#/treningi/nowy';

export const workoutEditPath = (id: string): string => `#/treningi/${encodeURIComponent(id)}/edytuj`;

/** Katalog planów, konfigurator klasyczny, podgląd planu i kreator. */
export const PLANS_PATH = '#/plany';
export const PLAN_CLASSIC_PATH = '#/plany/klasyczny';
export const PLAN_NEW_PATH = '#/plany/nowy';
export const planPath = (id: string): string => `#/plany/${encodeURIComponent(id)}`;
export const planEditPath = (id: string): string => `#/plany/${encodeURIComponent(id)}/edytuj`;

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

/**
 * Kroki, bieżnia i rower. Też bez zakładki, z tych samych powodów co przekąski: historia pod
 * `#/cardio` i zapis pod `#/cardio/kroki`, `#/cardio/bieznia`, `#/cardio/rower` — adres mówi,
 * co się wpisuje, więc skrót z ekranu Dziś otwiera od razu właściwy formularz.
 */
export const cardioPath = (): string => '#/cardio';

const SPORT_SLUG: Record<CardioSport, string> = { steps: 'kroki', treadmill: 'bieznia', bike: 'rower' };

export const cardioAddPath = (sport: CardioSport = 'steps'): string => `#/cardio/${SPORT_SLUG[sport]}`;

const SPORT_BY_SLUG = Object.fromEntries(
  Object.entries(SPORT_SLUG).map(([k, v]) => [v, k as CardioSport]),
) as Record<string, CardioSport>;

/** Nazwa formularza w pasku aplikacji — to, co się wpisuje. */
export const SPORT_TITLE: Record<CardioSport, string> = { steps: 'Kroki', treadmill: 'Bieżnia', bike: 'Rower' };

/** Czy od uruchomienia była już jakaś zmiana trasy w aplikacji. */
let movedInApp = false;

/** Ekran: tytuł w pasku aplikacji i dokąd prowadzi strzałka wstecz. Zakładki nie mają rodzica. */
export interface Screen {
  title: string;
  parent: string | null;
}

const TAB_SCREEN: Record<TabKey, Screen> = {
  train: { title: 'Dziś', parent: null },
  plan: { title: 'Plan', parent: null },
  atlas: { title: 'Atlas', parent: null },
  ach: { title: 'Osiągnięcia', parent: null },
  prog: { title: 'Profil', parent: null },
  work: { title: 'Treningi', parent: null },
  set: { title: 'Ustawienia', parent: '#/profil' },
};

/**
 * Tytuł i rodzic ekranu. Podstrona ćwiczenia nosi w pasku nazwę rodzaju, a nie ćwiczenia:
 * nazwa stoi dużą czcionką w treści, a powtórzona w pasku byłaby tą samą informacją dwa razy.
 */
export function screenOf(route: Route): Screen {
  switch (route.kind) {
    case 'tab':
      return TAB_SCREEN[route.tab];
    case 'atlas':
      // Druga sekcja zakładki Treningi — przełącznik u góry ekranu, więc bez strzałki wstecz.
      return { title: 'Ćwiczenia', parent: null };
    case 'workout':
      return { title: 'Trening', parent: '#/treningi' };
    case 'workoutEdit':
      return { title: route.id ? 'Edycja treningu' : 'Nowy trening', parent: '#/treningi' };
    case 'plans':
      return { title: 'Plany', parent: '#/plan' };
    case 'planClassic':
      return { title: 'Plan klasyczny', parent: PLANS_PATH };
    case 'planDetail':
      return { title: 'Plan', parent: PLANS_PATH };
    case 'planEdit':
      return { title: route.id ? 'Edycja planu' : 'Nowy plan', parent: PLANS_PATH };
    case 'exercise':
      return { title: 'Ćwiczenie', parent: '#/cwiczenia' };
    case 'exstats':
      return { title: 'Twoja historia', parent: '#/profil' };
    case 'snacks':
      return { title: 'Przekąski', parent: '#/sesja' };
    case 'snackAdd':
      return { title: 'Przekąska', parent: '#/sesja' };
    case 'cardio':
      return { title: 'Kroki i cardio', parent: '#/sesja' };
    case 'cardioAdd':
      return { title: SPORT_TITLE[route.sport ?? 'steps'], parent: '#/sesja' };
  }
}

const HOME = '#/sesja';
const norm = (hash: string): string => (hash && hash !== '#/' && hash !== '#' ? hash : HOME);

/** Bieżący adres, z pustym sprowadzonym do ekranu Dziś. */
export const currentPath = (): string => norm(window.location.hash);

/** Czy adres to korzeń zakładki albo jej sekcji — tam przewinięcie się pamięta. */
export const isTabRoot = (hash: string): boolean =>
  TABS.some((t) => t.path === norm(hash)) || norm(hash) === ATLAS_PATH;

/*
 * Pamięć przewinięcia. Każda zakładka wraca tam, gdzie ktoś ją zostawił, a powrót strzałką
 * z podstrony wraca na to samo miejsce listy — tak działają paski zakładek w iOS i Material.
 * Wejście w nową podstronę zaczyna się od góry. Wstecz rozpoznajemy po własnym stosie
 * adresów: zdarzenie `popstate` przeglądarki odpala się różnie przy zmianie samego hasha.
 */
const scrollMemo = new Map<string, number>();
const trail: string[] = [];

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

/**
 * Powrót tam, skąd ktoś przyszedł — po zapisie przekąski na ekran sesji, do atlasu albo do
 * historii ćwiczenia. Przycisk „wstecz” przeglądarki zna tę drogę lepiej niż jakakolwiek
 * zapamiętana ścieżka. Gdy ktoś otworzył adres wprost, historii w aplikacji nie ma i cofnięcie
 * wyprowadziłoby go ze strony, więc wtedy idzie na ekran zapasowy.
 */
export const goBack = (fallback: string): void => {
  // O cofnięciu decyduje własny stos tras, a nie `history.length`: po wejściu z linku
  // i jednym kroku wstecz historia przeglądarki ma dwa wpisy, ale w aplikacji nie ma już
  // dokąd wrócić — kolejne `back()` nic by nie zrobiło albo wyprowadziło ze strony.
  if (movedInApp && trail.length > 1) window.history.back();
  else go(fallback);
};

export function parseHash(hash: string): Route {
  // Ręcznie zepsuty adres (`%E0%A4%A`) nie może wywrócić aplikacji — zostaje wtedy surowy fragment.
  const decode = (x: string): string => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x;
    }
  };
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
  const [head, second] = parts;
  if (!head) return { kind: 'tab', tab: 'train' };
  if (head === 'cwiczenia') return second ? { kind: 'exercise', id: second } : { kind: 'atlas' };
  if (head === 'profil' && second) return { kind: 'exstats', id: second };
  if (head === 'przekaski') {
    if (!second) return { kind: 'snacks' };
    return second === 'dodaj' ? { kind: 'snackAdd' } : { kind: 'snackAdd', id: second };
  }
  if (head === 'treningi' && second) {
    const third = parts[2];
    if (second === 'nowy') return { kind: 'workoutEdit', from: third };
    return third === 'edytuj' ? { kind: 'workoutEdit', id: second } : { kind: 'workout', id: second };
  }
  if (head === 'plany') {
    const third = parts[2];
    if (!second) return { kind: 'plans' };
    if (second === 'klasyczny') return { kind: 'planClassic' };
    if (second === 'nowy') return { kind: 'planEdit' };
    return third === 'edytuj' ? { kind: 'planEdit', id: second } : { kind: 'planDetail', id: second };
  }
  if (head === 'cardio') {
    if (!second) return { kind: 'cardio' };
    // Nieznany rodzaj otwiera kroki — zapis zawsze ma dokąd prowadzić. `hasOwn`, bo ręcznie
    // wpisane `#/cardio/constructor` trafiłoby inaczej w prototyp obiektu zamiast w zapas.
    return { kind: 'cardioAdd', sport: Object.hasOwn(SPORT_BY_SLUG, second) ? SPORT_BY_SLUG[second] : 'steps' };
  }
  const tab = TAB_BY_PATH[head];
  return tab ? { kind: 'tab', tab } : { kind: 'tab', tab: 'train' };
}

/**
 * Zmiana trasy przez hash, więc przycisk „wstecz” w przeglądarce działa bez dodatkowego kodu.
 * `top` zapomina zapamiętane przewinięcie celu — po starcie treningu albo planu ekran ma się
 * zacząć od góry, a nie tam, gdzie ktoś zostawił go przed chwilą w innym stanie.
 */
export const go = (path: string, opts?: { top?: boolean; replace?: boolean }): void => {
  if (opts?.top) scrollMemo.delete(norm(path));
  if (window.location.hash === path) return;
  // Zapis z kreatora zastępuje kreator w historii: „wstecz” z podglądu nie ma wracać do
  // formularza, który właśnie się zamknął.
  if (opts?.replace) {
    // Cel jest tym samym ekranem, z którego się przyszło (podgląd → edycja → zapis): cofnięcie
    // zamiast podmiany, inaczej w historii zostałyby dwa takie same wpisy pod rząd.
    if (trail.length > 1 && trail[trail.length - 2] === norm(path)) {
      window.history.back();
      return;
    }
    trail.pop();
    window.location.replace(path);
    return;
  }
  window.location.hash = path;
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    if (!trail.length) trail.push(norm(window.location.hash));
    const onChange = (e: HashChangeEvent) => {
      movedInApp = true;
      const from = norm(new URL(e.oldURL).hash);
      const to = norm(window.location.hash);
      scrollMemo.set(from, window.scrollY);
      const back = trail.length > 1 && trail[trail.length - 2] === to;
      if (back) trail.pop();
      else trail.push(to);
      setRoute(parseHash(window.location.hash));
      const y = back || isTabRoot(to) ? (scrollMemo.get(to) ?? 0) : 0;
      // Dwie klatki: w pierwszej React podmienia ekran, w drugiej jest już co przewijać.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

/**
 * Który przycisk nawigacji ma być podświetlony. Atlas, podstrona ćwiczenia, podgląd i kreator
 * treningu należą do Treningów; historia ćwiczenia do profilu — ten sam ruch, dwa różne
 * pytania. Katalog i kreator planów należą do Planu. Przekąski i kroki należą do ekranu Dziś:
 * to ta sama odpowiedź na pytanie „co robię dzisiaj”.
 */
export function activeTab(route: Route): TabKey {
  switch (route.kind) {
    case 'tab':
      return route.tab === 'atlas' ? 'work' : route.tab;
    case 'exstats':
      return 'prog';
    case 'snacks':
    case 'snackAdd':
    case 'cardio':
    case 'cardioAdd':
      return 'train';
    case 'plans':
    case 'planClassic':
    case 'planDetail':
    case 'planEdit':
      return 'plan';
    case 'atlas':
    case 'exercise':
    case 'workout':
    case 'workoutEdit':
      return 'work';
  }
}
