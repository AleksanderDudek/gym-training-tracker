import type { DayTotals } from './day';
import type { PlannedCheat } from './db';
import type { MacroTargets } from './profiles';
import { kcalStatus } from './target';

/**
 * What a bigger meal („Większy posiłek”) does to its day — the numbers under the sheet (spec
 * 2026-10-24 §4.4). Pure: the day's targets come in at the day's target (`targetOn`), and this
 * module answers only the day's questions: does it fit on the ±100 band, what is left for the other
 * meals, and how much of a planned day still fits. Nothing beyond the day: no weekly balance, no
 * scale arithmetic, no making up for it with activity.
 */

export interface CheatInput {
  cheat: Pick<PlannedCheat, 'kcal' | 'protein' | 'carbs' | 'fat'>;
  /** The day's targets at its target (`targetOn(profile, date)`). */
  targets: MacroTargets;
  eaten: DayTotals;
  /** Meals still ahead at this hour, the bigger meal included (`mealsLeftAt`). */
  mealsLeft: number;
  /** kcal of the day's plan still ahead (meal prep or workbook); `null` without a plan. */
  plannedLeftKcal: number | null;
}

export interface CheatSimulation {
  goal: number;
  eatenBefore: number;
  after: number;
  /** goal − (eaten + the bigger meal), kcal: negative is over. */
  left: number;
  /** kcal over the target, rounded to 10, when more than the band over; 0 otherwise. */
  over: number;
  /**
   * On the ±100 band (`kcalStatus`): `over` more than 100 over the target; `full` within 100 of it;
   * `tight` fits, but less than 250 kcal per remaining meal; `fits` (the last meal of the day when
   * no other meals are left).
   */
  verdict: 'fits' | 'tight' | 'full' | 'over';
  /** Meals after the bigger meal today. */
  restMeals: number;
  perMeal: { kcal: number; protein: number } | null;
  /** Protein still to eat after the bigger meal, g (negative: more than the target). */
  protein: number;
  /** Carbs over the diet style's limit (keto, low carb), g; 0 for styles without a limit. */
  carbsOver: number;
  /** Share of the remaining planned portions that still fits (0..1); `null` without a plan. */
  planShare: number | null;
}

/** Below this per remaining meal the day still fits, but the meals are snacks. */
export const TIGHT_MEAL_KCAL = 250;

export function simulateCheat(input: CheatInput): CheatSimulation {
  const { cheat, targets, eaten } = input;
  const goal = targets.kcal;
  const after = eaten.kcal + cheat.kcal;
  const left = Math.round(goal - after);
  const restMeals = Math.max(0, input.mealsLeft - 1);
  const protein = Math.round(targets.protein.target - eaten.protein - (cheat.protein ?? 0));
  const carbsLimit = targets.carbs.max;
  const carbsEaten = eaten.carbs + (cheat.carbs ?? 0);
  const status = kcalStatus(goal, after);
  const verdict: CheatSimulation['verdict'] =
    status.kind === 'over'
      ? 'over'
      : status.kind === 'within'
        ? 'full'
        : restMeals > 0 && left < restMeals * TIGHT_MEAL_KCAL
          ? 'tight'
          : 'fits';

  return {
    goal: Math.round(goal),
    eatenBefore: Math.round(eaten.kcal),
    after: Math.round(after),
    left,
    over: status.kind === 'over' ? status.kcal : 0,
    verdict,
    restMeals,
    perMeal:
      restMeals > 0 && left > 0
        ? { kcal: Math.round(left / restMeals), protein: Math.round(Math.max(0, protein) / restMeals) }
        : null,
    protein,
    carbsOver: carbsLimit === null ? 0 : Math.max(0, Math.round(carbsEaten - carbsLimit)),
    planShare:
      input.plannedLeftKcal !== null && input.plannedLeftKcal > 0
        ? Math.min(1, Math.max(0, left / input.plannedLeftKcal))
        : null,
  };
}
