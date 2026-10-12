import { isOnlineShop } from '../online/shops';
import type { Recipe } from './catalog';
import { INGREDIENTS } from './ingredients';
import { needsStore, resolveRecipe, type Basket, type Candidates, type RecipeIndex } from './resolve';

/**
 * The SMALLEST baskets a recipe can be bought in, most convenient first: one
 * physical shop (by the ranking), one online shop; only when no single shop
 * does - a physical shop with an online one, then two online shops. Never two
 * physical shops. Each basket covers every store ingredient and keeps the
 * recipe's rule on the products it resolves to. A recipe of staples and pantry
 * items needs no shop: no baskets. Physical shops come from the ranking - the
 * chains that make recipes on their own - so a pair never names an obscure
 * shop that one crowd-sourced product happens to list.
 */
export function basketsFor(recipe: Recipe, candidates: Candidates, ranking: string[], online: string[]): string[][] {
  if (!needsStore(recipe)) return [];
  // Who sells a candidate of each store ingredient: a basket without one of them is not worth resolving.
  const sellers = recipe.items
    .map((i) => INGREDIENTS[i.ingredient])
    .filter((d) => d.role === 'store')
    .map((d) => new Set((candidates.get(d.id) ?? []).flatMap((p) => p.stores)));
  const works = (basket: string[]) => {
    if (!sellers.every((set) => basket.some((s) => set.has(s)))) return false;
    const r = resolveRecipe(recipe, candidates, basket);
    return r.available && r.passes;
  };

  const singles = [...ranking, ...online].filter((s) => works([s])).map((s) => [s]);
  if (singles.length) return singles;
  const pairs: string[][] = [];
  for (const shop of ranking) for (const web of online) if (works([shop, web])) pairs.push([shop, web]);
  for (const [i, a] of online.entries()) for (const b of online.slice(i + 1)) if (works([a, b])) pairs.push([a, b]);
  return pairs;
}

const cache = new WeakMap<RecipeIndex, Map<string, string[][]>>();

/** `basketsFor` with the index's own rankings, computed once per recipe and product list. */
export function recipeBaskets(recipe: Recipe, index: RecipeIndex): string[][] {
  let byRecipe = cache.get(index);
  if (!byRecipe) {
    byRecipe = new Map();
    cache.set(index, byRecipe);
  }
  let baskets = byRecipe.get(recipe.id);
  if (!baskets) {
    baskets = basketsFor(recipe, index.candidates, index.ranking, index.online);
    byRecipe.set(recipe.id, baskets);
  }
  return baskets;
}

/** Every shop of `inner` is in `outer`: what one basket buys, a bigger one buys too. */
export const within = (inner: Basket, outer: Basket): boolean => inner.every((s) => outer.includes(s));

export const basketKey = (basket: Basket): string => basket.join('+');

export const hasOnline = (basket: Basket): boolean => basket.some(isOnlineShop);

export interface BasketGroup<T> {
  /** The shops of the group; null: the recipes that need no particular shop. */
  basket: string[] | null;
  items: T[];
}

/**
 * Recipes grouped into as few shopping plans as possible, greedily: the basket
 * that lets the most remaining recipes be made - those that need exactly it
 * and those that need only one of its shops - first, then the next one among
 * the rest. Ties go to the smaller basket, then to the more convenient one
 * (earlier in the recipes' own basket order). Recipes that need no particular
 * shop close the list. Order inside a group is the input order.
 */
export function groupByBasket<T>(items: T[], basketsOf: (item: T) => string[][]): BasketGroup<T>[] {
  const groups: BasketGroup<T>[] = [];
  let rest = items.filter((item) => basketsOf(item).length > 0);
  while (rest.length) {
    const options = new Map<string, { basket: string[]; rank: number }>();
    for (const item of rest)
      for (const [rank, basket] of basketsOf(item).entries()) {
        const known = options.get(basketKey(basket));
        if (!known || rank < known.rank) options.set(basketKey(basket), { basket, rank });
      }
    let best: { basket: string[]; rank: number; covered: T[] } | null = null;
    for (const option of options.values()) {
      const covered = rest.filter((item) => basketsOf(item).some((b) => within(b, option.basket)));
      const better =
        !best ||
        covered.length > best.covered.length ||
        (covered.length === best.covered.length &&
          (option.basket.length < best.basket.length ||
            (option.basket.length === best.basket.length && option.rank < best.rank)));
      if (better) best = { ...option, covered };
    }
    groups.push({ basket: best!.basket, items: best!.covered });
    rest = rest.filter((item) => !best!.covered.includes(item));
  }
  const anywhere = items.filter((item) => basketsOf(item).length === 0);
  if (anywhere.length) groups.push({ basket: null, items: anywhere });
  return groups;
}
