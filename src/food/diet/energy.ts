import type { Profile } from './types';

type Body = Pick<Profile, 'sex' | 'age' | 'heightCm'>;

/** Mifflin-St Jeor, the workbook's formula. */
export function bmr(p: Body, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'M' ? 5 : -161);
}

/**
 * Total expenditure: BMR × activity multiplier, plus walking beyond the steps
 * the multiplier already assumes (never minus: a lazy day is inside the
 * multiplier), plus exercise beyond it spread over the week.
 */
export function tdee(p: Profile, weightKg: number, steps: number = p.targetSteps): number {
  const walking = (Math.max(0, steps - p.baseSteps) / 1000) * weightKg * p.kcalPer1000StepsPerKg;
  return bmr(p, weightKg) * p.activityMultiplier + walking + p.extraWeeklyKcal / 7;
}

export function paceKgPerWeek(p: Profile, weightKg: number, kcal: number): number {
  return ((tdee(p, weightKg) - kcal) * 7) / p.kcalPerKg;
}

/** The daily goal for a pace in kg a week, rounded to whole kcal. */
export function suggestedKcal(p: Profile, weightKg: number, paceKgPerWeekGoal: number): number {
  return Math.round(tdee(p, weightKg) - (paceKgPerWeekGoal * p.kcalPerKg) / 7);
}

export interface ForecastInput {
  date: string;
  plannedKcal: number;
  /** null/undefined: not logged, the plan is assumed (as the workbook does). */
  eatenKcal?: number | null;
  steps?: number | null;
}

export interface ForecastPoint {
  date: string;
  /** Weight at the START of this day if every day went by plan. */
  plan: number;
  /** The same from what was really eaten and walked. */
  real: number;
}

/**
 * Day by day, as the workbook's columns AA and AB: tomorrow's weight is
 * today's minus today's energy gap over the energy in a kilogram, and the
 * expenditure is recomputed at each day's weight, so the loss slows as the
 * weight falls.
 */
export function forecast(p: Profile, days: ForecastInput[]): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  let plan = p.startWeightKg;
  let real = p.startWeightKg;
  for (const day of days) {
    points.push({ date: day.date, plan, real });
    plan -= (tdee(p, plan) - day.plannedKcal) / p.kcalPerKg;
    real -= (tdee(p, real, day.steps ?? p.targetSteps) - (day.eatenKcal ?? day.plannedKcal)) / p.kcalPerKg;
  }
  return points;
}

/** Losing, gaining or keeping: where the target weight lies from the start. */
export type GoalDirection = 'loss' | 'gain' | 'keep';

/** Half a kilogram either way is keeping: the scale moves more than that between two mornings. */
const KEEP_KG = 0.5;

export function goalDirection(p: Pick<Profile, 'startWeightKg' | 'targetWeightKg'>): GoalDirection {
  const gap = p.targetWeightKg - p.startWeightKg;
  return gap < -KEEP_KG ? 'loss' : gap > KEEP_KG ? 'gain' : 'keep';
}

/**
 * The first day the series reaches the target: at or below it when losing, at or above it when
 * gaining. Keeping weight has no day to reach.
 */
export function dayReaching(
  target: number,
  series: ForecastPoint[],
  which: 'plan' | 'real',
  direction: GoalDirection = 'loss',
): string | null {
  if (direction === 'keep') return null;
  const reached = direction === 'loss' ? (w: number) => w <= target : (w: number) => w >= target;
  return series.find((point) => reached(point[which]))?.date ?? null;
}
