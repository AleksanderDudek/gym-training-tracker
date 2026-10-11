import { describe, expect, test } from 'vitest';
import { RECIPES, type Recipe } from './catalog';
import { byTime, TIER_LABELS, tierOf } from './tiers';

describe('tierOf', () => {
  test.each([
    [1, 'szybkie'],
    [7, 'szybkie'],
    [8, 'chwila'],
    [20, 'chwila'],
    [21, 'dluzej'],
    [90, 'dluzej'],
  ] as const)('%i min is %s', (minutes, tier) => {
    expect(tierOf(minutes)).toBe(tier);
  });

  test('every tier has a Polish label, fastest first', () => {
    expect(Object.values(TIER_LABELS)).toEqual(['Szybkie', 'Chwilę dłużej', 'Dłużej, w domu']);
  });
});

describe('byTime', () => {
  const r = (id: string, minutes: number): Recipe => ({
    id,
    name: id,
    kind: 'obiad',
    minutes,
    tool: '',
    description: '',
    items: [],
    steps: [],
  });

  test('quick first, then by minutes; equal times keep their order', () => {
    const sorted = [r('a', 40), r('b', 3), r('c', 12), r('d', 1), r('e', 3)].sort(byTime);
    expect(sorted.map((x) => x.id)).toEqual(['d', 'b', 'e', 'c', 'a']);
  });

  test('the catalog has recipes in every tier, and the quick ones are still there', () => {
    const tiers = new Set(RECIPES.map((x) => tierOf(x.minutes)));
    expect([...tiers].sort()).toEqual(['chwila', 'dluzej', 'szybkie']);
    expect(RECIPES.filter((x) => tierOf(x.minutes) === 'szybkie').length).toBeGreaterThanOrEqual(14);
  });
});
