import { apiConfigured } from './api';
import { keySlot, mailbox, readBox } from './mailbox';
import type { BoxResult } from './mailbox';
import { parsePayload } from './engine/watch';
import type { WatchPayload } from './engine/watch';
import type { WatchKeys } from './watchseal';

export { PULL_GAP_MS, whenText } from './mailbox';

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

const slot = keySlot('gt-garmin-key');
const box = mailbox(slot, garminConfigured, parsePayload);

export const garminKey = slot.get;
export const saveGarminKey = slot.save;

export type PullResult = BoxResult<WatchPayload>;

/** Odpowiedź `/garmin/pull` zamieniona na wynik — osobno od sieci, żeby dało się ją sprawdzić. */
export const readPull = (keys: WatchKeys, status: number, body: unknown, nowMs: number): Promise<PullResult> =>
  readBox(keys, status, body, nowMs, parsePayload);

/** Wynik ostatniego sprawdzenia w tej karcie przeglądarki — dla karty w ustawieniach. */
export const lastPullKind = box.lastKind;

export const pullWatch = box.pull;

/** Odłącza zegarek: kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
export const forgetWatch = box.forget;
