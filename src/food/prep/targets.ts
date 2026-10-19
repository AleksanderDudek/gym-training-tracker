import { weeklyAdjustment } from '../diet/day';
import { mondayOf } from '../diet/model';
import { DIET_PROFILES, type MacroTargets } from '../diet/profiles';
import type { Profile } from '../diet/types';

export interface PlanTargetsInput {
  profile: Profile;
  /** The daily goal the plan is made for: the profile's, or the check-in's. */
  kcal: number;
  /** Eaten kcal per date. */
  eaten: Map<string, number>;
  /** The real today: only days before it are over. */
  today: string;
  dates: readonly string[];
}

/**
 * Each day's targets. With the profile's weekly correction on, the balance of this week so far
 * (days before today) is spread ONCE over the plan's days of this week - the same delta every day,
 * capped like the diary's at 10 % of the goal. Calling the diary's `dayGoal` for every future day
 * would charge the same surplus again on each of them. Later weeks start clean.
 */
export function planTargets({ profile, kcal, eaten, today, dates }: PlanTargetsInput): { date: string; targets: MacroTargets }[] {
  const style = DIET_PROFILES[profile.dietProfile];
  const thisWeek = dates.filter((d) => mondayOf(d) === mondayOf(today));
  let delta = 0;
  if (profile.adaptWeekly && thisWeek.length) {
    const history = [...eaten].filter(([d]) => d < today).map(([date, eatenKcal]) => ({ date, eatenKcal }));
    // From the first planned day of this week, the days still to come carry the balance.
    const first = thisWeek[0]! < today ? today : thisWeek[0]!;
    delta = weeklyAdjustment(kcal, history, first).delta;
  }
  return dates.map((date) => ({
    date,
    targets: style.targets(kcal + (thisWeek.includes(date) ? delta : 0), profile.targetWeightKg),
  }));
}
