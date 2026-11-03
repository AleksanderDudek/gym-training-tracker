import { describe, expect, test } from 'vitest';
import type { Entry } from './db';
import { entryParts, gramsOf, servingsIn } from './parts';

const entry = (over: Partial<Entry>): Entry => ({
  date: '2026-11-02',
  time: '08:00',
  name: 'x',
  amountLabel: '',
  kcal: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  source: 'quick',
  ...over,
});

describe('what an entry was made of', () => {
  test('a recipe serving is its ingredients', () => {
    const parts = entryParts(entry({ source: 'recipe', key: 'recipe:bialko-woda', name: 'Białko z wodą', amountLabel: '1 porcja' }));
    expect(parts).toMatchObject([
      { ingredient: 'whey', grams: 30 },
      { ingredient: 'water', grams: 300 },
    ]);
    expect(parts[0]!.name).toMatch(/Białko w proszku/);
    expect(entryParts(entry({ source: 'recipe', key: 'recipe:bialko-woda', amountLabel: '2 porcje' }))[0]!.grams).toBe(60);
  });

  test('a set is its parts; a deleted set, a product or a quick entry is itself', () => {
    const sets = new Map([[3, { id: 3, name: 'Banan + baton', parts: [{ name: 'Banan', amountLabel: '120 g', kcal: 100, protein: 1, carbs: 25, fat: 0, key: 'product:1' }] }]]);
    expect(entryParts(entry({ source: 'set', key: 'set:3' }), sets)).toEqual([{ name: 'Banan', grams: 120, amountLabel: '120 g', key: 'product:1' }]);
    expect(entryParts(entry({ source: 'set', key: 'set:9', name: 'Stary' }), sets)).toEqual([{ name: 'Stary', grams: null, amountLabel: '', key: 'set:9' }]);
    expect(entryParts(entry({ source: 'product', key: 'product:590', name: 'Skyr', amountLabel: '150 g' }))).toEqual([
      { name: 'Skyr', grams: 150, amountLabel: '150 g', key: 'product:590' },
    ]);
    expect(entryParts(entry({ name: 'Obiad u mamy' }))).toEqual([{ name: 'Obiad u mamy', grams: null, amountLabel: '' }]);
  });

  test('amount parsing', () => {
    expect(gramsOf('62,5 g')).toBe(62.5);
    expect(gramsOf('1 porcja')).toBeNull();
    expect(servingsIn('1,5 porcji')).toBe(1.5);
    expect(servingsIn('z planu')).toBe(1);
  });
});
