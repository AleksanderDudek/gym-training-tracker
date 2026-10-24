import { completeProfile } from '../diet/store';
import type { Profile } from '../diet/types';
import { DIET_PROFILES } from '../diet/profiles';
import { indexProducts } from '../lib/search';
import type { Dictionaries, IndexedProduct, Price } from '../lib/types';
import { INGREDIENTS, type IngredientId } from '../recipes/ingredients';
import type { Candidates, RecipeIndex } from '../recipes/resolve';
import { makeProduct } from './fixtures';

/**
 * A shop of typical products for the planner's tests: one product per ingredient that can be
 * matched, at the ingredient's typical values, so every recipe is bought "as the catalog says".
 * What only the online shops sell (konjac, keto bread, protein mixes…) is at Myprotein; the rest
 * at Biedronka. Candidates are built directly - the matchers are tested elsewhere.
 */
export const ONLINE_ONLY: ReadonlySet<IngredientId> = new Set<IngredientId>([
  'proteinPancakeMix',
  'mugCake',
  'peanutPowder',
  'proteinCrisps',
  'ketoPasta',
  'konjac',
  'proteinBread',
  'ketoPizzaBase',
  'ketoTortilla',
  'plantProtein',
  'zeroSyrup',
  'zeroSauce',
  'plantDeli',
  'plantMeat',
]);

const QUANTITY: Partial<Record<IngredientId, string>> = {
  skyr: '450 g',
  quark: '250 g',
  cottage: '200 g',
  rice: '1 kg',
  oats: '500 g',
  roll: '60 g',
  oil: '500 ml',
  proteinBar: '45 g',
  proteinDrink: '350 ml',
  whey: '700 g',
  milk: '1 l',
  turkeyMince: '500 g',
};

const price = (value: number, perKg = false): Price => ({
  value,
  currency: 'PLN',
  date: '2026-10-01',
  store: 'Biedronka',
  city: null,
  perKg,
  discounted: false,
  regularValue: null,
  count: 1,
});

const PRICE: Partial<Record<IngredientId, Price>> = {
  skyr: price(5.49),
  quark: price(3.99),
  rice: price(4.99),
  turkeyMince: price(13.99),
  oil: price(19.99),
  // Sold by weight: the price is per kilogram.
  mushrooms: price(11.99, true),
};

function productFor(id: IngredientId): IndexedProduct {
  const t = INGREDIENTS[id].typical;
  const online = ONLINE_ONLY.has(id);
  const [product] = indexProducts(
    [
      makeProduct({
        code: `p-${id}`,
        name: INGREDIENTS[id].label,
        quantity: QUANTITY[id] ?? '500 g',
        nutrition: {
          kcal: t.kcal,
          protein: t.protein,
          carbs: t.carbs,
          fat: t.fat,
          sugars: 0,
          saturatedFat: 0,
          fiber: 0,
          salt: 0,
        },
        stores: [online ? 'myprotein' : 'biedronka'],
        popularity: 10,
        price: PRICE[id] ?? null,
        ...(online && {
          online: [{ shop: 'myprotein', url: `https://www.myprotein.pl/${id}`, price: 29.99, checked: '2026-10-13' }],
        }),
      }),
    ],
    {},
  );
  return product!;
}

/** Candidates for every ingredient with a matcher, one typical product each. */
export function prepCandidates(): Candidates {
  const candidates: Candidates = new Map();
  for (const def of Object.values(INGREDIENTS)) if (def.match) candidates.set(def.id, [productFor(def.id as IngredientId)]);
  return candidates;
}

export function prepIndex(): RecipeIndex {
  return { candidates: prepCandidates(), ranking: ['biedronka'], online: ['myprotein'] };
}

export const PREP_DICT: Dictionaries = {
  categories: {},
  labels: {},
  allergens: {},
  additives: {},
  brands: {},
  stores: { biedronka: 'Biedronka', myprotein: 'Myprotein' },
};

/** A person on the planner's tests: 30 years, 180 cm, 82 kg on the way to 76. */
export function prepProfile(over: Partial<Profile> = {}): Profile {
  return completeProfile({
    sex: 'M',
    age: 30,
    heightCm: 180,
    startWeightKg: 82,
    targetWeightKg: 76,
    startDate: '2026-09-01',
    dailyKcal: 2200,
    ...over,
  });
}

export const styleOf = (profile: Profile) => DIET_PROFILES[profile.dietProfile];
