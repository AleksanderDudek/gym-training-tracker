import { API_URL, apiConfigured } from './api';
import { LANG } from './i18n';
import { STATS_BATCH_MAX } from './statsCatalog';
import type { StatsEvent, StatsValue } from './statsCatalog';
import { isCatalogId } from './data/catalog/derive';
import type { AppState, Route } from './types';

/**
 * Anonimowe statystyki — tylko za zgodą, tylko pary z `statsCatalog.ts`.
 *
 * Czego tu nie ma i nie będzie: identyfikatora urządzenia, ciasteczek, adresu strony, tekstu
 * z ekranu, nagrywania sesji, liczb z danych użytkownika. Zgoda i lista dni z aplikacją leżą
 * w localStorage tego urządzenia (lista tylko przy włączonej zgodzie, do przedziału „dni
 * w tygodniu” liczonego tutaj) — na serwer idzie sam przedział.
 *
 * Paczka leci jako `text/plain`: to zwykłe zapytanie bez wstępnego CORS, więc działa też przez
 * `sendBeacon` przy zamykaniu strony. Bez serwera (`VITE_API_URL`) i przy włączonym w przeglądarce
 * Global Privacy Control nic się nie wysyła, a pytania o zgodę nie ma.
 */

const CONSENT_KEY = 'gt:stats';
const DAYS_KEY = 'gt:stats-days';

export type Consent = 'on' | 'off' | null;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* bez pamięci urządzenia statystyki po prostu milczą */
  }
};

/** Global Privacy Control — przeglądarka mówi „nie”, więc nawet nie pytamy. */
export const gpc = (): boolean =>
  typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

/** Czy w ogóle jest o co pytać: serwer jest, a przeglądarka nie zabrania. */
export const statsAvailable = (): boolean => apiConfigured() && !gpc();

export function consent(): Consent {
  const v = read(CONSENT_KEY);
  return v === 'on' || v === 'off' ? v : null;
}

const queue: [string, string][] = [];

export function setConsent(v: 'on' | 'off'): void {
  write(CONSENT_KEY, v);
  if (v === 'off') {
    queue.length = 0;
    write(DAYS_KEY, null);
  } else daily.last = '';
}

const enabled = (): boolean => statsAvailable() && consent() === 'on';

/** Jedno zdarzenie z zamkniętej listy. Typ nie przepuści niczego innego. */
export function track<E extends StatsEvent>(event: E, value: StatsValue<E>): void {
  if (!enabled()) return;
  listen();
  queue.push([event, value]);
  if (queue.length >= 40) flush();
}

export function flush(beacon = false): void {
  if (!queue.length || !enabled()) return;
  while (queue.length) {
    const body = JSON.stringify({ e: queue.splice(0, STATS_BATCH_MAX) });
    const url = `${API_URL}/stats`;
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' })))
      continue;
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => undefined);
  }
}

let listening = false;
function listen(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
    else daily.run?.();
  });
  addEventListener('pagehide', () => flush(true));
  setInterval(() => flush(), 120_000);
}

/* ---------------- Ekrany ---------------- */

/** Trasa → nazwa ekranu z listy: bez identyfikatorów, nazw i zapytań z adresu. */
export function statsScreen(route: Route): StatsValue<'screen'> {
  switch (route.kind) {
    case 'tab':
      return `tab-${route.tab}`;
    case 'food':
      return `food-${route.section}`;
    case 'diet':
      return `diet-${route.page}`;
    case 'exercise':
      return isCatalogId(route.id) ? 'exercise-catalog' : 'exercise-library';
    default:
      return route.kind;
  }
}

/* ---------------- Raz dziennie ---------------- */

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Poniedziałek tygodnia dnia `yyyy-mm-dd` (tydzień jak w kalendarzu: od poniedziałku). */
export function weekOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const bucket = (n: number): StatsValue<'week'> => (n <= 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : '5-7');

const installed = (): boolean =>
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * Pierwsze otwarcie dnia: aktywne urządzenie, język, funkcje w użyciu (tak/nie), a w nowym
 * tygodniu — przedział dni z aplikacją w poprzednim. Lista dni zostaje na urządzeniu (3 tygodnie).
 */
export function daily(state: AppState, now = new Date()): void {
  daily.run = () => daily(state);
  if (!enabled()) return;
  const today = localDay(now);
  if (daily.last === today) return;
  let days: string[] = [];
  try {
    const v = JSON.parse(read(DAYS_KEY) ?? '[]') as unknown;
    if (Array.isArray(v)) days = v.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {
    /* zepsuta lista — od nowa */
  }
  daily.last = today;
  if (days.includes(today)) return;

  track('open', installed() ? 'pwa' : 'web');
  track('lang', LANG);
  if (state.plan) track('uses', 'plan');
  if (state.watch) track('uses', 'watch');
  if (state.phone) track('uses', 'phone');
  const r = state.cfg.reminders;
  if (r && (r.morning || r.evening || r.weigh || r.food || r.shop || r.labs)) track('uses', 'reminders');
  if (state.catalog && Object.keys(state.catalog).length) track('uses', 'catalog');

  const last = days[days.length - 1];
  if (last && weekOf(last) !== weekOf(today)) {
    const prev = days.filter((d) => weekOf(d) === weekOf(last)).length;
    if (prev > 0) track('week', bucket(prev));
  }
  const cutoff = localDay(new Date(now.getTime() - 21 * 86_400_000));
  write(DAYS_KEY, JSON.stringify([...days.filter((d) => d >= cutoff), today]));
}
daily.last = '';
daily.run = undefined as (() => void) | undefined;

/** Tylko dla testów. */
export function resetStatsForTests(): void {
  queue.length = 0;
  daily.last = '';
}
