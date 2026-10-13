import { describe, expect, test } from 'vitest';
import type { Dataset } from '../lib/types';
import { DATASET, makeProduct } from '../test/fixtures';
import { CATEGORY_TAGS, keyOf, mergeOnline } from './merge';
import type { ShopData, ShopProductData } from './types';

const product = (over: Partial<ShopProductData> = {}): ShopProductData => ({
  name: 'Makaron konjac spaghetti',
  brand: 'Diet-Food',
  url: 'https://sklep.diet-food.pl/produkt/makaron-konjac-spaghetti',
  quantity: '200 g',
  category: 'makaron',
  nutrition: { kcal: 8, protein: 0.1, carbs: 0.2, fat: 0, sugars: 0, fiber: 3, saturatedFat: 0, salt: 0 },
  price: 9.99,
  vegan: true,
  ean: null,
  ...over,
});

const shop = (id: string, name: string, products: ShopProductData[]): ShopData => ({
  id,
  name,
  url: `https://${id}.pl`,
  checked: '2026-10-13',
  products,
});

const KNOWN = makeProduct({
  code: '5900000000017',
  name: 'Syrop zero',
  stores: ['biedronka'],
  nutrition: { kcal: null, protein: null, carbs: null, fat: null, sugars: null, saturatedFat: null, fiber: null, salt: null },
});
const BASE: Dataset = { ...DATASET, products: [...DATASET.products, KNOWN] };

describe('mergeOnline', () => {
  test('a new product: code from the page address, OFF categories, the shop as a store, an offer and a price', () => {
    const merged = mergeOnline(BASE, [shop('diet-food', 'Diet-Food', [product()])]);
    const p = merged.products.at(-1)!;
    expect(p).toMatchObject({
      code: 'diet-food-makaron-konjac-spaghetti',
      name: 'Makaron konjac spaghetti',
      brands: ['diet-food'],
      categories: CATEGORY_TAGS.makaron,
      mainCategory: 'en:pastas',
      stores: ['diet-food'],
      vegan: 'yes',
      images: { front: null },
      online: [{ shop: 'diet-food', url: product().url, price: 9.99, checked: '2026-10-13' }],
      shopOnly: true,
      price: { value: 9.99, currency: 'PLN', store: 'Diet-Food', date: '2026-10-13' },
    });
    expect(merged.dictionaries.stores['diet-food']).toBe('Diet-Food');
    expect(merged.dictionaries.brands['diet-food']).toBe('Diet-Food');
    // The input is not changed.
    expect(BASE.products).toHaveLength(DATASET.products.length + 1);
    expect(BASE.dictionaries.stores['diet-food']).toBeUndefined();
  });

  test('a known EAN gains an offer: the shop as a store, its price and its nutrition when OFF had none', () => {
    const merged = mergeOnline(BASE, [
      shop('guiltfree', 'GuiltFree', [product({ name: 'Syrop', category: 'sosy', ean: KNOWN.code, price: 19.99 })]),
    ]);
    expect(merged.products).toHaveLength(BASE.products.length);
    const p = merged.products.find((x) => x.code === KNOWN.code)!;
    expect(p.name).toBe('Syrop zero');
    expect(p.stores).toEqual(['biedronka', 'guiltfree']);
    expect(p.online).toHaveLength(1);
    expect(p.price?.value).toBe(19.99);
    expect(p.nutrition.kcal).toBe(8);
    expect(p.shopOnly).toBeUndefined();
  });

  test('the same EAN in two shops is one product with two offers', () => {
    const ean = '5901234567890';
    const merged = mergeOnline(BASE, [
      shop('a', 'Sklep A', [product({ ean, url: 'https://a.pl/x' })]),
      shop('b', 'Sklep B', [product({ ean, url: 'https://b.pl/x', price: 7.5 })]),
    ]);
    const p = merged.products.find((x) => x.code === ean)!;
    expect(p.stores).toEqual(['a', 'b']);
    expect(p.online?.map((o) => o.url)).toEqual(['https://a.pl/x', 'https://b.pl/x']);
    // The first shop's price stays the price; the second is in its offer.
    expect(p.price?.value).toBe(9.99);
    expect(p.online?.[1]?.price).toBe(7.5);
  });

  test('a product the shop lists as inconsistent is marked, and only that one', () => {
    const odd = product({ name: 'Erytrytol', url: 'https://diet-food.pl/erytrytol' });
    const merged = mergeOnline(BASE, [{ ...shop('diet-food', 'Diet-Food', [product(), odd]), inconsistent: ['Erytrytol'] }]);
    expect(merged.products.at(-1)?.labelMismatch).toBe(true);
    expect(merged.products.at(-2)?.labelMismatch).toBeUndefined();
  });

  test('keys are folded ASCII; an invalid EAN is not a code', () => {
    expect(keyOf('Bezmięsny Mięsny')).toBe('bezmiesny-miesny');
    const merged = mergeOnline(BASE, [shop('x', 'X', [product({ ean: '123', url: 'https://x.pl/p/Śliwka/12' })])]);
    expect(merged.products.at(-1)?.code).toBe('x-12');
  });
});
