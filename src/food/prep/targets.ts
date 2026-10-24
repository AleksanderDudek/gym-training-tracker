import { DIET_PROFILES, type MacroTargets } from '../diet/profiles';
import type { Profile } from '../diet/types';

export interface PlanTargetsInput {
  profile: Pick<Profile, 'dietProfile' | 'targetWeightKg'>;
  /** The daily target the plan is made for: today's from the diet profile (`targetOn`). */
  kcal: number;
  dates: readonly string[];
  /**
   * Ignored. The old weekly spread read what was eaten this week; callers written for it
   * (`prep/store.test.ts`, `scripts/food/check-prep.ts`) still pass these until they are updated.
   * @deprecated
   */
  eaten?: ReadonlyMap<string, number>;
  /** Ignored, as `eaten`. @deprecated */
  today?: string;
}

/**
 * Each day's targets: the same for every date (spec 2026-10-24 §4.7). A day's target never moves
 * with what another day held — no surplus is spread over the days ahead, no deficit earned back —
 * so a plan's days are planned at one number, the target of the day the plan is made.
 */
export function planTargets({ profile, kcal, dates }: PlanTargetsInput): { date: string; targets: MacroTargets }[] {
  const style = DIET_PROFILES[profile.dietProfile];
  return dates.map((date) => ({ date, targets: style.targets(kcal, profile.targetWeightKg) }));
}
