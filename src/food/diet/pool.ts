import type { Dictionaries, IndexedProduct } from '../lib/types';
import { RECIPES } from '../recipes/catalog';
import { readyProducts } from '../recipes/ready';
import { availableStores, bestVariant, needsStore, type Candidates } from '../recipes/resolve';
import { customFood, planFood, productFood, recipeFood, type CustomFood, type Food } from './foods';
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
}

/** Ready protein products offered per group: enough to choose from, not the whole shelf. */
const PER_GROUP = 12;

/**
 * Everything the day can be planned from: recipes bought in full at one of
 * the chains, ready protein products those chains sell, the plan's own
 * items, and the user's foods. Recipes are counted per SERVING.
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
    for (const product of group.items.slice(0, PER_GROUP)) {
      const food = productFood(product, input.dict);
      if (food) foods.push(food);
    }
  }

  if (input.plan) for (const item of input.plan.foods) foods.push(planFood(item));
  for (const c of input.custom) foods.push(customFood(c));

  const seen = new Set<string>();
  return foods.filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}
