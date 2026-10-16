import { packGrams } from '../lib/quantity';
import { CASH_AND_CARRY } from '../lib/stores';
import type { IndexedProduct } from '../lib/types';
import { isOnlineShop } from '../online/shops';
import { RECIPES, passesRule, servingsOf, type Recipe, type RecipeItem } from './catalog';
import { INGREDIENTS, type IngredientDef } from './ingredients';
import { divideMacros, macrosOf, scale, sumMacros, type Macros } from './macros';

/** Ingredient id -> the products that can play it, best first. */
export type Candidates = Map<string, IndexedProduct[]>;

function proteinDensity(p: IndexedProduct): number {
  const { kcal, protein } = p.nutrition;
  return kcal && protein !== null ? protein / kcal : 0;
}

/**
 * Popular first — products people actually scan are the ones on the shelf,
 * and their data has been looked at by more eyes — then the most protein per
 * calorie, then the barcode so the order never wobbles.
 */
function byPreference(a: IndexedProduct, b: IndexedProduct): number {
  return (
    (b.popularity ?? -1) - (a.popularity ?? -1) ||
    proteinDensity(b) - proteinDensity(a) ||
    (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  );
}

/** Built once per dataset: one pass over the products per ingredient. */
export function buildCandidates(products: IndexedProduct[]): Candidates {
  const candidates: Candidates = new Map();
  for (const def of Object.values(INGREDIENTS)) {
    if (!def.match) continue;
    const match = def.match;
    // A label that disagrees with itself (a shop's polyols, a slip) would plan a recipe on wrong numbers.
    candidates.set(
      def.id,
      products.filter((p) => !p.labelMismatch && macrosOf(p) !== null && match(p)).sort(byPreference),
    );
  }
  return candidates;
}

export interface ResolvedItem {
  item: RecipeItem;
  def: IngredientDef;
  /** null: no product known here, typical values are used. */
  product: IndexedProduct | null;
  /** The product is sold in the chosen store (one of the basket's shops). */
  fromStore: boolean;
  /** The basket shop it is bought in: the first of the basket that sells it; null when none does. */
  shop: string | null;
  /** What the user may swap to here. */
  alternatives: IndexedProduct[];
  /** The amount used: the catalog's, or the chosen product's own pack for a pack item. */
  grams: number;
  macros: Macros;
}

export interface ResolvedRecipe {
  recipe: Recipe;
  /** The basket's first shop; null: products from anywhere. */
  store: string | null;
  /** The basket: one shop, or two with at least one online (the physical one first); empty: anywhere. */
  stores: string[];
  /** Every store ingredient was found. */
  available: boolean;
  /** Store ingredients the store lacks. */
  missing: string[];
  items: ResolvedItem[];
  /** The whole recipe, as the gram amounts in the catalog are. */
  total: Macros;
  /** What one person eats: `total` over the recipe's servings. */
  perServing: Macros;
  /** The recipe's rule (`passesRule`), per serving, on the products actually chosen. */
  passes: boolean;
}

/** Ingredient id -> chosen product code. */
export type Overrides = Partial<Record<string, string>>;

export function needsStore(recipe: Recipe): boolean {
  return recipe.items.some((i) => INGREDIENTS[i.ingredient].role === 'store');
}

/**
 * Where the shopping happens: one shop, or two where at least one is online -
 * a trip to a shop plus a delivery, or deliveries only. Never two physical
 * shops: one trip to one shop stays the rule. The physical shop goes first.
 */
export type Basket = readonly string[];

/** The basket's products, its first shop's first: what is on the shelf beats what has to be ordered. */
function inBasket(all: IndexedProduct[], basket: Basket): IndexedProduct[] {
  // One shop (nearly every call): a plain filter keeps the candidates' own order.
  if (basket.length === 1) return all.filter((p) => p.stores.includes(basket[0]!));
  const rank = (p: IndexedProduct) => {
    const i = basket.findIndex((s) => p.stores.includes(s));
    return i === -1 ? basket.length : i;
  };
  return all
    .map((p, i) => ({ p, i, r: rank(p) }))
    .filter((x) => x.r < basket.length)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
}

/**
 * Which products may play an ingredient here.
 * - store:  what the basket's shops sell (everything, when there is no basket).
 * - staple: what the basket's PHYSICAL shop sells; with none, nothing - every
 *   shop has milk, and naming one product would name one chain under "every
 *   store" (nor is milk ordered from a protein shop).
 * - pantry: it is at home already, so anything; the basket's own goes first.
 */
function poolFor(
  role: IngredientDef['role'],
  basket: Basket,
  all: IndexedProduct[],
  here: IndexedProduct[],
): IndexedProduct[] {
  if (role === 'store') return here;
  if (role === 'staple') {
    const physical = basket.filter((s) => !isOnlineShop(s));
    // A basket of physical shops only (one shop - nearly every call): its products as they are.
    if (basket.length && physical.length === basket.length) return here;
    return physical.length ? here.filter((p) => physical.some((s) => p.stores.includes(s))) : [];
  }
  if (!basket.length) return all;
  const own = new Set(here);
  return [...here, ...all.filter((p) => !own.has(p))];
}

/**
 * The recipe bought in a basket (one shop, or a shop and an online shop; a
 * plain store key is a basket of one; null is anywhere), with the user's
 * product swaps, and judged by its rule on what was actually chosen.
 */
export function resolveRecipe(
  recipe: Recipe,
  candidates: Candidates,
  store: string | Basket | null,
  overrides: Overrides = {},
): ResolvedRecipe {
  const basket: Basket = store === null ? [] : typeof store === 'string' ? [store] : store;
  const missing: string[] = [];
  const items = recipe.items.map((item): ResolvedItem => {
    const def = INGREDIENTS[item.ingredient];
    const all = candidates.get(def.id) ?? [];
    const here = basket.length ? inBasket(all, basket) : all;
    const pool = poolFor(def.role, basket, all, here);
    if (def.role === 'store' && pool.length === 0) missing.push(def.id);

    const chosen = pool.find((p) => p.code === overrides[def.id]) ?? pool[0] ?? null;
    const per100 = chosen ? macrosOf(chosen)! : def.typical;
    const grams = item.pack && chosen ? (packGrams(chosen.quantity) ?? item.grams) : item.grams;
    const shop = (chosen && basket.find((s) => chosen.stores.includes(s))) ?? null;
    return {
      item,
      def,
      product: chosen,
      fromStore: shop !== null,
      shop,
      alternatives: pool,
      grams,
      macros: scale(per100, grams),
    };
  });

  const total = sumMacros(items.map((i) => i.macros));
  // The rule is about what is eaten, so it is judged per serving. Dividing by
  // the servings cannot change the verdict, but this is the number on the card.
  const perServing = divideMacros(total, servingsOf(recipe));
  return {
    recipe,
    store: basket[0] ?? null,
    stores: [...basket],
    available: missing.length === 0,
    missing,
    items,
    total,
    perServing,
    passes: passesRule(recipe, perServing),
  };
}

/** Stores where the recipe can be bought in full AND still passes the rule. */
export function availableStores(recipe: Recipe, candidates: Candidates, stores: string[]): string[] {
  return stores.filter((store) => {
    const r = resolveRecipe(recipe, candidates, store);
    return r.available && r.passes;
  });
}

/** Every store key that sells a candidate of some store ingredient. */
function storesWithCandidates(candidates: Candidates): Set<string> {
  const stores = new Set<string>();
  for (const def of Object.values(INGREDIENTS)) {
    if (def.role !== 'store') continue;
    for (const p of candidates.get(def.id) ?? []) for (const s of p.stores) stores.add(s);
  }
  return stores;
}

/**
 * Physical stores worth offering, most useful first: by how many recipes that
 * NEED a store they cover on their own. Recipes made of staples and pantry
 * items alone are available everywhere and would only inflate every count
 * equally. Online shops are ranked apart (`onlineRanking`): a shop down the
 * road is the default, a delivery the complement.
 */
export function storeRanking(recipes: Recipe[], candidates: Candidates): string[] {
  const stores = new Set([...storesWithCandidates(candidates)].filter((s) => !isOnlineShop(s)));
  const counts = new Map<string, number>();
  for (const recipe of recipes.filter(needsStore)) {
    for (const store of availableStores(recipe, candidates, [...stores]))
      counts.set(store, (counts.get(store) ?? 0) + 1);
  }
  // Supermarkets first, cash & carry halls after them: a hall covers a lot, but it is nobody's
  // default shop.
  const hall = (store: string) => (CASH_AND_CARRY.has(store) ? 1 : 0);
  return [...counts]
    .sort((a, b) => hall(a[0]) - hall(b[0]) || b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([store]) => store);
}

/**
 * What to show when no store is chosen: the first store in the ranking that
 * covers the whole recipe, so everything can be bought in one place. When no
 * single store does, NOTHING - one shop is the requirement, and a list of
 * products from here and there is exactly what it rules out.
 * Recipes without store ingredients need no shop at all.
 */
export function bestVariant(
  recipe: Recipe,
  candidates: Candidates,
  ranking: string[],
  overrides: Overrides = {},
): ResolvedRecipe | null {
  if (!needsStore(recipe)) {
    const anywhere = resolveRecipe(recipe, candidates, null, overrides);
    return anywhere.passes ? anywhere : null;
  }
  for (const store of ranking) {
    const r = resolveRecipe(recipe, candidates, store, overrides);
    if (r.available && r.passes) return r;
  }
  return null;
}

/**
 * Online shops that sell anything a recipe needs from a store, the broadest
 * first: by how many store ingredients they have candidates for.
 */
export function onlineRanking(candidates: Candidates): string[] {
  const counts = new Map<string, number>();
  for (const def of Object.values(INGREDIENTS)) {
    if (def.role !== 'store') continue;
    const shops = new Set((candidates.get(def.id) ?? []).flatMap((p) => p.stores.filter(isOnlineShop)));
    for (const s of shops) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
}

export interface RecipeIndex {
  candidates: Candidates;
  /** Physical stores, most useful first. */
  ranking: string[];
  /** Online shops, broadest first. */
  online: string[];
}

const indexes = new WeakMap<IndexedProduct[], RecipeIndex>();

/**
 * Candidates and the store ranking, computed once per product list: they
 * cost ~100 ms on 29 000 products, and switching tabs remounts the page.
 */
export function recipeIndex(products: IndexedProduct[]): RecipeIndex {
  let index = indexes.get(products);
  if (!index) {
    const candidates = buildCandidates(products);
    index = { candidates, ranking: storeRanking(RECIPES, candidates), online: onlineRanking(candidates) };
    indexes.set(products, index);
  }
  return index;
}
