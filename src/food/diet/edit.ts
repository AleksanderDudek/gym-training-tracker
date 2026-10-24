import { setTarget, targetFor } from './target';
import type { Profile } from './types';

/**
 * Saving the diet profile (spec §4.5): from the form's draft to the profile to store, with the
 * target history kept right. Package C owns this file and fills in the rules (rebasing an anchored
 * burn, keeping an unchanged target unrounded, the settle and the hold after a change).
 */

export interface EditContext {
  today: string;
  /** The weight the targets use now (`currentWeight`: the trend, else the start weight). */
  kgNow: number;
  /** A target typed in „Ustaw cel ręcznie”, or none — the chips decide. */
  manual?: number | null;
}

/**
 * The profile to save. `prev` is the stored profile, null for a new one. Stub until package C:
 * the target is the typed one or `targetFor` the draft at `kgNow`; a new profile starts its
 * history with it, an existing one gets it from today when it differs.
 */
export function applyProfileEdit(prev: Profile | null, draft: Profile, ctx: EditContext): Profile {
  const kcal = ctx.manual ?? targetFor(draft, ctx.kgNow);
  if (!prev) return { ...draft, dailyKcal: kcal, goals: [{ from: ctx.today, kcal, by: 'setup' }] };
  return kcal === prev.dailyKcal ? draft : setTarget(draft, kcal, ctx.today, 'user', ctx.today);
}
