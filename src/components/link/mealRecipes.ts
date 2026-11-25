import type { PlannedMeal } from '@gymtracker/link';
import { hashWith } from '../../food/hash';
import { RECIPES, servingsOf } from '../../food/recipes/catalog';
import type { Recipe } from '../../food/recipes/catalog';
import { INGREDIENTS } from '../../food/recipes/ingredients';
import type { IngredientId, IngredientRole } from '../../food/recipes/ingredients';
import { DEFAULT_RECIPES_STATE, recipesToParams } from '../../food/recipes/url';
import { RECIPES_PATH } from '../../routing';

/**
 * Przepisy z katalogu dla jadłospisu od prowadzącego — wczytywane dopiero, gdy jadłospis ma
 * jakiś przepis (`import()` w `MealsDay.tsx`), żeby katalog nie ciążył paczce współpracy.
 *
 * Lista zakupów to składniki przepisów zsumowane na porcje z jadłospisu, bez bazy produktów:
 * nazwy i gramy, nie konkretne opakowania ze sklepu (to robi „Plan z zakupami” w Jedzeniu).
 */

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

export const recipeOf = (id: string | null): Recipe | undefined => (id ? BY_ID.get(id) : undefined);

/** Przepis otwarty w zakładce Przepisy (przewinięty do karty). */
export const recipeHref = (id: string): string => hashWith(RECIPES_PATH, recipesToParams({ ...DEFAULT_RECIPES_STATE, recipe: id }));

export const ingredientLabel = (id: IngredientId): string => INGREDIENTS[id]?.label ?? id;

/** Składnik na jedną porcję (posiłek z jadłospisu to jedna porcja przepisu). */
export interface PortionItem {
  id: IngredientId;
  label: string;
  grams: number;
  /** Miara domowa z katalogu — tylko gdy przepis jest na jedną porcję (inaczej miara całości myli). */
  measure: string | null;
}

export function portion(recipe: Recipe): PortionItem[] {
  const n = servingsOf(recipe);
  return recipe.items.map((it) => ({
    id: it.ingredient,
    label: ingredientLabel(it.ingredient),
    grams: it.grams / n,
    measure: n === 1 && it.measure ? it.measure : null,
  }));
}

/** Nigdy nie do kupienia. */
const FREE: ReadonlySet<string> = new Set<IngredientId>(['water', 'ice']);

export interface ShopLine {
  id: IngredientId;
  label: string;
  grams: number;
  /** Ile opakowań, gdy przepis liczy składnik w opakowaniach (baton, butelka); inaczej `null`. */
  packs: number | null;
  role: IngredientRole;
}

export interface MealShopping {
  /** Do kupienia (sklep i podstawowe), od największej ilości. */
  buy: ShopLine[];
  /** Zwykle w domu (przyprawy, białko w proszku) — sprawdzić przed wyjściem. */
  home: ShopLine[];
  /** Posiłki bez przepisu z katalogu — kupuje się według nazwy. */
  loose: string[];
}

/** Lista zakupów z posiłków: każdy z przepisem to jedna porcja tego przepisu. */
export function shoppingFor(meals: readonly PlannedMeal[]): MealShopping {
  const lines = new Map<IngredientId, ShopLine>();
  const loose: string[] = [];
  for (const m of meals) {
    const r = recipeOf(m.recipe);
    if (!r) {
      if (!loose.includes(m.name)) loose.push(m.name);
      continue;
    }
    const n = servingsOf(r);
    for (const it of r.items) {
      if (FREE.has(it.ingredient)) continue;
      const line = lines.get(it.ingredient) ?? {
        id: it.ingredient,
        label: ingredientLabel(it.ingredient),
        grams: 0,
        packs: null,
        role: INGREDIENTS[it.ingredient]?.role ?? 'store',
      };
      line.grams += it.grams / n;
      if (it.pack) line.packs = (line.packs ?? 0) + 1 / n;
      lines.set(it.ingredient, line);
    }
  }
  const all = [...lines.values()]
    .map((l) => ({ ...l, packs: l.packs === null ? null : Math.ceil(l.packs - 1e-9) }))
    .sort((a, b) => b.grams - a.grams || a.label.localeCompare(b.label));
  return { buy: all.filter((l) => l.role !== 'pantry'), home: all.filter((l) => l.role === 'pantry'), loose };
}
