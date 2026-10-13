import { describe, expect, test } from 'vitest';
import { indexProducts } from '../lib/search';
import type { Nutrition, Product } from '../lib/types';
import { makeProduct } from '../test/fixtures';
import { basketsFor, groupByBasket, within } from './baskets';
import type { Recipe } from './catalog';
import { buildCandidates, onlineRanking, resolveRecipe, storeRanking } from './resolve';

function n(kcal: number, protein: number, carbs: number, fat: number, sugars = carbs): Nutrition {
  return { kcal, protein, carbs, fat, sugars, saturatedFat: null, fiber: null, salt: null };
}

const skyr = (code: string, stores: string[]) =>
  makeProduct({ code, name: `Skyr naturalny ${code}`, nutrition: n(63, 11, 4, 0.2), stores, popularity: 10 });
const bar = (code: string, stores: string[]) =>
  makeProduct({ code, name: `Baton proteinowy ${code}`, quantity: '50 g', nutrition: n(380, 33, 29, 16, 3), stores });
const milk = (code: string, stores: string[]) =>
  makeProduct({ code, name: `Mleko 2% ${code}`, categories: ['en:milks'], nutrition: n(50, 3.3, 4.8, 2, 4.8), stores });

// Skyr z batonem: oba składniki trzeba kupić, mleko jest wszędzie.
const RECIPE: Recipe = {
  id: 'skyr-baton',
  name: 'Skyr z batonem',
  kind: 'miska',
  minutes: 2,
  tool: 'Łyżka',
  description: '',
  items: [
    { ingredient: 'skyr', grams: 300 },
    { ingredient: 'proteinBar', grams: 50, pack: true },
    { ingredient: 'milk', grams: 100 },
  ],
  steps: ['x'],
};

const index = (products: Product[]) => {
  const candidates = buildCandidates(indexProducts(products, {}));
  return { candidates, ranking: storeRanking([RECIPE], candidates), online: onlineRanking(candidates) };
};

describe('basketsFor', () => {
  test('one physical shop that has everything is the whole answer — no pairs', () => {
    const i = index([skyr('s1', ['biedronka']), bar('b1', ['biedronka', 'myprotein'])]);
    expect(basketsFor(RECIPE, i.candidates, ['biedronka'], ['myprotein'])).toEqual([['biedronka']]);
  });

  test('a shop and an online shop when no single shop has everything; never two physical shops', () => {
    const i = index([skyr('s1', ['biedronka']), skyr('s2', ['lidl']), bar('b1', ['myprotein'])]);
    expect(i.online).toEqual(['myprotein']);
    expect(basketsFor(RECIPE, i.candidates, ['biedronka', 'lidl'], i.online)).toEqual([
      ['biedronka', 'myprotein'],
      ['lidl', 'myprotein'],
    ]);
  });

  test('online shops only, when that is what it takes', () => {
    const i = index([skyr('s1', ['diet-food']), bar('b1', ['myprotein'])]);
    expect(basketsFor(RECIPE, i.candidates, [], ['diet-food', 'myprotein'])).toEqual([['diet-food', 'myprotein']]);
  });

  test('nothing anywhere, nothing to offer; staples and pantry alone need no shop', () => {
    const i = index([skyr('s1', ['biedronka'])]);
    expect(basketsFor(RECIPE, i.candidates, ['biedronka'], [])).toEqual([]);
    const plain: Recipe = { ...RECIPE, id: 'mleko', items: [{ ingredient: 'milk', grams: 300 }] };
    expect(basketsFor(plain, i.candidates, ['biedronka'], [])).toEqual([]);
  });

  test('online shops are ranked apart from physical ones', () => {
    const i = index([skyr('s1', ['biedronka']), bar('b1', ['biedronka']), bar('b2', ['myprotein', 'fitiron'])]);
    expect(i.ranking).toEqual(['biedronka']);
    expect(i.online).toEqual(['fitiron', 'myprotein']);
  });
});

test('a product whose own label disagrees with itself never plays an ingredient', () => {
  const odd = { ...bar('odd', ['myprotein']), labelMismatch: true as const };
  const i = index([skyr('s1', ['biedronka']), odd]);
  expect(i.candidates.get('proteinBar')).toEqual([]);
});

test('a box of bars is not one bar: multipacks never play a pack item', () => {
  const box = makeProduct({
    code: 'box',
    name: 'Baton proteinowy PUDEŁKO x 4 BATONY',
    quantity: '240 g',
    nutrition: n(380, 33, 29, 16, 3),
    stores: ['guiltfree'],
  });
  expect(index([box]).candidates.get('proteinBar')).toEqual([]);
});

describe('resolveRecipe with a basket', () => {
  test('each item says which shop it is bought in; staples come from the physical shop', () => {
    const i = index([
      skyr('s1', ['biedronka']),
      bar('b1', ['myprotein']),
      milk('m1', ['biedronka']),
      milk('m2', ['myprotein']),
    ]);
    const r = resolveRecipe(RECIPE, i.candidates, ['biedronka', 'myprotein']);
    expect(r.available).toBe(true);
    expect(r.store).toBe('biedronka');
    expect(r.stores).toEqual(['biedronka', 'myprotein']);
    expect(r.items.map((x) => [x.def.id, x.shop, x.product?.code])).toEqual([
      ['skyr', 'biedronka', 's1'],
      ['proteinBar', 'myprotein', 'b1'],
      ['milk', 'biedronka', 'm1'],
    ]);
  });

  test('the shop on the shelf before the delivery when both sell it', () => {
    const i = index([skyr('s-net', ['myprotein']), skyr('s-shop', ['biedronka']), bar('b1', ['myprotein'])]);
    const r = resolveRecipe(RECIPE, i.candidates, ['biedronka', 'myprotein']);
    expect(r.items[0]?.product?.code).toBe('s-shop');
  });

  test('online shops only: a staple is "in every shop" at typical values, not milk from a protein shop', () => {
    const i = index([skyr('s1', ['diet-food']), bar('b1', ['myprotein']), milk('m2', ['myprotein'])]);
    const r = resolveRecipe(RECIPE, i.candidates, ['diet-food', 'myprotein']);
    expect(r.items[2]).toMatchObject({ product: null, shop: null });
  });
});

describe('groupByBasket', () => {
  const baskets: Record<string, string[][]> = {
    a: [['biedronka']],
    b: [
      ['biedronka', 'myprotein'],
      ['lidl', 'myprotein'],
    ],
    c: [['myprotein']],
    d: [['lidl'], ['biedronka']],
    e: [['lidl']],
    f: [],
  };
  const of = (id: string) => baskets[id]!;

  test('the basket that makes the most recipes first — counting the ones its single shops cover', () => {
    const groups = groupByBasket(['a', 'b', 'c', 'd', 'e', 'f'], of);
    expect(groups).toEqual([
      { basket: ['biedronka', 'myprotein'], items: ['a', 'b', 'c', 'd'] },
      { basket: ['lidl'], items: ['e'] },
      { basket: null, items: ['f'] },
    ]);
  });

  test('a tie goes to the smaller basket', () => {
    expect(groupByBasket(['a', 'd'], of)[0]).toEqual({ basket: ['biedronka'], items: ['a', 'd'] });
  });

  test('within: every shop of the smaller basket is in the bigger one', () => {
    expect(within(['biedronka'], ['biedronka', 'myprotein'])).toBe(true);
    expect(within(['lidl', 'myprotein'], ['biedronka', 'myprotein'])).toBe(false);
  });
});
