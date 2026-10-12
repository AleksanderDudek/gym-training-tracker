import { packGrams } from '../lib/quantity';
import type { IndexedProduct } from '../lib/types';
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
    candidates.set(def.id, products.filter((p) => macrosOf(p) !== null && match(p)).sort(byPreference));
  }
  return candidates;
}

export interface ResolvedItem {
  item: RecipeItem;
  def: IngredientDef;
  /** null: no product known here, typical values are used. */
  product: IndexedProduct | null;
  /** The product is sold in the chosen store. */
  fromStore: boolean;
  /** What the user may swap to here. */
  alternatives: IndexedProduct[];
  /** The amount used: the catalog's, or the chosen product's own pack for a pack item. */
  grams: number;
  macros: Macros;
}

export interface ResolvedRecipe {
  recipe: Recipe;
  /** null: products from anywhere. */
  store: string | null;
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
 * Which products may play an ingredient here.
 * - store:  what the store sells (everything, when no store is chosen).
 * - staple: what the store sells; with NO store, nothing - every shop has
 *   milk, and naming one product would name one chain under "every store".
 * - pantry: it is at home already, so anything; the store's own goes first.
 */
function poolFor(
  role: IngredientDef['role'],
  store: string | null,
  all: IndexedProduct[],
  here: IndexedProduct[],
): IndexedProduct[] {
  if (role === 'store') return here;
  if (role === 'staple') return store ? here : [];
  if (!store) return all;
  const own = new Set(here);
  return [...here, ...all.filter((p) => !own.has(p))];
}

export function resolveRecipe(
  recipe: Recipe,
  candidates: Candidates,
  store: string | null,
  overrides: Overrides = {},
): ResolvedRecipe {
  const missing: string[] = [];
  const items = recipe.items.map((item): ResolvedItem => {
    const def = INGREDIENTS[item.ingredient];
    const all = candidates.get(def.id) ?? [];
    const here = store ? all.filter((p) => p.stores.includes(store)) : all;
    const pool = poolFor(def.role, store, all, here);
    if (def.role === 'store' && pool.length === 0) missing.push(def.id);

    const chosen = pool.find((p) => p.code === overrides[def.id]) ?? pool[0] ?? null;
    const per100 = chosen ? macrosOf(chosen)! : def.typical;
    const grams = item.pack && chosen ? (packGrams(chosen.quantity) ?? item.grams) : item.grams;
    return {
      item,
      def,
      product: chosen,
      fromStore: !!chosen && store !== null && chosen.stores.includes(store),
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
    store,
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

/**
 * Stores worth offering, most useful first: by how many recipes that NEED a
 * store they cover. Recipes made of staples and pantry items alone are
 * available everywhere and would only inflate every count equally.
 */
export function storeRanking(recipes: Recipe[], candidates: Candidates): string[] {
  const stores = new Set<string>();
  for (const def of Object.values(INGREDIENTS)) {
    if (def.role !== 'store') continue;
    for (const p of candidates.get(def.id) ?? []) for (const s of p.stores) stores.add(s);
  }
  const counts = new Map<string, number>();
  for (const recipe of recipes.filter(needsStore)) {
    for (const store of availableStores(recipe, candidates, [...stores]))
      counts.set(store, (counts.get(store) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([store]) => store);
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

export interface RecipeIndex {
  candidates: Candidates;
  ranking: string[];
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
    index = { candidates, ranking: storeRanking(RECIPES, candidates) };
    indexes.set(products, index);
  }
  return index;
}
