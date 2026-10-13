import { describe, expect, test } from 'vitest';
import { SHOPS } from './shopData';
import { ONLINE_SHOPS, isOnlineShop } from './shops';
import { SHOP_CATEGORIES } from './types';

test('the registry and the data files name the same shops, with the same home pages', () => {
  expect(SHOPS.map((s) => s.id).sort()).toEqual(ONLINE_SHOPS.map((s) => s.id).sort());
  for (const shop of SHOPS) {
    const known = ONLINE_SHOPS.find((s) => s.id === shop.id)!;
    expect(shop.name, shop.id).toBe(known.name);
    expect(shop.url, shop.id).toBe(known.url);
  }
  expect(isOnlineShop('myprotein')).toBe(true);
  expect(isOnlineShop('biedronka')).toBe(false);
});

// Every shop file, checked like the restaurant menus: a transcription slip shows up as numbers that
// cannot be true together. What the shop's own page gets wrong (sugar-free sweets count polyols,
// spices count fibre) is listed in `inconsistent` - checked against the page and kept as published.
describe.each(SHOPS.map((s) => [s.id, s] as const))('shop data: %s', (_, shop) => {
  test('the shop says where its numbers come from', () => {
    expect(shop.id).toMatch(/^[a-z0-9-]+$/);
    expect(shop.url).toMatch(/^https:\/\//);
    expect(shop.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(shop.products.length).toBeGreaterThan(0);
  });

  test('every product has a name, a brand, a category and its own https page on the shop', () => {
    const host = (url: string) => new URL(url).hostname.replace(/^(www|sklep)\./, '');
    for (const p of shop.products) {
      expect(p.name.trim(), p.url).not.toBe('');
      expect(p.brand.trim(), p.name).not.toBe('');
      expect(SHOP_CATEGORIES, p.name).toContain(p.category);
      expect(p.url, p.name).toMatch(/^https:\/\//);
      expect(host(p.url), p.name).toBe(host(shop.url));
      if (p.ean !== null) expect(p.ean, p.name).toMatch(/^(\d{8}|\d{13})$/);
      if (p.price !== null) expect(p.price, p.name).toBeGreaterThan(0);
    }
    expect(new Set(shop.products.map((p) => p.url)).size).toBe(shop.products.length);
  });

  test('numbers per 100 g are physical, and energy agrees with the macros unless listed', () => {
    const listed = new Set(shop.inconsistent ?? []);
    for (const listedName of listed) expect(shop.products.some((p) => p.name === listedName), listedName).toBe(true);
    for (const p of shop.products) {
      const n = p.nutrition;
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const)
        expect(Number.isFinite(n[k]) && n[k] >= 0, `${p.name}: ${k}`).toBe(true);
      // Rounding on the label: an oil is "100 g fat, 0.1 g protein".
      expect(n.protein + n.carbs + n.fat, p.name).toBeLessThanOrEqual(100.5);
      if (listed.has(p.name)) continue;
      if (n.sugars !== null) expect(n.sugars, p.name).toBeLessThanOrEqual(n.carbs + 0.05);
      if (n.saturatedFat !== null) expect(n.saturatedFat, p.name).toBeLessThanOrEqual(n.fat + 0.05);
      const atwater = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
      expect(Math.abs(atwater - n.kcal), p.name).toBeLessThanOrEqual(n.kcal < 170 ? 25 : n.kcal * 0.15);
    }
  });
});
