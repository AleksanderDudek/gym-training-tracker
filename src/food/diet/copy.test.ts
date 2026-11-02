import { describe, expect, test } from 'vitest';
import { mealGroups, mealOf } from './copy';

describe('meals by the clock', () => {
  test('breakfast 04:00–10:59, lunch 11:00–16:59, dinner the rest (the small hours too)', () => {
    expect(['04:00', '07:30', '10:59'].map(mealOf)).toEqual(['breakfast', 'breakfast', 'breakfast']);
    expect(['11:00', '13:15', '16:59'].map(mealOf)).toEqual(['lunch', 'lunch', 'lunch']);
    expect(['17:00', '21:40', '00:30', '03:59'].map(mealOf)).toEqual(['dinner', 'dinner', 'dinner', 'dinner']);
  });

  test('groups in the order of the day, only meals with entries, entries in their order', () => {
    const entries = [{ time: '19:00' }, { time: '08:00' }, { time: '08:30' }];
    expect(mealGroups(entries)).toEqual([
      { meal: 'breakfast', entries: [{ time: '08:00' }, { time: '08:30' }] },
      { meal: 'dinner', entries: [{ time: '19:00' }] },
    ]);
    expect(mealGroups([])).toEqual([]);
  });
});
