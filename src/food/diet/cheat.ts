import { weeklyAdjustment, type DayTotals } from './day';
import type { PlannedCheat } from './db';
import type { MacroTargets } from './profiles';
import type { Profile } from './types';

/**
 * What a cheat meal does to the day and beyond — the numbers under the cheat-meal sheet. Pure: the
 * goal comes in already corrected by the week and by the activity the user expects for the rest of
 * the day; this module only answers the questions behind a cheat meal: do I fit, by how much do I
 * go over, what is left for the other meals, and how much does it cost the week and the scale.
 */

export interface CheatInput {
  cheat: Pick<PlannedCheat, 'kcal' | 'protein' | 'carbs' | 'fat'>;
  /** The day's targets at the goal after the week and the expected activity. */
  targets: MacroTargets;
  eaten: DayTotals;
  /** Meals still ahead at this hour, the cheat meal included (`mealsLeftAt`). */
  mealsLeft: number;
  profile: Profile;
  /** Weight on the day, kg — for the walking that would offset a surplus. */
  kg: number;
  date: string;
  /** Eaten kcal of the days of this week before `date` (the weekly balance). */
  eatenByDate: Map<string, number>;
  /** The goal of a closed day after its activity; base goal when not given. */
  goalOf?: (date: string) => number;
  /** kcal of the day's plan still ahead (meal prep or workbook); `null` without a plan. */
  plannedLeftKcal: number | null;
  /** A typical training of this person, kcal — another way to offset a surplus. */
  typicalWorkoutKcal: number;
}

export interface CheatSimulation {
  goal: number;
  eatenBefore: number;
  after: number;
  /** goal − (eaten + cheat meal): negative is over. */
  left: number;
  over: number;
  /** Over as a share of the goal. */
  overShare: number;
  /** `fits` - room left; `tight` - fits, but little is left for the other meals; `over` - more than 5 % over. */
  verdict: 'fits' | 'tight' | 'over' | 'edge';
  /** Meals after the cheat meal today. */
  restMeals: number;
  perMeal: { kcal: number; protein: number } | null;
  protein: number;
  carbs: { left: number; over: number };
  fat: { left: number; over: number };
  /** Share of the remaining planned portions that still fits (0..1); `null` without a plan. */
  planShare: number | null;
  week:
    | { kind: 'spread'; perDay: number; days: number; unpaid: number }
    | { kind: 'sunday' | 'off' | 'none' };
  /** Body-mass equivalent of the surplus, kg. */
  kg: number;
  offset: { steps: number; trainings: number } | null;
}

/** A surplus left unpaid by the weekly spread below this is rounding, not the 10 % cap. */
const UNPAID_MIN = 50;

/** Below this per remaining meal the day still fits, but the meals are snacks. */
export const TIGHT_MEAL_KCAL = 250;

const weekday = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * The surplus of the day as the weekly balance will see it tomorrow: the change of tomorrow's goal
 * against the day eaten exactly to goal. Sunday closes the week - nothing carries over.
 */
function weekOf(input: CheatInput, goal: number, after: number): CheatSimulation['week'] {
  const { profile, date } = input;
  if (after <= goal) return { kind: 'none' };
  if (!profile.adaptWeekly) return { kind: 'off' };
  if (weekday(date) === 6) return { kind: 'sunday' };
  const tomorrow = nextDay(date);
  const history = (todayKcal: number) =>
    [...input.eatenByDate, [date, todayKcal] as [string, number]]
      .filter(([d]) => d < tomorrow)
      .map(([d, kcal]) => ({ date: d, eatenKcal: kcal, goalKcal: d === date ? goal : (input.goalOf?.(d) ?? profile.dailyKcal) }));
  const withCheat = weeklyAdjustment(profile.dailyKcal, history(after), tomorrow);
  const onPlan = weeklyAdjustment(profile.dailyKcal, history(goal), tomorrow);
  const perDay = withCheat.delta - onPlan.delta;
  const days = withCheat.daysLeft;
  // What the capped spread does not pay back. Tens of kcal are rounding, not the cap: not worth a word.
  const unpaid = Math.max(0, Math.round(after - goal + perDay * days));
  return { kind: 'spread', perDay, days, unpaid: unpaid >= UNPAID_MIN ? unpaid : 0 };
}

export function simulateCheat(input: CheatInput): CheatSimulation {
  const { cheat, targets, eaten, profile } = input;
  const goal = targets.kcal;
  const after = eaten.kcal + cheat.kcal;
  const left = Math.round(goal - after);
  const over = Math.max(0, -left);
  const restMeals = Math.max(0, input.mealsLeft - 1);
  const protein = Math.round(targets.protein.target - eaten.protein - (cheat.protein ?? 0));
  const carbsEaten = eaten.carbs + (cheat.carbs ?? 0);
  const carbsLimit = targets.carbs.max ?? targets.carbs.target;
  const carbsCeiling = targets.carbs.max ?? targets.carbs.target * 1.25;
  const fatEaten = eaten.fat + (cheat.fat ?? 0);
  const fatCeiling = targets.fat.max ?? Number.POSITIVE_INFINITY;

  const verdict: CheatSimulation['verdict'] =
    over > goal * 0.05
      ? 'over'
      : over > 0
        ? 'edge'
        : restMeals > 0 && left < restMeals * TIGHT_MEAL_KCAL
          ? 'tight'
          : 'fits';

  const walkingPerStep = (input.kg * profile.kcalPer1000StepsPerKg) / 1000;
  return {
    goal: Math.round(goal),
    eatenBefore: Math.round(eaten.kcal),
    after: Math.round(after),
    left,
    over,
    overShare: goal > 0 ? over / goal : 0,
    verdict,
    restMeals,
    perMeal:
      restMeals > 0 && left > 0
        ? { kcal: Math.round(left / restMeals), protein: Math.round(Math.max(0, protein) / restMeals) }
        : null,
    protein,
    carbs: { left: Math.round(carbsLimit - carbsEaten), over: Math.max(0, Math.round(carbsEaten - carbsCeiling)) },
    fat: {
      left: Math.round(targets.fat.target - fatEaten),
      over: Number.isFinite(fatCeiling) ? Math.max(0, Math.round(fatEaten - fatCeiling)) : 0,
    },
    planShare:
      input.plannedLeftKcal !== null && input.plannedLeftKcal > 0
        ? Math.min(1, Math.max(0, left / input.plannedLeftKcal))
        : null,
    week: weekOf(input, goal, after),
    kg: over / profile.kcalPerKg,
    offset:
      over > 0
        ? {
            steps: walkingPerStep > 0 ? Math.ceil(over / walkingPerStep / 500) * 500 : 0,
            trainings: input.typicalWorkoutKcal > 0 ? over / input.typicalWorkoutKcal : 0,
          }
        : null,
  };
}
