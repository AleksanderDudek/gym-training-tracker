import { describe, expect, test } from 'vitest';
import { simulateCheat, type CheatInput } from './cheat';
import type { DayTotals } from './day';
import { DIET_PROFILES } from './profiles';
import { completeProfile } from './store';

/**
 * The cheat-meal simulation: do I fit, by how much do I go over, what is left for the other meals,
 * what it costs the week and the scale. 2026-10-21 is a Wednesday; the goal is 2000 kcal.
 */

const profile = completeProfile({ dailyKcal: 2000 });
const targets = DIET_PROFILES.redukcja.targets(2000, 75); // protein 150 g, carbs 200 g, fat 67 g (max 87)
const eaten = (kcal: number, protein = 0, carbs = 0, fat = 0): DayTotals => ({ kcal, protein, carbs, fat, unknownMacros: 0 });

const input = (over: Partial<CheatInput> = {}): CheatInput => ({
  cheat: { kcal: 600, protein: 25, carbs: 60, fat: 30 },
  targets,
  eaten: eaten(800, 60, 80, 30),
  mealsLeft: 3,
  profile,
  kg: 80,
  date: '2026-10-21',
  eatenByDate: new Map([
    ['2026-10-19', 2000],
    ['2026-10-20', 2000],
  ]),
  plannedLeftKcal: null,
  typicalWorkoutKcal: 300,
  ...over,
});

describe('the day', () => {
  test('it fits: what is left is split over the other meals, protein too', () => {
    const s = simulateCheat(input());
    expect(s).toMatchObject({ goal: 2000, eatenBefore: 800, after: 1400, left: 600, over: 0, verdict: 'fits', restMeals: 2 });
    expect(s.perMeal).toEqual({ kcal: 300, protein: 33 });
    expect(s.protein).toBe(65);
    expect(s.week).toEqual({ kind: 'none' });
    expect(s.offset).toBeNull();
  });

  test('it fits, but tightly: little per remaining meal', () => {
    const s = simulateCheat(input({ eaten: eaten(1100), cheat: { kcal: 600, protein: null, carbs: null, fat: null } }));
    expect(s.left).toBe(300);
    expect(s.verdict).toBe('tight');
    expect(s.perMeal?.kcal).toBe(150);
  });

  test('a little over the goal is the edge, more than 5 % is over', () => {
    expect(simulateCheat(input({ eaten: eaten(1450) })).verdict).toBe('edge');
    const s = simulateCheat(input({ eaten: eaten(1200), cheat: { kcal: 1400, protein: 50, carbs: 150, fat: 60 } }));
    expect(s).toMatchObject({ after: 2600, left: -600, over: 600, verdict: 'over', perMeal: null });
    expect(s.overShare).toBeCloseTo(0.3);
  });

  test('the cheat meal as the last meal of the day leaves no other meals', () => {
    const s = simulateCheat(input({ mealsLeft: 1 }));
    expect(s.restMeals).toBe(0);
    expect(s.perMeal).toBeNull();
    expect(s.verdict).toBe('fits');
  });

  test('carbohydrates over a keto limit and fat over its ceiling are flagged', () => {
    const keto = DIET_PROFILES.keto.targets(2000, 75); // carbs max 30 g
    const s = simulateCheat(input({ targets: keto, eaten: eaten(800, 60, 10, 60), cheat: { kcal: 900, protein: 30, carbs: 80, fat: 40 } }));
    expect(s.carbs.over).toBe(60);
    const fat = simulateCheat(input({ eaten: eaten(800, 60, 80, 70), cheat: { kcal: 600, protein: 20, carbs: 20, fat: 40 } }));
    expect(fat.fat.over).toBe(23);
  });

  test('a planned day: how much of the remaining planned portions still fits', () => {
    expect(simulateCheat(input({ plannedLeftKcal: 1000 })).planShare).toBeCloseTo(0.6);
    expect(simulateCheat(input({ plannedLeftKcal: 400 })).planShare).toBe(1);
    expect(simulateCheat(input({ eaten: eaten(1800), plannedLeftKcal: 500 })).planShare).toBe(0);
  });
});

describe('beyond the day', () => {
  const big = { cheat: { kcal: 1400, protein: 50, carbs: 150, fat: 60 }, eaten: eaten(1200) };

  test('the weekly balance spreads the surplus over the days left: Thursday to Sunday', () => {
    const s = simulateCheat(input(big));
    expect(s.week).toEqual({ kind: 'spread', perDay: -150, days: 4, unpaid: 0 });
    expect(s.kg).toBeCloseTo(0.08);
  });

  test('a large surplus hits the 10 % cap: the rest stays unpaid', () => {
    const s = simulateCheat(input({ ...big, cheat: { kcal: 2300, protein: null, carbs: null, fat: null } }));
    expect(s.over).toBe(1500);
    expect(s.week).toEqual({ kind: 'spread', perDay: -200, days: 4, unpaid: 700 });
  });

  test('on Sunday nothing carries over; without the weekly correction it stays in the balance', () => {
    expect(simulateCheat(input({ ...big, date: '2026-10-25' })).week).toEqual({ kind: 'sunday' });
    expect(simulateCheat(input({ ...big, profile: { ...profile, adaptWeekly: false } })).week).toEqual({ kind: 'off' });
  });

  test('a day before the cheat meal that was itself over makes tomorrow lower anyway: only the cheat meal’s part is reported', () => {
    const s = simulateCheat(input({ ...big, eatenByDate: new Map([['2026-10-20', 2400]]) }));
    expect(s.week).toMatchObject({ kind: 'spread', perDay: -100, days: 4 });
  });

  test('what would offset the surplus: extra steps (to 500) or trainings', () => {
    const s = simulateCheat(input(big));
    // 600 kcal / (80 kg × 0.4 kcal per 1000 steps per kg) = 18 750 steps
    expect(s.offset).toEqual({ steps: 19_000, trainings: 2 });
  });
});
