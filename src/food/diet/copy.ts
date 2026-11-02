import type { Entry } from './db';

/**
 * „Kopiuj na…”: what can be copied from a day — the whole day, or one meal. Entries carry only a
 * time, so a meal is a part of the day by the clock: breakfast before 11:00, lunch until 17:00,
 * dinner after (and the small hours, still the evening before). Copies keep their time, so a meal
 * copied to another day is the same meal there.
 */
export type Meal = 'breakfast' | 'lunch' | 'dinner';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];

/** The meal an entry's HH:MM falls in. */
export function mealOf(time: string): Meal {
  const hour = Number(time.slice(0, 2));
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 17) return 'lunch';
  return 'dinner';
}

/** The day's meals that have entries, in the order of the day, each with its entries. */
export function mealGroups<E extends Pick<Entry, 'time'>>(entries: readonly E[]): { meal: Meal; entries: E[] }[] {
  return MEALS.map((meal) => ({ meal, entries: entries.filter((e) => mealOf(e.time) === meal) })).filter(
    (g) => g.entries.length > 0,
  );
}
