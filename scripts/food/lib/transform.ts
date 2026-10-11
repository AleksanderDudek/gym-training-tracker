import { compactImagePath } from '../../../src/food/lib/images';
import { decodeEntities, foldDiacritics, humanizeTag } from '../../../src/food/lib/text';
import {
  ECO_GRADES,
  NOVA_GROUPS,
  NUTRI_GRADES,
  type EcoGrade,
  type NovaGroup,
  type NutriGrade,
  type Nutrition,
  type PalmOil,
  type Product,
  type Tri,
} from '../../../src/food/lib/types';
import { parseStores, storeKey, storesFromBrands } from './stores';

/** Every column this module reads. The rest of the 211 are ignored. */
export const USED_COLUMNS = [
  'code',
  'product_name',
  'generic_name',
  'quantity',
  'serving_size',
  'brands',
  'brands_tags',
  'categories_tags',
  'main_category',
  'image_url',
  'image_ingredients_url',
  'image_nutrition_url',
  'energy-kcal_100g',
  'energy-kj_100g',
  'energy_100g',
  'fat_100g',
  'saturated-fat_100g',
  'carbohydrates_100g',
  'sugars_100g',
  'fiber_100g',
  'proteins_100g',
  'salt_100g',
  'nutriscore_grade',
  'nova_group',
  'environmental_score_grade',
  'ingredients_analysis_tags',
  'labels_tags',
  'allergens',
  'traces_tags',
  'additives_tags',
  'additives_n',
  'ingredients_text',
  'stores',
  'unique_scans_n',
] as const;

export type SkipReason = 'no-code' | 'no-name';

export type TransformResult =
  | {
      ok: true;
      product: Product;
      /** [brand key, display name] pairs seen on this row. */
      brandLabels: [string, string][];
      /** [store key, display name] pairs seen on this row. */
      storeLabels: [string, string][];
    }
  | { ok: false; reason: SkipReason };

// Crowd-sourced numbers include typos: a 3000 kcal yoghurt is not a product.
const MAX_GRAMS = 100;
const MAX_KCAL = 900;
const KJ_PER_KCAL = 4.184;

function text(value: string | undefined): string | null {
  const cleaned = decodeEntities(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function number(value: string | undefined, max: number): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}

function count(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function oneOf<T extends string | number>(allowed: readonly T[], value: T): T | null {
  return allowed.includes(value) ? value : null;
}

function kcal(row: Record<string, string>): number | null {
  const stated = number(row['energy-kcal_100g'], MAX_KCAL);
  if (stated !== null) return stated;
  const kj =
    number(row['energy-kj_100g'], MAX_KCAL * KJ_PER_KCAL) ?? number(row['energy_100g'], MAX_KCAL * KJ_PER_KCAL);
  return kj === null ? null : Math.round(kj / KJ_PER_KCAL);
}

function nutrition(row: Record<string, string>): Nutrition {
  return {
    kcal: kcal(row),
    fat: number(row['fat_100g'], MAX_GRAMS),
    saturatedFat: number(row['saturated-fat_100g'], MAX_GRAMS),
    carbs: number(row['carbohydrates_100g'], MAX_GRAMS),
    sugars: number(row['sugars_100g'], MAX_GRAMS),
    fiber: number(row['fiber_100g'], MAX_GRAMS),
    protein: number(row['proteins_100g'], MAX_GRAMS),
    salt: number(row['salt_100g'], MAX_GRAMS),
  };
}

function tri(tags: Set<string>, yes: string, no: string, maybe: string): Tri {
  if (tags.has(yes)) return 'yes';
  if (tags.has(no)) return 'no';
  if (tags.has(maybe)) return 'maybe';
  return null;
}

function diet(analysis: string[], labels: string[]) {
  const tags = new Set(analysis);
  let vegan = tri(tags, 'en:vegan', 'en:non-vegan', 'en:maybe-vegan');
  let vegetarian = tri(tags, 'en:vegetarian', 'en:non-vegetarian', 'en:maybe-vegetarian');
  // A certification label is stronger evidence than the ingredient analysis,
  // which often cannot tell; and anything vegan is vegetarian.
  if (labels.includes('en:vegan')) vegan = 'yes';
  if (labels.includes('en:vegetarian')) vegetarian = 'yes';
  if (vegan === 'yes') vegetarian = 'yes';

  let palmOil: PalmOil = null;
  if (tags.has('en:palm-oil-free')) palmOil = 'free';
  else if (tags.has('en:palm-oil')) palmOil = 'contains';
  else if (tags.has('en:may-contain-palm-oil')) palmOil = 'maybe';

  return { vegan, vegetarian, palmOil };
}

/**
 * Open Food Facts writes one brand as `xx:tarczyński`, `tarczyński` and
 * `xx:tarczynski` (526 brands were split like that), so the key drops the
 * language prefix and the diacritics. The display name is chosen later, from
 * the spellings actually seen.
 */
export function brandKey(tag: string): string {
  return foldDiacritics(tag.replace(/^[a-z]{2,3}:/, '').toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function brands(row: Record<string, string>): [string, string][] {
  const tags = list(row['brands_tags']);
  const names = (row['brands'] ?? '').split(',').map((name) => text(name));
  const pairs = new Map<string, string>();
  tags.forEach((tag, i) => {
    const key = brandKey(tag);
    // brands and brands_tags are parallel lists; when they are not, the tag is
    // still a usable name.
    if (key && !pairs.has(key)) pairs.set(key, names[i] ?? humanizeTag(tag));
  });
  return [...pairs];
}

export function rowToProduct(row: Record<string, string>): TransformResult {
  const code = row['code']?.trim();
  if (!code) return { ok: false, reason: 'no-code' };
  const name = text(row['product_name']);
  if (!name) return { ok: false, reason: 'no-name' };

  const labels = list(row['labels_tags']);
  const brandLabels = brands(row);
  // What contributors typed first, then the chain a private-label brand
  // implies: 83% of products have no store at all, and a recipe that must be
  // bought in one shop cannot be planned on that.
  const stores = parseStores(decodeEntities(row['stores'] ?? ''));
  for (const chain of storesFromBrands(brandLabels.map(([key]) => key))) {
    const store = storeKey(chain);
    if (store && !stores.some((s) => s.key === store.key)) stores.push(store);
  }

  const product: Product = {
    code,
    name,
    genericName: text(row['generic_name']),
    brands: brandLabels.map(([key]) => key),
    quantity: text(row['quantity']),
    servingSize: text(row['serving_size']),
    images: {
      front: compactImagePath(row['image_url']),
      ingredients: compactImagePath(row['image_ingredients_url']),
      nutrition: compactImagePath(row['image_nutrition_url']),
    },
    categories: list(row['categories_tags']),
    mainCategory: row['main_category']?.trim() || null,
    nutrition: nutrition(row),
    nutriscore: oneOf<NutriGrade>(NUTRI_GRADES, row['nutriscore_grade']?.trim() as NutriGrade),
    nova: oneOf<NovaGroup>(NOVA_GROUPS, Number(row['nova_group']) as NovaGroup),
    ecoscore: oneOf<EcoGrade>(ECO_GRADES, row['environmental_score_grade']?.trim() as EcoGrade),
    ...diet(list(row['ingredients_analysis_tags']), labels),
    labels,
    allergens: list(row['allergens']),
    traces: list(row['traces_tags']),
    additives: list(row['additives_tags']),
    additivesCount: count(row['additives_n']),
    ingredientsText: text(row['ingredients_text']),
    stores: stores.map((s) => s.key),
    popularity: count(row['unique_scans_n']),
    price: null,
  };

  return {
    ok: true,
    product,
    brandLabels,
    storeLabels: stores.map((s) => [s.key, s.label]),
  };
}
