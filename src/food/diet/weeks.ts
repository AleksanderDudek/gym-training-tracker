import type { GoalDirection } from './energy';
import { addDays, daysBetween, mondayOf } from './model';
import { kcalStatus } from './target';
import { leastSquares, type WeighIn } from './trend';

/**
 * „Tydzień po tygodniu”: weeks side by side - what was eaten on the complete days, what the scale
 * did, steps and workouts - and, across the finished weeks, which habits go with progress toward
 * the goal (spec 2026-10-24 §2.8, §4.6).
 *
 * A week, not a day: the scale moves 1-2 kg a day with water and salt, so only a week says
 * anything. The weight change is the least-squares slope of the week's weigh-ins, Monday to the
 * next Monday (that morning closes Sunday's eating), from at least 3 weigh-ins at least 4 days
 * apart. Food is the average of the complete days (`isComplete`, today never), so a breakfast-only
 * day does not pull the week down.
 *
 * The findings compare weeks with more of a habit against weeks with less. Five habits are
 * compared, so a difference counts only when it is at least 0.1 kg a week and 2.6 Welch standard
 * errors (not 2), over at least 8 finished weeks with 3 on each side - and only such findings are
 * returned. They are associations, not proof: the weeks with more trainings may also be the weeks
 * with less food, so every finding carries the food difference between its groups.
 */

/** What one day held, from the diary and the gym data. */
export interface DayFacts {
  date: string;
  /** Logged kcal; `null` - nothing logged. */
  eaten: number | null;
  /** The day's target (`targetOn(profile, date)`). */
  goal: number;
  /** The day counts for the averages (`isComplete`); today never does. */
  complete: boolean;
  steps: number | null;
  /** Strength sessions logged. */
  workouts: number;
  /** Exercise snacks („przekąski ruchowe”): compared in the findings, not a column. */
  snacks: number;
  /** Cardio outings of 10+ minutes: compared in the findings, not a column. */
  outings: number;
}

export interface WeekRow {
  monday: string;
  /** Monday to Sunday, without the days after today. */
  days: DayFacts[];
  /** The week is over: its counts are final. */
  complete: boolean;
  /** kg a week (negative: losing) and the weigh-ins behind it; `null` - too few weigh-ins. */
  weight: { change: number; weighIns: number } | null;
  /** The average of the complete days and how many there were; `null` without one. */
  eaten: { avg: number; days: number } | null;
  /** Average over the days with steps and the days at the step goal, today left out. */
  steps: { avg: number; goalDays: number } | null;
  workouts: number;
  snacks: number;
  outings: number;
}

/** A week's slope needs this many weigh-ins... */
export const MIN_WEIGH_INS = 3;
/** ...spanning at least this many days. */
export const MIN_SPAN_DAYS = 4;

/**
 * Whether a day's eating was on the goal, on the ±100 kcal band (`kcalStatus`): losing - not over
 * it, gaining - not under it, keeping - within it.
 */
export function onGoal(eaten: number, goal: number, direction: GoalDirection): boolean {
  const { kind } = kcalStatus(goal, eaten);
  if (direction === 'loss') return kind !== 'over';
  if (direction === 'gain') return kind !== 'left';
  return kind === 'within';
}

export interface WeeksInput {
  /** Every day from the first week's Monday to today (missing days are treated as empty). */
  days: DayFacts[];
  /** The gym weight log (`GymBridge.weights`). */
  weighIns: readonly WeighIn[];
  today: string;
  /** The step goal (the gym's `STEP_GOAL`). */
  stepsGoal: number;
  /** How many weeks back, the current one included. */
  weeks?: number;
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const emptyDay = (date: string): DayFacts => ({
  date,
  eaten: null,
  goal: 0,
  complete: false,
  steps: null,
  workouts: 0,
  snacks: 0,
  outings: 0,
});

/** The weeks, newest first; a week with nothing logged at all is left out. */
export function weekRows({ days, weighIns, today, stepsGoal, weeks = 12 }: WeeksInput): WeekRow[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const thisMonday = mondayOf(today);
  const rows: WeekRow[] = [];
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(thisMonday, -7 * w);
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
      .filter((d) => d <= today)
      .map((date) => byDate.get(date) ?? emptyDay(date));
    const end = addDays(monday, 7);
    const points = weighIns.filter((x) => x.day >= monday && x.day <= end && x.day <= today);
    const line = leastSquares(points);
    const weight =
      line && line.n >= MIN_WEIGH_INS && daysBetween(line.first, line.last) >= MIN_SPAN_DAYS
        ? { change: line.slope * 7 || 0, weighIns: line.n }
        : null;
    // Today is not over: half a day of food and steps would pull the week's averages down.
    const closed = week.filter((d) => d.date < today);
    const complete = closed.filter((d): d is DayFacts & { eaten: number } => d.complete && d.eaten !== null);
    const walked = closed.filter((d): d is DayFacts & { steps: number } => d.steps !== null);
    const row: WeekRow = {
      monday,
      days: week,
      complete: addDays(monday, 6) < today,
      weight,
      eaten: complete.length ? { avg: avg(complete.map((d) => d.eaten)), days: complete.length } : null,
      steps: walked.length
        ? { avg: avg(walked.map((d) => d.steps)), goalDays: walked.filter((d) => d.steps >= stepsGoal).length }
        : null,
      workouts: week.reduce((s, d) => s + d.workouts, 0),
      snacks: week.reduce((s, d) => s + d.snacks, 0),
      outings: week.reduce((s, d) => s + d.outings, 0),
    };
    // The next Monday's weigh-in alone closes a week, it does not make one.
    const weighed = points.some((p) => p.day < end);
    const logged = week.some((d) => d.eaten !== null);
    const now = week.find((d) => d.date === today);
    const startedToday = !!now && now.steps !== null;
    const empty = !logged && !row.steps && !row.workouts && !row.snacks && !row.outings && !weighed && !startedToday;
    if (!empty) rows.push(row);
  }
  return rows;
}

/* ---------------- What goes with progress ---------------- */

export type Factor = 'eating' | 'workouts' | 'steps' | 'snacks' | 'outings';

export interface Finding {
  factor: Factor;
  /** Weeks with more of the habit (eating: weeks on the goal), from `threshold` up. */
  more: { weeks: number; change: number };
  less: { weeks: number; change: number };
  /** Where „more” starts: trainings, average steps, snacks, outings a week; eating has none. */
  threshold: number | null;
  /** `more.change − less.change`, kg a week. */
  diff: number;
  /** „More” goes clearly toward the goal (`true`) or clearly against it (`false`). */
  helps: boolean;
  /** How much more was eaten a day in the „more” weeks; `null` for eating itself or without logs. */
  kcalGap: number | null;
}

export interface Findings {
  /** Finished weeks with a weight change - the evidence. */
  weeks: number;
  /** Only the differences clearly bigger than the scale's noise, the biggest first. */
  findings: Finding[];
}

/** Fewer finished weeks with a weight change than this, and nothing is compared. */
export const MIN_WEEKS = 8;
/** Each side of a comparison needs at least this many weeks. */
export const MIN_GROUP = 3;
/** A smaller difference is no difference, kg a week: a week of weigh-ins cannot tell 100 g apart. */
export const MIN_DIFF = 0.1;
/** Welch standard errors a difference must reach: 2.6, not 2, because five habits are compared. */
export const WELCH_SE = 2.6;

/** Sample variance (n − 1). */
function variance(xs: number[]): number {
  const m = avg(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

/** The split that balances the two sides best: „more” is from `t` up. Steps snap to 500. */
function split(values: number[], snap: (v: number) => number): number | null {
  const candidates = [...new Set(values.map(snap))].sort((a, b) => a - b);
  let best: number | null = null;
  let bestSide = 0;
  for (const t of candidates) {
    const more = values.filter((v) => v >= t).length;
    const side = Math.min(more, values.length - more);
    if (side > bestSide) {
      best = t;
      bestSide = side;
    }
  }
  return bestSide >= MIN_GROUP ? best : null;
}

const FACTORS: { factor: Exclude<Factor, 'eating'>; value: (r: WeekRow) => number | null; snap: (v: number) => number }[] = [
  { factor: 'workouts', value: (r) => r.workouts, snap: (v) => v },
  { factor: 'steps', value: (r) => r.steps?.avg ?? null, snap: (v) => Math.floor(v / 500) * 500 },
  { factor: 'snacks', value: (r) => r.snacks, snap: (v) => v },
  { factor: 'outings', value: (r) => r.outings, snap: (v) => v },
];

/** A finding when the two groups differ clearly: by 0.1 kg a week and 2.6 Welch SE at least. */
function compare(
  factor: Factor,
  weeks: { row: WeekRow; more: boolean }[],
  threshold: number | null,
  direction: Exclude<GoalDirection, 'keep'>,
): Finding | null {
  const more = weeks.filter((w) => w.more).map((w) => w.row);
  const less = weeks.filter((w) => !w.more).map((w) => w.row);
  if (more.length < MIN_GROUP || less.length < MIN_GROUP) return null;
  const changes = (rows: WeekRow[]) => rows.map((r) => r.weight!.change);
  const m = avg(changes(more));
  const l = avg(changes(less));
  const diff = m - l;
  const se = Math.sqrt(variance(changes(more)) / more.length + variance(changes(less)) / less.length);
  // A hair of tolerance: the difference of two averages is a floating-point number.
  if (Math.abs(diff) < MIN_DIFF - 1e-9 || Math.abs(diff) < WELCH_SE * se - 1e-9) return null;
  const ate = (rows: WeekRow[]) => rows.flatMap((r) => (r.eaten ? [r.eaten.avg] : []));
  const kcalGap =
    factor !== 'eating' && ate(more).length && ate(less).length ? Math.round(avg(ate(more)) - avg(ate(less))) : null;
  return {
    factor,
    more: { weeks: more.length, change: m },
    less: { weeks: less.length, change: l },
    threshold,
    diff,
    // Losing: more weight off is toward the goal; gaining: more on.
    helps: direction === 'loss' ? diff < 0 : diff > 0,
    kcalGap,
  };
}

/**
 * Which habits go with progress toward the goal, across the finished weeks that have a weight
 * change - only the clear ones. The current week is left out: its counts are not final. Keeping
 * weight has no direction to progress in, so nothing is compared.
 */
export function findings(rows: WeekRow[], direction: GoalDirection): Findings {
  const done = rows.filter((r) => r.complete && r.weight);
  if (done.length < MIN_WEEKS || direction === 'keep') return { weeks: done.length, findings: [] };
  const out: Finding[] = [];

  // Eating: weeks on the goal (most complete days within it) against the rest.
  const eating = done
    .filter((r) => r.eaten)
    .map((row) => {
      const on = row.days.filter((d) => d.complete && d.eaten !== null && onGoal(d.eaten, d.goal, direction)).length;
      return { row, more: on * 2 > row.eaten!.days };
    });
  const e = compare('eating', eating, null, direction);
  if (e) out.push(e);

  for (const f of FACTORS) {
    const weeks = done.flatMap((row) => {
      const value = f.value(row);
      return value === null ? [] : [{ row, value }];
    });
    const t = split(
      weeks.map((w) => w.value),
      f.snap,
    );
    if (t === null) continue;
    const found = compare(
      f.factor,
      weeks.map((w) => ({ row: w.row, more: w.value >= t })),
      t,
      direction,
    );
    if (found) out.push(found);
  }

  out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { weeks: done.length, findings: out };
}
