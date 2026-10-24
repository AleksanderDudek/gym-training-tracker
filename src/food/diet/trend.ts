/**
 * The weight trend and the observed pace (spec 2026-10-24 §2.4, §2.6).
 *
 * - The display trend is an exponential moving average per weigh-in, aware of gaps between them
 *   and guarded against typos (a step moves it at most 3 kg). It lags about 9 days, which is why
 *   screens call it „trend”.
 * - The pace is a least-squares line with an honest standard error: the residual spread has a
 *   floor, and day-to-day water makes neighbouring residuals alike (lag-1 autocorrelation), so the
 *   naive error would be too small. The Monday check and the progress page use the same line.
 *
 * Dates are calendar dates (YYYY-MM-DD) handled at noon UTC. This module keeps its own two date
 * helpers and imports nothing.
 */

/** One weigh-in: the gym weight log through the bridge (`GymBridge.weights`). */
export interface WeighIn {
  day: string;
  kg: number;
}

export interface TrendPoint extends WeighIn {
  /** The display trend after this weigh-in. */
  trend: number;
}

/** A least-squares line through weigh-ins: x is days since the first one. */
export interface Line {
  /** kg a day (negative when losing). */
  slope: number;
  /** The line's weight on a date. */
  at(day: string): number;
  /** Honest standard error of the slope, kg a day. */
  se: number;
  /** Weigh-ins on the line. */
  n: number;
  /** Residual standard deviation (n − 2), floored at 0.35 kg. */
  sd: number;
  /** Lag-1 autocorrelation of the residuals as used in `se`. */
  r1: number;
  first: string;
  last: string;
}

export interface PaceFit {
  /** kg a week, positive when losing. */
  pace: number;
  /** Its honest standard error, kg a week. */
  se: number;
  weighIns: number;
  /** Days from the first to the last weigh-in. */
  spanDays: number;
}

/**
 * When the target weight comes at the observed pace: a range of dates (`late` null — only „at the
 * earliest”), `far` beyond two years, or `plan` when the pace points away from the target or is
 * under 0.1 kg a week — the screen then says the plan sentence instead.
 */
export type Reach = { kind: 'range'; early: string; late: string | null } | { kind: 'far' } | { kind: 'plan' };

/** A weigh-in step moves the trend by at most this much: guards against typos (`validWeight` allows 30–300). */
const STEP_LIMIT = 3;
/** The trend keeps 0.9 of itself per day between weigh-ins. */
const KEEP_PER_DAY = 0.9;
const RESIDUAL_FLOOR = 0.35;
const R1_MAX = 0.6;
const R1_DEFAULT = 0.3;
/** Below this many weigh-ins the autocorrelation is assumed (`R1_DEFAULT`), not measured. */
const R1_MIN_N = 10;
export const PACE_MIN_WEIGH_INS = 5;
export const PACE_MIN_SPAN = 14;
/** Slower than this toward the target is no pace to forecast from, kg a week. */
const REACH_MIN_PACE = 0.1;
/** The late end needs at least this much left after taking 2 SE off the pace, kg a week. */
const REACH_LATE_MIN = 0.05;
const REACH_MAX_DAYS = 730;

const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`);
const daysBetween = (from: string, to: string): number => Math.round((noon(to) - noon(from)) / 86_400_000);
function addDays(day: string, n: number): string {
  const d = new Date(noon(day));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** One weigh-in a day (the last given wins), oldest first; unreadable ones left out. */
function byDay(weighIns: readonly WeighIn[]): WeighIn[] {
  const days = new Map<string, WeighIn>();
  for (const w of weighIns)
    if (Number.isFinite(w.kg) && w.kg > 0 && !Number.isNaN(noon(w.day))) days.set(w.day, { day: w.day, kg: w.kg });
  return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/**
 * The display trend at every weigh-in: the first weigh-in starts it, each next one moves it by
 * `1 − 0.9^days` of the way (one day: a tenth; a week: about a half), the step clamped to ±3 kg.
 */
export function trendSeries(weighIns: readonly WeighIn[]): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const w of byDay(weighIns)) {
    const prev = out.at(-1);
    if (!prev) {
      out.push({ ...w, trend: w.kg });
      continue;
    }
    const share = 1 - KEEP_PER_DAY ** daysBetween(prev.day, w.day);
    const kg = Math.min(prev.trend + STEP_LIMIT, Math.max(prev.trend - STEP_LIMIT, w.kg));
    out.push({ ...w, trend: prev.trend + share * (kg - prev.trend) });
  }
  return out;
}

/** The display trend on a date: at the last weigh-in on or before it; null before the first. */
export function trendOn(weighIns: readonly WeighIn[], date: string): number | null {
  let trend: number | null = null;
  for (const p of trendSeries(weighIns)) {
    if (p.day > date) break;
    trend = p.trend;
  }
  return trend;
}

/**
 * Least squares through the weigh-ins (one a day), with the honest standard error of the slope:
 * the residual SD with n − 2, floored at 0.35 kg; the lag-1 autocorrelation of the residuals in
 * date order clamped to [0, 0.6] (0.3 below 10 weigh-ins, 0 when the points lie on the line);
 * `SE = sd / √Sxx × √((1 + r₁)/(1 − r₁))`. Null with fewer than two weigh-ins.
 */
export function leastSquares(weighIns: readonly WeighIn[]): Line | null {
  const pts = byDay(weighIns);
  const n = pts.length;
  if (n < 2) return null;
  const first = pts[0]!.day;
  const last = pts[n - 1]!.day;
  const xs = pts.map((p) => daysBetween(first, p.day));
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = pts.reduce((s, p) => s + p.kg, 0) / n;
  let sxx = 0;
  let sxy = 0;
  pts.forEach((p, i) => {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (p.kg - my);
  });
  const slope = sxy / sxx;
  const lineAt = (x: number) => my + slope * (x - mx);
  const residuals = pts.map((p, i) => p.kg - lineAt(xs[i]!));
  const squares = residuals.reduce((s, r) => s + r * r, 0);
  const sd = Math.max(n > 2 ? Math.sqrt(squares / (n - 2)) : Number.POSITIVE_INFINITY, RESIDUAL_FLOOR);
  let r1 = R1_DEFAULT;
  if (n >= R1_MIN_N) {
    let lagged = 0;
    for (let i = 1; i < n; i++) lagged += residuals[i]! * residuals[i - 1]!;
    // Points exactly on a line have nothing to correlate (and 0/0 would be NaN).
    r1 = squares > 0 ? Math.min(R1_MAX, Math.max(0, lagged / squares)) : 0;
  }
  const se = (sd / Math.sqrt(sxx)) * Math.sqrt((1 + r1) / (1 - r1));
  return { slope, at: (day) => lineAt(daysBetween(first, day)), se, n, sd, r1, first, last };
}

/**
 * The observed pace over weigh-ins from `from` to `to` (both inclusive): kg a week, positive when
 * losing, with its honest SE. Null below 5 weigh-ins or a span under 14 days.
 */
export function paceOver(weighIns: readonly WeighIn[], from: string, to: string): PaceFit | null {
  const pts = byDay(weighIns).filter((w) => w.day >= from && w.day <= to);
  if (pts.length < PACE_MIN_WEIGH_INS) return null;
  const spanDays = daysBetween(pts[0]!.day, pts[pts.length - 1]!.day);
  if (spanDays < PACE_MIN_SPAN) return null;
  const line = leastSquares(pts)!;
  return { pace: -line.slope * 7 || 0, se: line.se * 7, weighIns: pts.length, spanDays };
}

/**
 * When the target weight comes at the observed pace ± 2 SE, counted from `today`: the early end
 * at the pace plus 2 SE, the late end at the pace minus 2 SE (none when that leaves 0.05 kg a week
 * or less, or lands beyond two years). Beyond two years even at the early end: `far`.
 */
export function reachRange(input: {
  trendKg: number;
  targetKg: number;
  pace: number;
  se: number;
  today: string;
}): Reach {
  const distance = input.trendKg - input.targetKg;
  // Toward the target, whichever way it lies: losing is a positive pace and a positive distance.
  const toward = Math.sign(distance) * input.pace;
  if (distance === 0 || toward < REACH_MIN_PACE) return { kind: 'plan' };
  const kg = Math.abs(distance);
  const margin = 2 * Math.max(0, input.se);
  const earlyDays = Math.round((kg / (toward + margin)) * 7);
  if (earlyDays > REACH_MAX_DAYS) return { kind: 'far' };
  const slow = toward - margin;
  const lateDays = slow > REACH_LATE_MIN ? Math.round((kg / slow) * 7) : null;
  return {
    kind: 'range',
    early: addDays(input.today, earlyDays),
    late: lateDays !== null && lateDays <= REACH_MAX_DAYS ? addDays(input.today, lateDays) : null,
  };
}
