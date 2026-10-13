import { foldDiacritics } from '../lib/text';
import type { Dataset, OnlineOffer, Price, Product } from '../lib/types';
import type { ShopCategory, ShopData, ShopProductData } from './types';

/**
 * Shop categories as Open Food Facts tags, with their parents (OFF products
 * carry the whole hierarchy): category filters, the ready protein groups and
 * the recipe matchers then treat a shop's product like any other.
 */
export const CATEGORY_TAGS: Record<ShopCategory, string[]> = {
  bialko: ['en:dietary-supplements', 'en:bodybuilding-supplements', 'en:protein-powders'],
  batony: ['en:snacks', 'en:sweet-snacks', 'en:bars'],
  napoje: ['en:beverages'],
  slodycze: ['en:snacks', 'en:sweet-snacks'],
  smarowidla: ['en:spreads'],
  sosy: ['en:condiments', 'en:sauces'],
  makaron: ['en:pastas'],
  maki: ['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:flours'],
  pieczywo: ['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:breads'],
  sniadania: ['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:breakfast-cereals'],
  przekaski: ['en:snacks', 'en:salty-snacks'],
  'zamienniki-miesa': ['en:plant-based-foods', 'en:meat-analogues'],
  dania: ['en:meals'],
  orzechy: ['en:plant-based-foods', 'en:nuts'],
  kakao: ['en:cocoa-and-its-products'],
  kokos: ['en:plant-based-foods'],
  nabial: ['en:dairies'],
  inne: [],
};

/** "GuiltFree" -> "guiltfree": the brand key style of the OFF data. */
export function keyOf(text: string): string {
  return foldDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const isEan = (code: string | null): code is string => !!code && /^(\d{8}|\d{13})$/.test(code);

/** A code for a product without a barcode: the shop and the last part of its page address. */
function codeOf(shop: ShopData, p: ShopProductData): string {
  if (isEan(p.ean)) return p.ean;
  const path = new URL(p.url).pathname.split('/').filter(Boolean);
  const last = path[path.length - 1] ?? p.name;
  let slug: string;
  try {
    slug = decodeURIComponent(last);
  } catch {
    // A stray "%" in an address: the raw text still makes a key.
    slug = last;
  }
  return `${shop.id}-${keyOf(slug)}`;
}

/** The code every product of a shop gets in the dataset (exported for the data test). */
export const productCode = codeOf;

function priceOf(shop: ShopData, value: number | null): Price | null {
  if (value === null) return null;
  return {
    value,
    currency: 'PLN',
    date: shop.checked,
    store: shop.name,
    city: null,
    perKg: false,
    discounted: false,
    regularValue: null,
    count: 1,
  };
}

const complete = (p: Product) =>
  p.nutrition.kcal !== null && p.nutrition.protein !== null && p.nutrition.carbs !== null && p.nutrition.fat !== null;

function newProduct(shop: ShopData, p: ShopProductData, code: string, offer: OnlineOffer, odd: boolean): Product {
  const categories = CATEGORY_TAGS[p.category];
  const n = p.nutrition;
  return {
    code,
    name: p.name,
    genericName: null,
    brands: [keyOf(p.brand)],
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
    vegan: p.vegan === null ? null : p.vegan ? 'yes' : 'no',
    vegetarian: p.vegan ? 'yes' : null,
    palmOil: null,
    labels: [],
    allergens: [],
    traces: [],
    additives: [],
    additivesCount: null,
    ingredientsText: null,
    stores: [shop.id],
    popularity: null,
    price: priceOf(shop, p.price),
    online: [offer],
    shopOnly: true,
    ...(odd && { labelMismatch: true as const }),
  };
}

/**
 * The shops' products in the dataset. A product whose EAN is already known
 * (from Open Food Facts or another shop) gains an offer - the shop as a store,
 * a link, the shop's price when it had none, the shop's nutrition when its own
 * was incomplete; anything else becomes a product of its own. Shop names and
 * brands join the dictionaries. The input is not changed.
 */
export function mergeOnline(dataset: Dataset, shops: ShopData[]): Dataset {
  const products = [...dataset.products];
  const index = new Map(products.map((p, i) => [p.code, i]));
  const stores = { ...dataset.dictionaries.stores };
  const brands = { ...dataset.dictionaries.brands };

  for (const shop of shops) {
    stores[shop.id] = shop.name;
    const odd = new Set(shop.inconsistent ?? []);
    for (const p of shop.products) {
      const offer: OnlineOffer = { shop: shop.id, url: p.url, price: p.price, checked: shop.checked };
      const code = codeOf(shop, p);
      const at = index.get(code);
      if (at === undefined) {
        index.set(code, products.length);
        products.push(newProduct(shop, p, code, offer, odd.has(p.name)));
        brands[keyOf(p.brand)] ??= p.brand;
        continue;
      }
      const known = products[at]!;
      const fromShop = newProduct(shop, p, code, offer, odd.has(p.name));
      const keep = complete(known);
      products[at] = {
        ...known,
        stores: known.stores.includes(shop.id) ? known.stores : [...known.stores, shop.id],
        online: [...(known.online ?? []), offer],
        price: known.price ?? fromShop.price,
        nutrition: keep ? known.nutrition : fromShop.nutrition,
        ...(!keep && fromShop.labelMismatch && { labelMismatch: true as const }),
      };
    }
  }
  return { ...dataset, dictionaries: { ...dataset.dictionaries, stores, brands }, products };
}
