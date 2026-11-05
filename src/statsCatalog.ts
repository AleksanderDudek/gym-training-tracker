/**
 * Anonimowe statystyki: ZAMKNIĘTA lista zdarzeń i ich wartości.
 *
 * To jedyne, co aplikacja może wysłać, i jedyne, co serwer przyjmie (`server/api/stats.ts`
 * importuje ten plik). Każde zdarzenie to para „nazwa · wartość” z tej listy — bez tekstu
 * wpisanego przez użytkownika, bez liczb z jego danych (waga, kalorie, wyniki), bez identyfikatora
 * urządzenia i bez adresu strony. Serwer tylko dolicza 1 do licznika dnia; pojedynczych zdarzeń
 * nie przechowuje, więc nie da się odtworzyć niczyjej ścieżki.
 *
 * Nowe zdarzenie = nowy wpis tutaj + zdanie w polityce prywatności (`public/privacy.html`)
 * i w opisie w Ustawieniach (`STATS_LABEL` niżej). Plik bez importów — ładuje go też Worker.
 */

/** Ekrany: rodzaj trasy, bez identyfikatorów (ćwiczenie z biblioteki albo z katalogu, nie które). */
export const SCREENS = [
  'tab-train',
  'tab-prog',
  'tab-work',
  'tab-set',
  'tab-atlas',
  'tab-plan',
  'tab-ach',
  'tab-food',
  'atlas',
  'exercise-library',
  'exercise-catalog',
  'exstats',
  'snacks',
  'snackAdd',
  'workout',
  'workoutEdit',
  'plans',
  'planClassic',
  'planDetail',
  'planEdit',
  'cardio',
  'cardioAdd',
  'promo',
  'health',
  'calendar',
  'food-diary',
  'food-recipes',
  'food-products',
  'food-nearby',
  'diet-plan',
  'diet-plans',
  'diet-progress',
  'diet-profile',
  'diet-shopping',
  'diet-labs',
  'restaurants',
  'link',
  'linkInvite',
  'linkConnection',
  'linkAssignment',
] as const;

export const STATS_EVENTS = {
  /** Raz dziennie: urządzenie było aktywne — zainstalowana aplikacja albo przeglądarka. */
  open: ['pwa', 'web'],
  /** Raz dziennie: język aplikacji. */
  lang: ['pl', 'en'],
  /** Raz w tygodniu: w ilu dniach poprzedniego tygodnia aplikacja była otwarta (przedział). */
  week: ['1', '2', '3-4', '5-7'],
  /** Raz dziennie: które funkcje są w użyciu (tak/nie, bez szczegółów). */
  uses: ['plan', 'watch', 'phone', 'reminders', 'catalog'],
  /** Wejście na ekran. */
  screen: SCREENS,
  /** Trening rozpoczęty / zamknięty — w trybie prowadzonym albo na liście. */
  workout_start: ['guided', 'list'],
  workout_finish: ['guided', 'list'],
  /** Otwarty arkusz „Jak to zrobić?” — przy serii, w przerwie, na liście. */
  technique: ['set', 'rest', 'list'],
  /** Otwarty katalog ćwiczeń w atlasie. */
  catalog_view: ['-'],
  /** Ćwiczenie z katalogu dodane — z wyboru w kreatorze albo ze strony ćwiczenia. */
  catalog_add: ['picker', 'page'],
} as const satisfies Record<string, readonly string[]>;

export type StatsEvent = keyof typeof STATS_EVENTS;
export type StatsValue<E extends StatsEvent> = (typeof STATS_EVENTS)[E][number];

/** Najwięcej zdarzeń w jednej paczce — więcej nie wyjdzie z jednej wizyty. */
export const STATS_BATCH_MAX = 60;

export const validStatsPair = (e: unknown, v: unknown): boolean =>
  typeof e === 'string' &&
  typeof v === 'string' &&
  Object.hasOwn(STATS_EVENTS, e) &&
  (STATS_EVENTS[e as StatsEvent] as readonly string[]).includes(v);
