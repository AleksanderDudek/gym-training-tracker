import { round2 } from '../../engine/math';
import { applyProfileEdit, targetWeightProblem } from './edit';
import { DIET_PROFILES } from './profiles';
import { currentWeight, directionOf, floorOf, hardMinOf, minHealthyKg, r10, targetOn } from './target';
import type { WeighIn } from './trend';
import type { Profile } from './types';

/**
 * Targets from a coach („Ustaw jako moje cele” on a `targets` assignment, spec 2026-11-25
 * „powiadomienia”, decision „Prowadzący na pierwszym planie”): what the diet profile can take from
 * them, worked out by the profile page's own save (`applyProfileEdit`), so the same rules hold — a
 * typed target is never under the BMR floor without `belowFloorOk`, never under the hard minimum,
 * becomes the pace it implies, and puts a two-week hold on the Monday check.
 *
 * What maps: the kcal target (as „Ustaw cel ręcznie”) and the target weight, when it fits the goal's
 * direction and BMI 18.5. What does not: protein (the app derives it from the diet style and the
 * target weight), steps and workouts a week (no such settings), and the pace when a kcal target is
 * given (the kcal decides it) or none is (the pace chips belong to the profile page) — those the
 * screen shows as information.
 *
 * Pure: the preview and the stored change (`applyCoachTargets` in `store.ts`) run the same function.
 */

export interface CoachAsk {
  kcal: number | null;
  weightGoal: number | null;
}

export interface CoachEdit {
  /** The profile to store; equal to the input when nothing changes. */
  next: Profile;
  changed: boolean;
  /** Today's target before and after, when it changes. */
  kcal: { from: number; to: number } | null;
  /** The target weight before and after, when it changes. */
  weight: { from: number; to: number } | null;
  /** The pace (kg a week, positive when losing) before and after, when it changes. */
  pace: { from: number; to: number } | null;
  /** The kcal target was raised to the floor (`floor`) or capped at the stored range (`max`). */
  kcalAdjusted: 'floor' | 'max' | null;
  /** Asked for but left alone: the kcal under 18; the target weight under BMI 18.5, or against the goal's direction. */
  kept: { kcal?: 'minor'; weight?: 'min' | 'side' | 'keep' };
  /** The app's protein target after the change (g a day), to set beside the coach's. */
  protein: number;
}

/** The weight the targets use now: the trend of the weigh-ins, otherwise the start weight. */
export const kgNowOf = (p: Pick<Profile, 'startWeightKg'>, weighIns: readonly WeighIn[], today: string): number =>
  currentWeight(p, weighIns, today);

const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

export function coachEdit(prev: Profile, ask: CoachAsk, ctx: { today: string; kgNow: number }): CoachEdit {
  const { today, kgNow } = ctx;
  const minor = prev.age < 18;
  const manual = ask.kcal !== null && !minor ? ask.kcal : null;
  const asked = ask.weightGoal !== null ? round2(Math.round(ask.weightGoal * 10) / 10) : null;
  // Nothing that maps (or only what is kept): the profile as it is — the save path would otherwise
  // tidy unrelated fields (a keeping goal's target weight follows today's weight).
  const edit = (draft: Profile | null): Profile => (draft === null && manual === null ? prev : applyProfileEdit(prev, draft ?? prev, { today, kgNow, manual }));

  let next = edit(asked !== null ? { ...prev, targetWeightKg: asked } : null);
  let weightKept: CoachEdit['kept']['weight'];
  if (asked !== null) {
    // Under BMI 18.5 first: such a weight would also close the loss and read as „keeping”.
    const dir = directionOf(next.goalPace);
    weightKept =
      asked < minHealthyKg(prev.heightCm) ? 'min' : dir === 'keep' ? 'keep' : targetWeightProblem(dir, asked, kgNow, prev.heightCm) ? 'side' : undefined;
    if (weightKept) next = edit(null);
  }

  const kcalFrom = targetOn(prev, today);
  const kcalTo = targetOn(next, today);
  const typed = manual !== null ? r10(manual) : null;
  const kcalAdjusted =
    typed === null || kcalTo === typed ? null : typed > kcalTo ? 'max' : typed < Math.max(floorOf(prev, kgNow), hardMinOf(prev)) ? 'floor' : null;
  const kcal = kcalFrom !== kcalTo ? { from: kcalFrom, to: kcalTo } : null;
  const weight = !same(prev.targetWeightKg, next.targetWeightKg) ? { from: prev.targetWeightKg, to: next.targetWeightKg } : null;
  const pace = !same(prev.goalPace, next.goalPace) ? { from: prev.goalPace, to: next.goalPace } : null;
  const kept: CoachEdit['kept'] = {
    ...(minor && ask.kcal !== null ? { kcal: 'minor' as const } : {}),
    ...(weightKept ? { weight: weightKept } : {}),
  };
  return {
    next,
    changed: !!(kcal || weight || pace),
    kcal,
    weight,
    pace,
    kcalAdjusted,
    kept,
    protein: DIET_PROFILES[next.dietProfile].targets(kcalTo, next.targetWeightKg).protein.target,
  };
}
