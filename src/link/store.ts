import { useSyncExternalStore } from 'react';
import type { Area, AssignmentV1, Profession, PublicJwk, ReceiptStatus, Scope } from '@gymtracker/link';

/**
 * Współprace na tym telefonie: z kim, w jakich obszarach, co widzi, klucz i token — oraz
 * zalecenia, które przyszły.
 *
 * **Poza kopią zapasową**, jak klucz zegarka (`gt-garmin-key`): plik z danymi niesie treningi,
 * ale nie otwiera dostępu do współpracy. Kopia niesie za to sekret ID (`cfg.linkSecret`), więc
 * telefon odtworzony z kopii pokaże temu samemu prowadzącemu to samo ID przy nowym zaproszeniu.
 * „Usuń wszystkie dane” kasuje i to (`clearLink`).
 *
 * Moduł bez kryptografii i bez sieci: czytają go karta w profilu i uwaga na ekranie Dziś, które
 * stoją w głównej paczce. Szyfrowanie i rozmowa ze Sztabem są w `sync.ts`, wczytywanym leniwie.
 */

export const LINK_KEY = 'gt-link';

export type ConnectionStatus = 'active' | 'ended';

export interface LinkConnection {
  /** Numer współpracy na serwerze (UUID) — wchodzi do AAD szyfrogramów. */
  id: string;
  /** Zaproszenie, z którego powstała — wchodzi do klucza współpracy (HKDF). */
  inviteId: string;
  coachId: string;
  coach: { name: string; profession: Profession };
  areas: Area[];
  scopes: Scope[];
  /** ID podopiecznego u tego prowadzącego, 20 znaków Crockforda (`formatPseudonym` do pokazania). */
  pseudonym: string;
  /** Licznik ID (`pseudonymFor`) — inny niż 0 tylko po kolizji. */
  attempt: number;
  /** Token współpracy; po zakończeniu kasowany. */
  token: string | null;
  /** Klucz prywatny ECDH telefonu (JWK); po zakończeniu kasowany. */
  privateJwk: JsonWebKey | null;
  coachKey: PublicJwk;
  createdAt: number;
  lastPushAt: number | null;
  lastPullAt: number | null;
  status: ConnectionStatus;
  endedBy: 'client' | 'coach' | null;
  endedAt: number | null;
  /**
   * Zmiana, która nie doszła do serwera (brak sieci przy przyjęciu nowego zaproszenia albo przy
   * zakończeniu): `end` — zakończyć, `areas` — zostawić tylko te obszary. Synchronizacja ponawia.
   */
  pending?: { kind: 'end' } | { kind: 'areas'; areas: Area[] };
  /** Paczka, o którą poproszono, a serwer kazał chwilę poczekać — idzie przy następnej synchronizacji. */
  pushDue?: boolean;
  /** Zakończenie przez prowadzącego, o którym ekran jeszcze nie powiedział. */
  endNotice?: boolean;
}

/** `new` — przyszło, nikt nie otworzył; potem to, co podopieczny z nim zrobił. */
export type LocalStatus = 'new' | ReceiptStatus;

export interface StoredAssignment {
  id: string;
  connectionId: string;
  /** Odszyfrowane i sprawdzone (`parseAssignment`). */
  a: AssignmentV1;
  receivedAt: number;
  status: LocalStatus;
  /** Odhaczone punkty listy (notatka z listą). */
  ticked: number[];
  /** Status, który doszedł do prowadzącego — inny niż `status`, gdy potwierdzenie czeka na sieć. */
  sent: LocalStatus;
  /** Prowadzący wycofał — znika z ekranów. */
  withdrawn?: boolean;
  /** Co z niego powstało u nas: plan albo trening własny. */
  made?: { plan?: string; workout?: string };
}

export interface LinkState {
  connections: LinkConnection[];
  assignments: StoredAssignment[];
  /** Zalecenia, których nie dało się otworzyć (zły klucz, podmieniony szyfrogram) — po numerze. */
  broken: { id: string; connectionId: string }[];
}

/** Sekret ID z zapisu (`cfg.linkSecret`): 32 bajty base64url. Zepsuty dałby inne ID niż wcześniej, więc odpada. */
export const validLinkSecret = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

const EMPTY: LinkState = { connections: [], assignments: [], broken: [] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Wczytany zapis przesiany: zepsuta współpraca odpada, zamiast wywrócić ekran. */
export function cleanLinkState(raw: unknown): LinkState {
  if (!isObj(raw)) return { ...EMPTY, connections: [], assignments: [], broken: [] };
  const connections = (Array.isArray(raw.connections) ? raw.connections : []).filter(
    (c): c is LinkConnection =>
      isObj(c) &&
      typeof c.id === 'string' &&
      typeof c.inviteId === 'string' &&
      typeof c.coachId === 'string' &&
      isObj(c.coach) &&
      typeof (c.coach as { name?: unknown }).name === 'string' &&
      Array.isArray(c.areas) &&
      Array.isArray(c.scopes) &&
      typeof c.pseudonym === 'string' &&
      isObj(c.coachKey) &&
      (c.status === 'active' || c.status === 'ended'),
  );
  const ids = new Set(connections.map((c) => c.id));
  const assignments = (Array.isArray(raw.assignments) ? raw.assignments : []).filter(
    (a): a is StoredAssignment =>
      isObj(a) && typeof a.id === 'string' && typeof a.connectionId === 'string' && ids.has(a.connectionId) && isObj(a.a) && isObj((a.a as { body?: unknown }).body),
  );
  for (const a of assignments) if (!Array.isArray(a.ticked)) a.ticked = [];
  const broken = (Array.isArray(raw.broken) ? raw.broken : []).filter(
    (b): b is { id: string; connectionId: string } => isObj(b) && typeof b.id === 'string' && typeof b.connectionId === 'string',
  );
  return { connections, assignments, broken };
}

function read(): LinkState {
  try {
    return cleanLinkState(JSON.parse(localStorage.getItem(LINK_KEY) ?? 'null'));
  } catch {
    return cleanLinkState(null);
  }
}

let current: LinkState | null = null;
const listeners = new Set<() => void>();

export function linkState(): LinkState {
  current ??= read();
  return current;
}

/** Zmiana zapisu współprac. `f` dostaje kopię; zwraca to, co zapisać. */
export function updateLink(f: (s: LinkState) => LinkState | void): LinkState {
  const copy = JSON.parse(JSON.stringify(linkState())) as LinkState;
  const next = f(copy) ?? copy;
  current = next;
  try {
    localStorage.setItem(LINK_KEY, JSON.stringify(next));
  } catch {
    // Bez pamięci strony współpraca żyje do zamknięcia karty — tak jak klucz zegarka.
  }
  listeners.forEach((l) => l());
  return next;
}

export function subscribeLink(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const useLink = (): LinkState => useSyncExternalStore(subscribeLink, linkState, linkState);

/** „Usuń wszystkie dane”: zapomina współprace i zalecenia na tym telefonie. */
export function clearLink(): void {
  try {
    localStorage.removeItem(LINK_KEY);
  } catch {
    /* nic do skasowania */
  }
  current = { connections: [], assignments: [], broken: [] };
  listeners.forEach((l) => l());
}

/** Na potrzeby testów: wczytaj od nowa z `localStorage`. */
export function reloadLink(): void {
  current = null;
  listeners.forEach((l) => l());
}

/* ── Odczyty ───────────────────────────────────────────────────────────────────────── */

export const activeConnections = (s: LinkState): LinkConnection[] => s.connections.filter((c) => c.status === 'active');

export const connectionOf = (s: LinkState, id: string): LinkConnection | undefined => s.connections.find((c) => c.id === id);

/** Zalecenia do pokazania, najnowsze pierwsze — bez wycofanych. */
export const visibleAssignments = (s: LinkState, connectionId?: string): StoredAssignment[] =>
  s.assignments
    .filter((a) => !a.withdrawn && (connectionId === undefined || a.connectionId === connectionId))
    .sort((a, b) => b.a.sentAt - a.a.sentAt);

export const newAssignments = (s: LinkState): StoredAssignment[] => visibleAssignments(s).filter((a) => a.status === 'new');

/** Czy jest z czym rozmawiać ze Sztabem — bez tego aplikacja nie wczytuje nawet `sync.ts`. */
export const hasLinkWork = (s: LinkState = linkState()): boolean =>
  s.connections.some((c) => c.status === 'active' || (!!c.pending && !!c.token));
