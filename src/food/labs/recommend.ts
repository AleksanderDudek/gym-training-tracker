import { RECIPES, servingsOf, type Recipe } from '../recipes/catalog';
import nutrients from './data/nutrients.json';
import { LAB_FOODS, type FoodGroup, type LabFood } from './foods';
import { normFor, type NutrientKey } from './norms';
import type { Eats } from './types';

/**
 * Foods and recipes for a nutrient: what one portion gives, against the person's daily norm.
 * Ranked per portion, not per 100 g — 100 g of cocoa is not a thing anyone eats, a portion of
 * lentils is.
 */

type Row = Partial<Record<NutrientKey, number | null>>;
const PER_100 = nutrients.foods as Record<string, Row>;

export interface Person {
  sex: 'M' | 'K';
  age: number | null;
  pregnancy: boolean;
  eats: Eats;
}

export interface FoodPick {
  food: LabFood;
  /** In the nutrient's unit, per portion. */
  amount: number;
  /** Of the daily norm, 0–n; null without a norm. */
  share: number | null;
}

/** Spices, juices, powders: in the table for recipes, never proposed as a food to eat more of. */
const NOT_PROPOSED = new Set([
  'cinnamon',
  'curry',
  'paprika',
  'potatoStarch',
  'espresso',
  'gelatin',
  'wheyProtein',
  'lemonJuice',
  'chives',
  'dill',
  'garlic',
  'peanutFlour',
  'flour',
  'butter',
  'eggYolk',
  'eggWhite',
]);

const MEAT: readonly FoodGroup[] = ['fish', 'meat', 'organ', 'poultry'];
const ANIMAL: readonly FoodGroup[] = [...MEAT, 'eggs', 'dairy'];
const ANIMAL_IDS = new Set(['gelatin', 'wheyProtein', 'butter']);

export function fitsEats(food: LabFood, eats: Eats): boolean {
  if (eats === 'vege') return !MEAT.includes(food.group) && food.id !== 'gelatin';
  if (eats === 'vegan') return !ANIMAL.includes(food.group) && !ANIMAL_IDS.has(food.id);
  return true;
}

export function amountIn(food: LabFood, key: NutrientKey, grams = food.portion.g): number | null {
  const v = PER_100[food.id]?.[key];
  return v === null || v === undefined ? null : (v * grams) / 100;
}

export interface FoodOptions {
  /** Offal is left out: high uric acid, pregnancy (vitamin A). */
  noOrgan?: boolean;
  /** At most this many from one group, so the list is not five fish. */
  perGroup?: number;
  limit?: number;
}

export function topFoods(key: NutrientKey, person: Person, options: FoodOptions = {}): FoodPick[] {
  const { noOrgan = false, perGroup = 2, limit = 8 } = options;
  const norm = normFor(key, person);
  const ranked = LAB_FOODS.filter((f) => !NOT_PROPOSED.has(f.id) && fitsEats(f, person.eats) && !(noOrgan && f.organ))
    .map((food) => ({ food, amount: amountIn(food, key) }))
    .filter((p): p is { food: LabFood; amount: number } => p.amount !== null && p.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const counts = new Map<FoodGroup, number>();
  const out: FoodPick[] = [];
  for (const p of ranked) {
    const n = counts.get(p.food.group) ?? 0;
    if (n >= perGroup) continue;
    counts.set(p.food.group, n + 1);
    out.push({ ...p, share: norm ? p.amount / norm.amount : null });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * A day's example that reaches the norm: the richest foods, one per group, until the norm is met
 * or four foods are on the list. Not a menu — a picture of how much food the norm is.
 */
export function exampleDay(key: NutrientKey, person: Person, options: FoodOptions = {}): { items: FoodPick[]; total: number; share: number | null } {
  const norm = normFor(key, person);
  const picks = topFoods(key, person, { ...options, perGroup: 1, limit: 12 });
  const items: FoodPick[] = [];
  let total = 0;
  for (const p of picks) {
    if (items.length >= 4 || (norm && total >= norm.amount)) break;
    items.push(p);
    total += p.amount;
  }
  return { items, total, share: norm ? total / norm.amount : null };
}

/** Food of each recipe ingredient that has one: the ingredient borrows its micronutrients. */
const BY_INGREDIENT = new Map<string, LabFood>(LAB_FOODS.flatMap((f) => (f.ingredient ?? []).map((i) => [i, f] as const)));

export interface RecipePick {
  recipe: Recipe;
  /** Per serving; a lower bound when some ingredients have no data (`partial`). */
  amount: number;
  share: number | null;
  partial: boolean;
}

/** One serving of a recipe, in a nutrient. Unknown ingredients add nothing and mark it partial. */
export function recipeAmount(recipe: Recipe, key: NutrientKey): { amount: number; partial: boolean } {
  let total = 0;
  let partial = false;
  for (const item of recipe.items) {
    const food = BY_INGREDIENT.get(item.ingredient);
    const v = food ? amountIn(food, key, item.grams) : null;
    if (v === null) partial ||= item.ingredient !== 'water' && item.ingredient !== 'saltPepper';
    else total += v;
  }
  return { amount: total / servingsOf(recipe), partial };
}

/** Unmapped ready products that are usually made with milk protein, cheese or egg. */
const MADE_WITH_DAIRY_OR_EGG = new Set(['proteinBar', 'proteinPancakeMix', 'mugCake', 'proteinCrisps', 'proteinBread', 'ketoPizzaBase', 'ketoTortilla', 'ketoPasta', 'proteinDrink']);

/** Recipes animal-free enough for the person: an ingredient mapped to an excluded food rules it out. */
function recipeFits(recipe: Recipe, person: Person, noOrgan: boolean): boolean {
  return recipe.items.every((item) => {
    const food = BY_INGREDIENT.get(item.ingredient);
    if (!food) return person.eats !== 'vegan' || !MADE_WITH_DAIRY_OR_EGG.has(item.ingredient);
    return fitsEats(food, person.eats) && !(noOrgan && food.organ);
  });
}

/** Recipes that give at least `min` of the norm per serving, richest first. */
export function topRecipes(key: NutrientKey, person: Person, options: { noOrgan?: boolean; limit?: number; min?: number } = {}): RecipePick[] {
  const { noOrgan = false, limit = 3, min = 0.15 } = options;
  const norm = normFor(key, person);
  return RECIPES.filter((r) => r.kind !== 'gotowiec' && recipeFits(r, person, noOrgan))
    .map((recipe) => {
      const { amount, partial } = recipeAmount(recipe, key);
      return { recipe, amount, partial, share: norm ? amount / norm.amount : null };
    })
    .filter((p) => p.amount > 0 && (p.share === null || p.share >= min))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
