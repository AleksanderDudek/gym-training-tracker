import { describe, expect, test } from 'vitest';
import { storeKey } from '../lib/stores';
import { CHAIN_DATA } from '../online/shopData';
import { isOnlineShop } from '../online/shops';
import { DATA_CHAINS } from './chains';

const ALLERGENS = new Set([
  'en:gluten',
  'en:crustaceans',
  'en:eggs',
  'en:fish',
  'en:peanuts',
  'en:soybeans',
  'en:milk',
  'en:nuts',
  'en:celery',
  'en:mustard',
  'en:sesame-seeds',
  'en:sulphur-dioxide-and-sulphites',
  'en:lupin',
  'en:molluscs',
]);

/** GTIN-8 / GTIN-13 check digit. */
function validEan(code: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

test('the registry and the data files name the same chains; a chain is a store, not an online shop', () => {
  expect(CHAIN_DATA.map((c) => c.id).sort()).toEqual(DATA_CHAINS.map((c) => c.id).sort());
  for (const chain of CHAIN_DATA) {
    const known = DATA_CHAINS.find((c) => c.id === chain.id)!;
    expect(chain.name, chain.id).toBe(known.name);
    expect(chain.url, chain.id).toBe(known.url);
    // The same key the products' store tags and OpenStreetMap brands fold into.
    expect(storeKey(chain.name)?.key, chain.id).toBe(chain.id);
    expect(isOnlineShop(chain.id), chain.id).toBe(false);
  }
});

describe.each(CHAIN_DATA.map((c) => [c.id, c] as const))('chain data: %s', (_, chain) => {
  test('the chain says where and when its numbers come from', () => {
    expect(chain.url).toMatch(/^https:\/\//);
    expect(chain.productUrl).toContain('{id}');
    expect(new URL(chain.productUrl.replace('{id}', '1')).hostname).toBe(new URL(chain.url).hostname);
    expect(chain.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(chain.hall?.trim()).toBeTruthy();
    expect(chain.products.length).toBeGreaterThan(1000);
  });

  test('every product: a valid EAN and article number, each once; a name; OFF tags', () => {
    for (const p of chain.products) {
      expect(validEan(p.ean), `${p.ean} ${p.name}`).toBe(true);
      expect(p.id, p.name).toMatch(/^\d+$/);
      expect(p.name.trim(), p.ean).not.toBe('');
      if (p.brand !== null) expect(p.brand.trim(), p.ean).not.toBe('');
      if (p.quantity !== null) expect(p.quantity, p.ean).toMatch(/\d/);
      for (const t of p.categories) expect(t, p.ean).toMatch(/^en:[a-z0-9-]+$/);
      for (const a of p.allergens) expect(ALLERGENS.has(a), `${a} ${p.ean}`).toBe(true);
      if (p.price !== null) expect(p.price, p.ean).toBeGreaterThan(0);
    }
    expect(new Set(chain.products.map((p) => p.ean)).size).toBe(chain.products.length);
    expect(new Set(chain.products.map((p) => p.id)).size).toBe(chain.products.length);
  });

  // A transcription slip shows up as numbers that cannot be true together. What the chain's own
  // label gets wrong (energy that does not add up) is listed in `inconsistent` and kept as published.
  test('the numbers per 100 g can be true; energy adds up unless the label is listed as inconsistent', () => {
    const odd = new Set(chain.inconsistent ?? []);
    for (const ean of odd) expect(chain.products.some((p) => p.ean === ean), ean).toBe(true);
    for (const p of chain.products) {
      const n = p.nutrition;
      const grams = [n.protein, n.carbs, n.fat, n.sugars ?? 0, n.saturatedFat ?? 0, n.salt ?? 0, n.fiber ?? 0];
      expect(grams.every((g) => g >= 0 && g <= 100), `${p.ean} ${p.name}`).toBe(true);
      expect(n.protein + n.carbs + n.fat, `${p.ean} ${p.name}`).toBeLessThanOrEqual(105);
      expect(n.kcal, p.ean).toBeGreaterThanOrEqual(0);
      expect(n.kcal, p.ean).toBeLessThanOrEqual(900);
      if (n.sugars !== null) expect(n.sugars, p.ean).toBeLessThanOrEqual(n.carbs + 0.5);
      if (n.saturatedFat !== null) expect(n.saturatedFat, p.ean).toBeLessThanOrEqual(n.fat + 0.5);
      if (!odd.has(p.ean)) {
        const computed = 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * (n.fiber ?? 0);
        expect(Math.abs(computed - n.kcal), `${p.ean} ${p.name}`).toBeLessThanOrEqual(Math.max(25, n.kcal * 0.15));
      }
    }
  });
});
