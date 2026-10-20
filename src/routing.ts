import { useEffect, useState } from 'react';
import type { IconName } from './components/icons';
import { hashPath } from './food/hash';
import type { CardioSport, DietPage, ExerciseId, FoodSection, Route, TabKey } from './types';

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
 * aplikacji. Trening ma trzy sekcje z przełącznikiem u góry: Plan, Treningi i Ćwiczenia —
 * wszystkie trzy odpowiadają na pytanie „co trenuję”, a dzisiejszy termin i tak stoi na
 * ekranie Dziś. Połączenie Planu z Treningami zwolniło miejsce na Jedzenie bez szóstej
 * zakładki, która zeszłaby poniżej celu dotykowego. Jedzenie ma cztery sekcje: Dziennik,
 * Przepisy, Produkty i W pobliżu. Ustawienia siedzą w pasku aplikacji, bo otwiera się je raz
 * na miesiąc.
 *
 * `path` to stały korzeń zakładki. Trening i Jedzenie wracają do ostatniej sekcji, więc ich
 * odnośnik w pasku liczy `tabHref` przy każdym renderze.
 */
export const TABS: { key: TabKey; label: string; path: string; icon: IconName }[] = [
  { key: 'train', label: 'Dziś', path: '#/sesja', icon: 'session' },
  { key: 'work', label: 'Trening', path: '#/treningi', icon: 'workouts' },
  { key: 'food', label: 'Jedzenie', path: '#/jedzenie', icon: 'food' },
  { key: 'ach', label: 'Osiągnięcia', path: '#/osiagniecia', icon: 'awards' },
  { key: 'prog', label: 'Profil', path: '#/profil', icon: 'profile' },
];

/** Ustawienia mają własny przycisk w pasku aplikacji — poza dolnym paskiem, ale wciąż jeden klik. */
export const SETTINGS_PATH = '#/ustawienia';

/** Plakat polecający aplikację — z ustawień i z profilu. */
export const PROMO_PATH = '#/polec';

const TAB_BY_PATH: Record<string, TabKey> = {
  sesja: 'train',
  // Stary adres zakładki. Zostaje, żeby zapisane linki i zakładki przeglądarki dalej działały.
  trening: 'train',
  // Stary adres zakładki Plan — dziś sekcja Treningu pod tym samym adresem.
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

/** Atlas ćwiczeń — trzecia sekcja zakładki Trening. */
export const ATLAS_PATH = '#/cwiczenia';

/**
 * Zakładka Jedzenie: dziennik (z podstronami planu posiłków, postępu i profilu diety), przepisy,
 * produkty i sklepy w pobliżu. Stan strony — wyszukiwanie, filtry, otwarty produkt — siedzi
 * w zapytaniu wewnątrz hasha (`#/produkty?q=skyr`), więc trasa go nie widzi.
 */
export const FOOD_PATH = '#/jedzenie';
export const RECIPES_PATH = '#/przepisy';
export const PRODUCTS_PATH = '#/produkty';
export const NEARBY_PATH = '#/w-poblizu';

/**
 * Lokale — menu sieci gastronomicznych z wartościami odżywczymi. Podstrona Produktów (ze strzałką
 * wstecz), a nie piąta sekcja: pięć pozycji przełącznika nie mieści się na ekranie 320 px.
 */
export const RESTAURANTS_PATH = '#/lokale';
export const restaurantPath = (chain: string): string => `${RESTAURANTS_PATH}/${encodeURIComponent(chain)}`;

/** Trasy zakładki Jedzenie: sekcje, podstrony dziennika i lokale. */
export type FoodRoute = Extract<Route, { kind: 'food' } | { kind: 'diet' } | { kind: 'restaurants' }>;
export const isFoodRoute = (route: Route): route is FoodRoute =>
  route.kind === 'food' || route.kind === 'diet' || route.kind === 'restaurants';

/** Korzeń każdej sekcji jedzenia. */
export const FOOD_SECTION_PATH: Record<FoodSection, string> = {
  diary: FOOD_PATH,
  recipes: RECIPES_PATH,
  products: PRODUCTS_PATH,
  nearby: NEARBY_PATH,
};

const FOOD_BY_PATH = Object.fromEntries(
  Object.entries(FOOD_SECTION_PATH).map(([k, v]) => [v.slice(2), k as FoodSection]),
) as Record<string, FoodSection>;

const DIET_SLUG: Record<DietPage, string> = { plan: 'plan', progress: 'postep', profile: 'profil', shopping: 'zakupy' };

const DIET_BY_SLUG = Object.fromEntries(Object.entries(DIET_SLUG).map(([k, v]) => [v, k as DietPage])) as Record<
  string,
  DietPage
>;

export const dietPath = (page: DietPage): string => `${FOOD_PATH}/${DIET_SLUG[page]}`;

const FOOD_TITLE: Record<FoodSection, string> = {
  diary: 'Jedzenie',
  recipes: 'Przepisy',
  products: 'Produkty',
  nearby: 'W pobliżu',
};

const DIET_TITLE: Record<DietPage, string> = {
  plan: 'Plan posiłków',
  progress: 'Postęp',
  profile: 'Profil diety',
  shopping: 'Lista zakupów',
};

/** Pozycja przełącznika sekcji: adres korzenia sekcji i jej nazwa. */
export interface SectionLink {
  path: string;
  label: string;
}

/**
 * Sekcje zakładek, w kolejności przełącznika u góry ekranu. Korzeń sekcji zachowuje się jak
 * korzeń zakładki: bez strzałki wstecz, z pamięcią przewinięcia, a zakładka do niego wraca.
 */
export const SECTIONS: Record<'work' | 'food', readonly SectionLink[]> = {
  work: [
    { path: '#/plan', label: 'Plan' },
    { path: '#/treningi', label: 'Treningi' },
    { path: ATLAS_PATH, label: 'Ćwiczenia' },
  ],
  food: [
    { path: FOOD_PATH, label: 'Dziennik' },
    { path: RECIPES_PATH, label: 'Przepisy' },
    { path: PRODUCTS_PATH, label: 'Produkty' },
    { path: NEARBY_PATH, label: 'W pobliżu' },
  ],
};

/** Podgląd treningu: ćwiczenia z seriami, mięśnie, doradca i start. */
export const workoutPath = (id: string): string => `#/treningi/${encodeURIComponent(id)}`;

/**
 * Kreator: pusty albo z kopią gotowego treningu. `add` — ćwiczenie do dopisania na wejściu
 * (z atlasu: „Dodaj do treningu”); bez kopii w miejscu treningu stoi „-”.
 */
export const workoutNewPath = (from?: string, add?: string): string =>
  add
    ? `#/treningi/nowy/${from ? encodeURIComponent(from) : '-'}/${encodeURIComponent(add)}`
    : from
      ? `#/treningi/nowy/${encodeURIComponent(from)}`
      : '#/treningi/nowy';

export const workoutEditPath = (id: string, add?: string): string =>
  `#/treningi/${encodeURIComponent(id)}/edytuj${add ? `/${encodeURIComponent(add)}` : ''}`;

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
 * Kroki, bieżnia, rower i taniec. Też bez zakładki, z tych samych powodów co przekąski: historia
 * pod `#/cardio` i zapis pod `#/cardio/kroki`, `#/cardio/bieznia`, `#/cardio/rower`,
 * `#/cardio/taniec` — adres mówi, co się wpisuje, więc skrót z ekranu Dziś otwiera od razu
 * właściwy formularz.
 */
export const cardioPath = (): string => '#/cardio';

const SPORT_SLUG: Record<CardioSport, string> = {
  steps: 'kroki',
  treadmill: 'bieznia',
  bike: 'rower',
  dance: 'taniec',
};

export const cardioAddPath = (sport: CardioSport = 'steps'): string => `#/cardio/${SPORT_SLUG[sport]}`;

const SPORT_BY_SLUG = Object.fromEntries(
  Object.entries(SPORT_SLUG).map(([k, v]) => [v, k as CardioSport]),
) as Record<string, CardioSport>;

/** Nazwa formularza w pasku aplikacji — to, co się wpisuje. */
export const SPORT_TITLE: Record<CardioSport, string> = {
  steps: 'Kroki',
  treadmill: 'Bieżnia',
  bike: 'Rower',
  dance: 'Taniec',
};

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
  food: { title: 'Jedzenie', parent: null },
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
      // Sekcja zakładki Trening — przełącznik u góry ekranu, więc bez strzałki wstecz.
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
    case 'promo':
      return { title: 'Poleć znajomym', parent: SETTINGS_PATH };
    case 'food':
      return { title: FOOD_TITLE[route.section], parent: null };
    case 'diet':
      // Lista zakupów należy do planu, z którego powstała: strzałka wraca do niego, nie do dziennika.
      return { title: DIET_TITLE[route.page], parent: route.page === 'shopping' ? dietPath('plan') : FOOD_PATH };
    case 'restaurants':
      // Nazwa sieci stoi dużą czcionką w treści — w pasku, jak przy ćwiczeniu, rodzaj strony.
      return route.chain ? { title: 'Menu', parent: RESTAURANTS_PATH } : { title: 'Lokale', parent: PRODUCTS_PATH };
  }
}

const HOME = '#/sesja';

/**
 * Ścieżka trasy: hash bez zapytania, z pustym sprowadzonym do ekranu Dziś. Zapytanie to stan
 * strony (filtry, otwarty produkt), więc o tym, czy to „ten sam ekran”, decyduje sama ścieżka.
 */
const norm = (hash: string): string => {
  const path = hashPath(hash);
  return path && path !== '#/' && path !== '#' ? path : HOME;
};

/** Bieżący adres bez zapytania, z pustym sprowadzonym do ekranu Dziś. */
export const currentPath = (): string => norm(window.location.hash);

const ROOTS = new Set([...TABS.map((t) => t.path), ...SECTIONS.work.map((s) => s.path), ...SECTIONS.food.map((s) => s.path)]);

/** Czy adres to korzeń zakładki albo jej sekcji — tam przewinięcie się pamięta. */
export const isTabRoot = (hash: string): boolean => ROOTS.has(norm(hash));

/** Zakładka, której sekcją jest ten adres; `null` dla podstron i zakładek bez sekcji. */
const sectionTab = (hash: string): 'work' | 'food' | null => {
  const path = norm(hash);
  if (SECTIONS.work.some((s) => s.path === path)) return 'work';
  if (SECTIONS.food.some((s) => s.path === path)) return 'food';
  return null;
};

/*
 * Pamięć sekcji — jak osobny stos na zakładkę w iOS. Każda sekcja pamięta swój ostatni adres
 * razem z zapytaniem (produkty wracają z wyszukiwaniem i filtrami, jak w Produktach PL), a każda
 * zakładka — swoją ostatnią sekcję: Trening otwiera się tam, gdzie ktoś go zostawił. Kopia
 * w `sessionStorage` przetrwa przeładowanie strony, ale nie zamknięcie karty: nowa wizyta zaczyna
 * od sekcji domyślnych. Bez dostępu do pamięci przeglądarki (tryb prywatny, testy w node) pamięć
 * zostaje tylko w tej wizycie.
 */
const SECTIONS_KEY = 'gt:sections';

interface SectionMemory {
  /** Ostatnia sekcja zakładki — ścieżka jej korzenia. */
  tabs: Partial<Record<'work' | 'food', string>>;
  /** Ostatni pełny adres sekcji (z zapytaniem) pod ścieżką jej korzenia. */
  hashes: Record<string, string>;
}

function readSections(): SectionMemory {
  const memo: SectionMemory = { tabs: {}, hashes: {} };
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(SECTIONS_KEY) ?? 'null') as Partial<SectionMemory> | null;
    // Tylko korzenie sekcji, każdy pod własną ścieżką i w swojej zakładce — ręcznie zmieniony
    // zapis nie przeniesie nikogo gdzie indziej.
    for (const [path, hash] of Object.entries(raw?.hashes ?? {})) {
      if (typeof hash === 'string' && hash.startsWith('#/') && sectionTab(path) && norm(hash) === path) memo.hashes[path] = hash;
    }
    for (const [tab, path] of Object.entries(raw?.tabs ?? {})) {
      if (typeof path === 'string' && sectionTab(path) === tab && norm(path) === path) memo.tabs[tab as 'work' | 'food'] = path;
    }
  } catch {
    // Zepsuty zapis albo brak dostępu — zaczynamy od sekcji domyślnych.
  }
  return memo;
}

const memory = readSections();

function saveSections(): void {
  try {
    window.sessionStorage.setItem(SECTIONS_KEY, JSON.stringify(memory));
  } catch {
    // Pamięć przeglądarki niedostępna — zostaje pamięć tej wizyty.
  }
}

/** Zapamiętuje adres, jeśli to korzeń sekcji; podstrony i zakładki bez sekcji nic nie zmieniają. */
export function rememberSection(hash: string): void {
  const tab = sectionTab(hash);
  if (!tab) return;
  const path = norm(hash);
  if (memory.hashes[path] === hash && memory.tabs[tab] === path) return;
  memory.hashes[path] = hash;
  memory.tabs[tab] = path;
  saveSections();
}

/** Zapomina sekcje — kolejne wejście w zakładkę idzie do sekcji domyślnej, bez zapamiętanych filtrów. */
export function forgetSections(): void {
  memory.tabs = {};
  memory.hashes = {};
  saveSections();
}

/** Adres sekcji z jej ostatnim stanem w zapytaniu — dokąd prowadzi pozycja przełącznika sekcji. */
export const sectionHref = (path: string): string => memory.hashes[path] ?? path;

/**
 * Dokąd prowadzi zakładka w dolnym pasku. Trening i Jedzenie — do ostatniej sekcji (z jej
 * zapytaniem), a za pierwszym razem do domyślnej: Plan, gdy plan trwa (stamtąd widać kolejny
 * termin), inaczej Treningi; Jedzenie — Dziennik. Pozostałe zakładki mają stały adres.
 */
export function tabHref(key: TabKey, opts: { hasPlan: boolean }): string {
  if (key === 'work') return sectionHref(memory.tabs.work ?? (opts.hasPlan ? '#/plan' : '#/treningi'));
  if (key === 'food') return sectionHref(memory.tabs.food ?? FOOD_PATH);
  return TABS.find((t) => t.key === key)?.path ?? HOME;
}

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
  const parts = hashPath(hash).replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
  const [head, second] = parts;
  if (!head) return { kind: 'tab', tab: 'train' };
  // Nieznana podstrona dziennika prowadzi do samego dziennika — adres zostaje w swojej zakładce.
  if (head === 'jedzenie' && second && Object.hasOwn(DIET_BY_SLUG, second)) return { kind: 'diet', page: DIET_BY_SLUG[second]! };
  if (Object.hasOwn(FOOD_BY_PATH, head)) return { kind: 'food', section: FOOD_BY_PATH[head]! };
  if (head === 'lokale') return { kind: 'restaurants', chain: second ?? null };
  if (head === 'cwiczenia') return second ? { kind: 'exercise', id: second } : { kind: 'atlas' };
  if (head === 'profil' && second) return { kind: 'exstats', id: second };
  if (head === 'przekaski') {
    if (!second) return { kind: 'snacks' };
    return second === 'dodaj' ? { kind: 'snackAdd' } : { kind: 'snackAdd', id: second };
  }
  if (head === 'treningi' && second) {
    const third = parts[2];
    const add = parts[3];
    if (second === 'nowy') return { kind: 'workoutEdit', from: third === '-' ? undefined : third, add };
    return third === 'edytuj' ? { kind: 'workoutEdit', id: second, add } : { kind: 'workout', id: second };
  }
  if (head === 'plany') {
    const third = parts[2];
    if (!second) return { kind: 'plans' };
    if (second === 'klasyczny') return { kind: 'planClassic' };
    if (second === 'nowy') return { kind: 'planEdit' };
    return third === 'edytuj' ? { kind: 'planEdit', id: second } : { kind: 'planDetail', id: second };
  }
  if (head === 'polec') return { kind: 'promo' };
  if (head === 'cardio') {
    if (!second) return { kind: 'cardio' };
    // Nieznany rodzaj otwiera kroki — zapis zawsze ma dokąd prowadzić. `hasOwn`, bo ręcznie
    // wpisane `#/cardio/constructor` trafiłoby inaczej w prototyp obiektu zamiast w zapas.
    return { kind: 'cardioAdd', sport: Object.hasOwn(SPORT_BY_SLUG, second) ? SPORT_BY_SLUG[second] : 'steps' };
  }
  // `hasOwn`, bo ręcznie wpisane `#/constructor` trafiłoby w prototyp obiektu zamiast w zapas.
  const tab = Object.hasOwn(TAB_BY_PATH, head) ? TAB_BY_PATH[head] : undefined;
  return tab ? { kind: 'tab', tab } : { kind: 'tab', tab: 'train' };
}

/**
 * Zmiana trasy przez hash, więc przycisk „wstecz” w przeglądarce działa bez dodatkowego kodu.
 * `top` zapomina zapamiętane przewinięcie celu — po starcie treningu albo planu ekran ma się
 * zacząć od góry, a nie tam, gdzie ktoś zostawił go przed chwilą w innym stanie.
 */
export const go = (path: string, opts?: { top?: boolean; replace?: boolean }): void => {
  if (opts?.top) scrollMemo.delete(norm(path));
  // Cały adres, a nie sama ścieżka: `go('#/jedzenie?dodaj=1')` z dziennika to zmiana stanu strony
  // (router ją przepuści, strona przeczyta ją z `popstate`), a nie powtórzenie bieżącego adresu.
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
    // Ta sama ścieżka z innym zapytaniem nie trafi na stos tras, więc nie ma czego zdejmować.
    if (norm(path) !== currentPath()) trail.pop();
    window.location.replace(path);
    return;
  }
  window.location.hash = path;
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    if (!trail.length) trail.push(norm(window.location.hash));
    rememberSection(window.location.hash);
    const onChange = (e: HashChangeEvent) => {
      movedInApp = true;
      const old = new URL(e.oldURL).hash;
      const from = norm(old);
      const to = norm(window.location.hash);
      // Stary adres z zapytaniem, jakie miał w chwili wyjścia: strony jedzenia zmieniają je bez
      // `hashchange` (`replaceState`), a `oldURL` niesie już tę podmienioną wersję — dopiero tu
      // widać, z jakimi filtrami ktoś wyszedł.
      rememberSection(old);
      rememberSection(window.location.hash);
      // Ta sama strona, inny stan w zapytaniu — np. „wstecz” zamyka kartę produktu. To nie jest
      // przejście: bez wpisu na stos tras, bez przewijania i bez nowej trasy (zapytania trasa nie
      // czyta). Nowy stan strona czyta sama, z `popstate`.
      if (from === to) return;
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
 * Który przycisk nawigacji ma być podświetlony. Plan z katalogiem i kreatorem planów, atlas,
 * podstrona ćwiczenia, podgląd i kreator treningu należą do Treningu; historia ćwiczenia do
 * profilu — ten sam ruch, dwa różne pytania. Przekąski i kroki należą do ekranu Dziś: to ta
 * sama odpowiedź na pytanie „co robię dzisiaj”. Sekcje i podstrony diety — do Jedzenia.
 */
export function activeTab(route: Route): TabKey {
  switch (route.kind) {
    case 'tab':
      return route.tab === 'atlas' || route.tab === 'plan' ? 'work' : route.tab;
    case 'exstats':
    case 'promo':
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
    case 'atlas':
    case 'exercise':
    case 'workout':
    case 'workoutEdit':
      return 'work';
    case 'food':
    case 'diet':
    case 'restaurants':
      return 'food';
  }
}
