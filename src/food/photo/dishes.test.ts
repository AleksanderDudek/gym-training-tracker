import { describe, expect, it } from 'vitest';
import data from './data/dishes.json';
import {
  DISHES,
  FAT_SCALE,
  SAUCE_SCALE,
  SAUCES,
  SWEET_SCALE,
  adjustedPer100,
  dishByFood101,
  dishById,
  estimate,
  type Choices,
  type Dish,
} from './dishes';

// ethz/food101, the 101 class names.
const FOOD101 = [
  'apple_pie', 'baby_back_ribs', 'baklava', 'beef_carpaccio', 'beef_tartare', 'beet_salad', 'beignets', 'bibimbap',
  'bread_pudding', 'breakfast_burrito', 'bruschetta', 'caesar_salad', 'cannoli', 'caprese_salad', 'carrot_cake', 'ceviche',
  'cheesecake', 'cheese_plate', 'chicken_curry', 'chicken_quesadilla', 'chicken_wings', 'chocolate_cake', 'chocolate_mousse',
  'churros', 'clam_chowder', 'club_sandwich', 'crab_cakes', 'creme_brulee', 'croque_madame', 'cup_cakes', 'deviled_eggs',
  'donuts', 'dumplings', 'edamame', 'eggs_benedict', 'escargots', 'falafel', 'filet_mignon', 'fish_and_chips', 'foie_gras',
  'french_fries', 'french_onion_soup', 'french_toast', 'fried_calamari', 'fried_rice', 'frozen_yogurt', 'garlic_bread',
  'gnocchi', 'greek_salad', 'grilled_cheese_sandwich', 'grilled_salmon', 'guacamole', 'gyoza', 'hamburger',
  'hot_and_sour_soup', 'hot_dog', 'huevos_rancheros', 'hummus', 'ice_cream', 'lasagna', 'lobster_bisque',
  'lobster_roll_sandwich', 'macaroni_and_cheese', 'macarons', 'miso_soup', 'mussels', 'nachos', 'omelette', 'onion_rings',
  'oysters', 'pad_thai', 'paella', 'pancakes', 'panna_cotta', 'peking_duck', 'pho', 'pizza', 'pork_chop', 'poutine',
  'prime_rib', 'pulled_pork_sandwich', 'ramen', 'ravioli', 'red_velvet_cake', 'risotto', 'samosa', 'sashimi', 'scallops',
  'seaweed_salad', 'shrimp_and_grits', 'spaghetti_bolognese', 'spaghetti_carbonara', 'spring_rolls', 'steak',
  'strawberry_shortcake', 'sushi', 'tacos', 'takoyaki', 'tiramisu', 'tuna_tartare', 'waffles',
];

const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'sugars'] as const;
const scales = (d: Dish) => (['fat', 'sweet', 'sauce'] as const).filter((s) => d.adjust[s]);
const LEVELS = { fat: FAT_SCALE.levels, sweet: SWEET_SCALE.levels, sauce: SAUCE_SCALE.levels };
/** Per 100 g at each level of one scale, the others unanswered. */
const ladder = (d: Dish, scale: 'fat' | 'sweet' | 'sauce') => LEVELS[scale].map((l) => adjustedPer100(d, { [scale]: l.id } as Choices));

describe('DISHES', () => {
  it('has about 300 dishes with unique camelCase ids', () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(280);
    expect(new Set(DISHES.map((d) => d.id)).size).toBe(DISHES.length);
    for (const d of DISHES) expect(d.id, d.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
  });

  it('has a data row for every dish, and no row without a dish', () => {
    expect(Object.keys(data.dishes).sort()).toEqual(DISHES.map((d) => d.id).sort());
    expect(Object.keys(data.sauces).sort()).toEqual(Object.keys(SAUCES).sort());
  });

  it('covers every Food-101 class exactly once', () => {
    expect(FOOD101).toHaveLength(101);
    const named = DISHES.flatMap((d) => (d.food101 ? [d.food101] : []));
    expect(named.sort()).toEqual([...FOOD101].sort());
    for (const c of FOOD101) expect(dishByFood101(c)?.food101, c).toBe(c);
  });

  it('gives every dish a name, 1-3 English prompts and a group', () => {
    for (const d of DISHES) {
      expect(d.label.trim(), d.id).not.toBe('');
      expect(d.prompts.length, d.id).toBeGreaterThanOrEqual(1);
      expect(d.prompts.length, d.id).toBeLessThanOrEqual(3);
      for (const p of d.prompts) expect(p, d.id).toMatch(/^[a-z0-9 ,'-]+$/);
    }
    expect(new Set(DISHES.flatMap((d) => d.prompts)).size, 'prompts are unique').toBe(DISHES.flatMap((d) => d.prompts).length);
  });

  it('keeps energy within the Atwater bound, 9 fat + 4 (protein + carbs) + 7 alcohol, ±15 %', () => {
    for (const { id, per100: n } of [...DISHES, ...Object.entries(SAUCES).map(([id, s]) => ({ id, per100: s.per100 }))]) {
      const atwater = 9 * n.fat + 4 * (n.protein + n.carbs) + 7 * (n.alcohol ?? 0);
      // A few kcal of slack for drinks and broths, where 15 % of almost nothing is nothing.
      expect(Math.abs(n.kcal - atwater), `${id}: ${n.kcal} kcal vs ${atwater.toFixed(0)}`).toBeLessThanOrEqual(Math.max(5, 0.15 * atwater));
    }
  });

  it('has consistent macros: sugars within carbs, saturated within total fat, nothing negative, under 100 g', () => {
    for (const d of DISHES) {
      const n = d.per100;
      for (const v of Object.values(n)) expect(v, d.id).toBeGreaterThanOrEqual(0);
      expect(n.sugars, d.id).toBeLessThanOrEqual(n.carbs + 0.05);
      expect(n.satFat, d.id).toBeLessThanOrEqual(n.fat + 0.05);
      expect(n.protein + n.carbs + n.fat + (n.alcohol ?? 0), d.id).toBeLessThanOrEqual(100);
      expect(n.kcal, d.id).toBeLessThanOrEqual(900);
    }
  });

  it('has a positive portion whose label ends with its weight', () => {
    for (const d of DISHES) {
      expect(d.portion.g, d.id).toBeGreaterThan(0);
      expect(d.portion.g, d.id).toBeLessThanOrEqual(1000);
      expect(d.portion.label, d.id).toMatch(new RegExp(`\\(${d.portion.g} (g|ml)\\)$`));
    }
  });

  it('names its source: a USDA food, or a recipe of them', () => {
    for (const d of DISHES) {
      if (d.source.db === 'composed') {
        expect(d.source.note, d.id).toBeTruthy();
        expect(d.source.recipe?.length, d.id).toBeGreaterThan(0);
        for (const line of d.source.recipe!) expect(line.g, d.id).toBeGreaterThan(0);
      } else {
        expect(['FNDDS 2021-2023', 'SR Legacy'], d.id).toContain(d.source.db);
        expect(d.source.code, d.id).toBeGreaterThan(0);
        expect(d.source.description, d.id).toBeTruthy();
      }
    }
  });

  it('finds dishes by id', () => {
    expect(dishById('pierogiRuskie')?.group).toBe('main');
    expect(dishById('nope')).toBeUndefined();
  });
});

describe('scales', () => {
  it('uses step sizes in a physical range', () => {
    for (const d of DISHES) {
      const { fat, sweet, sauce } = d.adjust;
      if (fat) expect(fat.step, d.id).toBeGreaterThan(0);
      if (fat) expect(fat.step, d.id).toBeLessThanOrEqual(5);
      if (sweet) expect(sweet.step, d.id).toBeGreaterThan(0);
      if (sweet) expect(sweet.step, d.id).toBeLessThanOrEqual(10);
      if (sauce) expect(sauce.step, d.id).toBeGreaterThan(0);
      if (sauce) expect(sauce.step, d.id).toBeLessThanOrEqual(20);
    }
  });

  it('never runs out: "chude" keeps fat, "bez cukru" keeps sugar and "bez sosu" keeps the rest of the dish at 0 or more', () => {
    for (const d of DISHES) {
      const { fat, sweet, sauce } = d.adjust;
      if (fat) expect(d.per100.fat - fat.step, d.id).toBeGreaterThanOrEqual(0);
      if (sweet && (sweet.base ?? 'usual') === 'usual') expect(d.per100.sugars - 2 * sweet.step, d.id).toBeGreaterThanOrEqual(0);
      if (sauce) {
        const none = adjustedPer100(d, { sauce: 'none' });
        const share = (sauce.base ?? 'usual') === 'usual' ? 2 * sauce.step : 0;
        for (const k of MACROS) {
          // The dish without sauce, exactly: (dish - share x sauce) / (1 - share), unclamped.
          const unclamped = (d.per100[k] * 100 - share * SAUCES[sauce.kind].per100[k]) / (100 - share);
          expect(unclamped, `${d.id} ${k}`).toBeGreaterThanOrEqual(-1e-9);
          if ((sauce.base ?? 'usual') === 'usual') expect(none[k], `${d.id} ${k}`).toBeCloseTo(unclamped, 6);
          else expect(none[k], `${d.id} ${k}`).toBeCloseTo(d.per100[k], 6);
        }
      }
    }
  });

  it('is monotonic: fat and sugar raise the energy at every level, sauce moves it one way', () => {
    for (const d of DISHES) {
      for (const s of scales(d)) {
        const kcal = ladder(d, s).map((n) => n.kcal);
        const diffs = kcal.slice(1).map((v, i) => v - kcal[i]!);
        if (s === 'sauce') {
          expect(diffs.every((x) => x >= 0) || diffs.every((x) => x <= 0), `${d.id} ${s}: ${kcal}`).toBe(true);
        } else {
          for (const x of diffs) expect(x, `${d.id} ${s}: ${kcal}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('moves in equal steps: one level up and one level down from the catalog value differ by the same amount', () => {
    for (const d of DISHES) {
      for (const s of scales(d)) {
        const steps = ladder(d, s);
        for (const k of MACROS) {
          const diffs = steps.slice(1).map((n, i) => n[k] - steps[i]![k]);
          for (const x of diffs) expect(x, `${d.id} ${s} ${k}`).toBeCloseTo(diffs[0]!, 6);
        }
      }
    }
  });

  it('keeps the catalog value at the base level, and when unanswered', () => {
    for (const d of DISHES) {
      const plain = adjustedPer100(d);
      for (const k of MACROS) expect(plain[k], `${d.id} ${k}`).toBeCloseTo(d.per100[k], 6);
      const base: Choices = {
        fat: d.adjust.fat ? 'usual' : undefined,
        sweet: d.adjust.sweet ? (d.adjust.sweet.base ?? 'usual') : undefined,
        sauce: d.adjust.sauce ? (d.adjust.sauce.base ?? 'usual') : undefined,
      };
      const at = adjustedPer100(d, base);
      for (const k of MACROS) expect(at[k], `${d.id} ${k}`).toBeCloseTo(d.per100[k], 6);
    }
  });

  it('ignores a scale the dish does not have', () => {
    const fruit = dishById('jablko')!;
    expect(adjustedPer100(fruit, { fat: 'veryFatty', sweet: 'very', sauce: 'lots' })).toEqual(adjustedPer100(fruit));
  });

  it('moves a deep-fried dish 4 g of fat per 100 g a step, 36 kcal', () => {
    const fries = dishById('frenchFries')!;
    expect(adjustedPer100(fries, { fat: 'fatty' }).fat - fries.per100.fat).toBeCloseTo(4, 6);
    expect(adjustedPer100(fries, { fat: 'lean' }).kcal - fries.per100.kcal).toBeCloseTo(-36, 6);
  });

  it('takes the whole usual sauce out at "bez sosu"', () => {
    const bolognese = dishById('spaghettiBolognese')!;
    const none = adjustedPer100(bolognese, { sauce: 'none' });
    // 40 g of meat sauce per 100 g out; what is left is mostly pasta, so the energy rises a little.
    expect(none.kcal).toBeGreaterThan(bolognese.per100.kcal);
    expect(none.fat).toBeLessThan(bolognese.per100.fat);
  });
});

describe('estimate', () => {
  it('scales with the weight and matches the catalog at 100 g', () => {
    for (const d of DISHES) {
      const e = estimate(d, 100);
      expect(e.kcal, d.id).toBe(Math.round(d.per100.kcal));
      const twice = estimate(d, 200);
      expect(Math.abs(twice.kcal - 2 * d.per100.kcal), d.id).toBeLessThanOrEqual(1);
      expect(twice.protein, d.id).toBeCloseTo(2 * d.per100.protein, 0);
    }
    expect(estimate(dishById('jablko')!, 0)).toMatchObject({ kcal: 0, low: 0, high: 0 });
  });

  it('gives a symmetric range that contains the central value', () => {
    const answers: Choices[] = [{}, { fat: 'lean', sweet: 'none', sauce: 'none' }, { fat: 'veryFatty', sweet: 'very', sauce: 'lots' }, { fat: 'fatty', sweet: 'light', sauce: 'little' }];
    for (const d of DISHES) {
      for (const choices of answers) {
        const e = estimate(d, d.portion.g, choices);
        expect(e.low, d.id).toBeLessThanOrEqual(e.kcal);
        expect(e.high, d.id).toBeGreaterThanOrEqual(e.kcal);
        // Symmetric up to rounding, unless `low` stopped at 0.
        if (e.low > 0) expect(Math.abs(e.high - e.kcal - (e.kcal - e.low)), d.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is ±15 % for a dish without scales', () => {
    const e = estimate(dishById('banan')!, 200);
    expect(e.kcal).toBe(194);
    expect(e.low).toBe(Math.round(194 * 0.85));
    expect(e.high).toBe(Math.round(194 * 1.15));
  });

  it('narrows the range when a scale is answered', () => {
    for (const d of DISHES.filter((x) => scales(x).length)) {
      const open = estimate(d, d.portion.g);
      const usual: Choices = { fat: 'usual', sweet: d.adjust.sweet?.base ?? 'usual', sauce: d.adjust.sauce?.base ?? 'usual' };
      const answered = estimate(d, d.portion.g, usual);
      expect(answered.kcal, d.id).toBe(open.kcal);
      expect(answered.high - answered.low, d.id).toBeLessThan(open.high - open.low);
      // The range always covers the portion error and at least half a step.
      expect(answered.high - answered.kcal, d.id).toBeGreaterThanOrEqual(Math.floor(0.15 * answered.kcal));
    }
  });

  it('adds up a plate of pierogi: 280 g, fatty, with the right numbers', () => {
    const pierogi = dishById('pierogiRuskie')!;
    const usual = estimate(pierogi, 280);
    const fatty = estimate(pierogi, 280, { fat: 'fatty' });
    // One step is 3 g of fat per 100 g: 8.4 g and 76 kcal more on 280 g.
    expect(fatty.fat - usual.fat).toBeCloseTo(8.4, 1);
    expect(fatty.kcal - usual.kcal).toBeGreaterThanOrEqual(75);
    expect(fatty.kcal - usual.kcal).toBeLessThanOrEqual(77);
    expect(usual.kcal).toBeGreaterThan(450);
    expect(usual.kcal).toBeLessThan(650);
  });

  it('adds sugar to an unsweetened coffee only when asked', () => {
    const coffee = dishById('kawaCzarna')!;
    expect(estimate(coffee, 250).sugars).toBe(0);
    // Two steps of 1.7 g per 100 ml: a teaspoon in a 250 ml mug.
    expect(estimate(coffee, 250, { sweet: 'usual' }).sugars).toBeCloseTo(8.5, 1);
    expect(estimate(coffee, 250, { sweet: 'none' }).low).toBe(0);
  });
});
