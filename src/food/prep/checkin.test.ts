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
    expect(r.reason).toMatch(/^Do dopasowania celu potrzebuję co najmniej 5 ważeń z 14 dni/);
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

  test('a second check-in on what the first one fixed changes nothing: the same error is never applied twice', () => {
    // The model says ~2500 kcal; the scale on 2200 kcal says 2200 (weight stands still).
    const first = history({ startKg: 82, perWeek: 0, kcal: 2200 });
    const one = checkIn({ profile, days: first.days, eaten: first.eaten, today: TODAY });
    expect(one).toMatchObject({ status: 'korekta', suggestedKcal: 1950, correction: -250, limited: 'cap' });

    // Four weeks on the corrected goal: 250 kcal under the real expenditure, as planned.
    const corrected = { ...profile, dailyKcal: 1950, kcalCorrection: one.correction };
    const second = history({ startKg: 82, perWeek: -(250 * 7) / 7500, kcal: 1950 });
    const two = checkIn({ profile: corrected, days: second.days, eaten: second.eaten, today: TODAY });
    expect(two.status).toBe('zgodnie');
    expect(two.suggestedKcal).toBe(1950);
    expect(two.correction).toBe(-250);
    // The pace aimed at stays: the corrected model at the corrected goal, as the uncorrected one at the old goal.
    expect(two.plannedPace).toBeCloseTo(one.plannedPace, 1);
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

  test('days logged at under half the goal are half-logged days: they do not count, and alone they are not enough', () => {
    const { days, eaten } = history({ startKg: 82, perWeek: 0, kcal: 900 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('za-malo-danych');
    expect(r.reason).toContain('pełne zapisy z 0');
  });

  test('a few breakfast-only days do not move the goal of someone the model describes well', () => {
    const pace = ((tdee(profile, 81) - 2200) * 7) / 7500;
    const { days, eaten } = history({ startKg: 82, perWeek: -pace, kcal: 2200 });
    for (const n of [3, 9, 15, 21]) eaten.set(addDays(TODAY, n - 28), 500);
    expect(checkIn({ profile, days, eaten, today: TODAY }).status).toBe('zgodnie');
  });

  test('a scale that jumps half a kilo is not believed: the goal stays, and why', () => {
    // Weighed once a week, on the model's own line, but half a kilo up or down each time.
    const pace = ((tdee(profile, 81) - 2200) * 7) / 7500;
    const jumps = [0.4, -0.3, 0.5, -0.4, -0.3];
    const days = [0, 7, 14, 21, 27].map((n, i) => ({ date: addDays(TODAY, n - 28), weightKg: 82 - (pace / 7) * n + jumps[i]! }));
    const { eaten } = history({ startKg: 82, perWeek: 0, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    // The scale alone would say 170 kcal a day more than the model: inside the noise of five weigh-ins.
    expect(Math.abs(r.observedTdee! - r.modelTdee)).toBeGreaterThan(100);
    expect(r).toMatchObject({ status: 'zgodnie', suggestedKcal: 2200 });
    expect(r.reason).toContain('Waga skacze za bardzo');
  });

  test('a scale that cannot be true either: water at the start of a diet is not a burn of 5000 kcal', () => {
    const { days, eaten } = history({ startKg: 86, perWeek: -3, kcal: 2200 });
    const r = checkIn({ profile, days, eaten, today: TODAY });
    expect(r.status).toBe('za-malo-danych');
    expect(r.reason).toContain('woda, która schodzi na początku diety');
  });

  test('reaching the target on a low goal moves to maintenance in steps of at most 500 kcal', () => {
    // Losing 0.8 kg a week on 1500 kcal: maintenance is about 2400.
    const low = { ...profile, dailyKcal: 1500 };
    const { days, eaten } = history({ startKg: 77.5, perWeek: -0.8, kcal: 1500 });
    const r = checkIn({ profile: low, days, eaten, today: TODAY });
    expect(r.status).toBe('cel');
    expect(r.suggestedKcal).toBe(2000);
    expect(r.limited).toBe('cap');
    expect(r.reason).toContain('po 500 kcal');
  });

  test('a goal already below the floor is not raised by a correction downwards; the floor is named', () => {
    // BMR under 1200 kcal: the floor is the minimum for women, not the BMR.
    const small = prepProfile({ sex: 'K', age: 50, heightCm: 155, dailyKcal: 1100, startWeightKg: 52, targetWeightKg: 48 });
    const { days, eaten } = history({ startKg: 50, perWeek: 0, kcal: 1100 });
    const r = checkIn({ profile: small, days, eaten, today: TODAY });
    expect(r.suggestedKcal).toBe(1100);
    expect(r.reason).toContain('1100 kcal to już mniej niż minimum 1200 kcal dla kobiet');
  });

  test('the correction lives in the model: the pace of the profile and its chips see it', () => {
    const corrected = { ...profile, kcalCorrection: -300 };
    expect(tdee(corrected, 82)).toBeCloseTo(tdee(profile, 82) - 300, 9);
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

  test('a plan starting later this week gets the same share: the days before it carry theirs in the diary', () => {
    const profile = prepProfile({ dailyKcal: 2000, adaptWeekly: true });
    const eaten = new Map([['2026-10-19', 2600]]);
    // Friday to Sunday, made on Tuesday: still 600 over six days, not over the three of the plan.
    const t = planTargets({ profile, kcal: 2000, eaten, today: TODAY, dates: ['2026-10-23', '2026-10-24', '2026-10-25'] });
    expect(t.map((d) => d.targets.kcal)).toEqual([1900, 1900, 1900]);
  });

  test('a goal changed today starts its own balance: days eaten to the old goal are no surplus over the new one', () => {
    const profile = prepProfile({ dailyKcal: 1950, adaptWeekly: true, goalSince: TODAY });
    const eaten = new Map([['2026-10-19', 2200]]);
    const t = planTargets({ profile, kcal: 1950, eaten, today: TODAY, dates: [TODAY, '2026-10-21'] });
    expect(t.map((d) => d.targets.kcal)).toEqual([1950, 1950]);
  });

  test('without the weekly correction every day has the goal', () => {
    const profile = prepProfile({ dailyKcal: 2000, adaptWeekly: false });
    const t = planTargets({ profile, kcal: 2100, eaten: new Map([['2026-10-19', 3000]]), today: TODAY, dates: [TODAY] });
    expect(t[0]!.targets.kcal).toBe(2100);
  });
});
