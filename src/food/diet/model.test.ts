import { describe, expect, test } from 'vitest';
import { DIET_PROFILES } from './profiles';
import { addDays, dayLabel, mealsLeftAt, mondayOf, remainingOf } from './model';

describe('dates', () => {
  test('days are added across months and a week starts on Monday', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });

  test('near days get a word, the rest a date', () => {
    expect(dayLabel('2026-10-11', '2026-10-11')).toBe('Dziś');
    expect(dayLabel('2026-10-10', '2026-10-11')).toBe('Wczoraj');
    expect(dayLabel('2026-10-14', '2026-10-11')).toMatch(/środa, 14 października/);
  });
});

describe('the day', () => {
  test('the day winds down: four meals in the morning, one at night', () => {
    expect([8, 12, 17, 21].map(mealsLeftAt)).toEqual([4, 3, 2, 1]);
  });

  test('what is left counts carbohydrates down to the limit of a low-carb profile', () => {
    const keto = DIET_PROFILES.keto.targets(1800, 90);
    expect(remainingOf(keto, { kcal: 600, protein: 40, carbs: 12, fat: 40, unknownMacros: 0 }).carbs).toBe(18);
  });
});
