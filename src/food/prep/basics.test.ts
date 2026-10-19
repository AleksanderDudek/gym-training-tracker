import { describe, expect, test } from 'vitest';
import { INGREDIENTS } from '../recipes/ingredients';
import { AISLE, AISLE_LABELS, AISLE_ORDER } from './aisles';
import { BLOCK_DAYS, cookingBlocks, planDates } from './blocks';
import { gramsLabel, mixed, portionLabel, rangeLabel, roundGrams, weekdaySpan } from './format';
import { SIDES, sidesFor } from './sides';
import { MEAL_COUNTS, slotsFor } from './slots';

describe('cooking blocks', () => {
  const sizes = (days: number) => cookingBlocks('2026-10-20', days).map((b) => b.dates.length);

  test('never longer than four days, as even as they can be, the longer first', () => {
    expect(sizes(5)).toEqual([3, 2]);
    expect(sizes(6)).toEqual([3, 3]);
    expect(sizes(7)).toEqual([4, 3]);
    expect(sizes(8)).toEqual([4, 4]);
    expect(sizes(10)).toEqual([4, 3, 3]);
    expect(sizes(14)).toEqual([4, 4, 3, 3]);
    for (let days = 5; days <= 14; days++) {
      expect(sizes(days).reduce((a, b) => a + b, 0)).toBe(days);
      expect(Math.max(...sizes(days))).toBeLessThanOrEqual(BLOCK_DAYS);
    }
  });

  test('a block starts on its cooking day and runs on consecutive days', () => {
    const [first, second] = cookingBlocks('2026-10-30', 7);
    expect(first).toEqual({ start: '2026-10-30', dates: ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'] });
    expect(second!.start).toBe('2026-11-03');
    expect(planDates('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('meals of a day', () => {
  test('three, four or five, in the order they are eaten, shares adding up to the day', () => {
    for (const n of MEAL_COUNTS) {
      const slots = slotsFor(n);
      expect(slots).toHaveLength(n);
      expect(slots.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 9);
      expect(slots[0]!.kind).toBe('breakfast');
      expect(slots.at(-1)!.kind).toBe('dinner');
      expect(slots.filter((s) => s.kind === 'lunch')).toHaveLength(1);
    }
    expect(slotsFor(4).map((s) => s.name)).toEqual(['Śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja']);
    expect(slotsFor(5).filter((s) => s.kind === 'snack')).toHaveLength(2);
  });
});

describe('aisles', () => {
  test('every ingredient stands somewhere in the shop', () => {
    for (const id of Object.keys(INGREDIENTS)) expect(AISLE_ORDER, id).toContain(AISLE[id as keyof typeof AISLE]);
    expect(Object.keys(AISLE).sort()).toEqual(Object.keys(INGREDIENTS).sort());
    expect(Object.keys(AISLE_LABELS).sort()).toEqual([...AISLE_ORDER].sort());
  });
});

describe('sides', () => {
  const ctx = {
    slot: 'lunch' as const,
    box: true,
    savoury: true,
    starch: false,
    ownStarch: null,
    classic: false,
    fixed: false,
    carbLimited: false,
  };

  test('rice with a box, potatoes with a Polish classic, nothing starchy next to a starch', () => {
    expect(sidesFor(ctx).map((s) => s.id)).toEqual(['rice', 'oil']);
    expect(sidesFor({ ...ctx, classic: true }).map((s) => s.id)).toEqual(['potato', 'oil']);
    expect(sidesFor({ ...ctx, starch: true }).map((s) => s.id)).toEqual(['oil']);
  });

  test('more of its own starch: more rice in the curry, more potatoes with the pyry, nothing next to pasta', () => {
    expect(sidesFor({ ...ctx, starch: true, ownStarch: 'rice' }).map((s) => s.id)).toEqual(['rice', 'oil']);
    expect(sidesFor({ ...ctx, starch: true, ownStarch: 'potato', classic: true }).map((s) => s.id)).toEqual(['potato', 'oil']);
    expect(sidesFor({ ...ctx, starch: true, ownStarch: null }).map((s) => s.id)).toEqual(['oil']);
  });

  test('a roll, avocado and oil with a savoury breakfast or supper, a banana and nuts with a sweet one, nothing with a gotowiec', () => {
    expect(sidesFor({ ...ctx, slot: 'breakfast', box: false }).map((s) => s.id)).toEqual(['roll', 'avocado', 'oil']);
    expect(sidesFor({ ...ctx, slot: 'dinner', box: false }).map((s) => s.id)).toEqual(['roll', 'avocado', 'oil']);
    expect(sidesFor({ ...ctx, slot: 'dinner', box: true }).map((s) => s.id)).toEqual(['rice', 'oil']);
    expect(sidesFor({ ...ctx, slot: 'breakfast', box: false, savoury: false, starch: true }).map((s) => s.id)).toEqual([
      'banana',
      'nuts',
    ]);
    expect(sidesFor({ ...ctx, slot: 'snack', box: false, savoury: true }).map((s) => s.id)).toEqual(['nuts']);
    expect(sidesFor({ ...ctx, fixed: true })).toEqual([]);
  });

  test('under a carb limit: more oil, and nuts with a savoury meal too', () => {
    const keto = sidesFor({ ...ctx, slot: 'dinner', box: false, carbLimited: true });
    expect(keto.map((s) => s.id)).toEqual(['roll', 'avocado', 'oil', 'nuts']);
    expect(keto.find((s) => s.id === 'oil')!.max).toBe(4);
    expect(sidesFor(ctx).find((s) => s.id === 'oil')!.max).toBe(2);
  });

  test('amounts a person can measure', () => {
    expect(SIDES.rice.amount(3)).toBe('75 g ryżu (suchego)');
    expect(SIDES.roll.amount(2)).toBe('2 bułki');
    expect(SIDES.oil.amount(1)).toBe('1 łyżeczka oliwy');
    expect(SIDES.oil.amount(2)).toBe('1 łyżka oliwy');
    expect(SIDES.oil.amount(4)).toBe('2 łyżki oliwy');
    expect(SIDES.avocado.amount(1)).toBe('½ awokado');
  });
});

describe('words for amounts and days', () => {
  test('portions with quarters, in the right Polish form', () => {
    expect(mixed(1.25)).toBe('1¼');
    expect(mixed(0.5)).toBe('½');
    expect(mixed(2)).toBe('2');
    expect(mixed(1.3)).toBe('1,3');
    expect(portionLabel(1)).toBe('1 porcja');
    expect(portionLabel(2)).toBe('2 porcje');
    expect(portionLabel(5)).toBe('5 porcji');
    expect(portionLabel(1.5)).toBe('1½ porcji');
    expect(portionLabel(0.75)).toBe('¾ porcji');
  });

  test('ranges and spans of days', () => {
    expect(rangeLabel('2026-10-20', '2026-10-26')).toBe('20–26 paź');
    expect(rangeLabel('2026-10-28', '2026-11-03')).toBe('28 paź – 3 lis');
    expect(weekdaySpan(['2026-10-20', '2026-10-21', '2026-10-22'])).toBe('wt.–czw.');
    expect(weekdaySpan(['2026-10-20'])).toBe('wt.');
  });

  test('grams in kitchen precision', () => {
    expect(roundGrams(2.4)).toBe(2);
    expect(roundGrams(43)).toBe(45);
    expect(roundGrams(437)).toBe(440);
    expect(gramsLabel(437)).toBe('440 g');
    expect(gramsLabel(1250)).toBe('1,25 kg');
  });
});
