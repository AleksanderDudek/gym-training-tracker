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

/**
 * Oil in kitchen spoons: a teaspoon is 5 ml, a tablespoon 15 ml, and a millilitre of oil weighs
 * 0.915 g - 4.5 g and 13.5 g (USDA: 1 tbsp olive oil = 13.5 g).
 */
const TEASPOON_OIL = 4.5;

function oilAmount(n: number): string {
  const spoons = Math.floor(n / 3);
  const tea = n % 3;
  const big = spoons === 1 ? '1 łyżka' : spoons > 1 ? `${spoons} łyżki` : '';
  const small = tea === 1 ? '1 łyżeczka' : tea === 2 ? '2 łyżeczki' : '';
  return `${[big, small].filter(Boolean).join(' i ')} oliwy`;
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
    step: TEASPOON_OIL,
    max: 3,
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
export const KETO_OIL: SideDef = { ...SIDES.oil, max: 6 };

/** A side's portion grows with a big meal, up to twice: 3500 kcal a day is not eaten with one roll. */
const ROOM_KCAL = 700;
export const roomFor = (slotKcal: number): number => Math.max(1, Math.min(2, slotKcal / ROOM_KCAL));

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
  /** The style caps carbohydrates (keto, low carb): no starch next to the dish, the energy comes from fat. */
  carbLimited: boolean;
  /** How much bigger than an ordinary meal this one is (1–2, `roomFor`): the sides may grow with it. */
  room?: number;
}

/**
 * The sides a meal may get, by the meal and the dish: a box gets rice or potatoes and oil, a
 * savoury breakfast or supper a roll, avocado and oil, a sweet one a banana and nuts, a savoury snack
 * nuts. A dish with a starch of its own gets more of that starch (more rice in the curry's box), or
 * none (no rice next to pasta). Under a carb limit (keto, low carb) there is no starch and no banana
 * at all - the styles avoid them - but more oil, and nuts with every meal. Each starts at zero: the
 * portions decide whether a day needs it.
 */
export function sidesFor(c: SideContext): SideDef[] {
  if (c.fixed) return [];
  const carb = (usual: SideDef): SideDef[] =>
    c.carbLimited ? [] : !c.starch ? [usual] : c.ownStarch ? [SIDES[c.ownStarch]] : [];
  const oil = c.carbLimited ? KETO_OIL : SIDES.oil;
  const room = c.room ?? 1;
  const grow = (defs: SideDef[]) => (room > 1 ? defs.map((d) => ({ ...d, max: Math.ceil(d.max * room) })) : defs);
  if (c.slot === 'lunch' || (c.slot === 'dinner' && c.box)) return grow([...carb(c.classic ? SIDES.potato : SIDES.rice), oil]);
  if (c.savoury && c.slot !== 'snack') return grow([...carb(SIDES.roll), SIDES.avocado, oil, ...(c.carbLimited ? [SIDES.nuts] : [])]);
  // A banana goes with oats or a cake too: it is fruit, not a second starch - but not under a carb limit.
  if (!c.savoury) return grow([...(c.carbLimited ? [] : [SIDES.banana]), SIDES.nuts]);
  return grow([SIDES.nuts]);
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

/** Below this, an oil's "100 g" is a label per 100 ml: a gram of fat has 9 kcal, so 100 g of oil ~880-900. */
const OIL_PER_ML_BELOW = 860;
const OIL_DENSITY = 0.915;

/**
 * The side's macros per step in this basket: the physical shop's product, or typical values. Oil
 * labels give 100 ml; a step is in grams, so their numbers are read per millilitre.
 */
export function resolveSide(def: SideDef, candidates: Candidates, basket: Basket): ResolvedSide {
  const item = resolveRecipe(asRecipe(def, def.step), candidates, basket).items[0]!;
  const perHundred = (item.macros.kcal / def.step) * 100;
  const k = def.ingredient === 'oil' && perHundred < OIL_PER_ML_BELOW ? 1 / OIL_DENSITY : 1;
  const m = item.macros;
  return { def, perStep: { kcal: m.kcal * k, protein: m.protein * k, carbs: m.carbs * k, fat: m.fat * k } };
}

/** The macros of `steps` steps. */
export function sideMacros(side: ResolvedSide, steps: number): Macros {
  const m = side.perStep;
  const r = (n: number) => Math.round(n * steps * 100) / 100;
  return { kcal: r(m.kcal), protein: r(m.protein), carbs: r(m.carbs), fat: r(m.fat) };
}
