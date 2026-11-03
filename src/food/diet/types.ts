import type { Macros } from '../recipes/macros';
import type { ShopRhythm } from '../shop/rhythm';

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
  /** When the person shops (`shop/rhythm.ts`): the list from the diary and the calendar follow it. Absent: not set yet. */
  shopping?: ShopRhythm | null;
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
 * and only the upgrade reads them; nothing adds them to a row without them.
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
  /** „Pokazuj wodę”: the water card in the diary (on by default). */
  showWater: boolean;
  /** The person's own drinks target, ml a day; null: the EFSA value for sex and pregnancy (`water.ts`). */
  waterMl: number | null;
  /** „Okno jedzenia” (intermittent fasting): the chosen split, null while off (the default). */
  fastPlan: FastPlan | null;
  /** The current or the last fast, as the person started and ended it; null before the first. */
  fast: Fast | null;
  /** When the person shops (`shop/rhythm.ts`): the list from the diary and the calendar follow it. Absent: not set yet. */
  shopping?: ShopRhythm | null;
}

/** Fasting hours : eating-window hours. */
export const FAST_PLANS = ['12:12', '14:10', '16:8', '18:6'] as const;
export type FastPlan = (typeof FAST_PLANS)[number];

/** A fast: local times `YYYY-MM-DDTHH:MM`; `end` null while it lasts. Never touches a food target. */
export interface Fast {
  start: string;
  end: string | null;
}

/** The model's defaults for what a person does not have to know. */
export const MODEL_DEFAULTS = { kcalPerKg: 7500 } as const;

/** Nutrition of one eaten amount; unknown macros are null, never zero. */
export interface Nutrients {
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /**
   * Fibre, total sugars and salt (g), when the source knows them. Optional: foods made before they
   * were known (a set, a favourite, an old entry) have none, and none is unknown, never zero.
   */
  fiber?: number | null;
  sugars?: number | null;
  salt?: number | null;
}

/** The three extras of the day balance („Więcej: …”). */
export const EXTRAS = ['fiber', 'sugars', 'salt'] as const;
export type Extra = (typeof EXTRAS)[number];
export type Extras = Record<Extra, number | null>;

/** Grams of an extra rounded as the labels print them: salt to 0.01 g, fibre and sugars to 0.1 g. */
export const roundExtra = (key: Extra, grams: number): number =>
  key === 'salt' ? Math.round(grams * 100) / 100 : Math.round(grams * 10) / 10;

export type { Macros };
