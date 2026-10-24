import type { Macros } from '../recipes/macros';

export type Sex = 'M' | 'K';
export type DietProfileId = 'redukcja' | 'zbilansowana' | 'lowcarb' | 'keto' | 'sportowa';

/** The usual week, NASEM 2023 ch. 7: mostly sitting, about an hour of activity a day, a lot, a great deal. */
export type ActivityLevel = 'inactive' | 'low' | 'active' | 'very';

/** Who set a target: the first setup, the person, the Monday check, the upgrade, a break, a safety rule. */
export type GoalBy = 'setup' | 'user' | 'check' | 'migration' | 'break' | 'safety';

/** One step of the target history: `kcal` a day from `from` (YYYY-MM-DD) until the next entry. */
export interface GoalChange {
  from: string;
  kcal: number;
  by: GoalBy;
}

/** A break („Przerwa”): both dates inclusive; `kcal` is the target to return to afterwards. */
export interface Pause {
  from: string;
  to: string;
  kcal: number;
}

/** After a change the Monday check waits before moving in `dir` (0: either way); `until` is exclusive. */
export interface Hold {
  dir: -1 | 0 | 1;
  until: string;
}

/** Weigh-ins before `from` are left out of the check: water after a start, a big change or a break. */
export interface Settle {
  from: string;
  why: 'start' | 'change' | 'pause';
}

/** The target weight was reached on week `at` at trend `kg`; what to return to and when to ask again. */
export interface Reached {
  at: string;
  kg: number;
  prevPace: number;
  prevKcal: number;
  askAgain: string | null;
}

export type CheckStatus =
  | 'setup'
  | 'migrated'
  | 'changed'
  | 'ask'
  | 'suggested'
  | 'reached'
  | 'same'
  | 'data'
  | 'settling'
  | 'implausible'
  | 'paused'
  | 'off';
export type CheckReason = 'burn' | 'weight' | 'floor-up' | 'reached';
export type CheckNote = 'held' | 'noisy' | 'floor' | 'pace' | 'quiet';

/** What a data-backed check saw, for the card's facts and „Szczegóły”. */
export interface CheckFacts {
  /** The window actually used (YYYY-MM-DD). */
  from: string;
  to: string;
  /** clamp(round(span / 7), 2, 4) */
  weeks: number;
  weighIns: number;
  completeDays: number;
  spanDays: number;
  /** kg a week, positive when losing, and its honest SE. */
  pace: number;
  paceSe: number;
  /** Mean of the complete days, rounded to 10. */
  intake: number;
  /** Observed burn rounded to 50, ± max(50, round50(2·SE)). */
  burn: number;
  burnSe: number;
  /** The burn estimate before and after this check, rounded to 50. */
  before: number;
  after: number;
  trendKg: number;
}

/** The last Monday check: its week (the Monday), what it decided, and the answer to its card. */
export interface WeekCheck {
  week: string;
  status: CheckStatus;
  /** The target before and after (equal when nothing changed). */
  from: number;
  to: number;
  reason: CheckReason | null;
  note: CheckNote | null;
  settle: Settle['why'] | null;
  facts: CheckFacts | null;
  missing: { weighIns: number; completeDays: number } | null;
  floor: number | null;
  /** `ask`: the burn offset a „Tak” would store. */
  offsetAfter: number | null;
  goalPace: number;
  answer: 'ok' | 'keep' | 'yes' | 'no' | 'set' | 'later' | 'continue' | null;
}

/**
 * Keys of the old model. They stay in stored rows untouched (a code revert reads them as before)
 * and only the upgrade reads them. Until the old screens are gone (I2) they are also in `Profile`.
 */
export interface LegacyFields {
  activityMultiplier?: number;
  baseSteps?: number;
  targetSteps?: number;
  kcalPer1000StepsPerKg?: number;
  extraWeeklyKcal?: number;
  kcalCorrection?: number;
  adaptWeekly?: boolean;
  adaptActivity?: boolean;
  goalSince?: string;
}

/** Everything the energy model and the targets need. One per device. */
export interface Profile {
  /** 2: one target a day. A stored row without it is a legacy row, upgraded on read. */
  version: 2;
  sex: Sex;
  age: number;
  heightCm: number;
  startWeightKg: number;
  targetWeightKg: number;
  /** YYYY-MM-DD */
  startDate: string;
  /** The usual week for the first estimate (NASEM 2023). Steps are only a hint, never a preselection. */
  activityLevel: ActivityLevel;
  /** Planned change, kg a week, positive when losing: [−0.5, 1]; 0 under 18 and in pregnancy. */
  goalPace: number;
  /** Energy in 1 kg of body mass (a practical value, not a physical constant). */
  kcalPerKg: number;
  /**
   * Today's target: the mirror of `targetOn(profile, today)` (`target.ts`). The meal planner, the
   * suggestions, „Zjedz teraz” and the backup read it; every store write keeps it in step.
   */
  dailyKcal: number;
  /** The target history, oldest first: every past day keeps the target it had. ≤ 200 newest. */
  goals: GoalChange[];
  /** What the Monday check has learned the formula gets wrong for this person, kcal a day: [−1500, 1500]. */
  burnOffset: number;
  /** The burn is tied to data (after the upgrade or the first data-backed check): body edits rebase `burnOffset`. */
  anchored: boolean;
  /** „Dopasowuj cel co tydzień”: off — the check only suggests. */
  autoAdjust: boolean;
  /** „Bez liczenia kalorii” (always on under 18, see `hidesKcal`). */
  hideKcal: boolean;
  /** Pregnancy or breastfeeding (offered for K): no deficit, no check. */
  pregnancy: boolean;
  /** The target is agreed with a doctor or dietitian: the floor is the hard minimum, not the BMR. */
  belowFloorOk: boolean;
  /** Breaks, the last 12, each at most 28 days. */
  pauses: Pause[];
  hold: Hold | null;
  settle: Settle;
  lastCheck: WeekCheck | null;
  reached: Reached | null;
  /** The one-time „what changed” notice after the upgrade. */
  notice: 'show' | 'seen' | null;
  dietProfile: DietProfileId;
  /** Chain key to plan around when nothing nearby is known (null: any). */
  preferredStore: string | null;

  // Legacy, read by the old screens until the packages replace them, then only in `LegacyFields` (I2).
  /** BMR × this = expenditure at the base step count (1.28: desk job + 2 trainings a week). */
  activityMultiplier: number;
  /** Steps already inside the multiplier. */
  baseSteps: number;
  /** Planned steps a day. */
  targetSteps: number;
  kcalPer1000StepsPerKg: number;
  /** Exercise beyond what the multiplier assumes, per week. */
  extraWeeklyKcal: number;
  /**
   * What the energy model gets wrong for this person, in kcal a day, as the check-ins measured it
   * from the scale and the log: part of the expenditure (`tdee`) everywhere - the pace, the goals of
   * the pace chips, the forecast. A check-in compares the scale with the corrected model, so the
   * same error is never applied twice. 0 until a check-in is accepted; editable in the profile.
   * Superseded by `burnOffset`; the stored key is never touched.
   */
  kcalCorrection: number;
  /**
   * The day `dailyKcal` last changed (YYYY-MM-DD). The week's balance counts only the days since:
   * days eaten to an older goal are not a surplus over a new one. Superseded by `goals`.
   */
  goalSince?: string;
  /** Correct today's goal by this week's surplus or deficit. */
  adaptWeekly: boolean;
  /**
   * Move the day's goal by the activity against the plan: more steps or an extra training add,
   * fewer steps or a skipped planned training take off (`diet/activity.ts`). Absent means on.
   */
  adaptActivity?: boolean;
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
