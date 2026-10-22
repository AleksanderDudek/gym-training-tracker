import { text } from '../lib/lang';
import type { Slot } from './types';

const N = text({
  pl: { breakfast: 'Śniadanie', second: 'II śniadanie', lunch: 'Obiad', tea: 'Podwieczorek', dinner: 'Kolacja' },
  en: { breakfast: 'Breakfast', second: 'Mid-morning snack', lunch: 'Lunch', tea: 'Afternoon snack', dinner: 'Dinner' },
});

/**
 * The meals of a day in the order they are eaten, each with its share of the day's energy. Four
 * is the default; a podwieczorek of 15 % is a proper snack (a skyr and fruit), not a biscuit.
 */
const SLOTS: Record<3 | 4 | 5, Slot[]> = {
  3: [
    { name: N.breakfast, kind: 'breakfast', share: 0.3 },
    { name: N.lunch, kind: 'lunch', share: 0.4 },
    { name: N.dinner, kind: 'dinner', share: 0.3 },
  ],
  4: [
    { name: N.breakfast, kind: 'breakfast', share: 0.25 },
    { name: N.lunch, kind: 'lunch', share: 0.35 },
    { name: N.tea, kind: 'snack', share: 0.15 },
    { name: N.dinner, kind: 'dinner', share: 0.25 },
  ],
  5: [
    { name: N.breakfast, kind: 'breakfast', share: 0.25 },
    { name: N.second, kind: 'snack', share: 0.1 },
    { name: N.lunch, kind: 'lunch', share: 0.3 },
    { name: N.tea, kind: 'snack', share: 0.1 },
    { name: N.dinner, kind: 'dinner', share: 0.25 },
  ],
};

export function slotsFor(meals: 3 | 4 | 5): Slot[] {
  return SLOTS[meals];
}

export const MEAL_COUNTS = [3, 4, 5] as const;
