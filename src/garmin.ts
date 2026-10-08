import { API_URL, apiConfigured } from './api';
import { parsePayload } from './engine/watch';
import type { WatchPayload } from './engine/watch';
import { cleanKey, deriveKeys, open } from './watchseal';
import type { WatchKeys } from './watchseal';

/**
 * Zegarek Garmin — warstwa przeglądarki: klucz, odbiór paczki z serwera i odłączenie.
 *
 * Klucz powstaje w karcie zegarka i leży tylko w pamięci tej strony. Do zegarka trafia przez
 * schowek: ktoś wkleja go w ustawienia aplikacji GYM TRACKER na zegarku w Garmin Connect.
 * Do eksportu danych nie trafia — plik z kopią treningów nie ma otwierać danych o zdrowiu.
 *
 * Adres aplikacji w Connect IQ Store przychodzi z buildu (`VITE_GARMIN_APP_URL`). Bez niego
 * albo bez serwera karty zegarka nie ma, a aplikacja działa jak dotąd.
 */

export const GARMIN_APP_URL = String(import.meta.env.VITE_GARMIN_APP_URL ?? '');

export const garminConfigured = (): boolean => apiConfigured() && GARMIN_APP_URL !== '';

const KEY = 'gt-garmin-key';

export function garminKey(): string | null {
  try {
    return cleanKey(localStorage.getItem(KEY) ?? '');
  } catch {
    return null;
  }
}

export function saveGarminKey(raw: string): boolean {
  const k = cleanKey(raw);
  if (!k) return false;
  try {
    localStorage.setItem(KEY, k);
    return true;
  } catch {
    return false;
  }
}

/**
 * - `ok` — paczka odczytana;
 * - `empty` — skrzynka pusta: zegarek jeszcze nic nie wysłał;
 * - `bad` — paczka jest, ale nie otwiera się tym kluczem (na zegarku inny klucz);
 * - `offline` — sieć albo serwer;
 * - `skip` — za wcześnie od poprzedniego sprawdzenia;
 * - `off` — brak klucza albo serwera w buildzie.
 */
export type PullResult = { kind: 'ok'; payload: WatchPayload } | { kind: 'empty' | 'bad' | 'offline' | 'skip' | 'off' };

/** Odpowiedź `/garmin/pull` zamieniona na wynik — osobno od sieci, żeby dało się ją sprawdzić. */
export async function readPull(keys: WatchKeys, status: number, body: unknown, nowMs: number): Promise<PullResult> {
  if (status === 404) return { kind: 'empty' };
  if (status !== 200 || !body || typeof body !== 'object') return { kind: 'offline' };
  const blob = (body as { blob?: unknown }).blob;
  const text = typeof blob === 'string' ? await open(keys, blob) : null;
  if (text === null) return { kind: 'bad' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'bad' };
  }
  const payload = parsePayload(json, nowMs);
  return payload ? { kind: 'ok', payload } : { kind: 'bad' };
}

/** Zegarek wysyła co pół godziny — częściej niż raz na minutę nie ma po co pytać. */
export const PULL_GAP_MS = 60_000;
let lastPull = 0;
let lastKind: PullResult['kind'] | null = null;

/** Wynik ostatniego sprawdzenia w tej karcie przeglądarki — dla karty w ustawieniach. */
export const lastPullKind = (): PullResult['kind'] | null => lastKind;

export async function pullWatch(force = false): Promise<PullResult> {
  const hex = garminKey();
  if (!garminConfigured() || !hex) return { kind: 'off' };
  const now = Date.now();
  if (!force && now - lastPull < PULL_GAP_MS) return { kind: 'skip' };
  lastPull = now;
  const keys = await deriveKeys(hex);
  if (!keys) return { kind: 'off' };
  let r: PullResult;
  try {
    const res = await fetch(`${API_URL}/garmin/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ box: keys.box }),
      cache: 'no-store',
    });
    r = await readPull(keys, res.status, res.status === 200 ? await res.json() : null, now);
  } catch {
    r = { kind: 'offline' };
  }
  lastKind = r.kind;
  return r;
}

/** Odłącza zegarek: kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
export async function forgetWatch(): Promise<void> {
  const hex = garminKey();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Bez pamięci strony klucza i tak nie było. */
  }
  lastKind = null;
  const keys = hex ? await deriveKeys(hex) : null;
  if (!keys || !apiConfigured()) return;
  await fetch(`${API_URL}/garmin/forget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ box: keys.box }),
  }).catch(() => undefined);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** „dziś 14:05”, „wczoraj 7:30”, „1.10 21:40” — według zegara telefonu. */
export function whenText(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${d.getHours()}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `dziś ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `wczoraj ${time}`;
  return `${d.getDate()}.${pad(d.getMonth() + 1)} ${time}`;
}
