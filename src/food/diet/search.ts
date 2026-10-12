import { matchesQuery } from '../lib/search';
import { normalizeForSearch, tokenize } from '../lib/text';
import type { Dictionaries, IndexedProduct } from '../lib/types';
import { restaurantFood } from '../restaurants/food';
import { searchMenus } from '../restaurants/search';
import type { Chain } from '../restaurants/types';
import { productFood, type Food, type FoodSource } from './foods';

export const MAX_RESULTS = 30;
/** Restaurant positions per search: enough for "latte" in four chains, never a page of them over products. */
export const MAX_MENU_RESULTS = 12;

/** The user's own things first: a set or own food is what they eat, a recipe is an idea. */
const OWN_ORDER: Partial<Record<FoodSource, number>> = { set: 0, custom: 1, plan: 2, recipe: 3 };

interface Input {
  query: string;
  /** The day's pool: recipes, ready products, plan, own foods and sets. */
  pool: Food[];
  /** Restaurant menus (empty while they load). */
  chains: Chain[];
  products: IndexedProduct[];
  dict: Dictionaries;
  /** Leave sets out (a set is not made of sets). */
  noSets?: boolean;
}

/**
 * „Dodaj zjedzone” search. No words: the user's own things. Words: own things
 * that match, then restaurant positions ("big mac", "latte grande"), then any
 * Open Food Facts product - at most 30 in all.
 */
export function searchFoods({ query, pool, chains, products, dict, noSets = false }: Input): Food[] {
  const own = pool
    .filter((f) => f.source !== 'product' && !(noSets && f.source === 'set'))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (OWN_ORDER[a.f.source] ?? 9) - (OWN_ORDER[b.f.source] ?? 9) || a.i - b.i)
    .map(({ f }) => f);
  const tokens = tokenize(query);
  if (!tokens.length) return own.slice(0, MAX_RESULTS);

  const fromPool = own.filter((f) => matchesQuery(normalizeForSearch(f.name), tokens));
  const fromMenus = searchMenus(chains, query, MAX_MENU_RESULTS).map(({ chain, item }) => restaurantFood(chain, item));
  const fromProducts: Food[] = [];
  for (const p of products) {
    if (fromProducts.length >= MAX_RESULTS) break;
    if (!matchesQuery(p.searchText, tokens)) continue;
    const food = productFood(p, dict);
    if (food) fromProducts.push(food);
  }
  return [...fromPool, ...fromMenus, ...fromProducts].slice(0, MAX_RESULTS);
}
