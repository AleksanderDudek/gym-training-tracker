import { describe, expect, test } from 'vitest';
import { INDEXED } from '../test/fixtures';
import { browse } from './browse';
import { EMPTY_FILTERS, type Filters } from './filters';

function filters(overrides: Partial<Filters>): Filters {
  return { ...EMPTY_FILTERS, ...overrides };
}

function names(f: Partial<Filters>): string[] {
  return browse(INDEXED, filters(f))
    .results.map((p) => p.name)
    .sort();
}

describe('results', () => {
  test('no filters returns everything', () => {
    expect(browse(INDEXED, EMPTY_FILTERS).results).toHaveLength(INDEXED.length);
  });

  test('search needs every word, ignoring case and Polish diacritics', () => {
    expect(names({ q: 'zolty SER' })).toEqual(['Żółty ser Gouda']);
    expect(names({ q: 'ser chleb' })).toEqual([]);
  });

  test('search finds a product by its displayed brand name and by barcode', () => {
    expect(names({ q: 'piątnica' })).toEqual(['Skyr naturalny']);
    expect(names({ q: '4' })).toContain('Pepsi');
  });

  test('grades are OR within a group and AND across groups', () => {
    expect(names({ nutriscore: ['a', 'e'] })).toEqual(['Pepsi', 'Skyr naturalny', 'Tofu naturalne']);
    expect(names({ nutriscore: ['a', 'e'], nova: [4] })).toEqual(['Pepsi']);
    expect(names({ ecoscore: ['b'] })).toEqual(['Skyr naturalny', 'Tofu naturalne']);
  });

  test('labels must all be present', () => {
    expect(names({ labels: ['en:vegan'] })).toEqual(['Musli owocowe', 'Tofu naturalne']);
    expect(names({ labels: ['en:vegan', 'en:no-added-sugar'] })).toEqual([]);
  });

  test('categories, brands and stores are OR within the group', () => {
    expect(names({ categories: ['en:dairies'] })).toEqual(['Skyr naturalny', 'Żółty ser Gouda']);
    expect(names({ brands: ['sante', 'pepsi'] })).toEqual(['Musli owocowe', 'Pepsi', 'Tofu naturalne']);
    expect(names({ stores: ['lidl'] })).toEqual(['Musli owocowe', 'Skyr naturalny']);
  });

  test('vegan needs yes, not maybe; no palm oil needs free', () => {
    expect(names({ toggles: ['vegan'] })).toEqual(['Musli owocowe', 'Pepsi', 'Tofu naturalne']);
    expect(names({ toggles: ['noPalmOil'] })).toEqual(['Musli owocowe', 'Tofu naturalne']);
  });

  test('presence toggles', () => {
    expect(names({ toggles: ['hasPrice'] })).toEqual(['Skyr naturalny', 'Tofu naturalne', 'Żółty ser Gouda']);
    expect(names({ toggles: ['hasImage', 'hasPrice'] })).toHaveLength(3);
    expect(names({ toggles: ['hasNutrition'] })).not.toContain('Chleb żytni');
  });

  test('a range bound excludes products with no value', () => {
    expect(names({ ranges: { kcal: { min: null, max: 100 } } })).toEqual(['Pepsi', 'Skyr naturalny']);
    expect(names({ ranges: { protein: { min: 10, max: null } } })).toEqual([
      'Skyr naturalny',
      'Tofu naturalne',
      'Żółty ser Gouda',
    ]);
    expect(names({ ranges: { price: { min: 5, max: 10 } } })).toEqual(['Tofu naturalne']);
  });

  test('an allergen exclusion removes declared allergens and traces', () => {
    expect(names({ withoutAllergens: ['en:milk'] })).not.toContain('Skyr naturalny');
    expect(names({ withoutAllergens: ['en:nuts'] })).not.toContain('Musli owocowe');
  });

  test('an allergen exclusion also hides products whose ingredients are unknown', () => {
    expect(names({ withoutAllergens: ['en:milk'] })).toEqual(['Musli owocowe', 'Pepsi', 'Tofu naturalne']);
  });
});

describe('facets', () => {
  test('a group counts against every other filter but not itself', () => {
    const { facets } = browse(INDEXED, filters({ nutriscore: ['a'], toggles: ['vegan'] }));
    // Ticking A leaves B..E countable, limited to vegan products.
    expect(facets.nutriscore).toEqual({ a: 1, c: 1, e: 1 });
    // Every other group is limited by both filters: only Tofu remains.
    expect(facets.stores).toEqual({ auchan: 1 });
  });

  test('labels are AND, so their counts narrow the current results', () => {
    const { facets } = browse(INDEXED, filters({ labels: ['en:vegan'] }));
    expect(facets.labels).toEqual({ 'en:vegan': 2, 'en:organic': 2 });
  });

  test('categories count the whole hierarchy', () => {
    expect(browse(INDEXED, EMPTY_FILTERS).facets.categories).toMatchObject({
      'en:dairies': 2,
      'en:cheeses': 1,
      'en:yogurts': 1,
    });
  });

  test('toggle counts say how many results would remain with that toggle on', () => {
    const { facets } = browse(INDEXED, filters({ nutriscore: ['a'] }));
    expect(facets.toggles).toMatchObject({ vegan: 1, hasPrice: 2, hasImage: 2, noPalmOil: 1 });
  });

  test('nova groups are counted under string keys', () => {
    expect(browse(INDEXED, EMPTY_FILTERS).facets.nova).toEqual({ 1: 1, 3: 2, 4: 1 });
  });
});
