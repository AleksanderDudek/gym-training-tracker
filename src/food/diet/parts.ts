import { RECIPES, servingsOf, type Recipe } from '../recipes/catalog';
import { INGREDIENTS, type IngredientId } from '../recipes/ingredients';
import type { Entry } from './db';
import type { FoodSet } from './foods';

/**
 * What one diary entry was made of, as far as the app knows: a recipe serving is its ingredients
 * (grams for one serving times the servings eaten), a set is its parts, anything else is itself.
 * One rule for the shopping list from the diary and the export for a dietitian.
 *
 * Recipes are looked up in today's catalog by the entry's key — an entry is a snapshot of the
 * macros, not of the recipe, so a recipe changed since shows its current ingredients, and one
 * removed from the catalog shows as the entry itself.
 */
export interface EntryPart {
  name: string;
  /** Grams when known (an ingredient of a recipe, a product logged in grams); null otherwise. */
  grams: number | null;
  /** The amount as logged („150 g”, „1 porcja”), for parts that have no grams. */
  amountLabel: string;
  /** The food the part came from: "product:590…", "recipe:…"; absent for a quick entry. */
  key?: string;
  /** The recipe ingredient, for a part of a recipe. */
  ingredient?: IngredientId;
}

const BY_ID: ReadonlyMap<string, Recipe> = new Map(RECIPES.map((r) => [r.id, r]));

export const recipeOf = (key: string | undefined): Recipe | undefined =>
  key?.startsWith('recipe:') ? BY_ID.get(key.slice('recipe:'.length)) : undefined;

/** Grams of an amount logged in grams: „150 g”, „62,5 g”; anything else null. */
export function gramsOf(amountLabel: string): number | null {
  const g = Number(amountLabel.match(/^(\d+(?:[.,]\d+)?)\s?g$/)?.[1]?.replace(',', '.'));
  return g > 0 ? g : null;
}

/** Servings in an amount: „1 porcja”, „2 porcje”, „1,5 porcji”, „2 servings”; anything else one. */
export function servingsIn(amountLabel: string): number {
  const n = Number(amountLabel.match(/^(\d+(?:[.,]\d+)?)\s/)?.[1]?.replace(',', '.'));
  return n > 0 && n <= 20 ? n : 1;
}

const self = (e: Entry): EntryPart => ({
  name: e.name,
  grams: gramsOf(e.amountLabel),
  amountLabel: e.amountLabel,
  ...(e.key && { key: e.key }),
});

/** `sets` by id: the user's own sets as stored now (a deleted set shows as the entry itself). */
export function entryParts(e: Entry, sets: ReadonlyMap<number, FoodSet> = new Map()): EntryPart[] {
  const recipe = recipeOf(e.key);
  if (recipe) {
    const f = servingsIn(e.amountLabel) / servingsOf(recipe);
    return recipe.items.map((item) => ({
      name: INGREDIENTS[item.ingredient]?.label ?? item.ingredient,
      grams: Math.round(item.grams * f),
      amountLabel: '',
      ingredient: item.ingredient,
    }));
  }
  const setId = e.key?.startsWith('set:') ? Number(e.key.slice(4)) : NaN;
  const set = Number.isInteger(setId) ? sets.get(setId) : undefined;
  if (set?.parts.length)
    return set.parts.map((p) => ({ name: p.name, grams: gramsOf(p.amountLabel), amountLabel: p.amountLabel, ...(p.key && { key: p.key }) }));
  return [self(e)];
}
