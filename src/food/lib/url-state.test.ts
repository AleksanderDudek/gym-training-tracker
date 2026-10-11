import { describe, expect, test } from 'vitest';
import { EMPTY_FILTERS } from './filters';
import { DEFAULT_VIEW_STATE, fromSearchParams, toSearchParams, type ViewState } from './url-state';

const FULL: ViewState = {
  filters: {
    q: 'żółty ser',
    toggles: ['hasImage', 'vegan'],
    nutriscore: ['a', 'b'],
    nova: [1, 4],
    ecoscore: ['a-plus'],
    withoutAllergens: ['en:milk', 'en:gluten'],
    labels: ['en:organic'],
    categories: ['en:dairies'],
    brands: ['piatnica'],
    stores: ['biedronka', 'lidl'],
    ranges: { kcal: { min: 0, max: 200 }, protein: { min: 10.5, max: null }, price: { min: null, max: 9.99 } },
  },
  sort: { key: 'kcal', dir: 'asc' },
  view: 'table',
  page: 3,
  product: '5900120011151',
};

describe('url state', () => {
  test('the default state is an empty query string', () => {
    expect(toSearchParams(DEFAULT_VIEW_STATE).toString()).toBe('');
  });

  test('an empty query string is the default state', () => {
    expect(fromSearchParams(new URLSearchParams(''))).toEqual(DEFAULT_VIEW_STATE);
  });

  test('a full state survives the round trip', () => {
    expect(fromSearchParams(toSearchParams(FULL))).toEqual(FULL);
  });

  test('ranges are written compactly', () => {
    const params = toSearchParams(FULL);
    expect(params.get('kcal')).toBe('0-200');
    expect(params.get('protein')).toBe('10.5-');
    expect(params.get('price')).toBe('-9.99');
  });

  test('unknown or malformed values are dropped, not fatal', () => {
    const state = fromSearchParams(
      new URLSearchParams(
        'ns=z,a&nova=9,2&eco=q&only=bogus,vegan&sort=nonsense-asc&view=grid&page=-3&kcal=abc-&fat=5-x',
      ),
    );
    expect(state.filters.nutriscore).toEqual(['a']);
    expect(state.filters.nova).toEqual([2]);
    expect(state.filters.ecoscore).toEqual([]);
    expect(state.filters.toggles).toEqual(['vegan']);
    expect(state.sort).toEqual(DEFAULT_VIEW_STATE.sort);
    expect(state.view).toBe('cards');
    expect(state.page).toBe(1);
    expect(state.filters.ranges).toEqual({ fat: { min: 5, max: null } });
  });

  test('an empty range is not written', () => {
    const state = { ...DEFAULT_VIEW_STATE, filters: { ...EMPTY_FILTERS, ranges: { kcal: { min: null, max: null } } } };
    expect(toSearchParams(state).toString()).toBe('');
  });
});
