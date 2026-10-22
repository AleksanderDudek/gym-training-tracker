import type { GoalDirection } from './energy';
import { addDays, daysBetween, mondayOf } from './model';

/**
 * „Co działa u Ciebie”: weeks side by side - what was eaten, how much moved, and what the scale did
 * - and, across the weeks, which habits go with progress toward the goal.
 *
 * A week, not a day: the scale moves 1-2 kg a day with water and salt, so only a week's trend says
 * anything. The weight change is the least-squares slope of the week's weigh-ins, Monday to the next
 * Monday (that morning closes Sunday's eating) - the check-in's method, every weigh-in counts.
 *
 * The findings compare weeks with more of a habit against weeks with less. They are associations
 * from a handful of noisy weeks, not proof: the weeks with more trainings may also be the weeks with
 * less food, so every finding carries the food difference between its groups.
 */

/** What one day held, from the diary and the gym data. */
export interface DayFacts {
  date: string;
  /** Eaten kcal; `null` - nothing logged. */
  eaten: number | null;
  /** The day's goal with its weekly and activity corrections (`dayGoal`). */
  goal: number;
  steps: number | null;
  /** Strength sessions logged. */
  workouts: number;
  /** Exercise snacks („przekąski ruchowe”). */
  snacks: number;
  /** Cardio outings of 10+ minutes (treadmill, bike, dance, watch runs and walks). */
  outings: number;
  /** WHO activity minutes, moderate-equivalent. */
  activeMin: number;
}

export type Verdict = 'good' | 'bad' | 'flat';

export interface WeekRow {
  monday: string;
  /** Monday to Sunday, without the days after today. */
  days: DayFacts[];
  /** The week is over: its counts are final. */
  complete: boolean;
  /** kg a week (negative: losing) and the weigh-ins behind it; `null` - too few weigh-ins. */
  weight: { change: number; weighIns: number } | null;
  verdict: Verdict | null;
  /** Averages over the logged days, today left out (it is not over); `null` without a logged day. */
  eaten: { avg: number; goal: number; days: number } | null;
  /** Average over the days with steps and the days at the step target, today left out. */
  steps: { avg: number; goalDays: number } | null;
  workouts: number;
  snacks: number;
  outings: number;
  activeMin: number;
}

/** A change smaller than this is no change: a week of weigh-ins cannot tell 100 g apart. */
export const FLAT_KG = 0.1;
/** Keeping weight: within this a week is on target. */
export const KEEP_KG = 0.2;
/** A slope needs at least two weigh-ins this many days apart. */
export const MIN_SPAN_DAYS = 4;
/** A day this much over (or under, when gaining) its goal is off the goal - as in „Kalorie – 14 dni”. */
export const GOAL_SLACK = 0.05;

function slope(points: { x: number; kg: number }[]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.kg, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.kg - my), 0);
  return sxx > 0 ? sxy / sxx : 0;
}

/** Good, bad or flat for this goal. */
export function verdictOf(change: number, direction: GoalDirection): Verdict {
  if (direction === 'keep') return Math.abs(change) <= KEEP_KG ? 'good' : 'bad';
  const toward = direction === 'loss' ? -change : change;
  return toward >= FLAT_KG ? 'good' : toward <= -FLAT_KG ? 'bad' : 'flat';
}

/** Whether a day's eating was on the goal, by the goal's direction: losing - not over, gaining - not under. */
export function onGoal(eaten: number, goal: number, direction: GoalDirection): boolean {
  if (direction === 'loss') return eaten <= goal * (1 + GOAL_SLACK);
  if (direction === 'gain') return eaten >= goal * (1 - GOAL_SLACK);
  return Math.abs(eaten - goal) <= goal * GOAL_SLACK;
}

export interface WeeksInput {
  /** Every day from the first week's Monday to today (missing days are treated as empty). */
  days: DayFacts[];
  weighIns: { date: string; kg: number }[];
  today: string;
  stepsGoal: number;
  direction: GoalDirection;
  /** How many weeks back, the current one included. */
  weeks?: number;
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** The weeks, newest first; a week with nothing logged at all is left out. */
export function weekRows({ days, weighIns, today, stepsGoal, direction, weeks = 12 }: WeeksInput): WeekRow[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const thisMonday = mondayOf(today);
  const rows: WeekRow[] = [];
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(thisMonday, -7 * w);
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
      .filter((d) => d <= today)
      .map((date) => byDate.get(date) ?? { date, eaten: null, goal: 0, steps: null, workouts: 0, snacks: 0, outings: 0, activeMin: 0 });
    const end = addDays(monday, 7);
    const points = weighIns
      .filter((x) => x.date >= monday && x.date <= end && x.date <= today)
      .map((x) => ({ x: daysBetween(monday, x.date), kg: x.kg }));
    const span = points.length ? Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) : 0;
    const weight = points.length >= 2 && span >= MIN_SPAN_DAYS ? { change: slope(points) * 7, weighIns: points.length } : null;
    // Today is not over: half a day of food and steps would pull the week's averages down.
    const closed = week.filter((d) => d.date < today);
    const logged = closed.filter((d): d is DayFacts & { eaten: number } => d.eaten !== null);
    const walked = closed.filter((d): d is DayFacts & { steps: number } => d.steps !== null);
    const row: WeekRow = {
      monday,
      days: week,
      complete: addDays(monday, 6) < today,
      weight,
      verdict: weight ? verdictOf(weight.change, direction) : null,
      eaten: logged.length
        ? { avg: avg(logged.map((d) => d.eaten)), goal: avg(logged.map((d) => d.goal)), days: logged.length }
        : null,
      steps: walked.length
        ? { avg: avg(walked.map((d) => d.steps)), goalDays: walked.filter((d) => d.steps >= stepsGoal).length }
        : null,
      workouts: week.reduce((s, d) => s + d.workouts, 0),
      snacks: week.reduce((s, d) => s + d.snacks, 0),
      outings: week.reduce((s, d) => s + d.outings, 0),
      activeMin: week.reduce((s, d) => s + d.activeMin, 0),
    };
    // The next Monday's weigh-in alone closes a week, it does not make one.
    const weighed = points.some((p) => p.x < 7);
    const now = week.find((d) => d.date === today);
    const startedToday = !!now && (now.eaten !== null || now.steps !== null);
    const empty =
      !row.weight && !row.eaten && !row.steps && !row.workouts && !row.snacks && !row.outings && !weighed && !startedToday;
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
  /** „More” goes toward the goal (`true`), against it (`false`), or no clear difference (`null`). */
  helps: boolean | null;
  /**
   * How tightly the habit and the change move together across the weeks (|r|). A weak link is no
   * clear difference, whatever the averages say: one odd week can make them.
   */
  strength: 'weak' | 'moderate' | 'clear';
  /** How much more was eaten a day in the „more” weeks; `null` for eating itself or without logs. */
  kcalGap: number | null;
}

export interface Findings {
  /** Finished weeks with a weight change - the evidence. */
  weeks: number;
  findings: Finding[];
}

/** Fewer finished weeks with a weight change than this, and nothing is compared. */
export const MIN_WEEKS = 4;
/** Each side of a comparison needs at least this many weeks. */
export const MIN_GROUP = 2;
/** Below this |r| the habit and the weight barely move together. */
export const WEAK_R = 0.3;

function pearson(xs: number[], ys: number[]): number {
  const mx = avg(xs);
  const my = avg(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i]! - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  });
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
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

function compare(
  factor: Factor,
  weeks: { row: WeekRow; value: number; more: boolean }[],
  threshold: number | null,
  direction: GoalDirection,
): Finding | null {
  const more = weeks.filter((w) => w.more);
  const less = weeks.filter((w) => !w.more);
  if (more.length < MIN_GROUP || less.length < MIN_GROUP) return null;
  const change = (ws: typeof weeks) => avg(ws.map((w) => w.row.weight!.change));
  const m = change(more);
  const l = change(less);
  const diff = m - l;
  const gain = direction === 'keep' ? Math.abs(l) - Math.abs(m) : direction === 'loss' ? -diff : diff;
  const r = Math.abs(pearson(weeks.map((w) => w.value), weeks.map((w) => w.row.weight!.change)));
  const ate = (ws: typeof weeks) => ws.flatMap((w) => (w.row.eaten ? [w.row.eaten.avg] : []));
  const kcalGap =
    factor !== 'eating' && ate(more).length && ate(less).length ? Math.round(avg(ate(more)) - avg(ate(less))) : null;
  return {
    factor,
    more: { weeks: more.length, change: m },
    less: { weeks: less.length, change: l },
    threshold,
    diff,
    helps: Math.abs(gain) < FLAT_KG || r < WEAK_R ? null : gain > 0,
    strength: r < WEAK_R ? 'weak' : r < 0.5 ? 'moderate' : 'clear',
    kcalGap,
  };
}

/**
 * Which habits go with progress toward the goal, across the finished weeks that have a weight
 * change. The current week is left out: its counts are not final.
 */
export function findings(rows: WeekRow[], direction: GoalDirection): Findings {
  const done = rows.filter((r) => r.complete && r.weight);
  if (done.length < MIN_WEEKS) return { weeks: done.length, findings: [] };
  const out: Finding[] = [];

  // Eating: weeks on the goal (most days within it) against the rest.
  const eating = done
    .filter((r) => r.eaten)
    .map((row) => {
      const on = row.days.filter((d) => d.eaten !== null && onGoal(d.eaten, d.goal, direction)).length;
      return { row, value: on / row.eaten!.days, more: on * 2 > row.eaten!.days };
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
      weeks.map((w) => ({ ...w, more: w.value >= t })),
      t,
      direction,
    );
    if (found) out.push(found);
  }

  // Clear differences first, the biggest on top; „no clear difference” after them.
  out.sort((a, b) => Number(a.helps === null) - Number(b.helps === null) || Math.abs(b.diff) - Math.abs(a.diff));
  return { weeks: done.length, findings: out };
}
