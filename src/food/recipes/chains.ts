import type { IndexedProduct } from '../lib/types';
import { isOnlineShop } from '../online/shops';
import { readyProducts } from './ready';
import { recipeIndex } from './resolve';

const cache = new WeakMap<IndexedProduct[], Set<string>>();

/**
 * Chains that can give something: a recipe bought in full there, or a ready
 * protein product. Every store key in the data would include slugs like
 * "malina" or "orlen" that an unrelated local shop can share, so a shop
 * nearby only counts when its chain is one of these.
 */
export function chainsWithFood(products: IndexedProduct[]): Set<string> {
  let chains = cache.get(products);
  if (!chains) {
    chains = new Set(recipeIndex(products).ranking);
    // Online shops sell nothing on the street: a local shop that happens to share a key must not count.
    for (const group of readyProducts(products, null))
      for (const p of group.items) for (const s of p.stores) if (!isOnlineShop(s)) chains.add(s);
    cache.set(products, chains);
  }
  return chains;
}
