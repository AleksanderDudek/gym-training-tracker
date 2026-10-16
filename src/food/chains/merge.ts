import type { Dataset, Price, Product } from '../lib/types';
import { keyOf } from '../online/merge';
import type { ChainData, ChainProductData } from './types';

/** The product's page on the chain's site. */
export function chainProductUrl(chain: ChainData, p: ChainProductData): string {
  return chain.productUrl.replace('{id}', encodeURIComponent(p.id));
}

function priceOf(chain: ChainData, p: ChainProductData): Price | null {
  if (p.price === null) return null;
  return {
    value: p.price,
    currency: 'PLN',
    date: chain.checked,
    store: chain.name,
    city: chain.hall,
    perKg: !!p.perKg,
    discounted: false,
    regularValue: null,
    count: 1,
  };
}

const complete = (p: Product) =>
  p.nutrition.kcal !== null && p.nutrition.protein !== null && p.nutrition.carbs !== null && p.nutrition.fat !== null;

function newProduct(chain: ChainData, p: ChainProductData, odd: boolean): Product {
  const n = p.nutrition;
  const categories = p.categories;
  return {
    code: p.ean,
    name: p.name,
    genericName: null,
    brands: p.brand ? [keyOf(p.brand)] : [],
    quantity: p.quantity,
    servingSize: null,
    images: { front: null, ingredients: null, nutrition: null },
    categories,
    mainCategory: categories[categories.length - 1] ?? null,
    nutrition: {
      kcal: n.kcal,
      fat: n.fat,
      saturatedFat: n.saturatedFat,
      carbs: n.carbs,
      sugars: n.sugars,
      fiber: n.fiber,
      protein: n.protein,
      salt: n.salt,
    },
    nutriscore: null,
    nova: null,
    ecoscore: null,
    vegan: null,
    vegetarian: null,
    palmOil: null,
    labels: [],
    allergens: p.allergens,
    traces: [],
    additives: [],
    additivesCount: null,
    ingredientsText: null,
    stores: [chain.id],
    popularity: null,
    price: priceOf(chain, p),
    pages: [{ store: chain.id, url: chainProductUrl(chain, p) }],
    shopOnly: true,
    ...(odd && { labelMismatch: true as const }),
  };
}

/**
 * The chains' products in the dataset. A product whose EAN is already known (from Open Food Facts
 * or an online shop) is sold in the chain too: it gains the chain as a store, a link to its page
 * there, the chain's price when it had none, the chain's nutrition when its own was incomplete, and
 * the chain's allergens when it had none. Anything else becomes a product of its own. Chain names
 * and brands join the dictionaries. The input is not changed.
 */
export function mergeChains(dataset: Dataset, chains: ChainData[]): Dataset {
  const products = [...dataset.products];
  const index = new Map(products.map((p, i) => [p.code, i]));
  const stores = { ...dataset.dictionaries.stores };
  const brands = { ...dataset.dictionaries.brands };

  for (const chain of chains) {
    stores[chain.id] = chain.name;
    const odd = new Set(chain.inconsistent ?? []);
    for (const p of chain.products) {
      const fromChain = newProduct(chain, p, odd.has(p.ean));
      const at = index.get(p.ean);
      if (at === undefined) {
        index.set(p.ean, products.length);
        products.push(fromChain);
        if (p.brand) brands[keyOf(p.brand)] ??= p.brand;
        continue;
      }
      const known = products[at]!;
      const keep = complete(known);
      products[at] = {
        ...known,
        stores: known.stores.includes(chain.id) ? known.stores : [...known.stores, chain.id],
        pages: [...(known.pages ?? []), ...fromChain.pages!],
        price: known.price ?? fromChain.price,
        nutrition: keep ? known.nutrition : fromChain.nutrition,
        allergens: known.allergens.length ? known.allergens : fromChain.allergens,
        ...(!keep && fromChain.labelMismatch && { labelMismatch: true as const }),
      };
    }
  }
  return { ...dataset, dictionaries: { ...dataset.dictionaries, stores, brands }, products };
}
