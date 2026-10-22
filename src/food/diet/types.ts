import type { Macros } from '../recipes/macros';

export type Sex = 'M' | 'K';
export type DietProfileId = 'redukcja' | 'zbilansowana' | 'lowcarb' | 'keto' | 'sportowa';

/** Everything the energy model and the targets need. One per device. */
export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  /** YYYY-MM-DD */
  startDate: string;
  /** BMR × this = expenditure at the base step count (1.28: desk job + 2 trainings a week). */
  activityMultiplier: number;
  /** Steps already inside the multiplier. */
  baseSteps: number;
  /** Planned steps a day. */
  targetSteps: number;
  kcalPer1000StepsPerKg: number;
  /** Exercise beyond what the multiplier assumes, per week. */
  extraWeeklyKcal: number;
  /** Energy in 1 kg of body mass (a practical value, not a physical constant). */
  kcalPerKg: number;
  /** The daily calorie goal before any weekly adjustment. */
  dailyKcal: number;
  /**
   * What the energy model gets wrong for this person, in kcal a day, as the check-ins measured it
   * from the scale and the log: part of the expenditure (`tdee`) everywhere - the pace, the goals of
   * the pace chips, the forecast. A check-in compares the scale with the corrected model, so the
   * same error is never applied twice. 0 until a check-in is accepted; editable in the profile.
   */
  kcalCorrection: number;
  /**
   * The day `dailyKcal` last changed (YYYY-MM-DD). The week's balance counts only the days since:
   * days eaten to an older goal are not a surplus over a new one.
   */
  goalSince?: string;
  dietProfile: DietProfileId;
  /** Correct today's goal by this week's surplus or deficit. */
  adaptWeekly: boolean;
  /**
   * Move the day's goal by the activity against the plan: more steps or an extra training add,
   * fewer steps or a skipped planned training take off (`diet/activity.ts`). Absent means on.
   */
  adaptActivity?: boolean;
  /** Chain key to plan around when nothing nearby is known (null: any). */
  preferredStore: string | null;
}

/** The workbook's defaults for everything a person does not have to know. */
export const MODEL_DEFAULTS = {
  activityMultiplier: 1.28,
  baseSteps: 4000,
  targetSteps: 10_000,
  kcalPer1000StepsPerKg: 0.4,
  extraWeeklyKcal: 0,
  kcalPerKg: 7500,
} as const;

/** Nutrition of one eaten amount; unknown macros are null, never zero. */
export interface Nutrients {
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export type { Macros };
