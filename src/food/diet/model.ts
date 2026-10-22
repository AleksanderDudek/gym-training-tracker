import { weeklyAdjustment, type Adjustment, type DayTotals } from './day';
import type { DayRow } from './db';
import { tdee, type ForecastInput } from './energy';
import { plannedDay, plannedKcal, type Plan } from './plan';
import type { MacroTargets } from './profiles';
import type { Remaining } from './suggest';
import { formatNumber } from '../lib/format';
import type { Profile } from './types';

/**
 * What every diet screen derives from the same records: the weight on a
 * date, the day's goal after the weekly correction, what is left of it, and
 * the day-by-day input the forecast runs on. Dates are calendar dates
 * (YYYY-MM-DD) handled at noon UTC, so no time zone can move them a day.
 */

const at = (date: string) => new Date(`${date}T12:00:00Z`);

export function addDays(date: string, days: number): string {
  const d = at(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((at(to).getTime() - at(from).getTime()) / 86_400_000);
}

export function mondayOf(date: string): string {
  return addDays(date, -((at(date).getUTCDay() + 6) % 7));
}

const LONG = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/** "Dziś", "Wczoraj", "Jutro", otherwise "poniedziałek, 12 października". */
export function dayLabel(date: string, today: string): string {
  const offset = daysBetween(today, date);
  if (offset === 0) return 'Dziś';
  if (offset === -1) return 'Wczoraj';
  if (offset === 1) return 'Jutro';
  return LONG.format(at(date));
}

export const shortDay = (date: string) => SHORT.format(at(date));

/**
 * Tempo as a change of weight: "−0,5 kg/tydz." is losing, "+0,25 kg/tydz." gaining (the energy
 * model's pace is positive when losing). Below 5 g a week there is no sign.
 */
export function paceText(pace: number): string {
  const sign = pace >= 0.005 ? '−' : pace <= -0.005 ? '+' : '';
  return `${sign}${formatNumber(Math.abs(pace), 2)} kg/tydz.`;
}
export const longDay = (date: string) => LONG.format(at(date));

/** The last weight logged on or before `date`; the start weight before the first one. */
export function weightOn(days: Iterable<DayRow>, date: string, startWeight: number): number {
  let best: DayRow | null = null;
  for (const d of days) {
    if (d.weightKg == null || d.date > date) continue;
    if (!best || d.date > best.date) best = d;
  }
  return best?.weightKg ?? startWeight;
}

/** Meals still ahead at this hour, the current one included: a day of four meals winds down. */
export function mealsLeftAt(hour: number): number {
  if (hour < 11) return 4;
  if (hour < 15) return 3;
  if (hour < 19) return 2;
  return 1;
}

/** What is left of the day's targets. Carbohydrates count down to the LIMIT when the profile has one. */
export function remainingOf(targets: MacroTargets, eaten: DayTotals): Remaining {
  return {
    kcal: targets.kcal - eaten.kcal,
    protein: targets.protein.target - eaten.protein,
    carbs: (targets.carbs.max ?? targets.carbs.target) - eaten.carbs,
    fat: targets.fat.target - eaten.fat,
  };
}

/**
 * The day's calorie goal: the profile's, corrected by this week's balance
 * when the user wants that, and by the day's activity against the plan
 * (`activityKcal`, from `diet/activity.ts`, when the user wants that). Only
 * days that are OVER count in the balance (before `today`, the real one):
 * looking at tomorrow must not read this morning's breakfast as a whole day
 * eaten and raise tomorrow's goal to make up for it. Each of those days is
 * judged against its own goal after its activity.
 */
export function dayGoal(
  profile: Profile,
  eatenByDate: Map<string, number>,
  date: string,
  today: string,
  activityKcal?: (date: string) => number,
): { kcal: number; adjustment: Adjustment | null; activity: number } {
  const activity = activityKcal?.(date) ?? 0;
  if (!profile.adaptWeekly) return { kcal: profile.dailyKcal + activity, adjustment: null, activity };
  // Days eaten to an older goal are no surplus over this one: the balance starts when the goal did.
  const since = profile.goalSince ?? '';
  const history = [...eatenByDate]
    .filter(([d]) => d < today && d >= since)
    .map(([d, kcal]) => ({
      date: d,
      eatenKcal: kcal,
      ...(activityKcal && { goalKcal: profile.dailyKcal + activityKcal(d) }),
    }));
  const adjustment = weeklyAdjustment(profile.dailyKcal, history, date);
  return { kcal: adjustment.adjusted + activity, adjustment, activity };
}

/** The plan's calories for a date, or the profile's goal when there is no plan for it. */
export function plannedKcalOn(profile: Profile, plan: Plan | null, date: string, days: Map<string, DayRow>): number {
  const day = plan ? plannedDay(plan, date, days.get(date)?.choices) : null;
  return plannedKcal(day) ?? profile.dailyKcal;
}

/**
 * The forecast's days from the start: what was planned, and - for days
 * already over that have anything logged - what was really eaten. A past day
 * with nothing logged is assumed to have gone by plan, as the workbook does;
 * today is never "real" yet, it is still being eaten.
 */
export function forecastInputs(
  profile: Profile,
  plan: Plan | null,
  history: { eaten: Map<string, number>; days: Map<string, DayRow> },
  today: string,
  horizonDays: number,
): ForecastInput[] {
  const inputs: ForecastInput[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(profile.startDate, i);
    inputs.push({
      date,
      plannedKcal: plannedKcalOn(profile, plan, date, history.days),
      eatenKcal: date < today ? (history.eaten.get(date) ?? null) : null,
      steps: history.days.get(date)?.steps ?? null,
    });
  }
  return inputs;
}

/**
 * Where the weight is heading from the LAST WEIGHING, eating to plan from
 * then on. The model of what was eaten drifts from the scale (water, the gut,
 * a mislogged dinner); the scale is the truth to project from.
 */
export function projectFromWeighing(
  profile: Profile,
  inputs: ForecastInput[],
  weighing: { date: string; kg: number } | null,
): Map<string, number> {
  const projection = new Map<string, number>();
  if (!weighing) return projection;
  let weight = weighing.kg;
  for (const day of inputs) {
    if (day.date < weighing.date) continue;
    projection.set(day.date, weight);
    weight -= (tdee(profile, weight, day.steps ?? profile.targetSteps) - day.plannedKcal) / profile.kcalPerKg;
  }
  return projection;
}

/** The latest weighing, or null when the scale has never been used. */
export function lastWeighing(days: Iterable<DayRow>): { date: string; kg: number } | null {
  let best: { date: string; kg: number } | null = null;
  for (const d of days)
    if (d.weightKg != null && (!best || d.date > best.date)) best = { date: d.date, kg: d.weightKg };
  return best;
}
