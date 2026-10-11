import { normalizeForSearch } from './text';
import type { IndexedProduct, Product } from './types';

/**
 * Precomputes each product's search text once, at load: name, brand names
 * (as displayed, so "piatnica" and "Piątnica" both find it) and barcode.
 */
export function indexProducts(products: Product[], brandNames: Record<string, string>): IndexedProduct[] {
  return products.map((p) => ({
    ...p,
    searchText: normalizeForSearch(
      [p.name, p.genericName ?? '', ...p.brands.map((b) => brandNames[b] ?? b), p.code].join(' '),
    ),
  }));
}

/** Every token must appear somewhere in the text. */
export function matchesQuery(searchText: string, tokens: string[]): boolean {
  return tokens.every((token) => searchText.includes(token));
}
