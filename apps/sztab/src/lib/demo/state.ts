import type { DemoPhone } from './phone';

/**
 * Telefon demo zapamiętany w tej przeglądarce (`sztab-demo:<konto>`): numer współpracy, token i klucz
 * prywatny telefonu symulowanego — dane zmyślone, bez nich nie da się grać roli telefonu. Osobno od
 * `client.ts`, żeby lista i karta podopiecznego mogły pokazać „DEMO” bez wczytywania symulacji.
 */

/** Etykieta zaproszenia demo — widać ją też na innym komputerze, przy zaproszeniach i na karcie. */
export const DEMO_LABEL = 'DEMO';

export interface DemoState extends DemoPhone {
  pseudonym: string;
  createdAt: number;
}

const storageKey = (userId: string) => `sztab-demo:${userId}`;

export function loadDemo(userId: string): DemoState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) ?? 'null') as Partial<DemoState> | null;
    if (!raw || typeof raw !== 'object') return null;
    const ok =
      typeof raw.connectionId === 'string' &&
      typeof raw.inviteId === 'string' &&
      typeof raw.token === 'string' &&
      typeof raw.pseudonym === 'string' &&
      typeof raw.createdAt === 'number' &&
      !!raw.privateJwk &&
      typeof raw.privateJwk === 'object';
    return ok ? (raw as DemoState) : null;
  } catch {
    return null;
  }
}

export function saveDemo(userId: string, s: DemoState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(s));
  } catch {
    /* Bez pamięci strony demo działa do zamknięcia karty — potem zostaje zwykłą współpracą. */
  }
}

export function clearDemo(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* nic do zrobienia */
  }
}

export const isDemo = (userId: string, connectionId: string): boolean => loadDemo(userId)?.connectionId === connectionId;

/**
 * Współpraca demo: z telefonem symulowanym w tej przeglądarce albo — na innym komputerze — z zaproszenia
 * z etykietą „DEMO”.
 */
export const isDemoConnection = (userId: string, c: { id: string; label: string | null }): boolean =>
  c.label === DEMO_LABEL || isDemo(userId, c.id);

/**
 * „Zaznacz wszystkich” w akcjach grupowych (wysyłka, program, wiadomość): bez podopiecznego demo, żeby
 * treść „dla wszystkich” nie szła do zmyślonego podopiecznego — zaznaczony ręcznie dostaje ją jak każdy.
 * Gdy na liście jest tylko demo, zaznacza je (prowadzący wyraźnie patrzy właśnie na nie).
 */
export function bulkPick<C extends { id: string; label: string | null }>(userId: string, list: readonly C[]): C[] {
  const real = list.filter((c) => !isDemoConnection(userId, c));
  return real.length ? real : [...list];
}
