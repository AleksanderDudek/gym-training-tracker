import type { DictionaryName, Dictionaries, Product } from './types';

/** Keys -> display names through one dictionary, unknown keys shown as is. */
export function names(dict: Dictionaries, name: DictionaryName, keys: string[]): string[] {
  return keys.map((key) => dict[name][key] ?? key);
}

export function brandLine(product: Product, dict: Dictionaries): string {
  return names(dict, 'brands', product.brands).join(', ');
}

/**
 * The allergens worth offering for exclusion: the ones that actually occur,
 * most common first. Rare free-text tags (`pl:orzechy-laskowe-z-…`) are left
 * out; the EU's fourteen all clear the bar many times over.
 */
export function allergenOptions(products: Product[], minCount = 20, limit = 20): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    for (const tag of new Set([...p.allergens, ...p.traces])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .filter(([tag, n]) => n >= minCount && tag.startsWith('en:') && tag !== 'en:none')
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
