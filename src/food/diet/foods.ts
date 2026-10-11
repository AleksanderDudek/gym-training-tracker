import { brandLine } from '../lib/display';
import type { Dictionaries, Product } from '../lib/types';
import type { Macros } from '../recipes/macros';
import type { PlanItem } from './plan';
import type { Nutrients } from './types';

/**
 * One shape for everything that can be eaten, logged, suggested or swapped:
 * a product, a recipe serving, a line of the plan, a food of the user's own.
 */
export type FoodSource = 'product' | 'recipe' | 'plan' | 'custom';

/** 'main': a meal; 'light': breakfast, snack, shake; 'addon': butter, oil - never suggested on its own. */
export type MealRole = 'main' | 'light' | 'addon';

export interface Food {
  /** Stable: "product:590…", "recipe:skyr-maliny", "plan:½ opak. Teriyaki", "custom:3". */
  key: string;
  name: string;
  detail: string;
  source: FoodSource;
  /** "150 g", "1 porcja", "½ opakowania". */
  amountLabel: string;
  /** For one amount. */
  nutrients: Nutrients;
  /** Per 100 g, when the amount can be changed in grams. */
  per100: Macros | null;
  grams: number | null;
  /** Chains that sell it (empty: unknown, or not bought in a shop). */
  stores: string[];
  /** Already at home: catering from the plan, the user's own foods. */
  atHome: boolean;
  /**
   * Made only of staples (meat, vegetables, rice): any proper shop has them,
   * so no one chain is named - the nearest Żabka is not where a chicken
   * dinner is bought.
   */
  everywhere?: boolean;
  role: MealRole;
}

/**
 * The size of one pack from "150 g", "0,5 l", "4 x 125 g" or "330ml": one
 * piece of a multipack, millilitres as grams. Anything over 600 g (a family
 * pack, a litre of milk) or unreadable means 100 g - nobody eats a kilo of
 * twaróg as "one portion".
 */
export function portionGrams(quantity: string | null): number {
  if (!quantity) return 100;
  const text = quantity.toLowerCase().replace(',', '.');
  const multi = text.match(/\d+\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|ml)\b/);
  const single = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  let grams: number | null = null;
  if (multi) grams = Number(multi[1]);
  else if (single) grams = Number(single[1]) * (single[2] === 'kg' || single[2] === 'l' ? 1000 : 1);
  return grams && grams > 0 && grams <= 600 ? Math.round(grams) : 100;
}

const scaled = (per100: Macros, grams: number): Nutrients => {
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 10) / 10;
  return { kcal: Math.round(per100.kcal * f), protein: r(per100.protein), carbs: r(per100.carbs), fat: r(per100.fat) };
};

/** A food is an add-on when nearly all its energy is fat: butter, oil, cream. */
function roleOf(n: Nutrients, fallback: MealRole): MealRole {
  if (n.fat !== null && n.kcal > 0 && (n.fat * 9) / n.kcal > 0.8) return 'addon';
  return fallback;
}

export function productFood(p: Product, dict: Dictionaries, grams = portionGrams(p.quantity)): Food | null {
  const { kcal, protein, carbs, fat } = p.nutrition;
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  const per100 = { kcal, protein, carbs, fat };
  const nutrients = scaled(per100, grams);
  return {
    key: `product:${p.code}`,
    name: p.name,
    detail: [brandLine(p, dict), p.quantity].filter(Boolean).join(' · '),
    source: 'product',
    amountLabel: `${grams} g`,
    nutrients,
    per100,
    grams,
    stores: p.stores,
    atHome: false,
    role: roleOf(nutrients, nutrients.kcal >= 350 ? 'main' : 'light'),
  };
}

/** A food at another amount in grams (only foods with per-100 g values). */
export function withGrams(food: Food, grams: number): Food {
  if (!food.per100) return food;
  return { ...food, grams, amountLabel: `${grams} g`, nutrients: scaled(food.per100, grams) };
}

export function recipeFood(
  recipe: { id: string; name: string; kind: string; minutes: number; servings?: number },
  perServing: Macros,
  stores: string[],
  everywhere = false,
): Food {
  const nutrients = {
    kcal: Math.round(perServing.kcal),
    protein: Math.round(perServing.protein * 10) / 10,
    carbs: Math.round(perServing.carbs * 10) / 10,
    fat: Math.round(perServing.fat * 10) / 10,
  };
  return {
    key: `recipe:${recipe.id}`,
    name: recipe.name,
    detail: `przepis · ${recipe.minutes} min${(recipe.servings ?? 1) > 1 ? ` · gotujesz na ${recipe.servings} porcje` : ''}`,
    source: 'recipe',
    amountLabel: '1 porcja',
    nutrients,
    per100: null,
    grams: null,
    stores: everywhere ? [] : stores,
    atHome: false,
    ...(everywhere && { everywhere: true }),
    role: recipe.kind === 'obiad' || recipe.kind === 'slone' ? 'main' : 'light',
  };
}

/** Catering from the plan is at home; what the plan says is bought (pizzas) has its shops. */
export function planFood(item: PlanItem): Food {
  const isMeal = /opak\.|pizza/i.test(item.text) || item.kcal >= 450;
  return {
    key: `plan:${item.text}`,
    name: item.text,
    detail: 'z planu',
    source: 'plan',
    amountLabel: '1 pozycja',
    nutrients: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
    per100: null,
    grams: null,
    stores: item.stores,
    atHome: item.stores.length === 0,
    role: roleOf(item, isMeal ? 'main' : 'light'),
  };
}

export interface CustomFood extends Nutrients {
  id?: number;
  name: string;
  amountLabel: string;
}

export function customFood(c: CustomFood & { id: number }): Food {
  return {
    key: `custom:${c.id}`,
    name: c.name,
    detail: 'moje',
    source: 'custom',
    amountLabel: c.amountLabel,
    nutrients: { kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat },
    per100: null,
    grams: null,
    stores: [],
    atHome: true,
    role: roleOf(c, c.kcal >= 350 ? 'main' : 'light'),
  };
}
