import type { DietProfileId } from '../diet/types';
import type { MacroTargets } from '../diet/profiles';
import type { IngredientRole } from '../recipes/ingredients';
import type { Macros } from '../recipes/macros';
import type { CheckIn } from './checkin';

/**
 * Meal prep: food for the next days of ONE person, cooked ahead in blocks and bought in one
 * physical shop (plus at most one online shop), with a shopping list per shop. A plan is stored as
 * a snapshot - the list is used in a shop, offline, without the product base, and a rebuilt base
 * must not change what was bought.
 */

/** What a meal is for: its recipes and its size. */
export type SlotKind = 'breakfast' | 'snack' | 'lunch' | 'dinner';

export interface Slot {
  name: string;
  kind: SlotKind;
  /** Share of the day's energy. */
  share: number;
}

/**
 * Who chooses the recipe of a meal. Rotation roles alternate by day (two breakfasts, two snacks,
 * up to three fresh suppers); box roles have one recipe per cooking block, cooked on its first day.
 */
export type Role = 'breakfast' | 'snack' | 'lunch' | 'dinner' | 'lunchBox' | 'dinnerBox';

export const BOX_ROLES = ['lunchBox', 'dinnerBox'] as const satisfies readonly Role[];
export type BoxRole = (typeof BOX_ROLES)[number];
export const isBoxRole = (role: Role): role is BoxRole => role === 'lunchBox' || role === 'dinnerBox';

/** Recipe ids per role: rotation roles in the order they alternate, box roles one per block. */
export type Choices = Partial<Record<Role, string[]>>;

/** `lunch`: obiad from a box, a fresh supper; `both`: obiad and kolacja from boxes. */
export type Cooking = 'lunch' | 'both';

export type Exclusion = 'meat' | 'fish' | 'eggs';

export interface PrepSettings {
  /** YYYY-MM-DD, the first day (the shopping day). */
  start: string;
  /** 5–14. */
  days: number;
  meals: 3 | 4 | 5;
  cooking: Cooking;
  /** The physical shop. */
  store: string;
  /** At most one online shop. */
  online: string | null;
  exclude: Exclusion[];
  /** Which of the good plans: another seed, another plan. */
  seed: number;
  /** Recipes swapped out of this plan, never brought back by a later swap. */
  avoid: string[];
}

export interface PrepShop {
  key: string;
  name: string;
  online: boolean;
  /** The online shop's home page. */
  url: string | null;
}

/** The goal the plan was made for: what the diary's goal was, or what the check-in made it. */
export interface PrepGoal {
  /** Daily kcal before the week's balance. */
  kcal: number;
  source: 'profile' | 'checkin';
  dietProfile: DietProfileId;
  styleLabel: string;
  /** kg a week at that goal and weight; positive is losing. */
  pace: number;
  weightKg: number;
}

/** A staple next to a recipe: rice in the box, a roll with the supper, oil on the salad. */
export interface PrepSide {
  ingredient: string;
  label: string;
  grams: number;
  /** "75 g", "1 bułka", "½ awokado". */
  amount: string;
  nutrients: Macros;
}

export interface PrepMeal {
  date: string;
  /** Index into the plan's slots. */
  slot: number;
  slotName: string;
  role: Role;
  recipeId: string;
  name: string;
  /** Servings of the recipe. */
  portion: number;
  /** Index into the plan's batches when the meal is a box. */
  box: number | null;
  sides: PrepSide[];
  /** The recipe part: portion × one serving, with the basket's products. */
  recipe: Macros;
  /** Recipe and sides: what is logged when it is eaten. */
  total: Macros;
}

/** One dish cooked on a cooking day and divided into equal boxes. */
export interface PrepBatch {
  date: string;
  role: BoxRole;
  recipeId: string;
  name: string;
  /** Servings cooked in all. */
  servings: number;
  /** Servings over the recipe's own servings: what every amount is multiplied by. */
  factor: number;
  /** Servings in each box. */
  portion: number;
  boxes: { date: string; slotName: string }[];
  /** What goes into each box next to the dish. */
  sides: PrepSide[];
  /** The recipe's ingredients at this size. */
  ingredients: { label: string; grams: number }[];
}

export type Aisle = 'warzywa' | 'pieczywo' | 'nabial' | 'mieso' | 'mrozonki' | 'suche' | 'inne';

/** Where a line is bought: on the visit to the physical shop, in the online order, or from home. */
export type ShoppingGroup = 'visit' | 'order' | 'home';

export interface ShoppingProduct {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  /** The online shop's product page. */
  url: string | null;
}

export interface ShoppingItem {
  /** Unique within the plan: the ingredient id. */
  key: string;
  ingredient: string;
  label: string;
  role: IngredientRole;
  /** The basket shop it is bought in; null when no product of it is known there. */
  shop: string | null;
  group: ShoppingGroup;
  aisle: Aisle;
  /** Needed by the plan. */
  grams: number;
  product: ShoppingProduct | null;
  /** Packs of the product, when its pack size is known. */
  packs: number | null;
  packGrams: number | null;
  /** Pieces of a countable staple: eggs, bananas, onions. */
  pieces: number | null;
  /** PLN for the packs (or the grams, when sold by weight), when a price is known. */
  price: number | null;
  /** Raw meat or fish needed from the third day: frozen after shopping. */
  freeze: { date: string; grams: number }[];
}

export interface PrepPlan {
  id?: number;
  /** ISO time. */
  createdAt: string;
  settings: PrepSettings;
  /** The basket, the physical shop first. */
  shops: PrepShop[];
  goal: PrepGoal;
  checkIn: CheckIn | null;
  dayTargets: { date: string; targets: MacroTargets }[];
  slots: Slot[];
  choices: Choices;
  meals: PrepMeal[];
  batches: PrepBatch[];
  shopping: ShoppingItem[];
  /** Keys of the shopping lines already bought. */
  bought: string[];
}

export const MIN_DAYS = 5;
export const MAX_DAYS = 14;
