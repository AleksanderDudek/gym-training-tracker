import type { DayTotals } from './day';
import type { PlannedCheat } from './db';
import { remainingOf } from './model';
import { DIET_PROFILES, type DietProfile, type MacroTargets } from './profiles';
import type { Remaining } from './suggest';
import type { Profile } from './types';

/**
 * What is left of a day for the next meal: the day's targets at its goal, what is eaten, a planned
 * cheat meal reserved (it takes its kcal and one of the meals ahead), and the meals still to come.
 * One rule for the diary's „Co teraz?” and „Zjedz teraz” nearby.
 */

export interface DayNeeds {
  profile: DietProfile;
  targets: MacroTargets;
  /** What is eaten plus the planned cheat meal. */
  reserved: DayTotals;
  /** Meals ahead besides the cheat meal (0 when the cheat meal is the last one). */
  restMeals: number;
  remaining: Remaining;
  /** Meals the remaining is split over, at least 1. */
  mealsLeft: number;
  /** About one meal's share of what is left - what `suggest` aims a meal at. */
  meal: { kcal: number; protein: number };
}

/** What is eaten plus the planned cheat meal: the rest of the day is planned around it. */
export function withCheat(eaten: DayTotals, cheat: PlannedCheat): DayTotals {
  return {
    kcal: eaten.kcal + cheat.kcal,
    protein: eaten.protein + (cheat.protein ?? 0),
    carbs: eaten.carbs + (cheat.carbs ?? 0),
    fat: eaten.fat + (cheat.fat ?? 0),
    unknownMacros: eaten.unknownMacros + (cheat.protein === null || cheat.carbs === null || cheat.fat === null ? 1 : 0),
  };
}

/** The floors `suggest` uses for one meal: a snack's worth of kcal, a little protein. */
const MIN_MEAL_KCAL = 150;
const MIN_MEAL_PROTEIN = 10;

export function dayNeeds(input: {
  profile: Pick<Profile, 'dietProfile' | 'targetWeightKg'>;
  goalKcal: number;
  eaten: DayTotals;
  cheat: PlannedCheat | null;
  /** Meals still ahead in the day, before the cheat meal takes one (`mealsLeftAt`). */
  mealsAhead: number;
}): DayNeeds {
  const profile = DIET_PROFILES[input.profile.dietProfile];
  const targets = profile.targets(input.goalKcal, input.profile.targetWeightKg);
  const reserved = input.cheat ? withCheat(input.eaten, input.cheat) : input.eaten;
  const restMeals = input.cheat ? Math.max(0, input.mealsAhead - 1) : input.mealsAhead;
  const remaining = remainingOf(targets, reserved);
  const mealsLeft = Math.max(1, restMeals);
  return {
    profile,
    targets,
    reserved,
    restMeals,
    remaining,
    mealsLeft,
    meal: {
      kcal: Math.max(MIN_MEAL_KCAL, remaining.kcal / mealsLeft),
      protein: Math.max(MIN_MEAL_PROTEIN, remaining.protein / mealsLeft),
    },
  };
}
