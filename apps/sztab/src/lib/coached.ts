import { addDays, localDay, parseAssignment } from '@gymtracker/link';
import type { AssignmentBody, FormBody, HabitsBody, MealsBody, ReceiptStatus, SnapshotV1 } from '@gymtracker/link';
import type { SentAssignment } from './data';

/**
 * Wspólny wybór i wspólne dni dla wszystkiego, co w Sztabie liczy prowadzenie dzień po dniu:
 * lista „Do przejrzenia” (`review.ts`), zakładka „Realizacja” (`adherence.ts`) i „Odpowiedzi”
 * (`forms.ts`). Jedno miejsce — żeby lista i karta podopiecznego nigdy nie mówiły co innego.
 *
 * **Które zalecenia obowiązują** — te, które telefon pokazuje na ekranie Dziś (`src/link/today.ts`):
 * szyfrogram się otworzył, nie wycofane, nie odrzucone, już widoczne („pokaż od” minęło) i treść
 * przechodzi `parseAssignment` (to samo sprawdzenie co w telefonie, razem z numerem w środku równym
 * numerowi wiersza). Odpowiedzi i odhaczenia telefon zapisuje pod **numerem wiersza małymi literami**
 * (`src/link/sync.ts`) — pod tym kluczem je tu szukamy.
 *
 * **Siedem pełnych dni** liczy się przed `min(dziś, dzień paczki)`: dziś jeszcze trwa, a dni po
 * paczce są nieznane, nie opuszczone (telefon mógł odhaczyć i jeszcze nie wysłać).
 */

/* ── Dzień w strefie telefonu ──────────────────────────────────────────────────────── */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const fmts = new Map<string, Intl.DateTimeFormat | null>();

function formatter(tz: string): Intl.DateTimeFormat | null {
  if (!fmts.has(tz)) {
    let f: Intl.DateTimeFormat | null = null;
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      f = null;
    }
    fmts.set(tz, f);
  }
  return fmts.get(tz) ?? null;
}

/**
 * Dzień `YYYY-MM-DD` chwili `at` w strefie `tz` (z paczki — dane z zewnątrz: brak, nieznana albo
 * zepsuta strefa daje dzień w strefie tej przeglądarki).
 */
export function dayIn(tz: string | null | undefined, at: number): string {
  const f = tz && tz.length <= 64 ? formatter(tz) : null;
  if (!f) return localDay(at);
  const parts = f.formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return DAY_RE.test(day) ? day : localDay(at);
}

/* ── Okno pełnych dni ──────────────────────────────────────────────────────────────── */

export const WEEK = 7;

/**
 * `n` pełnych dni (od najstarszego) przed `min(today, snapDay)`. Ten sam rachunek dla nawyków,
 * jadłospisu i treningów — na liście i w zakładce.
 */
export function fullDaysBefore(today: string, snapDay: string, n: number = WEEK): string[] {
  const end = today < snapDay ? today : snapDay;
  return Array.from({ length: n }, (_, i) => addDays(end, i - n));
}

/** Czy paczka ma część `coaching` — telefon sprzed tej wersji jej nie wysyła i o odhaczeniach nic nie wiemy. */
export const hasCoaching = (s: Pick<SnapshotV1, 'coaching'> | null | undefined): boolean => s?.coaching !== undefined && s?.coaching !== null;

/* ── Zalecenia, które obowiązują ───────────────────────────────────────────────────── */

export type CoachedKind = 'form' | 'habits' | 'meals';
export type CoachedBody = FormBody | HabitsBody | MealsBody;
export type BodyOf<K extends AssignmentBody['kind']> = Extract<AssignmentBody, { kind: K }>;

export interface LiveItem<B extends AssignmentBody = AssignmentBody> {
  /** Numer wiersza małymi literami — pod nim telefon trzyma odpowiedzi i odhaczenia. */
  id: string;
  /** Treść po `parseAssignment` — ta sama, którą widzi telefon. */
  body: B;
  /** Od kiedy podopieczny ma zalecenie (ms): wysłanie albo „pokaż od” zaplanowanego. */
  sentAt: number;
  status: ReceiptStatus | null;
}

export interface ScheduledItem<B extends AssignmentBody = AssignmentBody> extends LiveItem<B> {
  /** Chwila „pokaż od” (ms) — wcześniej telefon tego nie dostaje. */
  visibleAt: number;
}

export interface SortedSent {
  /** Obowiązujące, od najnowszego. */
  live: LiveItem[];
  /** Zaplanowane, jeszcze niewidoczne — od najbliższego. */
  scheduled: ScheduledItem[];
  /** Odrzucone przez podopiecznego (telefon nie pokazuje ich na ekranie Dziś). */
  declined: LiveItem[];
}

/** Rozdziela wysłane zalecenia: obowiązujące, zaplanowane i odrzucone. Wycofane i nieczytelne odpadają. */
export function sortSent(sent: readonly SentAssignment[], now: number): SortedSent {
  const out: SortedSent = { live: [], scheduled: [], declined: [] };
  for (const x of sent) {
    if (x.withdrawnAt || !x.envelope) continue;
    const a = parseAssignment(x.envelope);
    const id = x.id.toLowerCase();
    // Numer w środku musi być numerem wiersza — inaczej telefon uznaje zalecenie za zepsute.
    if (!a || a.id.toLowerCase() !== id) continue;
    const item: LiveItem = { id, body: a.body, sentAt: a.sentAt, status: x.receipt?.status ?? null };
    const visibleAt = x.visibleFrom ? Date.parse(x.visibleFrom) : NaN;
    if (visibleAt > now) out.scheduled.push({ ...item, visibleAt });
    else if (item.status === 'declined') out.declined.push(item);
    else out.live.push(item);
  }
  out.live.sort((p, q) => q.sentAt - p.sentAt);
  out.declined.sort((p, q) => q.sentAt - p.sentAt);
  out.scheduled.sort((p, q) => p.visibleAt - q.visibleAt);
  return out;
}

export const isKind =
  <K extends AssignmentBody['kind']>(kind: K) =>
  <I extends LiveItem>(x: I): x is I & LiveItem<BodyOf<K>> =>
    x.body.kind === kind;

export const isCoached = (x: LiveItem): x is LiveItem<CoachedBody> => x.body.kind === 'form' || x.body.kind === 'habits' || x.body.kind === 'meals';
