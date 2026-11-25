import { useSyncExternalStore } from 'react';
import type { Area, AssignmentV1, Profession, PublicJwk, ReceiptStatus, Scope } from '@gymtracker/link';
import type { AnswerValue, MessageRef } from '@gymtracker/link/coaching';
import type { Booking } from './rpc';

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
  /** Kiedy poproszono o paczkę (ms) — wysłana paczka złożona wcześniej nie kasuje tej prośby. */
  pushDueAt?: number;
  /** Do kiedy (czas serwera) „przeczytane” doszło do prowadzącego — dalsze czeka na sieć. */
  readSent?: string | null;
  /** Zakończenie przez prowadzącego, o którym ekran jeszcze nie powiedział. */
  endNotice?: boolean;
  /** Czas serwera ostatniej pobranej wiadomości — następne pobranie prosi tylko o nowsze. */
  messagesSince?: string | null;
  /** Do kiedy (czas serwera) prowadzący przeczytał wiadomości od nas. */
  readUpTo?: string | null;
  /**
   * Wysłane zdjęcia sylwetki: `<numer zdjęcia na telefonie>|<dzień>` → numer na serwerze. Dzień jest
   * w kluczu, bo „Sylwetka” pozwala go poprawić — poprawione zdjęcie idzie jako nowa kopia, a stara znika.
   */
  photos?: Record<string, string>;
  /** Wizyty z ostatniego pobrania (`client_slots`): do pokazania bez sieci i do uwagi na ekranie Dziś. */
  visits?: { at: number; bookings: Booking[] };
}

/** Wiadomość w rozmowie z prowadzącym — już odszyfrowana (albo nasza, jeszcze niewysłana). */
export interface StoredMessage {
  id: string;
  connectionId: string;
  author: 'coach' | 'client';
  text: string;
  ref: MessageRef | null;
  /** Chwila napisania (ms, zegar autora). */
  at: number;
  /** Czas serwera; `null` — nasza wiadomość czeka na sieć. */
  serverAt: string | null;
  /** Wiadomość prowadzącego przeczytana na tym telefonie (ms); u naszych — nieużywane. */
  readAt: number | null;
}

/** Odpowiedź na formularz zapisana na telefonie; idzie do prowadzącego w paczce (`coaching`). */
export interface StoredAnswer {
  assignmentId: string;
  period: string;
  at: number;
  values: Record<string, AnswerValue>;
}

/** Odhaczenia dzień po dniu jednego zalecenia (nawyki albo jadłospis): dzień → numery punktów. */
export type DayTicks = Record<string, number[]>;

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
  /** Zalecenia rodzaju, którego ta wersja nie zna — „zaktualizuj aplikację”, a nie „zepsute”. */
  unsupported: { id: string; connectionId: string; kind: string }[];
  messages: StoredMessage[];
  answers: StoredAnswer[];
  /** Odhaczone nawyki i posiłki: numer zalecenia → dni. */
  ticks: Record<string, DayTicks>;
}

/** Sekret ID z zapisu (`cfg.linkSecret`): 32 bajty base64url. Zepsuty dałby inne ID niż wcześniej, więc odpada. */
export const validLinkSecret = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

const empty = (): LinkState => ({ connections: [], assignments: [], broken: [], unsupported: [], messages: [], answers: [], ticks: {} });

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Wczytany zapis przesiany: zepsuta współpraca odpada, zamiast wywrócić ekran. */
export function cleanLinkState(raw: unknown): LinkState {
  if (!isObj(raw)) return empty();
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
  for (const c of connections) if (c.visits !== undefined) cleanVisits(c);
  // Kursory wiadomości: zepsuty czas wysłany do serwera kończy się błędem rzutowania, który wygląda jak brak
  // sieci — i synchronizacja stawałaby na nim za każdym razem.
  const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
  for (const c of connections) {
    if (c.messagesSince !== undefined) c.messagesSince = iso(c.messagesSince);
    if (c.readUpTo !== undefined) c.readUpTo = iso(c.readUpTo);
    if (c.readSent !== undefined) c.readSent = iso(c.readSent);
    if (c.pushDueAt !== undefined && (typeof c.pushDueAt !== 'number' || !Number.isFinite(c.pushDueAt))) delete c.pushDueAt;
  }
  const ids = new Set(connections.map((c) => c.id));
  const assignments = (Array.isArray(raw.assignments) ? raw.assignments : []).filter(
    (a): a is StoredAssignment =>
      isObj(a) && typeof a.id === 'string' && typeof a.connectionId === 'string' && ids.has(a.connectionId) && isObj(a.a) && isObj((a.a as { body?: unknown }).body),
  );
  for (const a of assignments) if (!Array.isArray(a.ticked)) a.ticked = [];
  const broken = (Array.isArray(raw.broken) ? raw.broken : []).filter(
    (b): b is { id: string; connectionId: string } => isObj(b) && typeof b.id === 'string' && typeof b.connectionId === 'string',
  );
  const unsupported = (Array.isArray(raw.unsupported) ? raw.unsupported : []).filter(
    (u): u is { id: string; connectionId: string; kind: string } =>
      isObj(u) && typeof u.id === 'string' && typeof u.connectionId === 'string' && ids.has(u.connectionId) && typeof u.kind === 'string',
  );
  const messages = (Array.isArray(raw.messages) ? raw.messages : []).filter(
    (m): m is StoredMessage =>
      isObj(m) &&
      typeof m.id === 'string' &&
      typeof m.connectionId === 'string' &&
      ids.has(m.connectionId) &&
      (m.author === 'coach' || m.author === 'client') &&
      typeof m.text === 'string' &&
      typeof m.at === 'number',
  );
  for (const m of messages) {
    if (typeof m.serverAt !== 'string') m.serverAt = null;
    if (typeof m.readAt !== 'number') m.readAt = null;
    if (!isObj(m.ref)) m.ref = null;
  }
  const answers = (Array.isArray(raw.answers) ? raw.answers : []).filter(
    (a): a is StoredAnswer =>
      isObj(a) && typeof a.assignmentId === 'string' && typeof a.period === 'string' && typeof a.at === 'number' && isObj(a.values),
  );
  const ticks: Record<string, DayTicks> = {};
  if (isObj(raw.ticks)) {
    for (const [id, days] of Object.entries(raw.ticks)) {
      if (!isObj(days)) continue;
      const clean: DayTicks = {};
      for (const [day, list] of Object.entries(days)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(list)) clean[day] = list.filter((i): i is number => Number.isInteger(i) && i >= 0);
      }
      ticks[id] = clean;
    }
  }
  return { connections, assignments, broken, unsupported, messages, answers, ticks };
}

/** Kopia wizyt przesiana: zepsuta wypada w całości, rezerwacja bez numeru, czasu albo tytułu — sama. */
function cleanVisits(c: LinkConnection): void {
  const v = c.visits as unknown;
  if (!isObj(v) || typeof v.at !== 'number' || !Array.isArray(v.bookings)) {
    delete c.visits;
    return;
  }
  const opt = (x: unknown): string | null => (typeof x === 'string' ? x : null);
  c.visits = {
    at: v.at,
    bookings: v.bookings.flatMap((b): Booking[] =>
      isObj(b) && typeof b.id === 'string' && typeof b.slotId === 'string' && typeof b.startsAt === 'string' && typeof b.endsAt === 'string' && typeof b.title === 'string'
        ? [
            {
              id: b.id,
              slotId: b.slotId,
              startsAt: b.startsAt,
              endsAt: b.endsAt,
              title: b.title,
              place: opt(b.place),
              note: opt(b.note),
              cancelledAt: opt(b.cancelledAt),
              cancelledBy: b.cancelledBy === 'client' || b.cancelledBy === 'coach' ? b.cancelledBy : null,
            },
          ]
        : [],
    ),
  };
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
  current = empty();
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

/** Rozmowa z jednym prowadzącym, od najstarszej. */
export const messagesOf = (s: LinkState, connectionId: string): StoredMessage[] =>
  s.messages.filter((m) => m.connectionId === connectionId).sort((a, b) => (a.serverAt ?? '\uffff').localeCompare(b.serverAt ?? '\uffff') || a.at - b.at);

/** Wiadomości od prowadzących, których nikt na tym telefonie jeszcze nie otworzył. */
export const unreadMessages = (s: LinkState, connectionId?: string): StoredMessage[] =>
  s.messages.filter(
    (m) =>
      m.author === 'coach' &&
      m.readAt === null &&
      (connectionId === undefined || m.connectionId === connectionId) &&
      s.connections.some((c) => c.id === m.connectionId && c.status === 'active'),
  );

/** Odpowiedzi na jeden formularz (wszystkie okresy). */
export const answersOf = (s: LinkState, assignmentId: string): StoredAnswer[] => s.answers.filter((a) => a.assignmentId === assignmentId);

/** Odhaczone punkty zalecenia w danym dniu. */
export const ticksOn = (s: LinkState, assignmentId: string, day: string): number[] => s.ticks[assignmentId]?.[day] ?? [];
