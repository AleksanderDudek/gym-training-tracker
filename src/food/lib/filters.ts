import { matchesQuery } from './search';
import { tokenize } from './text';
import type { EcoGrade, IndexedProduct, NovaGroup, NutriGrade, Product } from './types';

export const TOGGLE_KEYS = ['hasImage', 'hasPrice', 'hasNutrition', 'vegan', 'vegetarian', 'noPalmOil'] as const;
export type ToggleKey = (typeof TOGGLE_KEYS)[number];

export const RANGE_KEYS = ['kcal', 'protein', 'fat', 'carbs', 'sugars', 'salt', 'fiber', 'price', 'additives'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export interface Range {
  min: number | null;
  max: number | null;
}

/** Groups whose values are product arrays, chosen from a facet list. */
export const LIST_KEYS = ['labels', 'categories', 'brands', 'stores'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export interface Filters {
  q: string;
  toggles: ToggleKey[];
  nutriscore: NutriGrade[];
  nova: NovaGroup[];
  ecoscore: EcoGrade[];
  withoutAllergens: string[];
  /** AND: a product must carry every selected label. */
  labels: string[];
  /** OR within each of these three. */
  categories: string[];
  brands: string[];
  stores: string[];
  ranges: Partial<Record<RangeKey, Range>>;
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  toggles: [],
  nutriscore: [],
  nova: [],
  ecoscore: [],
  withoutAllergens: [],
  labels: [],
  categories: [],
  brands: [],
  stores: [],
  ranges: {},
};

export function rangeValue(p: Product, key: RangeKey): number | null {
  if (key === 'price') return p.price?.value ?? null;
  if (key === 'additives') return p.additivesCount;
  return p.nutrition[key];
}

export function toggleTest(key: ToggleKey, p: Product): boolean {
  switch (key) {
    case 'hasImage':
      return p.images.front !== null;
    case 'hasPrice':
      return p.price !== null;
    case 'hasNutrition': {
      const n = p.nutrition;
      return n.kcal !== null && n.protein !== null && n.fat !== null && n.carbs !== null;
    }
    case 'vegan':
      return p.vegan === 'yes';
    case 'vegetarian':
      return p.vegetarian === 'yes';
    case 'noPalmOil':
      return p.palmOil === 'free';
  }
}

export function isActiveRange(range: Range | undefined): range is Range {
  return !!range && (range.min !== null || range.max !== null);
}

/** How many distinct filters are set, for the "Filtry (3)" badge. */
export function countActiveFilters(f: Filters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.toggles.length +
    f.nutriscore.length +
    f.nova.length +
    f.ecoscore.length +
    f.withoutAllergens.length +
    f.labels.length +
    f.categories.length +
    f.brands.length +
    f.stores.length +
    Object.values(f.ranges).filter(isActiveRange).length
  );
}

/**
 * The dimension a predicate belongs to. Facet counting needs to know which
 * single dimension a product failed, so each predicate carries its own.
 */
export type Dimension =
  'q' | ToggleKey | 'nutriscore' | 'nova' | 'ecoscore' | 'allergens' | ListKey | `range:${RangeKey}`;

export interface Predicate {
  dim: Dimension;
  test: (p: IndexedProduct) => boolean;
}

function anyOf<T>(selected: readonly T[], value: T | null): boolean {
  return value !== null && selected.includes(value);
}

function intersects(selected: string[], values: string[]): boolean {
  return values.some((v) => selected.includes(v));
}

/** One predicate per ACTIVE filter; an unset filter costs nothing. */
export function buildPredicates(f: Filters): Predicate[] {
  const predicates: Predicate[] = [];

  const tokens = tokenize(f.q);
  if (tokens.length) predicates.push({ dim: 'q', test: (p) => matchesQuery(p.searchText, tokens) });

  for (const key of f.toggles) predicates.push({ dim: key, test: (p) => toggleTest(key, p) });

  if (f.nutriscore.length) predicates.push({ dim: 'nutriscore', test: (p) => anyOf(f.nutriscore, p.nutriscore) });
  if (f.nova.length) predicates.push({ dim: 'nova', test: (p) => anyOf(f.nova, p.nova) });
  if (f.ecoscore.length) predicates.push({ dim: 'ecoscore', test: (p) => anyOf(f.ecoscore, p.ecoscore) });

  if (f.withoutAllergens.length) {
    // An unknown composition is not an allergen-free one.
    predicates.push({
      dim: 'allergens',
      test: (p) =>
        p.ingredientsText !== null &&
        !intersects(f.withoutAllergens, p.allergens) &&
        !intersects(f.withoutAllergens, p.traces),
    });
  }

  if (f.labels.length) predicates.push({ dim: 'labels', test: (p) => f.labels.every((l) => p.labels.includes(l)) });
  if (f.categories.length) predicates.push({ dim: 'categories', test: (p) => intersects(f.categories, p.categories) });
  if (f.brands.length) predicates.push({ dim: 'brands', test: (p) => intersects(f.brands, p.brands) });
  if (f.stores.length) predicates.push({ dim: 'stores', test: (p) => intersects(f.stores, p.stores) });

  for (const [key, range] of Object.entries(f.ranges) as [RangeKey, Range | undefined][]) {
    if (!isActiveRange(range)) continue;
    predicates.push({
      dim: `range:${key}`,
      test: (p) => {
        // A bound cannot be checked against an unknown value.
        const value = rangeValue(p, key);
        if (value === null) return false;
        return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
      },
    });
  }

  return predicates;
}
