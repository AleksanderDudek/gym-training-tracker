import { formDue, formPeriod, habitsFor, localDay, mealDayIndex } from '@gymtracker/link/coaching';
import type { FormBody, HabitsBody, MealsBody } from '@gymtracker/link';
import { answersOf, ticksOn, unreadMessages, visibleAssignments } from './store';
import type { LinkConnection, LinkState, StoredAssignment } from './store';

/**
 * Co od prowadzących czeka dziś — dla uwagi na ekranie Dziś i dla stron współpracy. Czyste funkcje
 * na zapisie współprac, bez kryptografii i sieci: stoją w głównej paczce obok `store.ts`.
 */

export type Coached<B> = StoredAssignment & { a: StoredAssignment['a'] & { body: B } };

const isKind =
  <K extends 'form' | 'habits' | 'meals'>(kind: K) =>
  (x: StoredAssignment): x is Coached<Extract<StoredAssignment['a']['body'], { kind: K }>> =>
    x.a.body.kind === kind;

const active = (s: LinkState) => new Set(s.connections.filter((c) => c.status === 'active').map((c) => c.id));

/** Zalecenia trwających współprac, bez odrzuconych — tylko one coś „zadają”. */
const live = (s: LinkState): StoredAssignment[] => {
  const ids = active(s);
  return visibleAssignments(s).filter((x) => ids.has(x.connectionId) && x.status !== 'declined');
};

/** Dzień wysłania zalecenia w strefie telefonu — od niego liczy się cykl jadłospisu bez daty startu. */
export const sentDay = (x: StoredAssignment): string => localDay(x.a.sentAt);

/** Formularze, które czekają dziś na odpowiedź (wywiad pierwszy). */
export function formsDue(s: LinkState, day: string = localDay()): Coached<FormBody>[] {
  return live(s)
    .filter(isKind('form'))
    .filter((x) => formDue(x.a.body, new Set(answersOf(s, x.id).map((a) => a.period)), day))
    .sort((a, b) => Number(b.a.body.intake) - Number(a.a.body.intake));
}

/** Okres, który zamknie dzisiejsza odpowiedź. */
export const periodToday = (form: FormBody, day: string = localDay()): string => formPeriod(form, day);

export interface DayProgress<B> {
  x: Coached<B>;
  /** Numery punktów (nawyki) albo posiłków dnia (jadłospis) na dziś. */
  due: number[];
  done: number[];
}

/** Nawyki na dziś: co obowiązuje i co już odhaczone. */
export function habitsToday(s: LinkState, day: string = localDay()): DayProgress<HabitsBody>[] {
  return live(s)
    .filter(isKind('habits'))
    .flatMap((x) => {
      const due = habitsFor(x.a.body, day);
      if (!due.length) return [];
      const ticked = ticksOn(s, x.id, day);
      return [{ x, due, done: due.filter((i) => ticked.includes(i)) }];
    });
}

/** Jadłospis na dziś: który dzień cyklu i które posiłki zjedzone. */
export function mealsToday(s: LinkState, day: string = localDay()): (DayProgress<MealsBody> & { dayIndex: number })[] {
  return live(s)
    .filter(isKind('meals'))
    .flatMap((x) => {
      const dayIndex = mealDayIndex(x.a.body, sentDay(x), day);
      if (dayIndex === null) return [];
      const due = x.a.body.days[dayIndex]!.meals.map((_, i) => i);
      const ticked = ticksOn(s, x.id, day);
      return [{ x, dayIndex, due, done: due.filter((i) => ticked.includes(i)) }];
    });
}

/** Nieprzeczytane wiadomości per współpraca (tylko trwające). */
export function unreadByConnection(s: LinkState): { connectionId: string; count: number }[] {
  const by = new Map<string, number>();
  for (const m of unreadMessages(s)) by.set(m.connectionId, (by.get(m.connectionId) ?? 0) + 1);
  return [...by].map(([connectionId, count]) => ({ connectionId, count }));
}

/**
 * Numer planu albo treningu od prowadzącego: `coach-<8 znaków numeru zalecenia>-<numer>` — ta sama
 * reguła co `coachPrefix` w `assign.ts` (tamten moduł ciągnie atlas ćwiczeń, ten stoi w głównej paczce).
 */
const COACH_ID = /^coach-([0-9a-f]{8})-/;

const shortId = (assignmentId: string): string => assignmentId.replace(/-/g, '').slice(0, 8).toLowerCase();

export interface CoachOf {
  /** Współpraca, z której przyszedł; `null`, gdy zapis współprac już jej nie zna. */
  connection: LinkConnection | null;
  assignment: StoredAssignment;
  name: string;
  profession: LinkConnection['coach']['profession'];
  /** Współpraca trwa — tylko wtedy plan stoi „od prowadzącego” na pierwszym planie. */
  active: boolean;
}

/**
 * Kto przysłał plan albo trening o tym numerze: najpierw zalecenie, z którego powstał (`made`), potem
 * zalecenie o tym samym początku numeru (treningi z rotacji planu). `null` — numer nie jest od
 * prowadzącego albo zapis współprac nic o nim nie wie (np. dane przeniesione kopią na inny telefon).
 */
export function coachOf(s: LinkState, id: string | null | undefined): CoachOf | null {
  const short = id?.match(COACH_ID)?.[1];
  if (!short) return null;
  const assignment = s.assignments.find((a) => a.made?.plan === id || a.made?.workout === id) ?? s.assignments.find((a) => shortId(a.id) === short);
  if (!assignment) return null;
  const connection = s.connections.find((c) => c.id === assignment.connectionId) ?? null;
  return {
    connection,
    assignment,
    name: connection?.coach.name ?? assignment.a.from.name,
    profession: connection?.coach.profession ?? assignment.a.from.profession,
    active: connection?.status === 'active',
  };
}

/**
 * Plany albo treningi od prowadzącego z trwającej współpracy, po prowadzących — `first` (plan, który
 * biegnie, albo dzisiejszy trening) na początku swojej grupy. Reszta listy tu nie wchodzi.
 */
export function byCoach<X extends { id: string }>(s: LinkState, list: readonly X[], first?: string): { key: string; name: string; items: X[] }[] {
  const groups: { key: string; name: string; items: X[] }[] = [];
  for (const x of list) {
    const who = coachOf(s, x.id);
    if (!who?.active || !who.connection) continue;
    const key = who.connection.id;
    const g = groups.find((y) => y.key === key);
    if (g) g.items.push(x);
    else groups.push({ key, name: who.name, items: [x] });
  }
  for (const g of groups) g.items.sort((a, b) => Number(b.id === first) - Number(a.id === first));
  return groups;
}
