/**
 * Potwierdzenie „Rozumiem” z karty zdrowia (`Health.tsx`) — raz na urządzenie, a numer wersji
 * pozwala zapytać jeszcze raz, gdy treść zmieni się istotnie. W `localStorage`, każdy dostęp
 * w `try` (tryb prywatny): bez pamięci karta pokaże się przy każdej wizycie, ale nic nie blokuje.
 * Plik bez importów: przygotowanie testów potwierdza kartę, zanim test ustawi język.
 */
export const HEALTH_ACK_KEY = 'gt:health-ack';
const ACK_VERSION = '1';

const listeners = new Set<() => void>();
let acked: boolean | null = null;

function readAck(): boolean {
  try {
    return window.localStorage.getItem(HEALTH_ACK_KEY) === ACK_VERSION;
  } catch {
    return false;
  }
}

export function ackSnapshot(): boolean {
  if (acked === null) acked = readAck();
  return acked;
}

export function subscribeAck(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function acknowledgeHealth(): void {
  try {
    window.localStorage.setItem(HEALTH_ACK_KEY, ACK_VERSION);
  } catch {
    // Bez pamięci przeglądarki potwierdzenie trwa do przeładowania.
  }
  acked = true;
  listeners.forEach((l) => l());
}

/** Tylko dla testów: następny odczyt sięga znowu do `localStorage`. */
export function resetHealthAckCache(): void {
  acked = null;
}
