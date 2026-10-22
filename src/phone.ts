import { apiConfigured } from './api';
import { PHONE_EVERY_MIN, deviceStatus } from './deviceStatus';
import type { DeviceStatus } from './deviceStatus';
import { keySlot, mailbox, readBox } from './mailbox';
import type { BoxResult } from './mailbox';
import { parsePhonePayload } from './engine/phone';
import type { PhonePayload } from './engine/phone';
import type { AppState } from './types';
import type { WatchKeys } from './watchseal';

/**
 * Zdrowie z telefonu — warstwa przeglądarki: klucz, odbiór paczki z serwera i odłączenie.
 *
 * Strona nie czyta Apple Zdrowie ani Health Connect — żadna przeglądarka nie daje do nich
 * dostępu. Czyta je aplikacja GYM TRACKER Zdrowie na telefonie (`health/`) i pieczętuje
 * kluczem z karty „Zdrowie z telefonu”. Klucz jest osobny od klucza zegarka: każde urządzenie
 * ma własną skrzynkę, więc nie nadpisują sobie paczek i odłącza się je osobno.
 *
 * Adresy aplikacji (App Store / TestFlight, plik APK albo Google Play) przychodzą z buildu.
 * Bez żadnego albo bez serwera karty nie ma.
 */

export const HEALTH_IOS_URL = String(import.meta.env.VITE_HEALTH_IOS_URL ?? '');
export const HEALTH_ANDROID_URL = String(import.meta.env.VITE_HEALTH_ANDROID_URL ?? '');

export const phoneConfigured = (): boolean => apiConfigured() && (HEALTH_IOS_URL !== '' || HEALTH_ANDROID_URL !== '');

const slot = keySlot('gt-phone-key');
const box = mailbox(slot, phoneConfigured, parsePhonePayload);

export const phoneKey = slot.get;
export const savePhoneKey = slot.save;

export type PhonePull = BoxResult<PhonePayload>;

/** Odpowiedź serwera zamieniona na wynik — osobno od sieci, żeby dało się ją sprawdzić. */
export const readPhonePull = (keys: WatchKeys, status: number, body: unknown, nowMs: number): Promise<PhonePull> =>
  readBox(keys, status, body, nowMs, parsePhonePayload);

export const lastPhoneKind = box.lastKind;

/** Kiedy ostatnio zapytano serwer o paczkę telefonu — „sprawdzone przed chwilą”. */
export const lastPhoneAt = box.lastAt;

/** Zapis na wiadomość po każdym sprawdzeniu — także tym bez nowej paczki. */
export const onPhoneCheck = box.subscribe;

/** Czy telefon jest połączony w tej przeglądarce: build zna aplikację i klucz jest zapisany. */
export const phoneConnected = (): boolean => phoneConfigured() && slot.get() !== null;

/** Stan połączenia z telefonem: aplikacja na telefonie wysyła mniej więcej co godzinę. */
export const phoneStatus = (state: AppState, nowMs: number): DeviceStatus =>
  deviceStatus({
    lastT: state.phone?.t ?? null,
    got: state.phone?.got ?? null,
    kind: box.lastKind(),
    hasKey: slot.get() !== null,
    nowMs,
    cadenceMin: PHONE_EVERY_MIN,
  });

export const pullPhone = box.pull;

/** Odłącza telefon: kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
export const forgetPhone = box.forget;

/**
 * Na czym otwarto stronę — karta pokazuje instrukcję dla tego telefonu, na komputerze obie.
 * iPad od iPadOS 13 przedstawia się jak Mac, więc zdradza go dopiero ekran dotykowy.
 */
export function platformOf(ua: string, touchPoints = 0): 'ios' | 'android' | 'other' {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1)) return 'ios';
  return 'other';
}
