import { expect, test } from 'vitest';
import { latestPricesByCode, type OpenPriceItem } from './prices';

let nextId = 1;
function item(o: {
  code?: string | null;
  price?: number;
  date?: string;
  currency?: string;
  per?: string | null;
  discounted?: boolean;
  regular?: number | null;
  store?: string | null;
  brand?: string | null;
  city?: string | null;
  duplicateOf?: number | null;
}): OpenPriceItem {
  return {
    id: nextId++,
    product_code: o.code === undefined ? '590' : o.code,
    price: o.price ?? 1,
    currency: o.currency ?? 'PLN',
    date: o.date ?? '2026-01-01',
    price_per: o.per ?? null,
    price_is_discounted: o.discounted ?? false,
    price_without_discount: o.regular ?? null,
    duplicate_of: o.duplicateOf ?? null,
    location: { osm_name: o.store ?? null, osm_brand: o.brand ?? null, osm_address_city: o.city ?? null },
  };
}

test('keeps the newest price per product code and counts the reports', () => {
  const prices = latestPricesByCode([
    item({ code: '1', price: 4.29, date: '2026-10-01', store: 'Lidl' }),
    item({ code: '1', price: 4.99, date: '2026-10-08', store: 'Biedronka', city: 'Warszawa' }),
    item({ code: '2', price: 2, date: '2026-01-01' }),
  ]);
  expect(prices.get('1')).toEqual({
    value: 4.99,
    currency: 'PLN',
    date: '2026-10-08',
    store: 'Biedronka',
    city: 'Warszawa',
    perKg: false,
    discounted: false,
    regularValue: null,
    count: 2,
  });
  expect(prices.get('2')?.count).toBe(1);
});

test('on the same date the later report wins', () => {
  const prices = latestPricesByCode([
    item({ code: '1', price: 1, date: '2026-10-01' }),
    item({ code: '1', price: 2, date: '2026-10-01' }),
  ]);
  expect(prices.get('1')?.value).toBe(2);
});

test('prefers the chain name over the shop name', () => {
  expect(latestPricesByCode([item({ code: '1', store: 'Lidl Mokotów', brand: 'Lidl' })]).get('1')?.store).toBe('Lidl');
});

test('ignores items with no product code, another currency, or marked duplicate', () => {
  expect(
    latestPricesByCode([
      item({ code: null }),
      item({ code: '3', currency: 'EUR' }),
      item({ code: '4', duplicateOf: 99 }),
    ]).size,
  ).toBe(0);
});

test('a price per item wins over a newer price per kg: the two are not comparable', () => {
  const prices = latestPricesByCode([
    item({ code: '5', price: 8.99, date: '2026-09-01' }),
    item({ code: '5', price: 40, date: '2026-10-01', per: 'KILOGRAM' }),
  ]);
  expect(prices.get('5')).toMatchObject({ value: 8.99, perKg: false, count: 2 });
});

test('a per-kg price is used when it is the only kind there is', () => {
  expect(latestPricesByCode([item({ code: '6', price: 40, per: 'KILOGRAM' })]).get('6')?.perKg).toBe(true);
});

test('flags per-kg and discounted prices and keeps the regular price', () => {
  expect(
    latestPricesByCode([item({ code: '4', per: 'KILOGRAM', discounted: true, regular: 7.89 })]).get('4'),
  ).toMatchObject({ perKg: true, discounted: true, regularValue: 7.89 });
});
