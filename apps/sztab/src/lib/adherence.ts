import { addDays, cleanCoaching, habitsFor, mealDayIndex } from '@gymtracker/link';
import type { AssignmentBody, HabitItem, HabitsBody, MealsBody, ReceiptStatus, SnapshotV1 } from '@gymtracker/link';
import type { SentAssignment } from './data';

/**
 * Realizacja nawyków i jadłospisu z części `coaching` paczki — czyste rachunki dla zakładki
 * „Realizacja” (i każdego, kto chce jednej liczby na liście podopiecznych).
 *
 * **Dni liczone w strefie telefonu** (`s.tz`), nie przeglądarki prowadzącego: telefon odhacza pod
 * swoim dniem (`localDay`) i od swojego dnia wysłania (`sentDay = localDay(sentAt)`) liczy cykl
 * jadłospisu. Prowadzący w innej strefie liczyłby inne dni i przesunięte numery dni cyklu.
 *
 * **Czego nie wiemy, nie jest „opuszczone”.** Dni po paczce — brak danych. Dzień paczki jest
 * w trakcie (o 10:00 wieczorny nawyk jeszcze czeka), więc procenty liczą się z pełnych dni przed
 * nim. Dni przed wysłaniem listy i dni, w które punkt nie obowiązuje — poza rachunkiem.
 */

/** Dzień `YYYY-MM-DD` chwili `ms` w strefie `tz`. Strefa nieznana tej przeglądarce — strefa przeglądarki. */
export function dayIn(tz: string | undefined, ms: number): string {
  const parts = formatter(tz).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string | undefined): Intl.DateTimeFormat {
  const k = tz ?? '';
  let f = formatters.get(k);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
      f = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: tz || undefined });
    } catch {
      // Strefa z zepsutej albo bardzo nowej paczki — lepiej dzień przeglądarki niż pusta zakładka.
      f = new Intl.DateTimeFormat('en-CA', opts);
    }
    formatters.set(k, f);
  }
  return f;
}

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
 * - `unknown` — po paczce, telefon jeszcze nic o tym dniu nie powiedział;
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
  tz: string;
  /** Dzień paczki w strefie telefonu. */
  snapDay: string;
  /** Dziś w strefie telefonu. */
  today: string;
  /** Dni siatki, od najstarszego (ostatni — dziś). */
  days: string[];
  habits: HabitsAdherence[];
  meals: MealsAdherence[];
}

const span = (end: string, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

type Live<B> = { a: SentAssignment; body: B };
type BodyOf<K extends AssignmentBody['kind']> = Extract<AssignmentBody, { kind: K }>;

/** Wysłane i niewycofane nawyki albo jadłospisy, które dało się otworzyć — od najnowszego. */
function live<K extends 'habits' | 'meals'>(sent: readonly SentAssignment[], kind: K): Live<BodyOf<K>>[] {
  return sent
    .filter((a) => !a.withdrawnAt && a.envelope?.body.kind === kind)
    .sort((x, y) => y.envelope!.sentAt - x.envelope!.sentAt)
    .map((a) => ({ a, body: a.envelope!.body as BodyOf<K> }));
}

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

/** Stan punktu nawyków w jednym dniu. */
export function habitCell(
  h: Pick<HabitsBody, 'items' | 'until'>,
  index: number,
  day: string,
  ctx: { sentDay: string; snapDay: string; ticked: ReadonlySet<number> | undefined },
): HabitCell {
  if (day < ctx.sentDay || !habitsFor(h, day).includes(index)) return 'off';
  if (day > ctx.snapDay) return 'unknown';
  if (ctx.ticked?.has(index)) return 'done';
  return day === ctx.snapDay ? 'pending' : 'missed';
}

/** Pełne dni okna `n` dni przed dniem paczki (sam dzień paczki trwa — poza procentami). */
const fullDays = (snapDay: string, n: number): string[] => span(addDays(snapDay, -1), n);

export function habitsAdherence(
  x: Live<HabitsBody>,
  ticks: Map<string, Set<number>> | undefined,
  ctx: { tz: string; snapDay: string; days: readonly string[] },
): HabitsAdherence {
  const sentAt = x.a.envelope!.sentAt;
  const sentDay = dayIn(ctx.tz, sentAt);
  const c = (i: number, day: string) => habitCell(x.body, i, day, { sentDay, snapDay: ctx.snapDay, ticked: ticks?.get(day) });
  const over = (i: number, days: string[]): Rate => {
    const cells = days.map((d) => c(i, d));
    return rate(cells.filter((s) => s === 'done').length, cells.filter((s) => s === 'done' || s === 'missed').length);
  };
  const week = fullDays(ctx.snapDay, 7);
  const month = fullDays(ctx.snapDay, 30);
  const rows = x.body.items.map((item, i) => ({
    index: i,
    item,
    cells: ctx.days.map((d) => c(i, d)),
    week: over(i, week),
    month: over(i, month),
  }));
  const dueSnap = ctx.snapDay >= sentDay ? habitsFor(x.body, ctx.snapDay) : [];
  const doneSnap = dueSnap.filter((i) => ticks?.get(ctx.snapDay)?.has(i)).length;
  return {
    id: x.a.id,
    title: x.body.title,
    body: x.body,
    sentAt,
    sentDay,
    status: x.a.receipt?.status ?? null,
    rows,
    week: sum(rows.map((r) => r.week)),
    month: sum(rows.map((r) => r.month)),
    snapDay: dueSnap.length ? { done: doneSnap, due: dueSnap.length } : null,
    reported: !!ticks && ticks.size > 0,
  };
}

/** Dzień jadłospisu: który dzień cyklu, ile zjedzone i jakie światło. */
export function mealDayCell(
  m: Pick<MealsBody, 'days' | 'start'>,
  day: string,
  ctx: { sentDay: string; snapDay: string; ticked: ReadonlySet<number> | undefined },
): MealDayCell {
  const index = day < ctx.sentDay ? null : mealDayIndex(m, ctx.sentDay, day);
  if (index === null) return { day, state: 'before', index: null, done: 0, due: 0, missed: [], light: null };
  const due = m.days[index]!.meals.length;
  const all = Array.from({ length: due }, (_, i) => i);
  const done = all.filter((i) => ctx.ticked?.has(i));
  const missed = all.filter((i) => !ctx.ticked?.has(i));
  if (day > ctx.snapDay) return { day, state: 'unknown', index, done: 0, due, missed: [], light: null };
  const complete = day < ctx.snapDay || done.length === due;
  return { day, state: complete ? 'complete' : 'partial', index, done: done.length, due, missed: complete ? missed : [], light: complete ? lightOf(done.length, due) : null };
}

export function mealsAdherence(
  x: Live<MealsBody>,
  ticks: Map<string, Set<number>> | undefined,
  ctx: { tz: string; snapDay: string; days: readonly string[] },
): MealsAdherence {
  const sentAt = x.a.envelope!.sentAt;
  const sentDay = dayIn(ctx.tz, sentAt);
  const cell = (day: string) => mealDayCell(x.body, day, { sentDay, snapDay: ctx.snapDay, ticked: ticks?.get(day) });
  const over = (days: string[]): Rate => {
    const cells = days.map(cell).filter((d) => d.state === 'complete');
    return rate(cells.reduce((n, d) => n + d.done, 0), cells.reduce((n, d) => n + d.due, 0));
  };
  return {
    id: x.a.id,
    title: x.body.title,
    body: x.body,
    sentAt,
    sentDay,
    startDay: x.body.start ?? sentDay,
    status: x.a.receipt?.status ?? null,
    days: ctx.days.map(cell),
    week: over(fullDays(ctx.snapDay, 7)),
    month: over(fullDays(ctx.snapDay, 30)),
    reported: !!ticks && ticks.size > 0,
  };
}

/**
 * Realizacja wszystkich wysłanych nawyków i jadłospisów (bez wycofanych). Siatka: `span` dni
 * kończących się dziś w strefie telefonu.
 */
export function adherence(s: SnapshotV1, sent: readonly SentAssignment[], now: number = Date.now(), days = 14): Adherence {
  const tz = s.tz;
  const snapDay = dayIn(tz, s.at);
  const todayTz = dayIn(tz, now);
  // Zegar telefonu przed zegarem prowadzącego — siatka i tak sięga dnia paczki.
  const today = todayTz < snapDay ? snapDay : todayTz;
  const grid = span(today, days);
  const c = cleanCoaching(s.coaching);
  const habitTicks = ticksBy(c.habits);
  const mealTicks = ticksBy(c.meals);
  const ctx = { tz, snapDay, days: grid };
  return {
    tz,
    snapDay,
    today,
    days: grid,
    habits: live(sent, 'habits').map((x) => habitsAdherence(x, habitTicks.get(x.a.id.toLowerCase()), ctx)),
    meals: live(sent, 'meals').map((x) => mealsAdherence(x, mealTicks.get(x.a.id.toLowerCase()), ctx)),
  };
}

/** Jedna liczba na podopiecznego: nawyki i jadłospis razem, 7 pełnych dni przed paczką. */
export function weekSummary(a: Adherence): Rate {
  return sum([...a.habits.map((h) => h.week), ...a.meals.map((m) => m.week)]);
}
