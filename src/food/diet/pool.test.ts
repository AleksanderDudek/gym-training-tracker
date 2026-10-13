import { describe, expect, test } from 'vitest';
import { RECIPES } from '../recipes/catalog';
import { recipeIndex } from '../recipes/resolve';
import { indexProducts } from '../lib/search';
import { chainsWithFood } from '../recipes/chains';
import { DATASET, PRODUCTS as RAW, makeProduct } from '../test/fixtures';
import { buildPool } from './pool';

const PRODUCTS = indexProducts(RAW, {});

describe('buildPool', () => {
  const { candidates, ranking } = recipeIndex(PRODUCTS);
  const pool = buildPool({
    products: PRODUCTS,
    dict: DATASET.dictionaries,
    candidates,
    chains: [],
    fallbackRanking: ranking,
    plan: null,
    custom: [],
  });

  test('a recipe for several people counts as ONE serving', () => {
    // Chili needs no shop of its own (staples only), so any data can make it.
    const chili = RECIPES.find((r) => r.id === 'chili-indyk')!;
    expect(chili.servings).toBe(3);
    const food = pool.find((f) => f.key === 'recipe:chili-indyk')!;
    expect(food).toMatchObject({ amountLabel: '1 porcja', role: 'main' });
    expect(food.detail).toMatch(/na 3 porcje/);
    // ~400 kcal a serving; the whole pot would be ~1200.
    expect(food.nutrients.kcal).toBeGreaterThan(250);
    expect(food.nutrients.kcal).toBeLessThan(600);
  });

  test('nothing appears twice, and own foods come in at home', () => {
    const withCustom = buildPool({
      products: PRODUCTS,
      dict: DATASET.dictionaries,
      candidates,
      chains: [],
      fallbackRanking: ranking,
      plan: null,
      custom: [{ id: 1, name: 'Owsianka', amountLabel: 'miska', kcal: 400, protein: 20, carbs: 50, fat: 10 }],
    });
    expect(new Set(withCustom.map((f) => f.key)).size).toBe(withCustom.length);
    expect(withCustom.find((f) => f.key === 'custom:1')).toMatchObject({ atHome: true });
  });

  test('„Co teraz?” and the nearby chains leave out what is sold only online', () => {
    const bar = (code: string, stores: string[]) =>
      makeProduct({
        code,
        name: `Baton proteinowy ${code}`,
        categories: ['en:protein-bars'],
        nutrition: {
          kcal: 380,
          protein: 33,
          carbs: 29,
          fat: 16,
          sugars: 3,
          saturatedFat: null,
          fiber: null,
          salt: null,
        },
        stores,
      });
    const products = indexProducts([...RAW, bar('web', ['myprotein']), bar('both', ['rossmann', 'fitiron'])], {});
    const index = recipeIndex(products);
    const keys = buildPool({
      products,
      dict: DATASET.dictionaries,
      candidates: index.candidates,
      chains: [],
      fallbackRanking: index.ranking,
      plan: null,
      custom: [],
    }).map((f) => f.key);
    expect(keys).not.toContain('product:web');
    expect(keys).toContain('product:both');
    const chains = chainsWithFood(products);
    expect(chains.has('myprotein')).toBe(false);
    expect(chains.has('fitiron')).toBe(false);
    expect(chains.has('rossmann')).toBe(true);
  });
});
