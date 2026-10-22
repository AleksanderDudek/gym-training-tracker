import { describe, expect, test } from 'vitest';
import { DATASET, makeProduct } from '../test/fixtures';
import { customFood, planFood, portionGrams, productFood, withGrams, type Food } from './foods';
import { DIET_PROFILES } from './profiles';
import { autoDay, combine, restOfDay, restSlots, restVariants, seedOf, suggest, swaps, type Context } from './suggest';

const dict = DATASET.dictionaries;
const n = (kcal: number, protein: number, carbs: number, fat: number) => ({
  kcal,
  protein,
  carbs,
  fat,
  saturatedFat: null,
  sugars: null,
  fiber: null,
  salt: null,
});

function food(key: string, kcal: number, protein: number, carbs: number, fat: number, extra: Partial<Food> = {}): Food {
  return {
    key,
    name: key,
    detail: '',
    source: 'custom',
    amountLabel: '1',
    nutrients: { kcal, protein, carbs, fat },
    per100: null,
    grams: null,
    stores: [],
    atHome: false,
    role: kcal >= 350 ? 'main' : 'light',
    ...extra,
  };
}

const targets = DIET_PROFILES.redukcja.targets(1800, 92);
const ctx = (over: Partial<Context> = {}): Context => ({
  remaining: { kcal: 900, protein: 100, carbs: 60, fat: 30 },
  targets,
  profile: DIET_PROFILES.redukcja,
  mealsLeft: 2,
  nearby: ['biedronka', 'lidl'],
  storeName: (c) => dict.stores[c] ?? c,
  distance: (c) => (c === 'biedronka' ? '300 m' : '1,2 km'),
  ...over,
});

describe('foods', () => {
  test('a pack size from its label; family packs and nonsense fall back to 100 g', () => {
    expect(['150 g', '0,5 l', '4 x 125 g', '330ml', '1 kg', null, 'duże'].map(portionGrams)).toEqual([
      150, 500, 125, 330, 100, 100, 100,
    ]);
  });

  test('a product is one pack, rescalable in grams', () => {
    const skyr = productFood(
      makeProduct({ code: '2', name: 'Skyr', quantity: '150 g', nutrition: n(63, 11, 4, 0.2) }),
      dict,
    )!;
    expect(skyr.nutrients).toEqual({ kcal: 95, protein: 16.5, carbs: 6, fat: 0.3 });
    expect(withGrams(skyr, 300).nutrients.protein).toBe(33);
  });

  test('a product without full nutrition cannot be planned', () => {
    expect(productFood(makeProduct({ code: '3', name: 'x' }), dict)).toBeNull();
  });

  test('butter is an add-on, catering from the plan is at home, a pizza is bought', () => {
    expect(planFood({ text: 'Masło 20 g', kcal: 109, protein: 0.2, carbs: 0.1, fat: 12, stores: [] }).role).toBe(
      'addon',
    );
    expect(
      planFood({ text: '½ opak. Teriyaki', kcal: 640, protein: 41, carbs: 43, fat: 31, stores: [] }),
    ).toMatchObject({ role: 'main', atHome: true });
    expect(
      planFood({ text: 'Pizza Salami — cała', kcal: 803, protein: 60, carbs: 98, fat: 17, stores: ['zabka'] }).atHome,
    ).toBe(false);
  });

  test('own foods are at home', () => {
    expect(
      customFood({ id: 1, name: 'Owsianka', amountLabel: 'miska', kcal: 400, protein: 20, carbs: 50, fat: 10 }).atHome,
    ).toBe(true);
  });
});

describe('suggest', () => {
  const foods = [
    food('skyr-shake', 450, 50, 30, 5, { stores: ['biedronka'] }),
    food('pizza', 800, 60, 98, 17, { stores: ['zabka'] }),
    food('croissant', 450, 8, 45, 25),
    food('maslo', 109, 0.2, 0.1, 12, { role: 'addon' }),
    food('twarog', 400, 45, 15, 5, { atHome: true }),
  ];

  test('the best fill a meal-sized share of what is left and close the protein gap', () => {
    const ranked = suggest(foods, ctx());
    expect(
      ranked
        .slice(0, 2)
        .map((s) => s.food.key)
        .sort(),
    ).toEqual(['skyr-shake', 'twarog']);
    expect(ranked.filter((s) => s.best).map((s) => s.food.key)).not.toContain('croissant');
  });

  test('add-ons are never suggested on their own', () => {
    expect(suggest(foods, ctx()).map((s) => s.food.key)).not.toContain('maslo');
  });

  test('reasons say why, and where to get it', () => {
    const shake = suggest(foods, ctx()).find((s) => s.food.key === 'skyr-shake')!;
    expect(shake.reasons[0]).toMatch(/uzupełnia białko: 50 g z brakujących 100 g/);
    expect(shake.where).toBe('Biedronka · 300 m');
    expect(suggest(foods, ctx()).find((s) => s.food.key === 'twarog')!.where).toBe('masz w domu');
  });

  test('over the budget is penalised and said', () => {
    const pizza = suggest(foods, ctx({ remaining: { kcal: 500, protein: 60, carbs: 40, fat: 20 } })).find(
      (s) => s.food.key === 'pizza',
    )!;
    expect(pizza.reasons.join(' ')).toMatch(/przekracza budżet o 300 kcal/);
    expect(pizza.best).toBe(false);
  });

  test('keto: carbohydrates over what is left of the limit push a food down', () => {
    const keto = DIET_PROFILES.keto;
    const ranked = suggest(
      foods,
      ctx({
        profile: keto,
        targets: keto.targets(1800, 92),
        remaining: { kcal: 900, protein: 60, carbs: 10, fat: 70 },
      }),
    );
    expect(ranked.at(-1)!.food.key).not.toBe('twarog');
    expect(ranked.find((s) => s.food.key === 'pizza')!.fit.level).toBe('avoid');
  });
});

describe('swaps', () => {
  const teriyaki = food('teriyaki', 640, 41, 43, 31, { atHome: true });
  const pool = [
    food('gyros-half', 730, 55, 58, 31, { atHome: true }), // +14%: out
    food('pizza-half', 600, 30, 49, 8, { stores: ['zabka'] }),
    food('burrito-half', 600, 50, 13, 27, { atHome: true }),
    food('cola', 650, 0, 160, 0),
  ];

  test('only about the same calories (±12%), closest macros first, protein weighing most', () => {
    const list = swaps(teriyaki, pool, ctx());
    expect(list.map((s) => s.food.key)).toEqual(['burrito-half', 'pizza-half', 'cola']);
    expect(list[0]?.best).toBe(true);
    expect(list[0]?.reasons[0]).toBe('+9 g białka');
  });
});

describe('swaps for a big item', () => {
  const gyros = food('gyros', 1280, 110, 116, 42, { atHome: true });
  const pool = [
    food('makaron', 1200, 96, 96, 44, { atHome: true }),
    food('burrito', 600, 50, 13, 27, { atHome: true }),
    food('kurczak', 700, 60, 50, 15, { stores: ['biedronka', 'lidl'] }),
    food('shake', 450, 50, 30, 5, { stores: ['lidl'] }),
    food('baton', 200, 20, 20, 7),
  ];

  test('when singles are few, pairs that add up to it are offered too', () => {
    const keys = swaps(gyros, pool, ctx()).map((s) => s.food.key);
    // Singles first, even when a pair matches the macros more closely.
    expect(keys[0]).toBe('makaron');
    expect(keys).toContain('combo:kurczak|burrito'); // 1300
    expect(keys).toContain('combo:kurczak|shake'); // 1150
    expect(keys).not.toContain('combo:burrito|shake'); // 1050: under 88%
    expect(swaps(gyros, pool, ctx()).find((s) => s.food.key === 'combo:kurczak|burrito')!.food.name).toBe(
      'kurczak + burrito',
    );
  });

  test('a small item is replaced by one thing, not two', () => {
    expect(swaps(food('skyr', 300, 30, 10, 2), pool, ctx()).some((s) => s.food.key.startsWith('combo:'))).toBe(false);
  });

  test('a pair is bought where both are sold, or said to be at home', () => {
    expect(combine(pool[2]!, pool[3]!).stores).toEqual(['lidl']);
    expect(combine(pool[1]!, pool[2]!)).toMatchObject({
      stores: ['biedronka', 'lidl'],
      atHome: false,
      nutrients: { kcal: 1300, protein: 110 },
    });
    expect(combine(pool[0]!, pool[1]!).atHome).toBe(true);
  });
});

describe('staples only', () => {
  test('a dinner made of staples names no single chain', () => {
    const roast = food('roast', 450, 60, 20, 12, { everywhere: true });
    expect(suggest([roast], ctx()).at(0)!.where).toBe('w każdym większym sklepie');
  });
});

describe('autoDay', () => {
  const pool = [
    food('shake', 450, 50, 30, 5, { role: 'light' }),
    food('omlet', 300, 30, 5, 15, { role: 'light' }),
    food('skyr', 200, 25, 15, 1, { role: 'light' }),
    food('kurczak', 600, 60, 50, 15, { role: 'main' }),
    food('losos', 550, 45, 20, 30, { role: 'main' }),
    food('chili', 520, 45, 40, 15, { role: 'main' }),
  ];
  const base = { targets, profile: DIET_PROFILES.redukcja, nearby: [], storeName: (c: string) => c };

  test('one meal per slot, never twice the same, and the same seed gives the same day', () => {
    const day = autoDay(pool, base, seedOf('2026-10-11'));
    expect(day.map((m) => m.slot)).toEqual(['Śniadanie', 'Obiad', 'Kolacja', 'Przekąska']);
    expect(new Set(day.map((m) => m.suggestion.food.key)).size).toBe(day.length);
    expect(autoDay(pool, base, seedOf('2026-10-11')).map((m) => m.suggestion.food.key)).toEqual(
      day.map((m) => m.suggestion.food.key),
    );
  });

  test('breakfast and snack are light, lunch is a meal', () => {
    const day = autoDay(pool, base, 7);
    expect(['shake', 'omlet', 'skyr']).toContain(day[0]?.suggestion.food.key);
    expect(['kurczak', 'losos', 'chili']).toContain(day[1]?.suggestion.food.key);
  });

  test('another seed can give another day', () => {
    const days = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((s) =>
        autoDay(pool, base, s)
          .map((m) => m.suggestion.food.key)
          .join(),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });
});

describe('the rest of the day', () => {
  const pool = [
    food('shake', 450, 50, 30, 5, { role: 'light' }),
    food('omlet', 300, 30, 5, 15, { role: 'light' }),
    food('skyr', 200, 25, 15, 1, { role: 'light' }),
    food('jogurt', 150, 15, 12, 3, { role: 'light' }),
    food('kurczak', 600, 60, 50, 15, { role: 'main' }),
    food('losos', 550, 45, 20, 30, { role: 'main' }),
    food('chili', 520, 45, 40, 15, { role: 'main' }),
    food('dorsz', 380, 50, 30, 6, { role: 'main' }),
  ];
  const left = (kcal: number, protein: number, mealsLeft: number) =>
    ctx({ remaining: { kcal, protein, carbs: 100, fat: 40 }, mealsLeft, nearby: [] });

  test('the slots still ahead: the day ends with dinner and a snack', () => {
    expect(restSlots(4).map((s) => s.name)).toEqual(['Śniadanie', 'Obiad', 'Kolacja', 'Przekąska']);
    expect(restSlots(3).map((s) => s.name)).toEqual(['Obiad', 'Kolacja', 'Przekąska']);
    expect(restSlots(2).map((s) => s.name)).toEqual(['Kolacja', 'Przekąska']);
    expect(restSlots(1).map((s) => s.name)).toEqual(['Kolacja']);
    expect(restSlots(0)).toEqual([]);
  });

  test('meals for the slots ahead, never the same food twice, stable for a seed', () => {
    const rest = restOfDay(pool, left(1100, 110, 3), 5);
    expect(rest.map((m) => m.slot)).toEqual(['Obiad', 'Kolacja', 'Przekąska']);
    expect(new Set(rest.map((m) => m.suggestion.food.key)).size).toBe(3);
    expect(restOfDay(pool, left(1100, 110, 3), 5).map((m) => m.suggestion.food.key)).toEqual(
      rest.map((m) => m.suggestion.food.key),
    );
  });

  test('variants differ, the closest to what is left first, and the best lands near it', () => {
    const variants = restVariants(pool, left(1100, 110, 3), 3);
    expect(variants.length).toBeGreaterThan(1);
    expect(new Set(variants.map((v) => v.meals.map((m) => m.suggestion.food.key).sort().join())).size).toBe(variants.length);
    const miss = (v: (typeof variants)[number]) => Math.abs(v.kcal - 1100) + 3 * Math.max(0, 110 - v.protein);
    expect(variants.map(miss)).toEqual([...variants.map(miss)].sort((a, b) => a - b));
    expect(Math.abs(variants[0]!.kcal - 1100)).toBeLessThan(300);
  });

  test('a big meal first leaves less for the next ones; almost nothing left is no variant', () => {
    const rest = restOfDay(pool, left(700, 70, 2), 1);
    const sum = rest.reduce((s, m) => s + m.suggestion.food.nutrients.kcal, 0);
    expect(sum).toBeLessThan(700 * 1.4);
    expect(restVariants(pool, left(60, 10, 2), 1)).toEqual([]);
  });
});
