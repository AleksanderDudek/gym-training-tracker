import { describe, expect, test } from 'vitest';
import type { DayRow } from '../diet/db';
import { bmr, tdee } from '../diet/energy';
import { addDays } from '../diet/model';
import { DIET_PROFILES } from '../diet/profiles';
import { prepProfile } from '../test/prep';
import { checkIn } from './checkin';
import { planTargets } from './targets';

const TODAY = '2026-10-20';

/**
 * Four weeks of a person: weighed every few days on a straight line from `startKg` by `perWeek`
 * (negative is losing), eating `kcal` on the logged days.
 */
function history(opts: { startKg: number; perWeek: number; kcal: number; weighEvery?: number; logged?: (i: number) => boolean }) {
  const days: DayRow[] = [];
  const eaten = new Map<string, number>();
  for (let i = 28; i >= 1; i--) {
    const date = addDays(TODAY, -i);
    const n = 28 - i;
    if (n % (opts.weighEvery ?? 3) === 0) days.push({ date, weightKg: opts.startKg + (opts.perWeek / 7) * n });
    if (opts.logged?.(n) ?? true) eaten.set(date, opts.kcal);
  }
  return { days, eaten };
}

describe('check-in', () => {
  const profile = prepProfile({ dailyKcal: 2200, startWeightKg: 84, targetWeightKg: 76 });

  test('too little data: the profile goal, and a sentence about what is missing', () => {
    const r = checkIn({ profile, days: [{ date: '2026-10-18', weightKg: 82 }], eaten: new Map(), today: TODAY });
    expect(r.status).toBe('za-malo-danych');
    expect(r.suggestedKcal).toBe(2200);
    expect(r.reason).toMatch(/^Do dopasowania celu potrzebuję co najmniej 4 ważeń z 14 dni/);
    expect(r.reason).toContain('1 ważenie');
  });

  test('weighed enough, but the log has holes: not enough either', () => {
    const { days, eaten } = history({ startKg: 82, perWeek: -0.5, kcal: 2200, logged: (n) => n % 2 === 0 });
    expect(checkIn({ profile, days, eaten, today: TODAY }).status).toBe('za-malo-danych');
  });

  test('on track: the model predicted what the scale shows, the goal stays', () => {
    // At 2200 kcal the model's expenditure at 81 kg makes a loss of (TDEE − 2200)·7/7500 a week.
    const pace = ((tdee(profile, 81) - 2200) * 7) / 7500;
    const { days, eaten } = history({ startKg: 82, perWeek: -pace, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('zgodnie');
    expect(r.suggestedKcal).toBe(2200);
    expect(Math.abs(r.observedTdee! - r.modelTdee)).toBeLessThan(100);
    expect(r.reason).toMatch(/^Przez ostatnie \d+ dni waga szła w tempie −0,\d+ kg\/tydz\./);
  });

  test('losing slower than planned on the logged food: burning less than the model says, the goal comes down', () => {
    const { days, eaten } = history({ startKg: 82, perWeek: -0.1, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('korekta');
    expect(r.observedTdee!).toBeLessThan(r.modelTdee);
    expect(r.suggestedKcal).toBeLessThan(2200);
    expect(r.suggestedKcal % 10).toBe(0);
    expect(r.reason).toContain(`Proponuję ${r.suggestedKcal} kcal zamiast 2200 kcal`);
  });

  test('one check-in moves the goal at most 250 kcal', () => {
    // Weight stands still on 2200 kcal: expenditure is 2200, the model says far more.
    const { days, eaten } = history({ startKg: 82, perWeek: 0, kcal: 2200 });
    const r = checkIn({ profile: prepProfile({ dailyKcal: 2200, activityMultiplier: 1.725 }), days, eaten, today: TODAY });
    expect(r.limited).toBe('cap');
    expect(r.suggestedKcal).toBe(1950);
    expect(r.reason).toContain('o 250 kcal naraz');
  });

  test('never below the basal metabolic rate', () => {
    const small = prepProfile({ sex: 'K', age: 40, heightCm: 160, dailyKcal: 1450, startWeightKg: 72, targetWeightKg: 60 });
    const { days, eaten } = history({ startKg: 70, perWeek: 0.1, kcal: 1450 });
    const r = checkIn({ profile: small, days, eaten, today: TODAY });
    expect(r.suggestedKcal).toBeGreaterThanOrEqual(Math.round(bmr(small, r.trendKg!) / 10) * 10);
    expect(r.limited).toBe('floor');
  });

  test('losing faster than planned: the goal goes up, with a word about muscle', () => {
    const { days, eaten } = history({ startKg: 84, perWeek: -1.2, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('korekta');
    expect(r.suggestedKcal).toBeGreaterThan(2200);
    expect(r.reason).toContain('Szybsze chudnięcie niż w planie kosztuje mięśnie.');
  });

  test('target reached: maintenance at what the scale and the log say is burned', () => {
    const { days, eaten } = history({ startKg: 76.4, perWeek: -0.3, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('cel');
    expect(r.suggestedKcal).toBe(Math.round(r.observedTdee! / 10) * 10);
    expect(r.reason).toMatch(/^Cel 76 kg osiągnięty/);
  });

  test('a log that cannot be true (half the food missing) is not used', () => {
    const { days, eaten } = history({ startKg: 82, perWeek: 0, kcal: 900 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('za-malo-danych');
    expect(r.reason).toContain('zapisy jedzenia są chyba niepełne');
  });
});

describe('day targets of a plan', () => {
  test("the week's surplus is spread once over the plan's days of this week; next week starts clean", () => {
    const profile = prepProfile({ dailyKcal: 2000, adaptWeekly: true });
    // Monday 19 Oct: 2600 eaten, 600 over the goal. Today is Tuesday 20 Oct.
    const eaten = new Map([['2026-10-19', 2600]]);
    const dates = ['2026-10-20', '2026-10-21', '2026-10-25', '2026-10-26'];
    const t = planTargets({ profile, kcal: 2000, eaten, today: TODAY, dates });
    // 600 over six days left (Tue–Sun) = −100 a day.
    expect(t.map((d) => d.targets.kcal)).toEqual([1900, 1900, 1900, 2000]);
    expect(t[0]!.targets).toEqual(DIET_PROFILES.redukcja.targets(1900, profile.targetWeightKg));
  });

  test('without the weekly correction every day has the goal', () => {
    const profile = prepProfile({ dailyKcal: 2000, adaptWeekly: false });
    const t = planTargets({ profile, kcal: 2100, eaten: new Map([['2026-10-19', 3000]]), today: TODAY, dates: [TODAY] });
    expect(t[0]!.targets.kcal).toBe(2100);
  });
});
