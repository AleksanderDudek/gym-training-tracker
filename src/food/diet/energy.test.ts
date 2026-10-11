import { describe, expect, test } from 'vitest';
import { bmr, dayReaching, forecast, paceKgPerWeek, suggestedKcal, tdee } from './energy';
import { MODEL_DEFAULTS, type Profile } from './types';

// A made-up person on the workbook's model: 84 -> 70 kg, 168 cm, 41 y, K, with
// the workbook's constants (multiplier 1.28, 4000 base steps, 10 000 goal,
// 0.4 kcal / 1000 steps / kg, 7500 kcal / kg).
const P: Profile = {
  sex: 'K',
  age: 41,
  heightCm: 168,
  startWeightKg: 84,
  targetWeightKg: 70,
  startDate: '2026-03-02',
  ...MODEL_DEFAULTS,
  dailyKcal: 1500,
  dietProfile: 'redukcja',
  adaptWeekly: true,
  preferredStore: null,
};

// 10·84 + 6.25·168 − 5·41 − 161
const BMR = 1524;
// BMR × 1.28 + (10 000 − 4000) / 1000 × 84 × 0.4
const TDEE = BMR * 1.28 + 6 * 84 * 0.4;

describe("energy, the workbook's model", () => {
  test('BMR (Mifflin-St Jeor) at the start weight', () => {
    expect(bmr(P, 84)).toBe(BMR);
    expect(bmr({ ...P, sex: 'M' }, 84)).toBe(BMR + 166);
  });

  test('TDEE at the step goal: 2152.32', () => {
    expect(tdee(P, 84)).toBeCloseTo(2152.32, 6);
  });

  test('steps below the base add nothing, never subtract', () => {
    expect(tdee(P, 84, 2000)).toBeCloseTo(BMR * 1.28, 6);
  });

  test('pace at the start for 1500 kcal: 0.609 kg a week', () => {
    expect(paceKgPerWeek(P, 84, 1500)).toBeCloseTo(((TDEE - 1500) * 7) / 7500, 9);
    expect(paceKgPerWeek(P, 84, 1500)).toBeCloseTo(0.608832, 9);
  });

  test("forecast by plan: tomorrow is today minus the day's gap over 7500", () => {
    const series = forecast(P, [
      { date: '2026-03-02', plannedKcal: 1500 },
      { date: '2026-03-03', plannedKcal: 1500 },
    ]);
    expect(series[0]).toMatchObject({ date: '2026-03-02', plan: 84, real: 84 });
    expect(series[1]?.plan).toBeCloseTo(84 - (TDEE - 1500) / 7500, 8);
  });

  test('the real forecast uses what was eaten and walked', () => {
    const series = forecast(P, [
      { date: '2026-03-02', plannedKcal: 1500, eatenKcal: 2100, steps: 4000 },
      { date: '2026-03-03', plannedKcal: 1500 },
    ]);
    // At the base steps no walking is added: 84 - (1524·1.28 - 2100) / 7500
    const tomorrow = series[1]!;
    expect(tomorrow.real).toBeCloseTo(84 - (BMR * 1.28 - 2100) / 7500, 8);
    expect(tomorrow.real).toBeGreaterThan(tomorrow.plan);
  });

  test('the first day at or below the target weight', () => {
    const days = Array.from({ length: 500 }, (_, i) => ({ date: `d${i}`, plannedKcal: 1500 }));
    const series = forecast(P, days);
    const day = dayReaching(70, series, 'plan');
    expect(day).not.toBeNull();
    expect(series.find((s) => s.date === day)!.plan).toBeLessThanOrEqual(70);
    expect(dayReaching(40, series, 'plan')).toBeNull();
  });

  test('a goal for a pace: TDEE minus the weekly energy spread over seven days', () => {
    expect(suggestedKcal(P, 84, 0.5)).toBe(Math.round(TDEE - (0.5 * 7500) / 7));
  });
});
