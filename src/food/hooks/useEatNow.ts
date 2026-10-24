import { useEffect, useMemo, useState } from 'react';
import { totals, type DayTotals } from '../diet/day';
import { mealsLeftAt } from '../diet/model';
import { dayNeeds, type DayNeeds } from '../diet/now';
import { completeProfile } from '../diet/store';
import { hidesKcal, targetOn } from '../diet/target';
import type { Profile } from '../diet/types';
import { useClock, useDay, useEntries, useProfile } from './useDiet';
import { useWeeklyCheck } from './useWeeklyCheck';

export interface EatNow {
  today: string;
  /** The clock, read once a minute: opening hours are checked against it. */
  nowMs: number;
  /** `null`: no diet profile - the numbers are for an average day. */
  profile: Profile | null;
  needs: DayNeeds;
  eaten: DayTotals;
  /** „Bez liczenia kalorii” (`hidesKcal`): the screens say protein, not calories. */
  hidesKcal: boolean;
  /**
   * Still loading the diary, or this week's Monday check may still change today's target: the
   * numbers would say "nothing eaten" or an old target for a moment.
   */
  loading: boolean;
}

/** An average day for someone without a diet profile: 2 000 kcal, balanced. */
const AVERAGE = completeProfile({ dailyKcal: 2000, dietProfile: 'zbilansowana', targetWeightKg: 75 });

const NOTHING: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, unknownMacros: 0 };

/**
 * What is left of today for the next meal, the way the diary counts it (spec 2026-10-24 §4.8):
 * today's target from the goals history (`targetOn` — activity never changes it), what is eaten, a
 * planned bigger meal set aside, the meals still ahead by the hour. It triggers this week's Monday
 * check. Without a diet profile, an average day with nothing eaten.
 */
export function useEatNow(): EatNow {
  const row = useProfile();
  const profile = row ?? null;
  const clock = useClock();
  const today = clock.date;
  const entries = useEntries(today);
  const day = useDay(today);
  const check = useWeeklyCheck(row, clock);
  // Opening hours need the minute, not the hour `useClock` settles for.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const base = useMemo(() => {
    const mealsAhead = mealsLeftAt(clock.hour);
    if (!profile) {
      return {
        today,
        profile: null,
        eaten: NOTHING,
        needs: dayNeeds({ profile: AVERAGE, goalKcal: AVERAGE.dailyKcal, eaten: NOTHING, cheat: null, mealsAhead }),
        hidesKcal: false,
        loading: row === undefined,
      };
    }
    const eaten = entries ? totals(entries) : NOTHING;
    return {
      today,
      profile,
      eaten,
      needs: dayNeeds({ profile, goalKcal: targetOn(profile, today), eaten, cheat: day?.cheat ?? null, mealsAhead }),
      hidesKcal: hidesKcal(profile),
      loading: entries === undefined || day === undefined || check === 'pending',
    };
  }, [profile, row, entries, day, check, clock.hour, today]);
  return useMemo(() => ({ ...base, nowMs }), [base, nowMs]);
}
