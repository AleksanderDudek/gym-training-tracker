import { addDays, cleanCoaching, habitsFor, mealDayIndex } from '@gymtracker/link';
import type { CoachingV1, HabitItem, HabitsBody, MealsBody, ReceiptStatus, SnapshotV1 } from '@gymtracker/link';
import { dayIn, fullDaysBefore, hasCoaching, isKind, sortSent } from './coached';
import type { LiveItem, ScheduledItem } from './coached';
import type { SentAssignment } from './data';

/**
 * Realizacja nawyków i jadłospisu z części `coaching` paczki — czyste rachunki dla zakładki
 * „Realizacja” i dla listy „Do przejrzenia” (`review.ts` liczy procenty tymi samymi funkcjami).
 *
 * **Dni liczone w strefie telefonu** (`s.tz`), nie przeglądarki prowadzącego: telefon odhacza pod
 * swoim dniem (`localDay`) i od swojego dnia wysłania (`sentDay = localDay(sentAt)`) liczy cykl
 * jadłospisu. Prowadzący w innej strefie liczyłby inne dni i przesunięte numery dni cyklu.
 *
 * **Czego nie wiemy, nie jest „opuszczone”.** Dni po paczce — brak danych. Dzień paczki jest
 * w trakcie (o 10:00 wieczorny nawyk jeszcze czeka), więc procenty liczą się z pełnych dni przed
 * `min(dziś, dzień paczki)` (`fullDaysBefore` z `coached.ts`). Dni przed wysłaniem listy i dni, w które
 * punkt nie obowiązuje — poza rachunkiem. Paczka bez części `coaching` (starsza wersja aplikacji) —
 * wszystkie dni bez danych i procentów brak, zamiast samych „opuszczonych”.
 */

export { dayIn } from './coached';

/** Ile zrobione z tego, co obowiązywało; `pct` — `null`, gdy nic nie obowiązywało. */
export interface Rate {
  done: number;
  due: number;
  pct: number | null;
}

const rate = (done: number, due: number): Rate => ({ done, due, pct: due ? Math.round((done / due) * 100) : null });
const sum = (rs: Rate[]): Rate => rate(rs.reduce((n, r) => n + r.done, 0), rs.reduce((n, r) => n + r.due, 0));

/**
 * - `done` — odhaczone;
 * - `missed` — obowiązywało, pełny dzień minął, nie odhaczone;
 * - `pending` — dzień paczki, jeszcze nie odhaczone (dzień trwał);
 * - `unknown` — po paczce (albo telefon bez części `coaching`), telefon nic o tym dniu nie powiedział;
 * - `off` — nie obowiązywało (inny dzień tygodnia, przed wysłaniem, po dacie końca).
 */
export type HabitCell = 'done' | 'missed' | 'pending' | 'unknown' | 'off';

export interface HabitRow {
  index: number;
  item: HabitItem;
  cells: HabitCell[];
  week: Rate;
  month: Rate;
}

export interface HabitsAdherence {
  id: string;
  title: string;
  body: HabitsBody;
  sentAt: number;
  /** Dzień wysłania w strefie telefonu — wcześniej lista nie obowiązywała. */
  sentDay: string;
  status: ReceiptStatus | null;
  rows: HabitRow[];
  /** Wszystkie punkty razem. */
  week: Rate;
  month: Rate;
  /** Dzień paczki: ile z tego, co obowiązuje; `null` — tego dnia nic. */
  snapDay: { done: number; due: number } | null;
  /** Telefon przysłał już jakieś odhaczenia tej listy. */
  reported: boolean;
}

/** Światła dnia jadłospisu: ≥ 80 % zielone, 50–79 % żółte, mniej — czerwone. */
export type Light = 'green' | 'yellow' | 'red';

export const lightOf = (done: number, due: number): Light | null => {
  if (!due) return null;
  const r = done / due;
  return r >= 0.8 ? 'green' : r >= 0.5 ? 'yellow' : 'red';
};

export interface MealDayCell {
  day: string;
  /**
   * `before` — przed startem cyklu albo przed wysłaniem; `unknown` — po paczce; `partial` — dzień
   * paczki, jeszcze nie wszystko zjedzone; `complete` — pełny dzień (albo dzień paczki ze wszystkim).
   */
  state: 'before' | 'unknown' | 'partial' | 'complete';
  /** Dzień cyklu (numer w `body.days`). */
  index: number | null;
  done: number;
  due: number;
  /** Posiłki dnia, których nie odhaczono (numery). */
  missed: number[];
  light: Light | null;
}

export interface MealsAdherence {
  id: string;
  title: string;
  body: MealsBody;
  sentAt: number;
  sentDay: string;
  /** Pierwszy dzień cyklu (data startu albo dzień wysłania). */
  startDay: string;
  status: ReceiptStatus | null;
  /** Od najstarszego do najnowszego. */
  days: MealDayCell[];
  week: Rate;
  month: Rate;
  reported: boolean;
}

export interface Adherence {
  tz: string | null;
  /** Dzień paczki w strefie telefonu. */
  snapDay: string;
  /** Dziś w strefie telefonu. */
  today: string;
  /** Dni siatki, od najstarszego (ostatni — dziś). */
  days: string[];
  /** Telefon nie wysyła części `coaching` (starsza wersja aplikacji) — o odhaczeniach nic nie wiadomo. */
  noCoaching: boolean;
  habits: HabitsAdherence[];
  meals: MealsAdherence[];
  /** Nawyki i jadłospisy zaplanowane na później — jeszcze nie obowiązują. */
  scheduled: ScheduledItem<HabitsBody | MealsBody>[];
  /** Odrzucone przez podopiecznego — telefon ich nie pokazuje, więc nie liczą się do realizacji. */
  declined: LiveItem<HabitsBody | MealsBody>[];
}

const span = (end: string, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

/** Odhaczenia jednego zalecenia, dzień → numery (kilka wpisów o tym samym numerze — suma). */
function ticksBy(logs: { assignmentId: string; days: Record<string, number[]> }[]): Map<string, Map<string, Set<number>>> {
  const out = new Map<string, Map<string, Set<number>>>();
  for (const log of logs) {
    const id = log.assignmentId.toLowerCase();
    const byDay = out.get(id) ?? new Map<string, Set<number>>();
    for (const [day, list] of Object.entries(log.days)) {
      const set = byDay.get(day) ?? new Set<number>();
      list.forEach((i) => set.add(i));
      byDay.set(day, set);
    }
    out.set(id, byDay);
  }
  return out;
}

interface CellCtx {
  sentDay: string;
  /** Ostatni dzień, o którym telefon coś powiedział (dzień paczki). */
  snapDay: string;
  ticked: ReadonlySet<number> | undefined;
  /** Telefon bez części `coaching` — każdy dzień, który obowiązywał, jest bez danych. */
  silent?: boolean;
}

/** Stan punktu nawyków w jednym dniu. */
export function habitCell(h: Pick<HabitsBody, 'items' | 'until'>, index: number, day: string, ctx: CellCtx): HabitCell {
  if (day < ctx.sentDay || !habitsFor(h, day).includes(index)) return 'off';
  if (ctx.silent || day > ctx.snapDay) return 'unknown';
  if (ctx.ticked?.has(index)) return 'done';
  return day === ctx.snapDay ? 'pending' : 'missed';
}

interface Ctx {
  tz: string | null;
  snapDay: string;
  /** Pełne dni do procentów: 7 i 30 przed `min(dziś, dzień paczki)`. */
  week: readonly string[];
  month: readonly string[];
  /** Dni siatki. */
  days: readonly string[];
  silent: boolean;
}

export function habitsAdherence(x: LiveItem<HabitsBody>, ticks: Map<string, Set<number>> | undefined, ctx: Ctx): HabitsAdherence {
  const sentDay = dayIn(ctx.tz, x.sentAt);
  const c = (i: number, day: string) => habitCell(x.body, i, day, { sentDay, snapDay: ctx.snapDay, ticked: ticks?.get(day), silent: ctx.silent });
  const over = (i: number, days: readonly string[]): Rate => {
    const cells = days.map((d) => c(i, d));
    return rate(cells.filter((s) => s === 'done').length, cells.filter((s) => s === 'done' || s === 'missed').length);
  };
  const rows = x.body.items.map((item, i) => ({
    index: i,
    item,
    cells: ctx.days.map((d) => c(i, d)),
    week: over(i, ctx.week),
    month: over(i, ctx.month),
  }));
  const dueSnap = !ctx.silent && ctx.snapDay >= sentDay ? habitsFor(x.body, ctx.snapDay) : [];
  const doneSnap = dueSnap.filter((i) => ticks?.get(ctx.snapDay)?.has(i)).length;
  return {
    id: x.id,
    title: x.body.title,
    body: x.body,
    sentAt: x.sentAt,
    sentDay,
    status: x.status,
    rows,
    week: sum(rows.map((r) => r.week)),
    month: sum(rows.map((r) => r.month)),
    snapDay: dueSnap.length ? { done: doneSnap, due: dueSnap.length } : null,
    reported: !!ticks && ticks.size > 0,
  };
}

/** Dzień jadłospisu: który dzień cyklu, ile zjedzone i jakie światło. */
export function mealDayCell(m: Pick<MealsBody, 'days' | 'start'>, day: string, ctx: CellCtx): MealDayCell {
  const index = day < ctx.sentDay ? null : mealDayIndex(m, ctx.sentDay, day);
  if (index === null) return { day, state: 'before', index: null, done: 0, due: 0, missed: [], light: null };
  const due = m.days[index]!.meals.length;
  const all = Array.from({ length: due }, (_, i) => i);
  const done = all.filter((i) => ctx.ticked?.has(i));
  const missed = all.filter((i) => !ctx.ticked?.has(i));
  if (ctx.silent || day > ctx.snapDay) return { day, state: 'unknown', index, done: 0, due, missed: [], light: null };
  const complete = day < ctx.snapDay || done.length === due;
  return { day, state: complete ? 'complete' : 'partial', index, done: done.length, due, missed: complete ? missed : [], light: complete ? lightOf(done.length, due) : null };
}

export function mealsAdherence(x: LiveItem<MealsBody>, ticks: Map<string, Set<number>> | undefined, ctx: Ctx): MealsAdherence {
  const sentDay = dayIn(ctx.tz, x.sentAt);
  const cell = (day: string) => mealDayCell(x.body, day, { sentDay, snapDay: ctx.snapDay, ticked: ticks?.get(day), silent: ctx.silent });
  const over = (days: readonly string[]): Rate => {
    const cells = days.map(cell).filter((d) => d.state === 'complete');
    return rate(cells.reduce((n, d) => n + d.done, 0), cells.reduce((n, d) => n + d.due, 0));
  };
  return {
    id: x.id,
    title: x.body.title,
    body: x.body,
    sentAt: x.sentAt,
    sentDay,
    startDay: x.body.start ?? sentDay,
    status: x.status,
    days: ctx.days.map(cell),
    week: over(ctx.week),
    month: over(ctx.month),
    reported: !!ticks && ticks.size > 0,
  };
}

/** Co z paczki potrzebne do realizacji: strefa, chwila paczki i jej część `coaching` (`null` — telefon jej nie wysyła). */
export interface CoachingInput {
  tz: string | null;
  at: number;
  coaching: CoachingV1 | null;
}

/**
 * Realizacja obowiązujących nawyków i jadłospisów (`sortSent(...).live`). Siatka: `days` dni
 * kończących się dziś w strefie telefonu (0 — bez siatki, same procenty: tak liczy lista).
 */
export function adherenceOf(input: CoachingInput, live: readonly LiveItem[], now: number, days = 14): Pick<Adherence, 'tz' | 'snapDay' | 'today' | 'days' | 'noCoaching' | 'habits' | 'meals'> {
  const { tz } = input;
  const snapDay = dayIn(tz, input.at);
  const todayTz = dayIn(tz, now);
  // Zegar telefonu przed zegarem prowadzącego — siatka i tak sięga dnia paczki.
  const today = todayTz < snapDay ? snapDay : todayTz;
  const grid = span(today, days);
  const c = input.coaching ?? cleanCoaching(null);
  const habitTicks = ticksBy(c.habits);
  const mealTicks = ticksBy(c.meals);
  const silent = input.coaching === null;
  const ctx: Ctx = { tz, snapDay, days: grid, week: fullDaysBefore(todayTz, snapDay, 7), month: fullDaysBefore(todayTz, snapDay, 30), silent };
  return {
    tz,
    snapDay,
    today,
    days: grid,
    noCoaching: silent,
    habits: live.filter(isKind('habits')).map((x) => habitsAdherence(x, habitTicks.get(x.id), ctx)),
    meals: live.filter(isKind('meals')).map((x) => mealsAdherence(x, mealTicks.get(x.id), ctx)),
  };
}

const habitsOrMeals = (x: LiveItem): x is LiveItem<HabitsBody | MealsBody> => x.body.kind === 'habits' || x.body.kind === 'meals';

/**
 * Realizacja wszystkich obowiązujących nawyków i jadłospisów (bez wycofanych, odrzuconych
 * i zaplanowanych — te osobno). Siatka: `days` dni kończących się dziś w strefie telefonu.
 */
export function adherence(s: SnapshotV1, sent: readonly SentAssignment[], now: number = Date.now(), days = 14): Adherence {
  const sorted = sortSent(sent, now);
  const input: CoachingInput = { tz: typeof s.tz === 'string' ? s.tz : null, at: s.at, coaching: hasCoaching(s) ? cleanCoaching(s.coaching) : null };
  return {
    ...adherenceOf(input, sorted.live, now, days),
    scheduled: sorted.scheduled.filter(habitsOrMeals) as ScheduledItem<HabitsBody | MealsBody>[],
    declined: sorted.declined.filter(habitsOrMeals),
  };
}

/** Nawyki razem i jadłospisy razem: 7 pełnych dni przed `min(dziś, dzień paczki)`. */
export function weekRates(a: Pick<Adherence, 'habits' | 'meals'>): { habits: Rate; meals: Rate } {
  return { habits: sum(a.habits.map((h) => h.week)), meals: sum(a.meals.map((m) => m.week)) };
}

/** Jedna liczba na podopiecznego: nawyki i jadłospis razem, 7 pełnych dni przed `min(dziś, dzień paczki)`. */
export function weekSummary(a: Pick<Adherence, 'habits' | 'meals'>): Rate {
  return sum([...a.habits.map((h) => h.week), ...a.meals.map((m) => m.week)]);
}
