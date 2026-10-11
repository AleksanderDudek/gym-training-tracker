import { TOGGLE_KEYS, buildPredicates, toggleTest, type Dimension, type Filters, type ToggleKey } from './filters';
import type { IndexedProduct } from './types';

export type Counts = Record<string, number>;

export interface Facets {
  nutriscore: Counts;
  nova: Counts;
  ecoscore: Counts;
  labels: Counts;
  categories: Counts;
  brands: Counts;
  stores: Counts;
  /** How many results there would be with each toggle switched on. */
  toggles: Record<ToggleKey, number>;
}

export interface BrowseResult {
  results: IndexedProduct[];
  facets: Facets;
}

// OR groups count "disjunctively": against every other filter but not their
// own, so ticking Nutri-Score A does not make B read zero. Labels are AND, so
// their counts come from the current results like everything else.
const DISJUNCTIVE = ['nutriscore', 'nova', 'ecoscore', 'categories', 'brands', 'stores'] as const;
type DisjunctiveKey = (typeof DISJUNCTIVE)[number];

function bump(counts: Counts, key: string | number | null): void {
  if (key === null) return;
  counts[key] = (counts[key] ?? 0) + 1;
}

function countGroup(facets: Facets, group: DisjunctiveKey | 'labels', p: IndexedProduct): void {
  switch (group) {
    case 'nutriscore':
    case 'nova':
    case 'ecoscore':
      bump(facets[group], p[group]);
      return;
    case 'labels':
    case 'categories':
    case 'brands':
    case 'stores':
      for (const value of p[group]) bump(facets[group], value);
  }
}

function emptyFacets(): Facets {
  return {
    nutriscore: {},
    nova: {},
    ecoscore: {},
    labels: {},
    categories: {},
    brands: {},
    stores: {},
    toggles: Object.fromEntries(TOGGLE_KEYS.map((k) => [k, 0])) as Record<ToggleKey, number>,
  };
}

/**
 * Filters and counts in ONE pass. Each product is tested against every active
 * predicate (stopping at the second failure): passing all makes it a result
 * and counts it everywhere; failing exactly one disjunctive group counts it in
 * that group alone. That is the whole of disjunctive faceting, without
 * re-filtering the list once per group.
 */
export function browse(products: IndexedProduct[], filters: Filters): BrowseResult {
  const predicates = buildPredicates(filters);
  const results: IndexedProduct[] = [];
  const facets = emptyFacets();

  for (const p of products) {
    let failures = 0;
    let failedDim: Dimension | null = null;
    for (const predicate of predicates) {
      if (!predicate.test(p)) {
        failures++;
        failedDim = predicate.dim;
        if (failures > 1) break;
      }
    }

    if (failures === 0) {
      results.push(p);
      for (const group of DISJUNCTIVE) countGroup(facets, group, p);
      countGroup(facets, 'labels', p);
      for (const key of TOGGLE_KEYS) if (toggleTest(key, p)) facets.toggles[key]++;
    } else if (failures === 1 && (DISJUNCTIVE as readonly string[]).includes(failedDim!)) {
      countGroup(facets, failedDim as DisjunctiveKey, p);
    }
  }

  return { results, facets };
}
