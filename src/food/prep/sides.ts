import type { Recipe } from '../recipes/catalog';
import type { IngredientId } from '../recipes/ingredients';
import type { Macros } from '../recipes/macros';
import { resolveRecipe, type Basket, type Candidates } from '../recipes/resolve';
import type { SlotKind } from './types';

/**
 * What goes next to a protein-forward recipe to make it a meal of the person's day: rice or
 * potatoes in a box, a roll with a savoury supper, a banana with a sweet breakfast, oil or avocado
 * for the fat a keto day needs. All are staples or pantry goods, so a side never changes where the
 * plan is bought.
 */
export type SideId = 'rice' | 'potato' | 'roll' | 'banana' | 'oil' | 'avocado' | 'nuts';

export interface SideDef {
  id: SideId;
  ingredient: IngredientId;
  kind: 'carb' | 'fat';
  /** Grams per step: one thing a person can measure without a scale. */
  step: number;
  /** The most steps next to one meal. */
  max: number;
  /** What the meal line calls it, after a plus: "ryż", "bułka". */
  name: string;
  /** The amount in words: "75 g ryżu (suchego)", "2 bułki". */
  amount: (steps: number) => string;
}

function oilAmount(n: number): string {
  return ['1 łyżeczka oliwy', '1 łyżka oliwy', '1½ łyżki oliwy', '2 łyżki oliwy'][n - 1] ?? `${n * 5} g oliwy`;
}

export const SIDES: Record<SideId, SideDef> = {
  rice: {
    id: 'rice',
    ingredient: 'rice',
    kind: 'carb',
    step: 25,
    max: 4,
    name: 'ryż',
    amount: (n) => `${n * 25} g ryżu (suchego)`,
  },
  potato: {
    id: 'potato',
    ingredient: 'potato',
    kind: 'carb',
    step: 100,
    max: 4,
    name: 'ziemniaki',
    amount: (n) => `${n * 100} g ziemniaków`,
  },
  roll: {
    id: 'roll',
    ingredient: 'roll',
    kind: 'carb',
    step: 60,
    max: 2,
    name: 'bułka',
    amount: (n) => (n === 1 ? '1 bułka' : `${n} bułki`),
  },
  banana: { id: 'banana', ingredient: 'banana', kind: 'carb', step: 120, max: 1, name: 'banan', amount: () => '1 banan' },
  oil: {
    id: 'oil',
    ingredient: 'oil',
    kind: 'fat',
    step: 5,
    max: 2,
    name: 'oliwa',
    amount: oilAmount,
  },
  avocado: {
    id: 'avocado',
    ingredient: 'avocado',
    kind: 'fat',
    step: 70,
    max: 2,
    name: 'awokado',
    amount: (n) => (n === 1 ? '½ awokado' : '1 awokado'),
  },
  nuts: {
    id: 'nuts',
    ingredient: 'nuts',
    kind: 'fat',
    step: 15,
    max: 2,
    name: 'orzechy',
    amount: (n) => (n === 1 ? '15 g orzechów (mała garść)' : '30 g orzechów (garść)'),
  },
};

/**
 * Oil under a carb limit: up to two tablespoons on a keto day's eggs or salad - the fat the protein
 * recipes leave out. Otherwise a tablespoon is enough.
 */
export const KETO_OIL: SideDef = { ...SIDES.oil, max: 4 };

/** What a recipe brings by itself, for choosing its sides. */
export interface SideContext {
  slot: SlotKind;
  box: boolean;
  savoury: boolean;
  /** Has a starch of its own: no rice next to pasta. */
  starch: boolean;
  /** The recipe's own starch when it is one a side can add more of (the curry's rice, the pyry's potatoes). */
  ownStarch: SideId | null;
  /** A Polish classic: potatoes, not rice, next to it. */
  classic: boolean;
  /** Portion locked (a gotowiec, a bar): eaten as bought, no sides. */
  fixed: boolean;
  /** The style caps carbohydrates (keto, low carb): its energy has to come from fat, nuts included. */
  carbLimited: boolean;
}

/**
 * The sides a meal may get, by the meal and the dish: a box gets rice or potatoes and oil, a
 * savoury breakfast or supper a roll, avocado and oil (and nuts under a carb limit), a sweet one a
 * banana and nuts, a savoury snack nuts. A dish with a starch of its own gets more of that starch (more rice in the curry's
 * box), or none (no rice next to pasta). Each starts at zero: the portions decide whether a day
 * needs it.
 */
export function sidesFor(c: SideContext): SideDef[] {
  if (c.fixed) return [];
  const carb = (usual: SideDef): SideDef[] => (!c.starch ? [usual] : c.ownStarch ? [SIDES[c.ownStarch]] : []);
  const oil = c.carbLimited ? KETO_OIL : SIDES.oil;
  if (c.slot === 'lunch' || (c.slot === 'dinner' && c.box)) return [...carb(c.classic ? SIDES.potato : SIDES.rice), oil];
  if (c.savoury && c.slot !== 'snack')
    return [...carb(SIDES.roll), SIDES.avocado, oil, ...(c.carbLimited ? [SIDES.nuts] : [])];
  // A banana goes with oats or a cake too: it is fruit, not a second starch.
  if (!c.savoury) return [SIDES.banana, SIDES.nuts];
  return [SIDES.nuts];
}

/** A side as a recipe of one ingredient, so it is bought by exactly the rules recipes are. */
function asRecipe(def: SideDef, grams: number): Recipe {
  return {
    id: `side-${def.id}`,
    name: def.name,
    kind: 'mix',
    minutes: 0,
    tool: '',
    description: '',
    items: [{ ingredient: def.ingredient, grams }],
    steps: [],
  };
}

export interface ResolvedSide {
  def: SideDef;
  /** Per step, with the product the basket's rules choose (typical values without one). */
  perStep: Macros;
}

/** The side's macros per step in this basket: the physical shop's product, or typical values. */
export function resolveSide(def: SideDef, candidates: Candidates, basket: Basket): ResolvedSide {
  const item = resolveRecipe(asRecipe(def, def.step), candidates, basket).items[0]!;
  return { def, perStep: item.macros };
}

/** The macros of `steps` steps. */
export function sideMacros(side: ResolvedSide, steps: number): Macros {
  const m = side.perStep;
  const r = (n: number) => Math.round(n * steps * 100) / 100;
  return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) };
}

/** The side recipe, for the shopping list: the same resolution as `resolveSide`. */
export const sideRecipe = asRecipe;
