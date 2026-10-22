import { LOCALE } from '../../i18n';
import { ECO_GRADES, NUTRI_GRADES, type Product } from './types';

export const SORT_KEYS = [
  'popularity',
  'name',
  'kcal',
  'protein',
  'fat',
  'carbs',
  'sugars',
  'salt',
  'fiber',
  'price',
  'nutriscore',
  'nova',
  'ecoscore',
  'additives',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export interface Sort {
  key: SortKey;
  dir: SortDir;
}

export const DEFAULT_SORT: Sort = { key: 'popularity', dir: 'desc' };

const collator = new Intl.Collator(LOCALE, { sensitivity: 'base', numeric: true });

function sortValue(p: Product, key: Exclude<SortKey, 'name'>): number | null {
  switch (key) {
    case 'popularity':
      return p.popularity;
    case 'price':
      return p.price?.value ?? null;
    case 'additives':
      return p.additivesCount;
    case 'nutriscore':
      return p.nutriscore === null ? null : NUTRI_GRADES.indexOf(p.nutriscore);
    case 'ecoscore':
      return p.ecoscore === null ? null : ECO_GRADES.indexOf(p.ecoscore);
    case 'nova':
      return p.nova;
    default:
      return p.nutrition[key];
  }
}

function byName(a: Product, b: Product): number {
  return collator.compare(a.name, b.name) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
}

/**
 * Returns a sorted copy. Unknown values go last in BOTH directions — a
 * product with no calorie data is not the lightest one, nor the heaviest.
 * Ties break on name then code, so a page holds the same products every time.
 */
export function sortProducts<T extends Product>(products: readonly T[], sort: Sort): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  if (sort.key === 'name') return [...products].sort((a, b) => sign * byName(a, b));

  const key = sort.key;
  // Decorate once: reading the value inside the comparator would repeat the
  // switch ~n log n times on 29 000 products.
  const decorated = products.map((p) => ({ p, v: sortValue(p, key) }));
  decorated.sort((a, b) => {
    if (a.v === null || b.v === null) {
      if (a.v === b.v) return byName(a.p, b.p);
      return a.v === null ? 1 : -1;
    }
    return sign * (a.v - b.v) || byName(a.p, b.p);
  });
  return decorated.map((d) => d.p);
}
