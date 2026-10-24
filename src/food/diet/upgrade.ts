import { bmr } from './energy';
import { addDays, mondayOf } from './model';
import {
  activityFromMultiplier,
  eer,
  floorOf,
  hardMinOf,
  maintenanceOf,
  safety,
  setTarget,
  snap05,
} from './target';
import type { GoalBy, LegacyFields, Profile, WeekCheck } from './types';

/**
 * The upgrade of a profile stored by the old model (spec 2026-10-24 §3.4): one target a day, the
 * burn estimate from NASEM 2023 plus an offset that keeps the old model's burn, the pace the old
 * target implied. The person keeps their target to the kcal and their history; the old keys stay
 * in the row untouched, so a code revert reads it exactly as before.
 *
 * Pure: the normaliser (`validate.ts cleanProfile`) calls it for every row without `version: 2`,
 * and `persistUpgrade` (store) writes the result once.
 */

/** The old model's defaults, for keys an old row does not have (the workbook's own values). */
export const LEGACY_DEFAULTS = {
  activityMultiplier: 1.28,
  baseSteps: 4000,
  targetSteps: 10_000,
  kcalPer1000StepsPerKg: 0.4,
  extraWeeklyKcal: 0,
  kcalPerKg: 7500,
  kcalCorrection: 0,
} as const;

/** The paces an upgraded target snaps to when it lies within 0.1 kg a week of one. */
const PACE_SNAPS = [0.75, 0.5, 0.25, 0, -0.25] as const;
const SNAP_WITHIN = 0.1;
/** The stored pace range, kg a week (positive when losing). */
const PACE_RANGE = [-0.5, 1] as const;
const OFFSET_LIMIT = 1500;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** The fields both models share. */
export type BaseKeys =
  | 'sex'
  | 'age'
  | 'heightCm'
  | 'startWeightKg'
  | 'targetWeightKg'
  | 'startDate'
  | 'kcalPerKg'
  | 'dailyKcal'
  | 'dietProfile'
  | 'preferredStore';

/** What the upgrade reads: the shared fields, valid and complete, and the old keys as stored. */
export type LegacyRow = Pick<Profile, BaseKeys> & LegacyFields;

/** The old keys with their defaults where the row has none (or not a number). */
function legacyValues(row: LegacyFields & Pick<Profile, 'kcalPerKg'>) {
  const pick = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    activityMultiplier: pick(row.activityMultiplier, LEGACY_DEFAULTS.activityMultiplier),
    baseSteps: pick(row.baseSteps, LEGACY_DEFAULTS.baseSteps),
    targetSteps: pick(row.targetSteps, LEGACY_DEFAULTS.targetSteps),
    kcalPer1000StepsPerKg: pick(row.kcalPer1000StepsPerKg, LEGACY_DEFAULTS.kcalPer1000StepsPerKg),
    extraWeeklyKcal: pick(row.extraWeeklyKcal, LEGACY_DEFAULTS.extraWeeklyKcal),
    kcalPerKg: pick(row.kcalPerKg, LEGACY_DEFAULTS.kcalPerKg),
    kcalCorrection: pick(row.kcalCorrection, LEGACY_DEFAULTS.kcalCorrection),
  };
}

/**
 * The old model's expenditure at a weight (a private copy of the old `tdee`, which I2 deletes):
 * BMR × the multiplier, walking beyond the base steps at the planned steps, extra exercise spread
 * over the week, and the check-ins' correction.
 */
export function legacyBurn(row: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'kcalPerKg'> & LegacyFields, kg: number): number {
  const v = legacyValues(row);
  const walking = (Math.max(0, v.targetSteps - v.baseSteps) / 1000) * kg * v.kcalPer1000StepsPerKg;
  return bmr(row, kg) * v.activityMultiplier + walking + v.extraWeeklyKcal / 7 + v.kcalCorrection;
}

/**
 * The pace an old target implied, as a stored pace: the nearest of 0.75 / 0.5 / 0.25 / 0 / −0.25
 * when it is within 0.1 kg a week of it, otherwise rounded to 0.05; within [−0.5, 1].
 */
export function upgradedPace(implied: number): number {
  let nearest: number = PACE_SNAPS[0];
  for (const snap of PACE_SNAPS) if (Math.abs(snap - implied) < Math.abs(nearest - implied)) nearest = snap;
  const pace = Math.abs(nearest - implied) <= SNAP_WITHIN + 1e-9 ? nearest : snap05(implied);
  return clamp(pace, PACE_RANGE[0], PACE_RANGE[1]) || 0;
}

export interface UpgradeContext {
  /** The weight to read the old burn at: the latest gym weigh-in, else the start weight. */
  weightKg?: number;
  today: string;
  /** A new profile from a workbook import: a setup, not an upgrade (no notice, not anchored). */
  fresh?: boolean;
}

/** The first check of an upgraded profile: none this week or the next, so at least 7 days later. */
const firstCheck = (week: string, status: 'migrated' | 'setup', kcal: number, goalPace: number): WeekCheck => ({
  week,
  status,
  from: kcal,
  to: kcal,
  reason: null,
  note: null,
  settle: null,
  facts: null,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace,
  answer: null,
});

/**
 * An old row as a version-2 profile (§3.4). The target stays to the kcal (not rounded) unless a
 * safety rule says otherwise: under 18 and a deficit at a BMI under 18.5 become maintenance, a
 * target under the hard minimum becomes the minimum (each a `safety` entry from today). A target
 * between the hard minimum and the BMR floor is kept: the notice offers the choice
 * (`resolveFloor`), and the Monday check raises it by 100 a week until then.
 */
export function upgradeProfile(row: LegacyRow, ctx: UpgradeContext): Profile & LegacyFields {
  const weighed = ctx.weightKg !== undefined && Number.isFinite(ctx.weightKg) && ctx.weightKg > 0;
  const kg = weighed ? ctx.weightKg! : row.startWeightKg;
  const legacy = legacyValues(row);
  const activityLevel = activityFromMultiplier(legacy.activityMultiplier);
  const oldBurn = legacyBurn(row, kg);
  const burnOffset = clamp(Math.round(oldBurn - eer({ ...row, activityLevel }, kg)), -OFFSET_LIMIT, OFFSET_LIMIT) || 0;
  const goalPace = upgradedPace(((oldBurn - row.dailyKcal) * 7) / legacy.kcalPerKg);
  const firstBy: GoalBy = ctx.fresh ? 'setup' : 'migration';
  const start = row.startDate < ctx.today ? row.startDate : ctx.today;

  let p: Profile & LegacyFields = {
    ...row,
    // The old keys the old screens still read (I2 takes them out of `Profile`): a missing one gets its old default.
    activityMultiplier: legacy.activityMultiplier,
    baseSteps: legacy.baseSteps,
    targetSteps: legacy.targetSteps,
    kcalPer1000StepsPerKg: legacy.kcalPer1000StepsPerKg,
    extraWeeklyKcal: legacy.extraWeeklyKcal,
    kcalCorrection: legacy.kcalCorrection,
    adaptWeekly: row.adaptWeekly ?? true,
    version: 2,
    activityLevel,
    goalPace,
    burnOffset,
    goals: [{ from: start, kcal: row.dailyKcal, by: firstBy }],
    anchored: !ctx.fresh,
    autoAdjust: true,
    hideKcal: false,
    pregnancy: false,
    belowFloorOk: false,
    pauses: [],
    hold: null,
    settle: { from: addDays(row.startDate, 14), why: 'start' },
    lastCheck: null,
    reached: null,
    notice: ctx.fresh ? null : 'show',
  };

  // Safety exceptions: each a second entry from today.
  const toTarget = (kcal: number) => (kcal === p.dailyKcal ? p : setTarget(p, kcal, ctx.today, 'safety'));
  if (p.age < 18) p = { ...toTarget(maintenanceOf(p, kg)), goalPace: 0 };
  else if (safety(p, kg).noLoss === 'bmi' && p.goalPace > 0) p = { ...toTarget(maintenanceOf(p, kg)), goalPace: 0 };
  else if (p.dailyKcal < hardMinOf(p)) p = toTarget(hardMinOf(p));

  const week = ctx.fresh ? mondayOf(ctx.today) : mondayOf(addDays(ctx.today, 6));
  return { ...p, lastCheck: firstCheck(week, ctx.fresh ? 'setup' : 'migrated', p.dailyKcal, p.goalPace) };
}

/** Which extra lines the „what changed” notice shows (§4.2 change notice). */
export interface NoticeNotes {
  /** Under 18: no calories and no deficit. */
  age: boolean;
  /** The upgrade turned a deficit at a BMI under 18.5 into maintenance. */
  bmi: boolean;
  /** The upgrade raised a target under the hard minimum to it (that minimum). */
  hardMin: number | null;
  /** The target is under the BMR floor and nobody chose yet: the floor for „Podnieś do …” / „Zostaw”. */
  floor: number | null;
}

/**
 * The notice's safety lines for an upgraded profile, read from what the upgrade left: the `safety`
 * entry it added and the target against the floor at today's weight (`kgNow`).
 */
export function noticeNotes(p: Profile, kgNow: number): NoticeNotes {
  const age = p.age < 18;
  const raised = p.goals.some((g) => g.by === 'safety');
  const bmi = !age && raised && safety(p, kgNow).noLoss === 'bmi';
  const min = hardMinOf(p);
  const hardMin = !age && !bmi && p.goals.some((g) => g.by === 'safety' && g.kcal === min) ? min : null;
  const floor = floorOf(p, kgNow);
  const below = !age && !p.belowFloorOk && p.dailyKcal >= min && p.dailyKcal < floor;
  return { age, bmi, hardMin, floor: below ? floor : null };
}
