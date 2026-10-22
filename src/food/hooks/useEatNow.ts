import { useEffect, useMemo, useState } from 'react';
import { totals, type DayTotals } from '../diet/day';
import { dayGoal, mealsLeftAt, mondayOf } from '../diet/model';
import { dayNeeds, type DayNeeds } from '../diet/now';
import { completeProfile } from '../diet/store';
import type { Profile } from '../diet/types';
import { activityKcalOf, useActivity } from './useActivity';
import { useClock, useDay, useEntries, useMergedHistory, useProfile } from './useDiet';

export interface EatNow {
  today: string;
  /** The clock, read once a minute: opening hours are checked against it. */
  nowMs: number;
  /** `null`: no diet profile - the numbers are for an average day. */
  profile: Profile | null;
  needs: DayNeeds;
  eaten: DayTotals;
  /** Still loading the diary: the numbers would say "nothing eaten" for a moment. */
  loading: boolean;
}

/** An average day for someone without a diet profile: 2 000 kcal, balanced. */
const AVERAGE = completeProfile({ dailyKcal: 2000, dietProfile: 'zbilansowana', targetWeightKg: 75 });

const NOTHING: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, unknownMacros: 0 };

/**
 * What is left of today for the next meal, the way the diary counts it: today's goal (the week and
 * the activity corrections), what is eaten, a planned cheat meal reserved, the meals still ahead by
 * the hour. Without a diet profile, an average day with nothing eaten.
 */
export function useEatNow(): EatNow {
  const row = useProfile();
  const profile = row ?? null;
  const clock = useClock();
  const today = clock.date;
  const entries = useEntries(today);
  const day = useDay(today);
  const history = useMergedHistory(profile ? mondayOf(today) : null);
  const activity = useActivity(profile, today);
  // Opening hours need the minute, not the hour `useClock` settles for.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const base = useMemo(() => {
    const eaten = entries ? totals(entries) : NOTHING;
    const mealsAhead = mealsLeftAt(clock.hour);
    if (!profile) {
      return {
        today,
        profile: null,
        eaten: NOTHING,
        needs: dayNeeds({ profile: AVERAGE, goalKcal: AVERAGE.dailyKcal, eaten: NOTHING, cheat: null, mealsAhead }),
        loading: row === undefined,
      };
    }
    const goal = history ? dayGoal(profile, history.eaten, today, today, activityKcalOf(activity)).kcal : profile.dailyKcal;
    return {
      today,
      profile,
      eaten,
      needs: dayNeeds({ profile, goalKcal: goal, eaten, cheat: day?.cheat ?? null, mealsAhead }),
      loading: entries === undefined || history === undefined,
    };
  }, [profile, row, entries, day, history, activity, clock.hour, today]);
  return useMemo(() => ({ ...base, nowMs }), [base, nowMs]);
}
