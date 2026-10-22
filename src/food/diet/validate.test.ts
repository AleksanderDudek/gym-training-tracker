import { describe, expect, test } from 'vitest';
import { completeProfile } from './store';
import { cleanDay, cleanPlan, cleanProfile, isCalendarDate } from './validate';

describe('validate', () => {
  test('a calendar date is a date the calendar has', () => {
    expect(['2026-10-11', '2028-02-29'].map(isCalendarDate)).toEqual([true, true]);
    expect(['2026-02-30', '2026-13-01', '11.10.2026', 20261011, null].map(isCalendarDate)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test('a profile keeps what is valid, clamps what is out of range, defaults the rest', () => {
    const defaults = completeProfile({});
    const p = cleanProfile(
      {
        age: 33,
        heightCm: 999,
        kcalPerKg: Number.NaN,
        sex: 'X',
        startDate: '2026-02-30',
        preferredStore: 'lidl',
        adaptWeekly: false,
      },
      defaults,
    );
    expect(p).toMatchObject({
      age: 33,
      heightCm: 230,
      kcalPerKg: defaults.kcalPerKg,
      sex: defaults.sex,
      startDate: defaults.startDate,
      preferredStore: 'lidl',
      adaptWeekly: false,
    });
    expect(cleanProfile('nonsense', defaults)).toEqual(defaults);
  });

  test('a plan is kept whole or not at all', () => {
    const variant = {
      index: 1,
      items: [{ text: 'Skyr', kcal: 95, protein: 16, carbs: 6, fat: 0.3, stores: [] }],
      totals: { kcal: 95, protein: 16, carbs: 6, fat: 0.3 },
    };
    const plan = {
      id: 'active',
      name: 'P',
      startDate: '2026-10-01',
      days: ['1A'],
      templates: { '1A': [variant] },
      foods: [],
      notes: [],
    };
    expect(cleanPlan(plan)).toEqual(plan);
    expect(
      cleanPlan({ ...plan, templates: { '1A': [{ ...variant, items: [{ text: 'Zły', kcal: 'x' }] }] } }),
    ).toBeNull();
  });

  test('a day keeps only choices that can be read', () => {
    expect(
      cleanDay({
        date: '2026-10-11',
        weightKg: -3,
        choices: { variant: 2, skipped: [1, 'x'], swaps: { 0: { text: 'Y' } } },
      }),
    ).toEqual({
      date: '2026-10-11',
      weightKg: null,
      steps: null,
      choices: { variant: 2, skipped: [1], swaps: {} },
    });
  });

  test('a planned cheat meal survives a backup with its macros; one without calories does not', () => {
    const day = cleanDay({ date: '2026-10-11', cheat: { name: 'Pizza', kcal: 1200, protein: 45, carbs: 'dużo', fat: 50 } });
    expect(day?.cheat).toEqual({ name: 'Pizza', kcal: 1200, protein: 45, carbs: null, fat: 50 });
    expect(cleanDay({ date: '2026-10-11', cheat: { name: 'Nic', kcal: 0 } })).not.toHaveProperty('cheat');
    expect(cleanDay({ date: '2026-10-11', cheat: 'pizza' })).not.toHaveProperty('cheat');
  });

  test('the activity switch is kept only as a yes or no', () => {
    const defaults = completeProfile({});
    expect(cleanProfile({ adaptActivity: false }, defaults).adaptActivity).toBe(false);
    expect(cleanProfile({ adaptActivity: 'tak' }, defaults).adaptActivity).toBeUndefined();
  });
});
