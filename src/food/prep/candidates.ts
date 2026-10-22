import type { DietProfile, Fit } from '../diet/profiles';
import { text } from '../lib/lang';
import { RECIPES, servingsOf, type Recipe } from '../recipes/catalog';
import { INGREDIENTS, type IngredientId } from '../recipes/ingredients';
import type { Macros } from '../recipes/macros';
import { resolveRecipe, type Basket, type Candidates } from '../recipes/resolve';
import { SIDES, type SideId } from './sides';
import type { Exclusion } from './types';

/**
 * What a person does not eat, by ingredient. Gelatine is made from animal skin and parmesan with
 * animal rennet, so a vegetarian plan ("bez mięsa") leaves them out too.
 */
export const EXCLUDED: Record<Exclusion, ReadonlySet<IngredientId>> = {
  meat: new Set<IngredientId>(['chicken', 'chickenFillet', 'turkeyMince', 'leanBeef', 'turkeyFillet', 'gelatin', 'parmesan']),
  fish: new Set<IngredientId>(['tuna', 'salmonFillet', 'whiteFish', 'shrimp', 'smokedSalmon', 'herring']),
  eggs: new Set<IngredientId>(['egg', 'eggWhites']),
};

export const EXCLUSION_LABELS: Record<Exclusion, string> = text({
  pl: {
    meat: 'Bez mięsa',
    fish: 'Bez ryb i owoców morza',
    eggs: 'Bez jajek',
  },
  en: {
    meat: 'No meat',
    fish: 'No fish or seafood',
    eggs: 'No eggs',
  },
});

/** A starch of the recipe's own: no rice or roll next to it. */
const STARCH: ReadonlySet<IngredientId> = new Set<IngredientId>([
  'rice',
  'potato',
  'oats',
  'roll',
  'lentilPasta',
  'ketoPasta',
  'konjac',
  'flour',
  'proteinBread',
  'riceCakes',
  'crispbread',
  'ketoTortilla',
  'ketoPizzaBase',
  'proteinPancakeMix',
  'mugCake',
]);

/** Starches a side can add more of, in the order they are looked for. */
const OWN_STARCH: readonly SideId[] = ['rice', 'potato', 'roll'];

/** A recipe as the planner sees it: bought in the plan's basket, judged by the person's style. */
export interface PlanRecipe {
  recipe: Recipe;
  /** One serving, with the products the basket's rules choose. */
  perServing: Macros;
  fit: Fit;
  /** A meal cooked for two or more servings: it can fill the boxes of a cooking block. */
  batch: boolean;
  /** Eaten as bought (a gotowiec) or with a whole pack in it (a bar, a bottle): always one serving. */
  fixed: boolean;
  starch: boolean;
  /** Its own starch, when a side can add more of it: rice, potatoes, a roll. */
  ownStarch: SideId | null;
  savoury: boolean;
  /** A Polish classic (it credits its Wikibooks page): potatoes go next to it, not rice. */
  classic: boolean;
  /** Ingredients that are bought (not pantry goods), for sharing packs between recipes. */
  bought: IngredientId[];
}

export interface PlanRecipesInput {
  candidates: Candidates;
  basket: Basket;
  dietProfile: DietProfile;
  exclude: readonly Exclusion[];
  recipes?: readonly Recipe[];
}

/**
 * Every recipe the plan may use: bought in full in the basket and keeping its rule there (the
 * same check as the recipe cards), nothing the person excluded, nothing their style calls
 * "nie pasuje".
 */
export function planRecipes({ candidates, basket, dietProfile, exclude, recipes = RECIPES }: PlanRecipesInput): PlanRecipe[] {
  const excluded = new Set(exclude.flatMap((e) => [...EXCLUDED[e]]));
  const out: PlanRecipe[] = [];
  for (const recipe of recipes) {
    const ingredients = recipe.items.map((i) => i.ingredient);
    if (ingredients.some((i) => excluded.has(i))) continue;
    const resolved = resolveRecipe(recipe, candidates, basket);
    if (!resolved.available || !resolved.passes) continue;
    const fit = dietProfile.fit(resolved.perServing);
    if (fit.level === 'avoid') continue;
    const savoury = recipe.kind === 'obiad' || recipe.kind === 'slone';
    out.push({
      recipe,
      perServing: resolved.perServing,
      fit,
      batch: savoury && servingsOf(recipe) >= 2,
      fixed: recipe.kind === 'gotowiec' || recipe.items.some((i) => i.pack),
      starch: ingredients.some((i) => STARCH.has(i)),
      ownStarch: OWN_STARCH.find((id) => ingredients.includes(SIDES[id].ingredient)) ?? null,
      savoury,
      classic: recipe.inspiredBy !== undefined,
      bought: [...new Set(ingredients.filter((i) => INGREDIENTS[i].role !== 'pantry'))],
    });
  }
  return out;
}
