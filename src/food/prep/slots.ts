import type { Slot } from './types';

/**
 * The meals of a day in the order they are eaten, each with its share of the day's energy. Four
 * is the default; a podwieczorek of 15 % is a proper snack (a skyr and fruit), not a biscuit.
 */
const SLOTS: Record<3 | 4 | 5, Slot[]> = {
  3: [
    { name: 'Śniadanie', kind: 'breakfast', share: 0.3 },
    { name: 'Obiad', kind: 'lunch', share: 0.4 },
    { name: 'Kolacja', kind: 'dinner', share: 0.3 },
  ],
  4: [
    { name: 'Śniadanie', kind: 'breakfast', share: 0.25 },
    { name: 'Obiad', kind: 'lunch', share: 0.35 },
    { name: 'Podwieczorek', kind: 'snack', share: 0.15 },
    { name: 'Kolacja', kind: 'dinner', share: 0.25 },
  ],
  5: [
    { name: 'Śniadanie', kind: 'breakfast', share: 0.25 },
    { name: 'II śniadanie', kind: 'snack', share: 0.1 },
    { name: 'Obiad', kind: 'lunch', share: 0.3 },
    { name: 'Podwieczorek', kind: 'snack', share: 0.1 },
    { name: 'Kolacja', kind: 'dinner', share: 0.25 },
  ],
};

export function slotsFor(meals: 3 | 4 | 5): Slot[] {
  return SLOTS[meals];
}

export const MEAL_COUNTS = [3, 4, 5] as const;
