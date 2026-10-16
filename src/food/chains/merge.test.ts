import { describe, expect, test } from 'vitest';
import type { Dataset } from '../lib/types';
import { mergeOnline } from '../online/merge';
import { DATASET, makeProduct } from '../test/fixtures';
import { chainProductUrl, mergeChains } from './merge';
import type { ChainData, ChainProductData } from './types';

const item = (over: Partial<ChainProductData> = {}): ChainProductData => ({
  ean: '5902899143835',
  id: '339221',
  name: 'Almette śmietankowy bez laktozy. Puszysty serek twarogowy. 150 g',
  brand: 'Almette',
  quantity: '150 g',
  categories: ['en:dairies', 'en:cheeses', 'en:fresh-cheeses'],
  allergens: ['en:milk'],
  nutrition: { kcal: 260, protein: 6.3, carbs: 2.4, fat: 25, sugars: 2.3, fiber: null, saturatedFat: 17, salt: 0.78 },
  price: 5.19,
  ...over,
});

const chain = (products: ChainProductData[], over: Partial<ChainData> = {}): ChainData => ({
  id: 'selgros',
  name: 'Selgros',
  url: 'https://www.selgros.pl',
  productUrl: 'https://www.selgros.pl/znajdz-produkt/product/{id}',
  checked: '2026-10-16',
  hall: 'Kraków',
  products,
  ...over,
});

const NO_NUTRITION = { kcal: null, protein: null, carbs: null, fat: null, sugars: null, saturatedFat: null, fiber: null, salt: null };
const KNOWN = makeProduct({
  code: '5902899143835',
  name: 'Almette śmietankowy',
  stores: ['biedronka'],
  nutrition: { kcal: 255, protein: 6, carbs: 3, fat: 24.5, sugars: 3, saturatedFat: 16, fiber: null, salt: 0.8 },
});
const PRICED = makeProduct({
  code: '5900000000017',
  name: 'Skyr',
  stores: [],
  price: { value: 3.49, currency: 'PLN', date: '2026-01-10', store: 'Biedronka', city: 'Poznań', perKg: false, discounted: false, regularValue: null, count: 1 },
});
const EMPTY = makeProduct({ code: '5900000000024', name: 'Twaróg', nutrition: NO_NUTRITION, allergens: [] });
const BASE: Dataset = { ...DATASET, products: [...DATASET.products, KNOWN, PRICED, EMPTY] };

describe('mergeChains', () => {
  test('a new product: the EAN as its code, OFF tags, the chain as a store, its page and its shelf price', () => {
    const merged = mergeChains(DATASET, [chain([item()])]);
    const p = merged.products.at(-1)!;
    expect(p).toMatchObject({
      code: '5902899143835',
      name: item().name,
      brands: ['almette'],
      quantity: '150 g',
      categories: ['en:dairies', 'en:cheeses', 'en:fresh-cheeses'],
      mainCategory: 'en:fresh-cheeses',
      allergens: ['en:milk'],
      stores: ['selgros'],
      pages: [{ store: 'selgros', url: 'https://www.selgros.pl/znajdz-produkt/product/339221' }],
      shopOnly: true,
      images: { front: null },
      price: { value: 5.19, currency: 'PLN', store: 'Selgros', city: 'Kraków', date: '2026-10-16', perKg: false },
    });
    // A store you walk into: no online offer.
    expect(p.online).toBeUndefined();
    expect(merged.dictionaries.stores.selgros).toBe('Selgros');
    expect(merged.dictionaries.brands.almette).toBe('Almette');
    // The input is not changed.
    expect(DATASET.products.some((x) => x.code === '5902899143835')).toBe(false);
    expect(DATASET.dictionaries.stores.selgros).toBeUndefined();
  });

  test('a known EAN is sold in the chain too: store and page added, its own name, numbers and price kept', () => {
    const merged = mergeChains(BASE, [
      chain([item(), item({ ean: '5900000000017', id: '1', name: 'Skyr naturalny', price: 4.2 })]),
    ]);
    const almette = merged.products.find((x) => x.code === '5902899143835')!;
    expect(almette.name).toBe('Almette śmietankowy');
    expect(almette.stores).toEqual(['biedronka', 'selgros']);
    expect(almette.pages).toEqual([{ store: 'selgros', url: 'https://www.selgros.pl/znajdz-produkt/product/339221' }]);
    expect(almette.nutrition).toEqual(KNOWN.nutrition);
    expect(almette.shopOnly).toBeUndefined();
    // No price in the base: the chain's one; a price already there stays.
    expect(almette.price).toMatchObject({ value: 5.19, store: 'Selgros' });
    expect(merged.products.find((x) => x.code === '5900000000017')!.price).toMatchObject({ value: 3.49, store: 'Biedronka' });
    expect(merged.products).toHaveLength(BASE.products.length);
  });

  test('incomplete numbers and no allergens in the base: the chain’s label fills them in', () => {
    const merged = mergeChains(BASE, [chain([item({ ean: '5900000000024', id: '7' })])]);
    const p = merged.products.find((x) => x.code === '5900000000024')!;
    expect(p.nutrition).toMatchObject({ kcal: 260, protein: 6.3, carbs: 2.4, fat: 25 });
    expect(p.allergens).toEqual(['en:milk']);
  });

  test('sold by weight: the price is per kilogram; a label that does not add up is marked', () => {
    const merged = mergeChains(DATASET, [
      chain([item({ ean: '2000000000008', id: '42', price: 31.99, perKg: true })], { inconsistent: ['2000000000008'] }),
    ]);
    const p = merged.products.at(-1)!;
    expect(p.price).toMatchObject({ value: 31.99, perKg: true });
    expect(p.labelMismatch).toBe(true);
  });

  test('a product in the chain and in an online shop gets both: the store, the page and the offer', () => {
    const withChain = mergeChains(DATASET, [chain([item()])]);
    const both = mergeOnline(withChain, [
      {
        id: 'guiltfree',
        name: 'GuiltFree',
        url: 'https://guiltfree.pl',
        checked: '2026-10-13',
        products: [
          {
            name: 'Almette',
            brand: 'Almette',
            url: 'https://guiltfree.pl/products/almette',
            quantity: '150 g',
            category: 'nabial',
            nutrition: item().nutrition,
            price: 6.5,
            vegan: false,
            ean: '5902899143835',
          },
        ],
      },
    ]);
    const p = both.products.find((x) => x.code === '5902899143835')!;
    expect(p.stores).toEqual(['selgros', 'guiltfree']);
    expect(p.pages).toHaveLength(1);
    expect(p.online).toEqual([{ shop: 'guiltfree', url: 'https://guiltfree.pl/products/almette', price: 6.5, checked: '2026-10-13' }]);
  });

  test('the product page address is built from the article number', () => {
    expect(chainProductUrl(chain([]), item({ id: '636305' }))).toBe('https://www.selgros.pl/znajdz-produkt/product/636305');
  });
});
