import { describe, expect, test } from 'vitest';
import { DIET_PROFILES } from '../diet/profiles';
import { prepProfile } from '../test/prep';
import { planTargets } from './targets';

const TODAY = '2026-10-20';

describe('day targets of a plan', () => {
  test('every day of a plan has the same targets: a surplus earlier in the week is spread over no day ahead', () => {
    const profile = prepProfile({ dailyKcal: 2000 });
    // Monday 19 Oct: 2600 eaten, 600 over the target. Today is Tuesday 20 Oct — the old weekly
    // spread (on by default) took 100 a day off the rest of this week.
    const dates = ['2026-10-20', '2026-10-21', '2026-10-25', '2026-10-26'];
    const t = planTargets({ profile, kcal: 2000, eaten: new Map([['2026-10-19', 2600]]), today: TODAY, dates });
    expect(t.map((d) => d.date)).toEqual(dates);
    expect(t.map((d) => d.targets)).toEqual(Array(dates.length).fill(DIET_PROFILES.redukcja.targets(2000, profile.targetWeightKg)));
  });

  test('the plan’s daily target is the one passed in (today’s from the profile), in the profile’s style', () => {
    const profile = prepProfile({ dailyKcal: 2000, dietProfile: 'keto', targetWeightKg: 70 });
    const [day] = planTargets({ profile, kcal: 2100, dates: [TODAY] });
    expect(day).toEqual({ date: TODAY, targets: DIET_PROFILES.keto.targets(2100, 70) });
    expect(day!.targets.carbs.max).toBe(30);
  });
});
