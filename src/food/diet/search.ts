import { matchesQuery } from '../lib/search';
import { normalizeForSearch, tokenize } from '../lib/text';
import type { Dictionaries, IndexedProduct } from '../lib/types';
import { restaurantFood } from '../restaurants/food';
import { searchMenus } from '../restaurants/search';
import { foldMenuText } from '../restaurants/text';
import type { Chain } from '../restaurants/types';
import { productFood, type Food, type FoodSource } from './foods';

export const MAX_RESULTS = 30;
/** Restaurant positions per search: enough for "latte" in four chains, never a page of them over products. */
export const MAX_MENU_RESULTS = 12;

/** Matches looked at before ranking: enough for "banan" to find the plain banana among bananowe-everything. */
const PRODUCT_CANDIDATES = 300;
/** Every chain's "latte" before the twelve best are kept: a cap in chain order would never reach Starbucks. */
const MENU_CANDIDATES = 200;

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
 * How well a name answers the query: 0 the name itself ("Banan" for "banan"),
 * 1 starts with it, 2 every word starts a word of the name ("Ciasto bananowe"),
 * 3 merely contains the words. Punctuation and a chain in brackets do not
 * count: "coca cola" is "Coca-Cola (KFC)".
 */
export function relevance(name: string, query: string): number {
  const folded = foldMenuText(name.replace(/\s*\([^)]*\)$/, ''));
  const q = foldMenuText(query);
  if (folded === q) return 0;
  if (folded.startsWith(q)) return 1;
  const words = folded.split(' ');
  return q.split(' ').every((t) => words.some((w) => w.startsWith(t))) ? 2 : 3;
}

/** Closest names first; equally close ones keep their order. */
function byRelevance(foods: Food[], query: string): Food[] {
  return foods
    .map((food, i) => ({ food, i, rank: relevance(food.name, query) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ food }) => food);
}

/**
 * „Dodaj zjedzone” search. No words: the user's own things. Words: own things
 * that match, then restaurant positions ("big mac", "latte grande") and Open
 * Food Facts products together, the closest names first - at most 30 in all,
 * at most 12 of them from restaurants.
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
  const fromMenus = byRelevance(
    searchMenus(chains, query, MENU_CANDIDATES).map(({ chain, item }) => restaurantFood(chain, item)),
    query,
  ).slice(0, MAX_MENU_RESULTS);
  const fromProducts: Food[] = [];
  for (const p of products) {
    if (fromProducts.length >= PRODUCT_CANDIDATES) break;
    if (!matchesQuery(p.searchText, tokens)) continue;
    const food = productFood(p, dict);
    if (food) fromProducts.push(food);
  }
  // Restaurants before products on a tie: "latte" means the café's latte before a carton of latte drink.
  return [...fromPool, ...byRelevance([...fromMenus, ...fromProducts], query)].slice(0, MAX_RESULTS);
}
