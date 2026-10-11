import { describe, expect, test } from 'vitest';
import { INDEXED, makeProduct } from '../test/fixtures';
import { sortProducts, type Sort } from './sort';

function names(sort: Sort, products = INDEXED): string[] {
  return sortProducts(products, sort).map((p) => p.name);
}

describe('sortProducts', () => {
  test('does not mutate its input', () => {
    const before = INDEXED.map((p) => p.code);
    sortProducts(INDEXED, { key: 'kcal', dir: 'asc' });
    expect(INDEXED.map((p) => p.code)).toEqual(before);
  });

  test('numbers ascending and descending, unknown values last in both', () => {
    expect(names({ key: 'kcal', dir: 'asc' })).toEqual([
      'Pepsi',
      'Skyr naturalny',
      'Tofu naturalne',
      'Żółty ser Gouda',
      'Musli owocowe',
      'Chleb żytni',
    ]);
    expect(names({ key: 'kcal', dir: 'desc' })).toEqual([
      'Musli owocowe',
      'Żółty ser Gouda',
      'Tofu naturalne',
      'Skyr naturalny',
      'Pepsi',
      'Chleb żytni',
    ]);
  });

  test('ties break on name in Polish order, then code', () => {
    // Skyr and Tofu share popularity 120.
    expect(names({ key: 'popularity', dir: 'desc' }).slice(0, 3)).toEqual([
      'Pepsi',
      'Skyr naturalny',
      'Tofu naturalne',
    ]);
  });

  test('grades: A first ascending; eco a-plus before a', () => {
    expect(names({ key: 'nutriscore', dir: 'asc' }).slice(0, 2)).toEqual(['Skyr naturalny', 'Tofu naturalne']);
    const eco = [
      makeProduct({ code: 'x', name: 'X', ecoscore: 'a' }),
      makeProduct({ code: 'y', name: 'Y', ecoscore: 'a-plus' }),
      makeProduct({ code: 'z', name: 'Z', ecoscore: null }),
    ];
    expect(sortProducts(eco, { key: 'ecoscore', dir: 'asc' }).map((p) => p.code)).toEqual(['y', 'x', 'z']);
    expect(sortProducts(eco, { key: 'ecoscore', dir: 'desc' }).map((p) => p.code)).toEqual(['x', 'y', 'z']);
  });

  test('name uses Polish collation: ł after l, ą after a, ż after z', () => {
    const products = ['Żurek', 'Zupa', 'Łosoś', 'Lody', 'mąka', 'Masło'].map((name, i) =>
      makeProduct({ code: String(i), name }),
    );
    expect(sortProducts(products, { key: 'name', dir: 'asc' }).map((p) => p.name)).toEqual([
      'Lody',
      'Łosoś',
      'Masło',
      'mąka',
      'Zupa',
      'Żurek',
    ]);
  });

  test('price sorts by value; unpriced products follow, by name', () => {
    expect(names({ key: 'price', dir: 'asc' })).toEqual([
      'Skyr naturalny',
      'Tofu naturalne',
      'Żółty ser Gouda',
      'Chleb żytni',
      'Musli owocowe',
      'Pepsi',
    ]);
  });
});
