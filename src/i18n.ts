/**
 * Języki aplikacji: polski i angielski.
 *
 * Język wybiera się raz, przy starcie strony: zapisany wybór z ustawień, a bez niego — pierwszy
 * obsługiwany z języków przeglądarki (`navigator.languages`). Przeglądarka w innym języku dostaje
 * angielski: łatwiej przeczytać go Niemcowi niż polski. Zmiana w ustawieniach zapisuje wybór
 * i przeładowuje stronę — stan i tak leży w zapisie, a stały język na całą wizytę pozwala liczyć
 * teksty także w modułach silnika i w stałych na poziomie modułu, bez przekazywania języka przez
 * każdy komponent.
 *
 * Teksty mieszkają w katalogach dwujęzycznych przy kodzie, który ich używa:
 *
 *     const T = text({
 *       pl: { save: 'Zapisz', left: (n: number) => `${n} ${plural(n, 'krok', 'kroki', 'kroków')}` },
 *       en: { save: 'Save', left: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}` },
 *     });
 *
 * Połowa angielska musi mieć dokładnie ten sam kształt co polska — brak klucza, klucz nadmiarowy
 * albo inna funkcja to błąd kompilacji. Trzeci język to trzecia połowa w każdym katalogu.
 */

export type Lang = 'pl' | 'en';

export const LANGS: readonly Lang[] = ['pl', 'en'];

/** Nazwy języków w nich samych — tak szuka ich ktoś, kto nie zna drugiego. */
export const LANG_NAMES: Record<Lang, string> = { pl: 'Polski', en: 'English' };

/** Klucz w localStorage: wybór z ustawień. Brak — język przeglądarki. */
export const LANG_KEY = 'kb-lang';

declare global {
  /** Język wymuszony z zewnątrz — tylko testy (`src/test/setup.ts`, `vi.hoisted`). */
  var __KB_LANG__: Lang | undefined;
}

const isLang = (v: unknown): v is Lang => v === 'pl' || v === 'en';

/** Zapisany wybór albo `null` — bez localStorage (tryb prywatny, blokada) też `null`. */
export function savedLang(): Lang | null {
  try {
    const v = globalThis.localStorage?.getItem(LANG_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Pierwszy obsługiwany język z listy przeglądarki („pl-PL” to polski); żaden — angielski. */
export function detectLang(languages: readonly string[] | undefined): Lang {
  for (const l of languages ?? []) {
    const base = l.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

const browserLanguages = (): readonly string[] => {
  const nav = globalThis.navigator;
  if (!nav) return [];
  return nav.languages?.length ? nav.languages : nav.language ? [nav.language] : [];
};

/** Język tej wizyty. */
export const LANG: Lang = globalThis.__KB_LANG__ ?? savedLang() ?? detectLang(browserLanguages());

/** Czy język idzie za przeglądarką (nic nie wybrano w ustawieniach). */
export const LANG_AUTO = globalThis.__KB_LANG__ === undefined && savedLang() === null;

/**
 * Locale do `Intl` i `toLocaleString`. Angielski brytyjski: system metryczny, data dzień–miesiąc
 * i tydzień od poniedziałku — jak w reszcie aplikacji.
 */
export const LOCALE = LANG === 'pl' ? 'pl-PL' : 'en-GB';

/** Zapisuje wybór (`null` — za przeglądarką) i przeładowuje stronę w nowym języku. */
export function setLang(lang: Lang | null): void {
  try {
    if (lang) localStorage.setItem(LANG_KEY, lang);
    else localStorage.removeItem(LANG_KEY);
  } catch {
    // Bez localStorage wybór nie przetrwa przeładowania — zostaje język przeglądarki.
  }
  // Przez `globalThis`: moduł czytają też skrypty w Node (`scripts/food`), bez typów DOM.
  (globalThis as { location?: { reload(): void } }).location?.reload();
}

/** Połowa katalogu w języku tej wizyty. Angielska musi mieć kształt polskiej. */
export function text<T>(catalog: { pl: T; en: NoInfer<T> }): T {
  return catalog[LANG];
}

/** Wartość w języku tej wizyty — do pojedynczych słów poza katalogiem. */
export const say = (pl: string, en: string): string => (LANG === 'pl' ? pl : en);

/** Angielska liczba mnoga: 1 step, 0 i 2 steps. */
export const pluralEn = (n: number, one: string, other: string): string => (Math.abs(n) === 1 ? one : other);

/** Liczba w formacie tego języka: „1 234,5” po polsku, „1,234.5” po angielsku. */
export const num = (n: number, digits = 0): string =>
  n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });
