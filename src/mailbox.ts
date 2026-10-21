import { API_URL, apiConfigured } from './api';
import { cleanKey, deriveKeys, open } from './watchseal';
import type { WatchKeys } from './watchseal';

/**
 * Skrzynka na serwerze — wspólna droga zegarka i telefonu. Urządzenie pieczętuje paczkę kluczem,
 * którego serwer nie zna, i odkłada ją pod adresem wyprowadzonym z klucza; aplikacja ją stąd
 * odbiera, sprawdza podpis i odszyfrowuje. Serwer nie wie, kto pisze ani co jest w środku, więc
 * telefon korzysta z tych samych ścieżek co zegarek (`/garmin/*` — nazwa historyczna).
 *
 * Każde urządzenie ma własny klucz w pamięci strony, nigdy w eksporcie danych: plik z kopią
 * treningów nie ma otwierać danych o zdrowiu.
 */

/**
 * - `ok` — paczka odczytana;
 * - `empty` — skrzynka pusta: urządzenie jeszcze nic nie wysłało;
 * - `bad` — paczka jest, ale nie otwiera się tym kluczem (w urządzeniu inny klucz);
 * - `offline` — sieć albo serwer;
 * - `skip` — za wcześnie od poprzedniego sprawdzenia;
 * - `off` — brak klucza albo serwera w buildzie.
 */
export type BoxResult<P> = { kind: 'ok'; payload: P } | { kind: 'empty' | 'bad' | 'offline' | 'skip' | 'off' };

/** Treść paczki po odszyfrowaniu zamieniona na dane urządzenia — `null`, gdy to nie jego paczka. */
export type Parse<P> = (json: unknown, nowMs: number) => P | null;

/** Odpowiedź `/garmin/pull` zamieniona na wynik — osobno od sieci, żeby dało się ją sprawdzić. */
export async function readBox<P>(
  keys: WatchKeys,
  status: number,
  body: unknown,
  nowMs: number,
  parse: Parse<P>,
): Promise<BoxResult<P>> {
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
  const payload = parse(json, nowMs);
  return payload ? { kind: 'ok', payload } : { kind: 'bad' };
}

/** Urządzenia wysyłają co pół godziny albo co godzinę — częściej niż raz na minutę nie ma po co pytać. */
export const PULL_GAP_MS = 60_000;

/** Klucz jednego urządzenia w pamięci strony: odczyt, zapis i usunięcie. */
export function keySlot(name: string) {
  return {
    get(): string | null {
      try {
        return cleanKey(localStorage.getItem(name) ?? '');
      } catch {
        return null;
      }
    },
    save(raw: string): boolean {
      const k = cleanKey(raw);
      if (!k) return false;
      try {
        localStorage.setItem(name, k);
        return true;
      } catch {
        return false;
      }
    },
    remove(): void {
      try {
        localStorage.removeItem(name);
      } catch {
        /* Bez pamięci strony klucza i tak nie było. */
      }
    },
  };
}

/**
 * Skrzynka jednego urządzenia: odbiór nie częściej niż raz na minutę (chyba że ktoś naciska
 * „Sprawdź teraz”) i odłączenie. Wynik ostatniego sprawdzenia zostaje dla karty w ustawieniach.
 */
export function mailbox<P>(slot: ReturnType<typeof keySlot>, configured: () => boolean, parse: Parse<P>) {
  let lastPull = 0;
  let lastKind: BoxResult<P>['kind'] | null = null;
  return {
    lastKind: (): BoxResult<P>['kind'] | null => lastKind,

    async pull(force = false): Promise<BoxResult<P>> {
      const hex = slot.get();
      if (!configured() || !hex) return { kind: 'off' };
      const now = Date.now();
      if (!force && now - lastPull < PULL_GAP_MS) return { kind: 'skip' };
      lastPull = now;
      const keys = await deriveKeys(hex);
      if (!keys) return { kind: 'off' };
      let r: BoxResult<P>;
      try {
        const res = await fetch(`${API_URL}/garmin/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ box: keys.box }),
          cache: 'no-store',
        });
        r = await readBox(keys, res.status, res.status === 200 ? await res.json() : null, now, parse);
      } catch {
        r = { kind: 'offline' };
      }
      lastKind = r.kind;
      return r;
    },

    /** Kasuje skrzynkę na serwerze i klucz w tej przeglądarce. Dane, które już przyszły, zostają. */
    async forget(): Promise<void> {
      const hex = slot.get();
      slot.remove();
      lastKind = null;
      const keys = hex ? await deriveKeys(hex) : null;
      if (!keys || !apiConfigured()) return;
      await fetch(`${API_URL}/garmin/forget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box: keys.box }),
      }).catch(() => undefined);
    },
  };
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
