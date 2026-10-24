import { addDays, mondayOf } from './model';
import {
  burnOf,
  directionOf,
  eer,
  floorOf,
  hardMinOf,
  impliedPace,
  minHealthyKg,
  minTargetOf,
  PACE_CHIPS,
  r10,
  r50,
  safePace,
  safety,
  setTarget,
  snap05,
  targetFor,
  targetOn,
  type TargetInput,
} from './target';
import type { Profile, WeekCheck } from './types';

/**
 * Saving the diet profile (spec 2026-10-24 §4.5): from the form's draft to the profile to store,
 * with the target history kept right, plus the pure pieces of the form — the pace chips and the
 * checks that block a save.
 *
 * The target is recomputed only when something that decides it changed: the goal's direction, the
 * pace, a typed target, or (before the burn is tied to data) the body or the usual week. Anything
 * else keeps the stored target to the kcal, so a migrated 1860 never re-rounds by opening and saving.
 * Once the burn is tied to data (`anchored`), body and week edits move `burnOffset` instead, so the
 * burn at today's weight stays what the data say (§2.5).
 */

export interface EditContext {
  today: string;
  /** The weight the targets use now (`currentWeight`: the trend, else the start weight). */
  kgNow: number;
  /** A target typed in „Ustaw cel ręcznie”, or none — the chips decide. */
  manual?: number | null;
}

export type Goal = 'loss' | 'keep' | 'gain';

/**
 * A typed target whose pace is closer than this to 0 is keeping the weight: 0.05 kg a week is about
 * 50 kcal, well inside the estimate's error and the ±100 band. Without it a target typed near
 * maintenance would turn the goal into a tiny loss (or gain) — and the Monday check would then call
 * the target weight reached at the first weigh-in under today's.
 */
const KEEP_PACE = 0.1;
/** A change of target at least this big waits 14 days of water before the Monday check looks again. */
const MAJOR_CHANGE = 300;
/** After a change from the profile the check waits this long (no burn-based change in either direction). */
const USER_HOLD_DAYS = 14;
const SETTLE_DAYS = 14;
/** The stored range of a target. */
const KCAL_MAX = 6000;
const OFFSET_LIMIT = 1500;

/** What NASEM reads besides the weight: a change re-estimates (or, anchored, rebases) the burn. */
const BODY = ['sex', 'age', 'heightCm', 'activityLevel'] as const;

const bodyChanged = (a: Profile, b: Profile): boolean => BODY.some((k) => a[k] !== b[k]);

const isDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

const round1 = (kg: number): number => Math.round(kg * 10) / 10;

/** No pace to choose: under 18, pregnant or breastfeeding. */
const paceLocked = (p: Pick<Profile, 'age' | 'pregnancy'>): boolean => p.age < 18 || p.pregnancy;

/**
 * The draft with the burn rebased (§2.5): once anchored, a new sex, age, height or usual week moves
 * `burnOffset` so that the burn at `kgNow` stays the same. Before anchoring the draft is returned
 * as it is — the formula moves the estimate.
 */
export function rebased(prev: Profile | null, draft: Profile, kgNow: number): Profile {
  if (!prev?.anchored || !bodyChanged(prev, draft)) return draft;
  const offset = Math.round(burnOf(prev, kgNow) - eer(draft, kgNow));
  return { ...draft, burnOffset: Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, offset)) || 0 };
}

/**
 * The pace a typed target stands for (§2.2): the pace it implies at `kgNow`, rounded to 0.05, within
 * the safety rails — and 0 when that is closer to keeping than 0.1 kg a week.
 */
export function typedPace(p: TargetInput, kgNow: number, kcal: number): number {
  const pace = snap05(impliedPace(p, kgNow, kcal));
  return Math.abs(pace) < KEEP_PACE - 1e-9 ? 0 : safePace(p, kgNow, pace);
}

/** The check of a new profile: nothing to look at yet, its week is this week. */
const setupCheck = (today: string, kcal: number, goalPace: number): WeekCheck => ({
  week: mondayOf(today),
  status: 'setup',
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
 * The profile to save. `prev` is the stored profile, null for a new one. `draft.goalPace` is the
 * chosen chip (0 for keeping the weight); a typed target (`ctx.manual`) wins over it and becomes a
 * pace too: the pace it implies, rounded to 0.05 and kept within the safety rails.
 *
 * - Keeping the weight (and under 18 or in pregnancy, where the pace is 0): the target weight is
 *   today's weight, one decimal.
 * - A new profile starts its history with the target (`setup`), a setup check and a 14-day settle.
 * - A changed target is the target from today (`user`) with a two-week hold on the Monday check;
 *   a change of 300 kcal or more, or of direction, also waits 14 days of water (settle `change`).
 */
export function applyProfileEdit(prev: Profile | null, draft: Profile, ctx: EditContext): Profile {
  const { today, kgNow } = ctx;
  const locked = paceLocked(draft);
  const keep = locked || draft.goalPace === 0;
  const body: Profile = { ...rebased(prev, draft, kgNow), ...(keep && { targetWeightKg: round1(kgNow) }) };
  // A typed target is kept as typed (to 10), but never under the hard minimum, and under the BMR
  // floor only when it is agreed with a doctor or dietitian (`belowFloorOk`).
  const manual =
    ctx.manual == null ? null : Math.min(KCAL_MAX, Math.max(minTargetOf(body, kgNow), r10(ctx.manual)));
  const goalPace = manual !== null ? typedPace(body, kgNow, manual) : locked ? 0 : draft.goalPace;
  const next: Profile = { ...body, goalPace };

  if (!prev) {
    const kcal = manual ?? targetFor(next, kgNow);
    return {
      ...next,
      dailyKcal: kcal,
      goals: [{ from: today, kcal, by: 'setup' }],
      hold: null,
      settle: { from: addDays(isDate(next.startDate) ? next.startDate : today, SETTLE_DAYS), why: 'start' },
      lastCheck: setupCheck(today, kcal, goalPace),
      reached: null,
      notice: null,
    };
  }

  const turned = directionOf(prev.goalPace) !== directionOf(goalPace);
  const recompute =
    manual !== null ||
    turned ||
    Math.abs(prev.goalPace - goalPace) > 1e-9 ||
    (!prev.anchored && (bodyChanged(prev, next) || prev.startWeightKg !== next.startWeightKg));
  const current = targetOn(prev, today);
  const kcal = recompute ? (manual ?? targetFor(next, kgNow)) : current;
  if (kcal === current) return next;
  const changed = setTarget(next, kcal, today, 'user');
  return {
    ...changed,
    hold: { dir: 0, until: addDays(today, USER_HOLD_DAYS) },
    ...((Math.abs(kcal - current) >= MAJOR_CHANGE || turned) && {
      settle: { from: addDays(today, SETTLE_DAYS), why: 'change' as const },
    }),
  };
}

/** One pace chip: kg a week, whether it is the stored pace matching no chip („(obecne)”), whether it is closed. */
export interface PaceChip {
  pace: number;
  current: boolean;
  disabled: boolean;
}

const LOSS_CHIPS = PACE_CHIPS.filter((p) => p > 0);
const GAIN_CHIP = Math.min(...PACE_CHIPS);
const floor05 = (x: number): number => Math.floor(x * 20 + 1e-9) / 20;

/** The gaining chip: −0.25, lowered to what is safe (gain ≤ 0.5 % of the weight a week) for a light person. */
const gainChip = (p: TargetInput, kg: number): number =>
  -Math.min(-GAIN_CHIP, floor05(safety(p, kg).maxGain)) || 0;

/**
 * Whether a pace is closed at this weight: faster than the safety rails allow, or (losing) a
 * target that would fall below the safe minimum — the chip would only repeat the floor.
 */
export function paceClosed(p: TargetInput, kg: number, pace: number): boolean {
  const s = safety(p, kg);
  if (pace > 0) {
    if (s.noLoss || pace > s.maxLoss + 1e-9) return true;
    return r50(burnOf(p, kg) - (pace * p.kcalPerKg) / 7) < minTargetOf(p, kg);
  }
  if (pace < 0) return s.noGain !== null || -pace > s.maxGain + 1e-9;
  return false;
}

/**
 * The pace chips of a goal: losing 0.25 / 0.5 / 0.75, gaining 0.25 (lowered for a light person),
 * plus `stored` as „(obecne)” when it points the same way and matches none of them. Slowest first.
 */
export function paceChips(p: TargetInput, kg: number, goal: 'loss' | 'gain', stored: number | null): PaceChip[] {
  const paces = goal === 'loss' ? [...LOSS_CHIPS] : [gainChip(p, kg)];
  const chips: PaceChip[] = paces.map((pace) => ({ pace, current: false, disabled: paceClosed(p, kg, pace) }));
  const sameWay = stored !== null && (goal === 'loss' ? stored > 0 : stored < 0);
  if (sameWay && !paces.some((pace) => Math.abs(pace - stored) < 1e-9))
    chips.push({ pace: stored, current: true, disabled: paceClosed(p, kg, stored) });
  return chips.sort((a, b) => Math.abs(a.pace) - Math.abs(b.pace));
}

/**
 * The pace a goal starts at when chosen: the stored pace when it points the same way, otherwise
 * 0.5 kg a week losing (0.25 when 0.5 is closed) or the gaining chip; 0 for keeping.
 */
export function startPace(p: TargetInput, kg: number, goal: Goal, stored: number | null): number {
  if (goal === 'keep') return 0;
  if (goal === 'gain') return stored !== null && stored < 0 ? stored : gainChip(p, kg);
  if (stored !== null && stored > 0) return stored;
  return paceClosed(p, kg, 0.5) ? 0.25 : 0.5;
}

/** Why the target weight blocks a save: missing, under BMI 18.5, or on the wrong side of today's weight. */
export type TargetWeightProblem = { kind: 'missing' } | { kind: 'min'; kg: number } | { kind: 'side'; goal: 'loss' | 'gain' };

/**
 * The target weight of a losing or gaining goal: required, at least `minHealthyKg` (BMI 18.5), and
 * below (losing) or above (gaining) today's weight as the screen shows it (one decimal).
 */
export function targetWeightProblem(
  goal: Goal | null,
  targetKg: number | null,
  kgNow: number,
  heightCm: number,
): TargetWeightProblem | null {
  if (goal !== 'loss' && goal !== 'gain') return null;
  if (targetKg === null) return { kind: 'missing' };
  const min = minHealthyKg(heightCm);
  if (targetKg < min) return { kind: 'min', kg: min };
  const now = round1(kgNow);
  if (goal === 'loss' ? targetKg >= now : targetKg <= now) return { kind: 'side', goal };
  return null;
}

/** Why a typed target blocks a save: under the hard minimum, over the stored range, or under the BMR floor without the checkbox. */
export type ManualProblem = { kind: 'min'; min: number } | { kind: 'max'; min: number; max: number } | { kind: 'floor'; floor: number };

/** A typed target (as it will be stored, to 10) against the hard minimum, the range and the BMR floor. */
export function manualProblem(
  p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'belowFloorOk'>,
  kgNow: number,
  manual: number | null,
): ManualProblem | null {
  if (manual === null) return null;
  const kcal = r10(manual);
  const min = hardMinOf(p);
  if (kcal < min) return { kind: 'min', min };
  if (kcal > KCAL_MAX) return { kind: 'max', min, max: KCAL_MAX };
  const floor = floorOf(p, kgNow);
  if (kcal < floor && !p.belowFloorOk) return { kind: 'floor', floor };
  return null;
}
