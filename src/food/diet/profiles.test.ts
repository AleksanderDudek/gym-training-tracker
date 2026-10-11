import { describe, expect, test } from 'vitest';
import { DIET_PROFILES } from './profiles';

const shares = (protein: number, carbs: number, fat: number) => ({
  kcal: protein * 4 + carbs * 4 + fat * 9,
  protein,
  carbs,
  fat,
});

describe('targets: grams that add up to the calories', () => {
  test.each(Object.values(DIET_PROFILES).map((p) => [p.id, p] as const))('%s', (_, profile) => {
    const t = profile.targets(1800, 92);
    const kcal = t.protein.target * 4 + t.carbs.target * 4 + t.fat.target * 9;
    expect(kcal).toBeGreaterThan(1800 - 25);
    expect(kcal).toBeLessThan(1800 + 25);
    expect(t.carbs.target).toBeGreaterThanOrEqual(0);
  });

  test('high-protein reduction: 2 g of protein per kg of target weight', () => {
    expect(DIET_PROFILES.redukcja.targets(1800, 92).protein.target).toBe(184);
  });

  test('keto caps carbohydrates at 30 g, low carb at 100 g', () => {
    expect(DIET_PROFILES.keto.targets(1800, 92).carbs.max).toBe(30);
    expect(DIET_PROFILES.lowcarb.targets(1800, 92).carbs.max).toBe(100);
  });

  test('a budget too small for the protein floor still gives non-negative carbs', () => {
    expect(DIET_PROFILES.redukcja.targets(900, 92).carbs.target).toBe(0);
  });
});

describe('fit: what a profile thinks of a food', () => {
  test('keto: an egg-and-bacon kind of thing is great, a sandwich is out', () => {
    expect(DIET_PROFILES.keto.fit(shares(20, 2, 25)).level).toBe('great');
    expect(DIET_PROFILES.keto.fit(shares(15, 45, 10)).level).toBe('avoid');
  });

  test('high-protein reduction: skyr great, a croissant out, with a reason', () => {
    expect(DIET_PROFILES.redukcja.fit(shares(11, 4, 0.2)).level).toBe('great');
    const croissant = DIET_PROFILES.redukcja.fit(shares(8, 45, 21));
    expect(croissant.level).toBe('avoid');
    expect(croissant.reason).toMatch(/białk/);
  });

  test('sport wants protein AND carbohydrates', () => {
    expect(DIET_PROFILES.sportowa.fit(shares(30, 60, 8)).level).toBe('great');
    expect(DIET_PROFILES.sportowa.fit(shares(5, 10, 40)).level).toBe('avoid');
  });

  test('zero calories (water, spices) fit everything', () => {
    for (const p of Object.values(DIET_PROFILES))
      expect(p.fit({ kcal: 0, protein: 0, carbs: 0, fat: 0 }).level).not.toBe('avoid');
  });
});
