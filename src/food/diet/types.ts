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
  dietProfile: DietProfileId;
  /** Correct today's goal by this week's surplus or deficit. */
  adaptWeekly: boolean;
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
