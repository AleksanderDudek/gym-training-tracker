import type { Price } from '../../../src/food/lib/types';

/** The subset of an Open Prices `/api/v1/prices` item this module reads. */
export interface OpenPriceItem {
  id: number;
  product_code: string | null;
  price: number;
  currency: string;
  date: string;
  price_per: string | null;
  price_is_discounted: boolean;
  price_without_discount: number | null;
  duplicate_of: number | null;
  location: {
    osm_name: string | null;
    osm_brand: string | null;
    osm_address_city: string | null;
  } | null;
}

const isPerKg = (item: OpenPriceItem) => item.price_per === 'KILOGRAM';

/**
 * Whether `a` should replace `b` as the product's price. A price per item
 * beats any price per kg, however recent: the app compares prices as one
 * number, and 40 zł/kg beside 8.99 zł a pack is not a comparison. Within one
 * kind, the newer report wins.
 */
function isPreferred(a: OpenPriceItem, b: OpenPriceItem): boolean {
  if (isPerKg(a) !== isPerKg(b)) return !isPerKg(a);
  return a.date !== b.date ? a.date > b.date : a.id > b.id;
}

/** One PLN price per product code (see isPreferred), with how many reports it has. */
export function latestPricesByCode(items: OpenPriceItem[]): Map<string, Price> {
  const newest = new Map<string, OpenPriceItem>();
  const counts = new Map<string, number>();

  for (const item of items) {
    // A price with no product code is for loose produce priced by category.
    const code = item.product_code?.trim();
    if (!code || item.currency !== 'PLN' || item.duplicate_of !== null) continue;
    if (!Number.isFinite(item.price) || item.price <= 0) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
    const current = newest.get(code);
    if (!current || isPreferred(item, current)) newest.set(code, item);
  }

  const prices = new Map<string, Price>();
  for (const [code, item] of newest) {
    prices.set(code, {
      value: item.price,
      currency: 'PLN',
      date: item.date,
      store: item.location?.osm_brand || item.location?.osm_name || null,
      city: item.location?.osm_address_city || null,
      perKg: isPerKg(item),
      discounted: item.price_is_discounted,
      regularValue: item.price_is_discounted ? item.price_without_discount : null,
      count: counts.get(code) ?? 1,
    });
  }
  return prices;
}
