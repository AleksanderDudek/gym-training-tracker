// The data contract of the online shops: one JSON file per shop in ./data, collected from the
// shop's own product pages (see README, "Jedzenie"). Nutrition is PER 100 g (or 100 ml).

export const SHOP_CATEGORIES = [
  'bialko',
  'batony',
  'napoje',
  'slodycze',
  'smarowidla',
  'sosy',
  'makaron',
  'maki',
  'pieczywo',
  'sniadania',
  'przekaski',
  'zamienniki-miesa',
  'dania',
  'orzechy',
  'kakao',
  'kokos',
  'nabial',
  'inne',
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export interface ShopNutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  fiber: number | null;
  saturatedFat: number | null;
  salt: number | null;
}

export interface ShopProductData {
  name: string;
  brand: string;
  /** The product page, https. */
  url: string;
  /** Pack size as written: "1 kg", "12 x 45 g". */
  quantity: string | null;
  category: ShopCategory;
  nutrition: ShopNutrition;
  /** Per-100 g values computed from per-serving ones. */
  computed?: true;
  /** Regular price in PLN when checked. */
  price: number | null;
  vegan: boolean | null;
  /** EAN-13 / GTIN-8, digits only, when the shop publishes it. */
  ean: string | null;
}

export interface ShopData {
  id: string;
  name: string;
  url: string;
  /** YYYY-MM-DD */
  checked: string;
  note?: string;
  /** Products whose numbers the shop's own page gets wrong (checked), kept as published. */
  inconsistent?: string[];
  products: ShopProductData[];
}
