import { apiConfigured } from './api';
import { WATCH_EVERY_MIN, deviceStatus } from './deviceStatus';
import type { DeviceStatus } from './deviceStatus';
import { keySlot, mailbox, readBox } from './mailbox';
import type { BoxResult } from './mailbox';
import { parsePayload } from './engine/watch';
import type { WatchPayload } from './engine/watch';
import type { AppState } from './types';
import type { WatchKeys } from './watchseal';

export { PULL_GAP_MS, whenText } from './mailbox';

/**
 * Zegarek Garmin — warstwa przeglądarki: klucz, odbiór paczki z serwera i odłączenie.
 *
 * Klucz powstaje w karcie zegarka i leży tylko w pamięci tej strony. Do zegarka trafia przez
 * schowek: ktoś wkleja go w ustawienia aplikacji GYM TRACKER na zegarku w Garmin Connect.
 * Do eksportu danych nie trafia — plik z kopią treningów nie ma otwierać danych o zdrowiu.
 *
 * Karta zegarka potrzebuje tylko serwera (`VITE_API_URL`) — bez niego karty nie ma, a aplikacja
 * działa jak dotąd. Adres aplikacji w Connect IQ Store jest w kodzie: strona wersji publicznej.
 * Zmienna buildu `VITE_GARMIN_APP_URL` (w GitHubie `GARMIN_APP_URL`) tylko go nadpisuje, np.
 * adresem bety do testów; pusta niczego nie zmienia.
 */

/** Strona aplikacji GYM TRACKER w Connect IQ Store — wersja publiczna, nie beta. */
export const GARMIN_STORE_URL = 'https://apps.garmin.com/apps/681b79f1-3575-4375-9836-a5ec600abab4';

// `||`, nie `??`: workflow wdrożenia podaje nieustawioną zmienną repozytorium jako pusty tekst.
export const GARMIN_APP_URL = String(import.meta.env.VITE_GARMIN_APP_URL || GARMIN_STORE_URL);

/** Nazwa została, choć adres sklepu jest już zawsze: karta zegarka zależy tylko od serwera. */
export const garminConfigured = (): boolean => apiConfigured();

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

/** Kiedy ostatnio zapytano serwer o paczkę zegarka — „sprawdzone przed chwilą”. */
export const lastPullAt = box.lastAt;

/** Zapis na wiadomość po każdym sprawdzeniu — także tym bez nowej paczki. */
export const onWatchCheck = box.subscribe;

/** Czy zegarek jest połączony w tej przeglądarce: build go zna i klucz jest zapisany. */
export const watchConnected = (): boolean => garminConfigured() && slot.get() !== null;

/** Stan połączenia z zegarkiem: zegarek wysyła co pół godziny. */
export const watchStatus = (state: AppState, nowMs: number): DeviceStatus =>
  deviceStatus({
    lastT: state.watch?.t ?? null,
    got: state.watch?.got ?? null,
    kind: box.lastKind(),
    hasKey: slot.get() !== null,
    nowMs,
    cadenceMin: WATCH_EVERY_MIN,
  });

export const pullWatch = box.pull;

/** Odłącza zegarek: kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
export const forgetWatch = box.forget;
