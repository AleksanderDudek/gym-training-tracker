import { describe, expect, test } from 'vitest';
import { indexProducts } from '../lib/search';
import type { Nutrition, Product } from '../lib/types';
import { makeProduct } from '../test/fixtures';
import type { Recipe } from './catalog';
import { availableStores, bestVariant, buildCandidates, recipeIndex, resolveRecipe, storeRanking } from './resolve';

function n(kcal: number, protein: number, carbs: number, fat: number, sugars = carbs): Nutrition {
  return { kcal, protein, carbs, fat, sugars, saturatedFat: null, fiber: null, salt: null };
}

const skyr = (code: string, stores: string[], popularity: number | null, protein = 11) =>
  makeProduct({ code, name: `Skyr naturalny ${code}`, nutrition: n(63, protein, 4, 0.2), stores, popularity });

const PRODUCTS: Product[] = [
  skyr('s-bie', ['biedronka'], 50),
  skyr('s-lidl-a', ['lidl'], 10),
  skyr('s-lidl-b', ['lidl'], 90, 12),
  makeProduct({
    code: 'w-bie',
    name: 'Go Active whey',
    categories: ['en:protein-powders'],
    nutrition: n(380, 70, 9, 6),
    stores: ['biedronka'],
    popularity: 5,
  }),
  makeProduct({
    code: 'w-net',
    name: 'Whey protein',
    categories: ['en:protein-powders'],
    nutrition: n(400, 80, 5, 7),
    stores: [],
    popularity: 300,
  }),
  makeProduct({
    code: 'm-lidl',
    name: 'Mleko 2%',
    categories: ['en:milks'],
    nutrition: n(50, 3.3, 4.8, 2, 4.8),
    stores: ['lidl'],
    popularity: 40,
  }),
  // A cottage cheese only Auchan has: the tuna salad needs tuna too, which Auchan lacks.
  makeProduct({
    code: 'c-auchan',
    name: 'Serek wiejski',
    categories: ['en:cottage-cheeses'],
    nutrition: n(97, 11, 2, 5, 2),
    stores: ['auchan'],
    popularity: 1,
  }),
];
const candidates = buildCandidates(indexProducts(PRODUCTS, {}));

const SKYR_BOWL: Recipe = {
  id: 'bowl',
  name: 'Bowl',
  kind: 'miska',
  minutes: 3,
  tool: '',
  description: '',
  items: [
    { ingredient: 'skyr', grams: 200 },
    { ingredient: 'whey', grams: 15 },
    { ingredient: 'raspberries', grams: 100 },
  ],
  steps: ['x'],
};
const WHEY_MILK: Recipe = {
  id: 'mix',
  name: 'Mix',
  kind: 'mix',
  minutes: 1,
  tool: '',
  description: '',
  items: [
    { ingredient: 'whey', grams: 30 },
    { ingredient: 'milk', grams: 300 },
  ],
  steps: ['x'],
};

describe('buildCandidates', () => {
  test('ranks by popularity, then protein density', () => {
    expect(candidates.get('skyr')!.map((p) => p.code)).toEqual(['s-lidl-b', 's-bie', 's-lidl-a']);
  });
});

describe('resolveRecipe', () => {
  test("a store variant uses that store's products", () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, 'lidl');
    expect(r.available).toBe(true);
    expect(r.items[0]?.product?.code).toBe('s-lidl-b');
    expect(r.items[0]?.fromStore).toBe(true);
  });

  test('a store ingredient the store does not have makes the recipe unavailable there', () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, 'auchan');
    expect(r.available).toBe(false);
    expect(r.missing).toEqual(['skyr']);
  });

  test('a staple the store has no data for falls back to typical values', () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, 'lidl');
    expect(r.items[2]).toMatchObject({ product: null, fromStore: false });
    expect(r.items[2]?.macros).toEqual({ kcal: 52, protein: 1.2, carbs: 5.4, fat: 0.7 });
  });

  test("pantry: the store's own if it has one, otherwise the best from anywhere", () => {
    expect(resolveRecipe(SKYR_BOWL, candidates, 'biedronka').items[1]).toMatchObject({ fromStore: true });
    expect(resolveRecipe(SKYR_BOWL, candidates, 'biedronka').items[1]?.product?.code).toBe('w-bie');
    const lidl = resolveRecipe(SKYR_BOWL, candidates, 'lidl').items[1];
    expect(lidl?.product?.code).toBe('w-net');
    expect(lidl?.fromStore).toBe(false);
  });

  test('totals add up and the rule is checked on them', () => {
    const r = resolveRecipe(WHEY_MILK, candidates, 'lidl');
    expect(r.total).toEqual({ kcal: 270, protein: 33.9, carbs: 15.9, fat: 8.1 });
    expect(r.passes).toBe(true);
  });

  test('a recipe for several servings keeps the whole total and shows one serving', () => {
    const forTwo: Recipe = { ...WHEY_MILK, servings: 2 };
    const r = resolveRecipe(forTwo, candidates, 'lidl');
    expect(r.total).toEqual({ kcal: 270, protein: 33.9, carbs: 15.9, fat: 8.1 });
    expect(r.perServing).toEqual({ kcal: 135, protein: 16.95, carbs: 7.95, fat: 4.05 });
    expect(r.passes).toBe(true);
  });

  test('without servings a recipe is one serving', () => {
    const r = resolveRecipe(WHEY_MILK, candidates, 'lidl');
    expect(r.perServing).toEqual(r.total);
  });

  test('a swap to another candidate in the same store is honoured and re-checked', () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, 'lidl', { skyr: 's-lidl-a' });
    expect(r.items[0]?.product?.code).toBe('s-lidl-a');
  });

  test('a swap to a product the store does not sell is ignored', () => {
    expect(resolveRecipe(SKYR_BOWL, candidates, 'lidl', { skyr: 's-bie' }).items[0]?.product?.code).toBe('s-lidl-b');
  });

  test('with no store, store and pantry pools are the whole dataset', () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, null);
    expect(r.items[0]?.product?.code).toBe('s-lidl-b');
    expect(r.items[1]?.product?.code).toBe('w-net');
  });

  test('with no store, a staple uses typical values: a product would name one chain under "every store"', () => {
    const r = resolveRecipe(WHEY_MILK, candidates, null);
    expect(r.items[1]).toMatchObject({ product: null, alternatives: [] });
    expect(r.items[1]?.macros).toEqual({ kcal: 150, protein: 9.9, carbs: 14.4, fat: 6 });
  });

  test("pantry: the store's own comes first, but any product can be swapped in - it is at home already", () => {
    const r = resolveRecipe(SKYR_BOWL, candidates, 'biedronka');
    expect(r.items[1]?.alternatives.map((p) => p.code)).toEqual(['w-bie', 'w-net']);
    expect(resolveRecipe(SKYR_BOWL, candidates, 'biedronka', { whey: 'w-net' }).items[1]?.product?.code).toBe('w-net');
  });
});

describe('stores', () => {
  test('availableStores lists only stores where the recipe resolves and passes', () => {
    expect(availableStores(SKYR_BOWL, candidates, ['biedronka', 'lidl', 'auchan'])).toEqual(['biedronka', 'lidl']);
  });

  test('storeRanking orders stores by how many recipes they cover', () => {
    expect(storeRanking([SKYR_BOWL, WHEY_MILK], candidates)).toEqual(['biedronka', 'lidl']);
  });

  test('storeRanking puts cash & carry halls after the supermarkets, however much they cover', () => {
    const withHall = buildCandidates(
      indexProducts(
        [
          ...PRODUCTS,
          skyr('s-sel', ['selgros'], 20),
          makeProduct({ code: 'w-sel', name: 'Whey', categories: ['en:protein-powders'], nutrition: n(390, 75, 8, 6), stores: ['selgros'], popularity: 2 }),
          makeProduct({ code: 'm-sel', name: 'Mleko 2%', categories: ['en:milks'], nutrition: n(50, 3.3, 4.8, 2, 4.8), stores: ['selgros'], popularity: 2 }),
        ],
        {},
      ),
    );
    expect(storeRanking([SKYR_BOWL, WHEY_MILK], withHall)).toEqual(['biedronka', 'lidl', 'selgros']);
    // Chosen on purpose, the hall is a store like any other.
    expect(bestVariant(SKYR_BOWL, withHall, ['selgros'])?.store).toBe('selgros');
  });

  test('bestVariant picks the first covering store in the ranking', () => {
    const v = bestVariant(SKYR_BOWL, candidates, ['lidl', 'biedronka']);
    expect(v?.store).toBe('lidl');
  });

  test('bestVariant offers nothing when no single store covers the recipe: one shop is the requirement', () => {
    const salad: Recipe = {
      ...SKYR_BOWL,
      items: [
        { ingredient: 'skyr', grams: 150 },
        { ingredient: 'cottage', grams: 150 },
      ],
    };
    expect(bestVariant(salad, candidates, ['biedronka', 'lidl', 'auchan'])).toBeNull();
  });

  test('bestVariant needs no shop for a recipe without store ingredients', () => {
    expect(bestVariant(WHEY_MILK, candidates, ['lidl'])?.store).toBeNull();
  });

  test('recipeIndex is computed once per product list', () => {
    const products = indexProducts(PRODUCTS, {});
    expect(recipeIndex(products)).toBe(recipeIndex(products));
    // The real catalog: three skyr recipes each at Biedronka and Lidl, and the
    // cottage-cheese-and-tomato bowl at Auchan, the only shop with cottage cheese here.
    expect(recipeIndex(products).ranking).toEqual(['biedronka', 'lidl', 'auchan']);
  });
});

describe('pack items', () => {
  const bar = (code: string, quantity: string | null, stores = ['biedronka']) =>
    makeProduct({
      code,
      name: `Baton proteinowy ${code}`,
      quantity,
      nutrition: n(380, 33, 29, 16, 3),
      stores,
      popularity: 10,
    });
  const SET: Recipe = {
    id: 'set',
    name: 'Banan i baton',
    kind: 'gotowiec',
    minutes: 1,
    tool: 'Bez naczyń',
    description: '',
    items: [
      { ingredient: 'banana', grams: 120 },
      { ingredient: 'proteinBar', grams: 45, pack: true },
    ],
    steps: ['x'],
  };

  test("a pack item weighs what the chosen product's pack weighs", () => {
    const c = buildCandidates(indexProducts([bar('b60', '60 g')], {}));
    const r = resolveRecipe(SET, c, 'biedronka');
    expect(r.items[1]!.grams).toBe(60);
    expect(r.items[1]!.macros.protein).toBeCloseTo(19.8);
    // Banana: a staple without a product, typical values at the catalog's grams.
    expect(r.items[0]!.grams).toBe(120);
  });

  test('a multipack counts one piece; an unreadable size keeps the catalog grams', () => {
    expect(
      resolveRecipe(SET, buildCandidates(indexProducts([bar('m', '4 x 50 g')], {})), 'biedronka').items[1]!.grams,
    ).toBe(50);
    expect(resolveRecipe(SET, buildCandidates(indexProducts([bar('u', null)], {})), 'biedronka').items[1]!.grams).toBe(
      45,
    );
  });

  test('a gotowiec is judged by its protein floor, not by protein over carbs', () => {
    const big = resolveRecipe(SET, buildCandidates(indexProducts([bar('b60', '60 g')], {})), 'biedronka');
    expect(big.perServing.carbs).toBeGreaterThan(big.perServing.protein);
    expect(big.passes).toBe(true);
    const small = resolveRecipe(SET, buildCandidates(indexProducts([bar('b35', '35 g')], {})), 'biedronka');
    expect(small.perServing.protein).toBeLessThan(15);
    expect(small.passes).toBe(false);
  });
});
