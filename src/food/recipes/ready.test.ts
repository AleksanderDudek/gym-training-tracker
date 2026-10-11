import { expect, test } from 'vitest';
import { indexProducts } from '../lib/search';
import type { Nutrition } from '../lib/types';
import { makeProduct } from '../test/fixtures';
import { readyProducts } from './ready';

function n(kcal: number, protein: number, carbs: number, fat: number): Nutrition {
  return { kcal, protein, carbs, fat, sugars: 1, saturatedFat: null, fiber: null, salt: null };
}

const PRODUCTS = indexProducts(
  [
    makeProduct({
      code: 'bar-ok',
      name: 'Baton proteinowy',
      categories: ['en:protein-bars'],
      nutrition: n(350, 33, 25, 12),
      stores: ['biedronka'],
      popularity: 5,
    }),
    makeProduct({
      code: 'bar-carby',
      name: 'Protein bar caramel',
      categories: ['en:protein-bars'],
      nutrition: n(400, 20, 40, 15),
      stores: ['biedronka'],
    }),
    makeProduct({
      code: 'drink',
      name: 'Napój proteinowy kakaowy',
      categories: ['en:beverages'],
      nutrition: n(60, 8, 4, 0.5),
      stores: ['lidl'],
    }),
    makeProduct({
      code: 'skyr',
      name: 'Skyr naturalny',
      categories: ['en:dairies'],
      nutrition: n(63, 11, 4, 0.2),
      stores: ['lidl'],
      popularity: 50,
    }),
    makeProduct({
      code: 'pudding',
      name: 'Pudding proteinowy',
      categories: ['en:dairy-desserts'],
      nutrition: n(80, 10, 6, 1.5),
      stores: ['biedronka'],
    }),
    makeProduct({
      code: 'cottage',
      name: 'Serek wiejski',
      categories: ['en:cottage-cheeses'],
      nutrition: n(97, 11, 2, 5),
      stores: ['lidl'],
    }),
    makeProduct({
      code: 'whey',
      name: 'Whey protein',
      categories: ['en:protein-powders'],
      nutrition: n(390, 75, 8, 6),
    }),
    makeProduct({ code: 'unknown', name: 'Baton proteinowy bez danych', categories: ['en:protein-bars'] }),
  ],
  {},
);

function groups(store: string | null) {
  return Object.fromEntries(readyProducts(PRODUCTS, store).map((g) => [g.id, g.items.map((p) => p.code)]));
}

test('each group holds only products that pass the rule per 100 g', () => {
  expect(groups(null)).toEqual({
    batony: ['bar-ok'],
    napoje: ['drink'],
    nabial: ['skyr', 'pudding'],
    twarogi: ['cottage'],
    odzywki: ['whey'],
  });
});

test('a store keeps only what it sells; empty groups are dropped', () => {
  expect(groups('lidl')).toEqual({ napoje: ['drink'], nabial: ['skyr'], twarogi: ['cottage'] });
});

test('each group is ordered by protein per calorie', () => {
  // skyr 11/63 beats pudding 10/80.
  expect(groups(null).nabial).toEqual(['skyr', 'pudding']);
});

test('a powder named like a drink is filed as a powder: no drink has 70 g protein per 100 g', () => {
  const p = indexProducts(
    [makeProduct({ code: 'night', name: 'Night Protein vanilla milk', nutrition: n(380, 71, 13, 1.7) })],
    {},
  );
  expect(Object.fromEntries(readyProducts(p, null).map((g) => [g.id, g.items.map((x) => x.code)]))).toEqual({
    odzywki: ['night'],
  });
});

test('a "bar" with an implausible 75% protein is left out rather than shown at the top', () => {
  const p = indexProducts(
    [
      makeProduct({
        code: 'odd',
        name: 'Białko baton mleczny',
        categories: ['en:protein-bars'],
        nutrition: n(420, 75, 9.8, 5.9),
      }),
    ],
    {},
  );
  expect(readyProducts(p, null)).toEqual([]);
});

test('a hard cheese is not a dessert', () => {
  const p = indexProducts(
    [
      makeProduct({
        code: 'cheese',
        name: 'Ser żółty high protein',
        categories: ['en:dairies'],
        nutrition: n(250, 31, 0, 8.2),
      }),
    ],
    {},
  );
  expect(readyProducts(p, null)).toEqual([]);
});

test('a cheese that calls itself high-protein is not filed with skyr and yogurts', () => {
  const p = indexProducts(
    [
      makeProduct({
        code: 'gouda',
        name: 'Ser żółty High Protein',
        categories: ['en:dairies', 'en:cheeses'],
        nutrition: n(198, 31, 0, 8.2),
      }),
      makeProduct({
        code: 'skyr',
        name: 'Skyr naturalny',
        categories: ['en:dairies', 'en:cheeses'],
        nutrition: n(63, 11, 4, 0.2),
      }),
    ],
    {},
  );
  expect(readyProducts(p, null).map((g) => [g.id, g.items.map((x) => x.code)])).toEqual([['nabial', ['skyr']]]);
});

test('several stores at once: what any of them sells', () => {
  expect(
    Object.fromEntries(readyProducts(PRODUCTS, ['lidl', 'biedronka']).map((g) => [g.id, g.items.map((p) => p.code)])),
  ).toEqual({
    batony: ['bar-ok'],
    napoje: ['drink'],
    nabial: ['skyr', 'pudding'],
    twarogi: ['cottage'],
  });
});
