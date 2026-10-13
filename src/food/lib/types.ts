// The data contract between scripts/prepare-data.ts (which writes it) and the
// app (which reads it). One definition, imported by both.

export const NUTRI_GRADES = ['a', 'b', 'c', 'd', 'e'] as const;
export type NutriGrade = (typeof NUTRI_GRADES)[number];

export const ECO_GRADES = ['a-plus', 'a', 'b', 'c', 'd', 'e', 'f'] as const;
export type EcoGrade = (typeof ECO_GRADES)[number];

export const NOVA_GROUPS = [1, 2, 3, 4] as const;
export type NovaGroup = (typeof NOVA_GROUPS)[number];

/** yes / no / maybe, or null when Open Food Facts could not tell. */
export type Tri = 'yes' | 'no' | 'maybe' | null;
export type PalmOil = 'free' | 'contains' | 'maybe' | null;

export const NUTRIENTS = ['kcal', 'fat', 'saturatedFat', 'carbs', 'sugars', 'fiber', 'protein', 'salt'] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

/** Per 100 g or 100 ml. null means unknown, never zero. */
export type Nutrition = Record<Nutrient, number | null>;

export interface Price {
  value: number;
  currency: 'PLN';
  /** YYYY-MM-DD */
  date: string;
  store: string | null;
  city: string | null;
  perKg: boolean;
  discounted: boolean;
  /** The undiscounted price, when a discounted one was reported. */
  regularValue: number | null;
  /** How many price reports exist for this product. */
  count: number;
}

/** Compact image paths: expand with imageUrl() from ./images.ts. */
export interface ProductImages {
  front: string | null;
  ingredients: string | null;
  nutrition: string | null;
}

/**
 * A product's page in an online shop (`src/food/online/data`): where to buy it
 * with delivery, at the shop's regular price when it was checked.
 */
export interface OnlineOffer {
  /** The shop's store key, also listed in `stores`. */
  shop: string;
  /** The product page, https. */
  url: string;
  /** PLN. */
  price: number | null;
  /** YYYY-MM-DD */
  checked: string;
}

export interface Product {
  code: string;
  name: string;
  genericName: string | null;
  /** Brand keys; display names live in Dataset.dictionaries.brands. */
  brands: string[];
  quantity: string | null;
  servingSize: string | null;
  images: ProductImages;
  /** Category tags, the full hierarchy, so a parent matches its children. */
  categories: string[];
  mainCategory: string | null;
  nutrition: Nutrition;
  nutriscore: NutriGrade | null;
  nova: NovaGroup | null;
  ecoscore: EcoGrade | null;
  vegan: Tri;
  vegetarian: Tri;
  palmOil: PalmOil;
  labels: string[];
  allergens: string[];
  traces: string[];
  additives: string[];
  additivesCount: number | null;
  ingredientsText: string | null;
  /** Store keys; display names live in Dataset.dictionaries.stores. */
  stores: string[];
  /** unique_scans_n: how many people scanned it. */
  popularity: number | null;
  price: Price | null;
  /** Online shops that sell it, with links (merged in at load time; absent in the OFF file). */
  online?: OnlineOffer[];
  /** Known only from an online shop's page, not from Open Food Facts. */
  shopOnly?: true;
  /**
   * The shop's own label disagrees with itself (energy vs macros: polyols, fibre or a slip on the
   * page). Kept as published and said in the detail, never used to plan recipes.
   */
  labelMismatch?: true;
}

export const DICTIONARY_NAMES = ['categories', 'labels', 'allergens', 'additives', 'brands', 'stores'] as const;
export type DictionaryName = (typeof DICTIONARY_NAMES)[number];
export type Dictionaries = Record<DictionaryName, Record<string, string>>;

export interface Dataset {
  generatedAt: string;
  sources: { products: string; prices: string | null; taxonomies: boolean };
  dictionaries: Dictionaries;
  products: Product[];
}

/** A product as the app holds it: with its search text precomputed once. */
export interface IndexedProduct extends Product {
  searchText: string;
}
