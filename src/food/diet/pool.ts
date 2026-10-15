import type { Dictionaries, IndexedProduct } from '../lib/types';
import { isOnlineShop } from '../online/shops';
import { RECIPES } from '../recipes/catalog';
import { readyProducts } from '../recipes/ready';
import { availableStores, bestVariant, needsStore, type Candidates } from '../recipes/resolve';
import {
  customFood,
  planFood,
  productFood,
  recipeFood,
  setFood,
  withGrams,
  type CustomFood,
  type Food,
  type FoodSet,
} from './foods';
import type { Favorite } from './db';
import { favoriteFood } from './favorites';
import type { Plan } from './plan';

interface PoolInput {
  products: IndexedProduct[];
  dict: Dictionaries;
  candidates: Candidates;
  /** Chains to plan around, nearest/most useful first; empty: all chains (the recipes' own ranking). */
  chains: string[];
  fallbackRanking: string[];
  plan: Plan | null;
  custom: (CustomFood & { id: number })[];
  /** Own sets; absent: none. */
  sets?: (FoodSet & { id: number })[];
  /** Starred foods; absent: none. */
  favorites?: Favorite[];
}

/** Ready protein products offered per group: enough to choose from, not the whole shelf. */
const PER_GROUP = 12;

/**
 * Everything the day can be planned from: recipes bought in full at one of
 * the chains, ready protein products those chains sell, the plan's own
 * items, and the user's foods and sets. Recipes are counted per SERVING.
 */
export function buildPool(input: PoolInput): Food[] {
  const ranking = input.chains.length ? input.chains : input.fallbackRanking;
  const foods: Food[] = [];

  for (const recipe of RECIPES) {
    const variant = bestVariant(recipe, input.candidates, ranking);
    if (!variant) continue;
    foods.push(
      recipeFood(recipe, variant.perServing, availableStores(recipe, input.candidates, ranking), !needsStore(recipe)),
    );
  }

  for (const group of readyProducts(input.products, input.chains.length ? input.chains : null)) {
    // „Co teraz?” nie czeka na kuriera: produkt, który kupisz tylko przez internet, tu nie trafia.
    const onShelves = group.items.filter((p) => !(p.stores.length && p.stores.every(isOnlineShop)));
    for (const product of onShelves.slice(0, PER_GROUP)) {
      const food = productFood(product, input.dict);
      if (food) foods.push(food);
    }
  }

  if (input.plan) for (const item of input.plan.foods) foods.push(planFood(item));
  for (const c of input.custom) foods.push(customFood(c));
  for (const s of input.sets ?? []) foods.push(setFood(s));

  // A starred food is marked where the pool has it already - a product at the grams it was starred
  // at - and joins it from its snapshot where not (a product from anywhere in the base, a restaurant
  // position, something eaten once).
  const starred = new Map((input.favorites ?? []).map((f) => [f.key, f]));
  const marked = foods.map((f) => {
    const star = starred.get(f.key);
    if (!star) return f;
    const grams = star.food.per100 ? star.food.grams : null;
    return { ...(grams ? withGrams(f, grams) : f), favorite: true as const };
  });
  const inPool = new Set(marked.map((f) => f.key));
  for (const f of starred.values()) if (!inPool.has(f.key)) marked.push(favoriteFood(f));

  const seen = new Set<string>();
  return marked.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}
