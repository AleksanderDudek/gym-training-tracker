import { bmr, type GoalDirection } from './energy';
import { trendOn, type WeighIn } from './trend';
import type { ActivityLevel, GoalBy, GoalChange, Pause, Profile, Sex } from './types';

/**
 * The daily calorie target: one number a day, the same all week (spec 2026-10-24 §2).
 *
 * The burn estimate starts from NASEM 2023 and the person's usual week, plus what the Monday
 * check has learned (`burnOffset`). The target is the burn minus the pace's deficit, rounded to
 * 50 and never below the safe floor. A day's target is a lookup in the goals history
 * (`targetOn`), never a calculation: past days keep the target they had.
 *
 * Pure functions only. Pace is in kg a week, positive when losing.
 */

/**
 * NASEM 2023, Dietary Reference Intakes for Energy (doi 10.17226/26818), adults:
 * `c − a·max(age, 19) + h·heightCm + w·kg` per sex and activity level.
 */
export const NASEM_2023: Record<Sex, Record<ActivityLevel, readonly [c: number, a: number, h: number, w: number]>> = {
  M: {
    inactive: [753.07, 10.83, 6.5, 14.1],
    low: [581.47, 10.83, 8.3, 14.94],
    active: [1004.82, 10.83, 6.52, 15.91],
    very: [-517.88, 10.83, 15.61, 19.11],
  },
  K: {
    inactive: [584.9, 7.01, 5.72, 11.71],
    low: [575.77, 7.01, 6.6, 12.14],
    active: [710.25, 7.01, 6.54, 12.34],
    very: [511.83, 7.01, 9.07, 12.56],
  },
};

/** ±100 kcal around the target is still on target, on every screen. */
export const BAND = 100;

/** A day counts as complete when at least this share of its target is logged. */
export const COMPLETE_DAY = 0.6;

/** Pace chips, kg a week: three losing, maintenance, one gaining. */
export const PACE_CHIPS = [0.25, 0.5, 0.75, 0, -0.25] as const;

/** The stored range of a target, kept for compatibility (history entries are never re-clamped). */
const KCAL_RANGE = [800, 6000] as const;
/** The goals history keeps this many newest entries. */
const GOALS_KEPT = 200;
const MIN_BMI = 18.5;
/** Fastest loss: 1 % of the weight a week; fastest gain: 0.5 % (divided, so 60 kg gives exactly 0.6). */
const maxLossOf = (kg: number): number => kg / 100;
const maxGainOf = (kg: number): number => kg / 200;

// `|| 0`: rounding a small negative number gives −0, which `Object.is` and the screen tell apart.
export const r10 = (n: number): number => Math.round(n / 10) * 10 || 0;
export const r50 = (n: number): number => Math.round(n / 50) * 50 || 0;
export const c50 = (n: number): number => Math.ceil(n / 50) * 50 || 0;
/** A pace rounded to 0.05 kg a week. */
export const snap05 = (pace: number): number => Math.round(pace * 20) / 20 || 0;

type Body = Pick<Profile, 'sex' | 'age' | 'heightCm'>;
type Burn = Body & Pick<Profile, 'activityLevel' | 'burnOffset'>;
type Limits = Body & Pick<Profile, 'pregnancy' | 'targetWeightKg'>;
/** What `targetFor` reads. */
export type TargetInput = Burn & Limits & Pick<Profile, 'kcalPerKg' | 'goalPace' | 'belowFloorOk'>;

/** NASEM 2023 estimated energy requirement at this weight, kcal a day. */
export function eer(p: Body & Pick<Profile, 'activityLevel'>, kg: number): number {
  const [c, a, h, w] = NASEM_2023[p.sex][p.activityLevel];
  return c - a * Math.max(p.age, 19) + h * p.heightCm + w * kg;
}

/** The burn estimate: NASEM plus what the Monday check has learned. */
export const burnOf = (p: Burn, kg: number): number => eer(p, kg) + p.burnOffset;

/** Never set by the app below this, whatever the formula says. */
export const hardMinOf = (p: Pick<Profile, 'sex'>): number => (p.sex === 'M' ? 1500 : 1200);

/** The safe floor: the BMR rounded UP to 50 (so "never below BMR" is literally true), at least the hard minimum. */
export const floorOf = (p: Body, kg: number): number => Math.max(c50(bmr(p, kg)), hardMinOf(p));

/** The lowest target the app may set: the floor, or the hard minimum for a doctor- or dietitian-agreed target. */
export const minTargetOf = (p: Body & Pick<Profile, 'belowFloorOk'>, kg: number): number =>
  p.belowFloorOk ? hardMinOf(p) : floorOf(p, kg);

export const bmiOf = (heightCm: number, kg: number): number => kg / (heightCm / 100) ** 2;

/** The lowest target weight with a BMI of 18.5, in whole kg rounded up (so it never falls below 18.5). */
export const minHealthyKg = (heightCm: number): number => Math.ceil(MIN_BMI * (heightCm / 100) ** 2 - 1e-9);

/** Why a direction is closed and how fast each may go, kg a week (both limits ≥ 0). */
export interface Safety {
  noLoss: 'age' | 'pregnancy' | 'bmi' | null;
  noGain: 'age' | 'pregnancy' | null;
  maxLoss: number;
  maxGain: number;
}

/**
 * The safety rails at this weight: no deficit under 18, in pregnancy or breastfeeding, or with a
 * BMI under 18.5 at the current or the target weight; loss at most 1 % of the weight a week, gain
 * 0.5 %. No surplus under 18 — and none in pregnancy either: the spec's pace rule (§2.2) closes
 * only loss there, but the profile field forces the pace to 0 in pregnancy (§3.1, §4.5), and one
 * rule here keeps the form, the normaliser and the target from disagreeing.
 */
export function safety(p: Limits, kg: number): Safety {
  const noLoss =
    p.age < 18
      ? 'age'
      : p.pregnancy
        ? 'pregnancy'
        : bmiOf(p.heightCm, kg) < MIN_BMI || bmiOf(p.heightCm, p.targetWeightKg) < MIN_BMI
          ? 'bmi'
          : null;
  const noGain = p.age < 18 ? 'age' : p.pregnancy ? 'pregnancy' : null;
  return { noLoss, noGain, maxLoss: noLoss ? 0 : maxLossOf(kg), maxGain: noGain ? 0 : maxGainOf(kg) };
}

/** The pace within the safety rails. */
export function safePace(p: Limits, kg: number, pace: number): number {
  const { maxLoss, maxGain } = safety(p, kg);
  return Math.min(maxLoss, Math.max(-maxGain, pace)) || 0;
}

/**
 * The target for a pace at this weight: the burn minus the pace's deficit (plus the surplus when
 * gaining), rounded to 50. A losing target never goes below `minTargetOf`. Keeping or gaining the
 * spec leaves unfloored; it still gets the hard minimum here, which only bites with an extreme
 * learned offset and makes pace 0 give exactly `maintenanceOf` ("app-set targets are never below
 * the hard minimum").
 */
export function targetFor(p: TargetInput, kg: number, pace: number = p.goalPace): number {
  const safe = safePace(p, kg, pace);
  const raw = r50(burnOf(p, kg) - (safe * p.kcalPerKg) / 7);
  return Math.max(raw, safe > 0 ? minTargetOf(p, kg) : hardMinOf(p));
}

/** Eating to keep the weight: the burn rounded to 50, at least the hard minimum. */
export const maintenanceOf = (p: Burn, kg: number): number => Math.max(r50(burnOf(p, kg)), hardMinOf(p));

/** The pace a target gives at this weight, kg a week (positive when losing). */
export const impliedPace = (p: Burn & Pick<Profile, 'kcalPerKg'>, kg: number, kcal: number): number =>
  ((burnOf(p, kg) - kcal) * 7) / p.kcalPerKg;

/** Losing, keeping or gaining, from the pace's sign. */
export function directionOf(pace: number): GoalDirection {
  return pace > 1e-9 ? 'loss' : pace < -1e-9 ? 'gain' : 'keep';
}

type Goals = Pick<Profile, 'goals' | 'dailyKcal'>;

/**
 * The target of a date: the kcal of the latest goals entry starting on or before it; a date before
 * the first entry takes the first entry. A profile without any history keeps `dailyKcal`.
 */
export function targetOn(p: Goals, date: string): number {
  let first: GoalChange | null = null;
  let best: GoalChange | null = null;
  for (const g of p.goals ?? []) {
    if (!first || g.from < first.from) first = g;
    if (g.from <= date && (!best || g.from >= best.from)) best = g;
  }
  return (best ?? first)?.kcal ?? p.dailyKcal;
}

/**
 * A new target from `from` on: every entry from that day on is replaced, the newest 200 are kept,
 * and `dailyKcal` mirrors the target of `today`. `today` defaults to `from`; a future entry (the
 * end of a break) passes the real today so the mirror stays right.
 */
export function setTarget<P extends Goals>(p: P, kcal: number, from: string, by: GoalBy, today: string = from): P {
  const entry: GoalChange = { from, kcal: Math.min(KCAL_RANGE[1], Math.max(KCAL_RANGE[0], kcal)), by };
  const goals = [...(p.goals ?? []).filter((g) => g.from < from), entry].slice(-GOALS_KEPT);
  const next = { ...p, goals };
  return { ...next, dailyKcal: targetOn(next, today) };
}

/** No calories on screen: chosen, or always under 18. */
export const hidesKcal = (p: Pick<Profile, 'hideKcal' | 'age'>): boolean => p.hideKcal || p.age < 18;

/** The break covering a date (both ends inclusive), or null. */
export const pauseOn = (p: Pick<Profile, 'pauses'>, date: string): Pause | null =>
  (p.pauses ?? []).find((x) => x.from <= date && date <= x.to) ?? null;

/**
 * Whether a day's log is complete, the one rule for the Monday check, the weeks table and the
 * 14-day chart. `eaten` is the day's logged kcal (null or 0: nothing logged). The person's own
 * word wins (`DayRow.partial`); otherwise 60 % of the day's target. Callers leave today out.
 */
export function isComplete(eaten: number | null | undefined, partial: boolean | undefined, target: number): boolean {
  if (partial === true) return false;
  const logged = eaten != null && eaten > 0;
  if (partial === false || !logged) return logged;
  // A hair of tolerance: the share is a floating-point product, the day's sum may be fractional.
  return eaten >= target * COMPLETE_DAY - 1e-9;
}

export interface KcalStatus {
  kind: 'left' | 'within' | 'over';
  /** kcal left or over, rounded to 10; 0 within the band. */
  kcal: number;
}

/** A day against its target on the ±100 band: left, within the target, or over it. */
export function kcalStatus(target: number, counted: number): KcalStatus {
  const d = counted - target;
  if (d < -BAND) return { kind: 'left', kcal: r10(-d) };
  if (d > BAND) return { kind: 'over', kcal: r10(d) };
  return { kind: 'within', kcal: 0 };
}

/** The old activity multiplier read as a level (the upgrade): 1.2 and 1.28 sit, 1.375 walks, 1.55 moves a lot. */
export function activityFromMultiplier(m: number): ActivityLevel {
  return m < 1.33 ? 'inactive' : m < 1.46 ? 'low' : m < 1.64 ? 'active' : 'very';
}

/** The weight the targets use: the display trend on that day, the start weight before any weigh-in. */
export const currentWeight = (p: Pick<Profile, 'startWeightKg'>, weighIns: readonly WeighIn[], date: string): number =>
  trendOn(weighIns, date) ?? p.startWeightKg;
