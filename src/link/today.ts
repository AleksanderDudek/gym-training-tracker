import { formDue, formPeriod, habitsFor, localDay, mealDayIndex } from '@gymtracker/link/coaching';
import type { FormBody, HabitsBody, MealsBody } from '@gymtracker/link';
import { answersOf, ticksOn, unreadMessages, visibleAssignments } from './store';
import type { LinkState, StoredAssignment } from './store';

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
