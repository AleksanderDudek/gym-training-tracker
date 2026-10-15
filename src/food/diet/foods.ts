import { brandLine } from '../lib/display';
import { packGrams } from '../lib/quantity';
import type { Dictionaries, Product } from '../lib/types';
import type { Macros } from '../recipes/macros';
import type { PlanItem } from './plan';
import type { Nutrients } from './types';

/**
 * One shape for everything that can be eaten, logged, suggested or swapped:
 * a product, a recipe serving, a line of the plan, a food of the user's own,
 * a set of the user's own, a position of a restaurant menu.
 */
export type FoodSource = 'product' | 'recipe' | 'plan' | 'custom' | 'set' | 'restaurant';

/** 'main': a meal; 'light': breakfast, snack, shake; 'addon': butter, oil - never suggested on its own. */
export type MealRole = 'main' | 'light' | 'addon';

export interface Food {
  /** Stable: "product:590…", "recipe:skyr-maliny", "plan:½ opak. Teriyaki", "custom:3", "set:2", "restaurant:kfc:strips". */
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
  /** Starred by the user („Ulubione”): first in the picker, a bonus in suggestions. */
  favorite?: true;
}

/** One pack ("150 g", "4 x 125 g", "330ml") as the portion; a family pack or an unreadable label means 100 g. */
export function portionGrams(quantity: string | null): number {
  return packGrams(quantity) ?? 100;
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

/** One part of a set, as it was chosen: a snapshot, like an eaten entry. */
export interface SetPart extends Nutrients {
  name: string;
  amountLabel: string;
  /** The food it came from: "product:590…", "restaurant:kfc:strips". */
  key?: string;
}

/**
 * A set of the user's own: "Banan + batonik", eaten together and logged in one
 * tap. Its parts are snapshots, so a rebuilt dataset (or one that fails to
 * load) never changes what the same breakfast logs.
 */
export interface FoodSet {
  id?: number;
  name: string;
  parts: SetPart[];
}

export function partOf(food: Food): SetPart {
  return { name: food.name, amountLabel: food.amountLabel, ...food.nutrients, key: food.key };
}

/** The parts added up; a macro unknown in any part is unknown in the sum (never counted as zero). */
export function setTotals(parts: SetPart[]): Nutrients {
  const add = (key: 'protein' | 'carbs' | 'fat') =>
    parts.every((p) => p[key] !== null) ? Math.round(parts.reduce((sum, p) => sum + p[key]!, 0) * 10) / 10 : null;
  return {
    kcal: Math.round(parts.reduce((sum, p) => sum + p.kcal, 0)),
    protein: add('protein'),
    carbs: add('carbs'),
    fat: add('fat'),
  };
}

const short = (name: string) => (name.length > 32 ? `${name.slice(0, 31).trimEnd()}…` : name);

/** "Banan 120 g + Baton proteinowy 45 g": what is in it, at what amount. */
export function setAmountLabel(parts: SetPart[]): string {
  return parts.map((p) => [short(p.name), p.amountLabel].filter(Boolean).join(' ')).join(' + ');
}

/** "Banan + Baton proteinowy" — the name of a set nobody named. */
export function autoSetName(parts: SetPart[]): string {
  return parts.map((p) => short(p.name.replace(/\s*\([^)]*\)$/, ''))).join(' + ');
}

export function setFood(set: FoodSet): Food {
  const nutrients = setTotals(set.parts);
  const n = set.parts.length;
  return {
    key: set.id !== undefined ? `set:${set.id}` : `set:${set.name}`,
    name: set.name,
    detail: `zestaw · ${n} ${n === 1 ? 'pozycja' : n < 5 ? 'pozycje' : 'pozycji'}`,
    source: 'set',
    amountLabel: setAmountLabel(set.parts),
    nutrients,
    per100: null,
    grams: null,
    stores: [],
    atHome: false,
    role: roleOf(nutrients, nutrients.kcal >= 350 ? 'main' : 'light'),
  };
}
