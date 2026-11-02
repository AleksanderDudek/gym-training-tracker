/**
 * Potwierdzenia „Rozumiem” — raz na urządzenie, a numer wersji pozwala zapytać jeszcze raz, gdy
 * treść zmieni się istotnie. W `localStorage`, każdy dostęp w `try` (tryb prywatny): bez pamięci
 * karta pokaże się przy każdej wizycie, ale nic nie blokuje. Plik bez importów: przygotowanie
 * testów potwierdza kartę zdrowia, zanim test ustawi język.
 */
export interface AckStore {
  key: string;
  snapshot: () => boolean;
  subscribe: (listener: () => void) => () => void;
  acknowledge: () => void;
  /** Tylko dla testów: następny odczyt sięga znowu do `localStorage`. */
  reset: () => void;
}

function ackStore(key: string, version: string): AckStore {
  const listeners = new Set<() => void>();
  let acked: boolean | null = null;
  const read = (): boolean => {
    try {
      return window.localStorage.getItem(key) === version;
    } catch {
      return false;
    }
  };
  return {
    key,
    snapshot: () => (acked ??= read()),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    acknowledge: () => {
      try {
        window.localStorage.setItem(key, version);
      } catch {
        // Bez pamięci przeglądarki potwierdzenie trwa do przeładowania.
      }
      acked = true;
      listeners.forEach((l) => l());
    },
    reset: () => {
      acked = null;
    },
  };
}

/** Karta „Zanim skorzystasz z podpowiedzi o jedzeniu” (`Health.tsx`). */
export const healthAck = ackStore('gt:health-ack', '1');

/** Ramka „Jak przechowywane są Twoje wyniki” w Badaniach: po „Rozumiem” zwija się do nagłówka. */
export const labsDataAck = ackStore('gt:labs-data-ack', '1');

export const HEALTH_ACK_KEY = healthAck.key;
export const acknowledgeHealth = healthAck.acknowledge;
export const resetHealthAckCache = healthAck.reset;
