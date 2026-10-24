import { describe, expect, test } from 'vitest';
import { simulateCheat, type CheatInput } from './cheat';
import type { DayTotals } from './day';
import { DIET_PROFILES } from './profiles';

/**
 * The bigger-meal simulation (spec §4.4, C14): only the day — does it fit on the ±100 band, what is
 * left for the other meals, protein, carbs over a diet's limit, the day's plan. The day's target is
 * 2000 kcal (protein 150 g, carbs 200 g with no limit, fat 67 g).
 */

const targets = DIET_PROFILES.redukcja.targets(2000, 75);
const eaten = (kcal: number, protein = 0, carbs = 0, fat = 0): DayTotals => ({ kcal, protein, carbs, fat, unknownMacros: 0 });

const input = (over: Partial<CheatInput> = {}): CheatInput => ({
  cheat: { kcal: 600, protein: 25, carbs: 60, fat: 30 },
  targets,
  eaten: eaten(800, 60, 80, 30),
  mealsLeft: 3,
  plannedLeftKcal: null,
  ...over,
});

/** A meal that brings the day to `after` kcal. */
const to = (after: number, mealsLeft = 3) =>
  simulateCheat(input({ eaten: eaten(1000), cheat: { kcal: after - 1000, protein: null, carbs: null, fat: null }, mealsLeft }));

describe('the day on the ±100 band', () => {
  test('it fits: what is left is split over the other meals, protein too', () => {
    const s = simulateCheat(input());
    expect(s).toMatchObject({ goal: 2000, eatenBefore: 800, after: 1400, left: 600, over: 0, verdict: 'fits', restMeals: 2 });
    expect(s.perMeal).toEqual({ kcal: 300, protein: 33 });
    expect(s.protein).toBe(65);
  });

  test('the result says nothing beyond the day: no week, no scale, no making up for it', () => {
    const s = simulateCheat(input({ eaten: eaten(1500), cheat: { kcal: 1200, protein: null, carbs: null, fat: null } }));
    expect(s.verdict).toBe('over');
    expect(s).not.toHaveProperty('week');
    expect(s).not.toHaveProperty('kg');
    expect(s).not.toHaveProperty('offset');
  });

  test('more than 100 over is over (rounded to 10); up to 100 over and up to 100 left fills the target', () => {
    expect(to(2101)).toMatchObject({ verdict: 'over', over: 100, left: -101 });
    expect(to(2150)).toMatchObject({ verdict: 'over', over: 150 });
    // The old sheet said „Lekko ponad cel” from +1 kcal and „Przekroczysz” from +5 %.
    expect(to(2080)).toMatchObject({ verdict: 'full', over: 0 });
    expect(to(2100).verdict).toBe('full');
    expect(to(1900).verdict).toBe('full');
  });

  test('beyond the band: tight below 250 kcal per remaining meal, fits from there, the last meal fits', () => {
    // 101 left for two more meals: snacks.
    expect(to(1899).verdict).toBe('tight');
    expect(to(1501).verdict).toBe('tight');
    expect(to(1500).verdict).toBe('fits');
    // The bigger meal is the last one of the day: whatever is left beyond the band, it fits.
    expect(to(1899, 1)).toMatchObject({ verdict: 'fits', restMeals: 0, perMeal: null });
  });

  test('carbs over a limit only for a diet style that has one', () => {
    const keto = DIET_PROFILES.keto.targets(2000, 75); // carbs max 30 g
    const k = simulateCheat(input({ targets: keto, eaten: eaten(800, 60, 10, 60), cheat: { kcal: 900, protein: 30, carbs: 80, fat: 40 } }));
    expect(k.carbsOver).toBe(60);
    // Redukcja has a carb target, not a limit: 400 g is a lot, but no „ponad limit”.
    const r = simulateCheat(input({ eaten: eaten(800, 60, 300, 30), cheat: { kcal: 600, protein: 20, carbs: 100, fat: 10 } }));
    expect(r.carbsOver).toBe(0);
  });

  test('a planned day: how much of the remaining planned portions still fits', () => {
    expect(simulateCheat(input({ plannedLeftKcal: 1000 })).planShare).toBeCloseTo(0.6);
    expect(simulateCheat(input({ plannedLeftKcal: 400 })).planShare).toBe(1);
    expect(simulateCheat(input({ eaten: eaten(1800), plannedLeftKcal: 500 })).planShare).toBe(0);
  });
});
