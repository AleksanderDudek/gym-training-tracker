/**
 * Wygląd: jasny albo ciemny.
 *
 * Wybór leży w tej przeglądarce (`localStorage`), tak jak język — nie w kopii danych, bo telefon
 * z ciemnym systemem i jasny laptop to dwa różne ekrany tej samej osoby. Bez wyboru aplikacja idzie
 * za systemem (`prefers-color-scheme`).
 *
 * Kolory robi arkusz, nie ten moduł. „Automatycznie” to brak atrybutu `data-theme` na `<html>`
 * i blok `@media (prefers-color-scheme: dark)` w `styles.css` — działa od pierwszej klatki, zanim
 * wczyta się jakikolwiek skrypt. Wybór z ustawień to `data-theme="light"` albo `"dark"`, stawiany
 * przy starcie modułu (`main.tsx` wczytuje go pierwszy), przed pierwszym renderem Reacta.
 *
 * Zmiana działa od razu, bez przeładowania: wystarczy przestawić atrybut, a reszta (pasek
 * systemowy, wykresy) słucha zdarzenia `kb-theme`.
 */

import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'auto' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Klucz w localStorage: wybór z ustawień. Brak — za systemem. */
export const THEME_KEY = 'kb-theme';

/** Zdarzenie na `window` po każdej zmianie motywu (wybór albo system). */
export const THEME_EVENT = 'kb-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Kolory paska systemowego (`meta theme-color`) — te same co tokeny `--bg` i `--surface`
 * w obu motywach. Test (`theme.test.ts`) pilnuje, żeby nie rozjechały się z arkuszem.
 */
export const TOP_COLORS: Record<Theme, { bg: string; surface: string }> = {
  light: { bg: '#D7D9D3', surface: '#FAFAF8' },
  dark: { bg: '#101311', surface: '#1C201D' },
};

const isExplicit = (v: unknown): v is Theme => v === 'light' || v === 'dark';

/** Zapisany wybór; bez localStorage (tryb prywatny, blokada) — „automatycznie”. */
export function savedTheme(): ThemeChoice {
  try {
    const v = globalThis.localStorage?.getItem(THEME_KEY);
    return isExplicit(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Czy system prosi o ciemny wygląd. Bez `matchMedia` (Node, stare przeglądarki) — nie. */
export function systemDark(): boolean {
  try {
    return !!globalThis.matchMedia?.(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** Motyw, który naprawdę widać: wybór albo system. */
export const resolveTheme = (choice: ThemeChoice, dark: boolean): Theme =>
  choice === 'auto' ? (dark ? 'dark' : 'light') : choice;

/** Motyw w tej chwili. */
export const currentTheme = (): Theme => resolveTheme(savedTheme(), systemDark());

/**
 * Stawia wybór na `<html>`. „Automatycznie” zdejmuje atrybut — wtedy rządzi zapytanie o system
 * w arkuszu, więc zmiana w systemie przechodzi bez skryptu.
 */
export function applyTheme(choice: ThemeChoice = savedTheme()): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** Zapisuje wybór, stawia go od razu i daje znać słuchaczom. */
export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Bez localStorage wybór działa do końca wizyty, ale nie przetrwa przeładowania.
  }
  applyTheme(choice);
  notify();
}

const notify = () => globalThis.dispatchEvent?.(new Event(THEME_EVENT));

/**
 * Słucha zmian motywu: wyboru w ustawieniach i przełączenia w systemie (zachód słońca, tryb
 * nocny). Zwraca funkcję, która przestaje słuchać.
 */
export function onThemeChange(cb: () => void): () => void {
  globalThis.addEventListener?.(THEME_EVENT, cb);
  let mq: MediaQueryList | undefined;
  try {
    mq = globalThis.matchMedia?.(DARK_QUERY);
  } catch {
    mq = undefined;
  }
  mq?.addEventListener?.('change', cb);
  return () => {
    globalThis.removeEventListener?.(THEME_EVENT, cb);
    mq?.removeEventListener?.('change', cb);
  };
}

/**
 * Kolor paska systemowego. W `index.html` stoją dwa znaczniki z `media` — jasny i ciemny — żeby
 * przed skryptem pasek szedł za systemem. Wybór z ustawień nie musi się z systemem zgadzać, więc
 * po starcie zostaje jeden znacznik bez `media`, z kolorem ustawionym wprost.
 */
export function setThemeColor(color: string): void {
  const doc = globalThis.document;
  if (!doc) return;
  const metas = [...doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
  let meta = metas.shift();
  metas.forEach((m) => m.remove());
  if (!meta) {
    meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.appendChild(meta);
  }
  meta.removeAttribute('media');
  meta.setAttribute('content', color);
}

/** Motyw w komponencie — przelicza się po zmianie wyboru i po przełączeniu systemu. */
export function useTheme(): Theme {
  return useSyncExternalStore(onThemeChange, currentTheme, () => 'light');
}

/** Wybór z ustawień w komponencie (karta „Wygląd”). */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(onThemeChange, savedTheme, () => 'auto');
}
