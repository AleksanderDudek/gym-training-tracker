import { describe, expect, test } from 'vitest';
import { indexProducts } from '../lib/search';
import { normalizeChain } from '../restaurants/normalize';
import { DATASET, makeProduct } from '../test/fixtures';
import { customFood, planFood, recipeFood, setFood, type Food } from './foods';
import { MAX_MENU_RESULTS, searchFoods } from './search';

const dict = DATASET.dictionaries;
const recipe = recipeFood(
  { id: 'banan-baton', name: 'Banan i baton białkowy', kind: 'gotowiec', minutes: 1 },
  { kcal: 280, protein: 16, carbs: 44, fat: 8 },
  ['biedronka'],
);
const plan = planFood({ text: 'Banan z planu', kcal: 100, protein: 1, carbs: 25, fat: 0, stores: [] });
const custom = customFood({
  id: 1,
  name: 'Bananowa owsianka',
  amountLabel: '1 porcja',
  kcal: 400,
  protein: 15,
  carbs: 60,
  fat: 10,
});
const set = setFood({
  id: 2,
  name: 'Banan + batonik',
  parts: [{ name: 'Banan', amountLabel: '120 g', kcal: 107, protein: 1.3, carbs: 27, fat: 0.4 }],
});
const POOL: Food[] = [recipe, plan, custom, set];

const products = indexProducts(
  [
    makeProduct({
      code: 'b1',
      name: 'Banan',
      quantity: '100 g',
      nutrition: {
        kcal: 89,
        protein: 1.1,
        carbs: 23,
        fat: 0.3,
        sugars: 12,
        saturatedFat: null,
        fiber: null,
        salt: null,
      },
    }),
  ],
  {},
);

const lattes = Array.from({ length: 20 }, (_, i) => ({
  name: `Latte ${i}`,
  category: 'kawa' as const,
  portion: 'M',
  grams: null,
  kcal: 150,
  protein: 9,
  carbs: 13,
  fat: 7,
  sugars: null,
  fiber: null,
  saturatedFat: null,
  salt: null,
}));
const chains = [
  normalizeChain({
    id: 'kawiarnia',
    name: 'Kawiarnia',
    kind: 'kawiarnia',
    market: 'PL',
    source: { url: 'https://example.com', title: 'x', checked: '2026-10-12' },
    items: [...lattes, { ...lattes[0]!, name: 'Bananowe smoothie', category: 'napoj' as const }],
  }),
];

describe('searchFoods', () => {
  test('no words: own sets first, then own food, plan and recipes', () => {
    expect(searchFoods({ query: '', pool: POOL, chains, products, dict }).map((f) => f.key)).toEqual([
      'set:2',
      'custom:1',
      'plan:Banan z planu',
      'recipe:banan-baton',
    ]);
  });

  test('words: own things, then restaurant positions, then products', () => {
    const keys = searchFoods({ query: 'banan', pool: POOL, chains, products, dict }).map((f) => f.key);
    expect(keys).toEqual([
      'set:2',
      'custom:1',
      'plan:Banan z planu',
      'recipe:banan-baton',
      'restaurant:kawiarnia:bananowe-smoothie',
      'product:b1',
    ]);
  });

  test('restaurants never crowd out products, and a set is not built of sets', () => {
    const latte = searchFoods({ query: 'latte', pool: POOL, chains, products, dict });
    expect(latte.filter((f) => f.source === 'restaurant')).toHaveLength(MAX_MENU_RESULTS);
    expect(
      searchFoods({ query: 'banan', pool: POOL, chains, products, dict, noSets: true }).map((f) => f.source),
    ).not.toContain('set');
  });
});
