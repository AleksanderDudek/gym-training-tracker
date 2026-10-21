import { DIET_PROFILES, type MacroTargets } from '../diet/profiles';
import type { Dictionaries } from '../lib/types';
import { isOnlineShop, onlineShop } from '../online/shops';
import { RECIPES, servingsOf, type Recipe } from '../recipes/catalog';
import { INGREDIENTS, type IngredientId } from '../recipes/ingredients';
import type { Macros } from '../recipes/macros';
import type { RecipeIndex } from '../recipes/resolve';
import { cookingBlocks, planDates } from './blocks';
import type { CheckIn } from './checkin';
import { planRecipes, type PlanRecipe } from './candidates';
import { fitPortions, mealMacros, type MealSpec } from './portions';
import { selectRecipes, swapCandidate, swapOptions, type SelectContext, type SwapOption } from './select';
import { resolveSide, roomFor, sideMacros, sidesFor, type ResolvedSide, type SideDef } from './sides';
import { shoppingList, type RecipeUse, type SideUse } from './shopping';
import { slotsFor } from './slots';
import {
  isBoxRole,
  type BoxRole,
  type Choices,
  type PrepBatch,
  type PrepGoal,
  type PrepMeal,
  type PrepPlan,
  type PrepSettings,
  type PrepShop,
  type PrepSide,
  type Role,
} from './types';

export interface GenerateInput {
  settings: PrepSettings;
  index: RecipeIndex;
  dict: Dictionaries;
  dayTargets: { date: string; targets: MacroTargets }[];
  goal: PrepGoal;
  checkIn: CheckIn | null;
  /** Starred recipes (ids): a nudge in the selection. */
  favorites?: ReadonlySet<string>;
  /** The catalog (tests pass their own). */
  recipes?: readonly Recipe[];
  /** Given choices (a swap): the selection is skipped. */
  choices?: Choices;
  /**
   * A plan being changed (a swap, another plan): its days before `from` stay as they were - they
   * are eaten - and so do the boxes of blocks cooked before `from`. Only what is still ahead changes.
   */
  keep?: { plan: PrepPlan; from: string };
  /** ISO time; now when absent. */
  createdAt?: string;
}

export type GenerateResult = { ok: true; plan: PrepPlan } | { ok: false; missing: Role[]; message: string };

const ROLE_WORDS: Record<Role, string> = {
  breakfast: 'śniadanie',
  snack: 'przekąskę',
  lunch: 'obiad',
  lunchBox: 'obiad',
  dinner: 'kolację',
  dinnerBox: 'kolację',
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const times = (m: Macros, k: number): Macros => ({
  kcal: round2(m.kcal * k),
  protein: round2(m.protein * k),
  carbs: round2(m.carbs * k),
  fat: round2(m.fat * k),
});

/** A seed for a plan nobody has seen yet: "Ułóż plan" and "Inny plan". */
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

export const basketOf = (settings: Pick<PrepSettings, 'store' | 'online'>): string[] =>
  settings.online ? [settings.store, settings.online] : [settings.store];

/** What the planner works with for these settings: the candidates and the selection context. */
function contextOf(input: GenerateInput): { pool: PlanRecipe[]; ctx: SelectContext } {
  const { settings, dayTargets } = input;
  const pool = planRecipes({
    candidates: input.index.candidates,
    basket: basketOf(settings),
    dietProfile: DIET_PROFILES[input.goal.dietProfile],
    exclude: settings.exclude,
    recipes: input.recipes ?? RECIPES,
  });
  const dayKcal = dayTargets.reduce((s, d) => s + d.targets.kcal, 0) / Math.max(1, dayTargets.length);
  const ctx: SelectContext = {
    pool,
    slots: slotsFor(settings.meals),
    blocks: cookingBlocks(settings.start, settings.days).length,
    days: settings.days,
    cooking: settings.cooking,
    dayKcal,
    carbLimited: dayTargets[0]?.targets.carbs.max != null,
    favorites: input.favorites ?? new Set(),
    avoid: new Set(settings.avoid),
    seed: settings.seed,
  };
  return { pool, ctx };
}

function missingMessage(missing: Role[], input: GenerateInput): string {
  const what = [...new Set(missing.map((r) => ROLE_WORDS[r]))].join(' ani na ');
  const style = DIET_PROFILES[input.goal.dietProfile].label;
  const tips = [
    input.settings.online ? null : 'dodaj sklep internetowy',
    'wybierz inny sklep',
    input.settings.exclude.length ? 'zdejmij wykluczenia' : null,
    input.settings.meals > 3 ? 'wybierz mniej posiłków' : null,
  ].filter(Boolean);
  return `Nie mam przepisu na ${what} z tego koszyka dla stylu „${style}”. Spróbuj: ${tips.join(', ')}.`;
}

/**
 * A plan from its settings and the day targets: the basket's recipes, the choices (or the given
 * ones), the meals of every day with portions and sides, the batches of the cooking days and the
 * shopping list - all as one snapshot.
 */
export function generatePlan(input: GenerateInput): GenerateResult {
  const { settings, dayTargets, index, dict } = input;
  const { pool, ctx } = contextOf(input);
  const selection = input.choices ? { choices: input.choices, missing: [] as Role[] } : selectRecipes(ctx);
  if (selection.missing.length)
    return { ok: false, missing: selection.missing, message: missingMessage(selection.missing, input) };
  const basket = basketOf(settings);
  const slots = ctx.slots;
  const blocks = cookingBlocks(settings.start, settings.days);
  const dates = planDates(settings.start, settings.days);
  const blockOf = (date: string) => blocks.findIndex((b) => b.dates.includes(date));
  // What is eaten or cooked already stays: the days before `from`, the blocks cooked before it.
  const old = input.keep && input.keep.from > settings.start ? input.keep.plan : null;
  const from = old ? input.keep!.from : null;
  const cooked = (block: number) => from !== null && blocks[block]!.start < from;

  // A cooked block keeps its dish in the choices too: the plan says what is in its boxes.
  const choices: Choices = { ...selection.choices };
  if (old)
    for (const role of ['lunchBox', 'dinnerBox'] as const) {
      const was = old.choices[role];
      if (choices[role] && was) choices[role] = choices[role].map((id, b) => (cooked(b) ? (was[b] ?? id) : id));
    }
  const byId = new Map(pool.map((r) => [r.recipe.id, r]));
  const gone = Object.entries(choices)
    .flatMap(([role, ids]) => ids.filter((_, i) => !(isBoxRole(role as Role) && cooked(i))))
    .filter((id) => !byId.has(id));
  if (gone.length)
    return {
      ok: false,
      missing: [],
      message: 'Któregoś przepisu z planu nie da się już kupić w tym koszyku — ułóż plan od nowa.',
    };
  const sideCache = new Map<SideDef, ResolvedSide>();
  const resolved = (def: SideDef) => {
    let side = sideCache.get(def);
    if (!side) {
      side = resolveSide(def, index.candidates, basket);
      sideCache.set(def, side);
    }
    return side;
  };

  interface Assigned extends MealSpec {
    date: string;
    slot: number;
    role: Role;
    block: number;
  }
  const specs: Assigned[] = [];
  const kept: PrepMeal[] = [];
  const fixed = new Map<number, (Macros & { share: number })[]>();
  for (const [d, date] of dates.entries()) {
    let snack = 0;
    for (const [s, slot] of slots.entries()) {
      const block = blockOf(date);
      const before = old?.meals.find((m) => m.date === date && m.slot === s);
      if (from !== null && before && (date < from || (before.box !== null && cooked(block)))) {
        kept.push(before);
        // A cooked box still counts on its day: the rest of the day is fitted around it.
        if (date >= from) fixed.set(d, [...(fixed.get(d) ?? []), { ...before.total, share: slot.share }]);
        if (slot.kind === 'snack') snack++;
        continue;
      }
      let role: Role;
      let id: string | undefined;
      if (slot.kind === 'breakfast') [role, id] = ['breakfast', at(choices.breakfast, d)];
      else if (slot.kind === 'snack') [role, id] = ['snack', at(choices.snack, d + snack++)];
      else if (slot.kind === 'lunch')
        [role, id] = choices.lunchBox?.length ? ['lunchBox', choices.lunchBox[block]] : ['lunch', at(choices.lunch, d)];
      else
        [role, id] = choices.dinnerBox?.length
          ? ['dinnerBox', choices.dinnerBox[block]]
          : ['dinner', at(choices.dinner, d)];
      const recipe = id ? byId.get(id) : undefined;
      if (!recipe) continue;
      const box = isBoxRole(role);
      const sides = sidesFor({
        slot: slot.kind,
        box,
        savoury: recipe.savoury,
        starch: recipe.starch,
        ownStarch: recipe.ownStarch,
        classic: recipe.classic,
        fixed: recipe.fixed,
        carbLimited: ctx.carbLimited,
        room: roomFor(slot.share * ctx.dayKcal),
      }).map(resolved);
      specs.push({
        day: d,
        date,
        slot: s,
        role,
        block,
        share: slot.share,
        recipe,
        key: box ? `${role}:${block}` : `meal:${d}:${s}`,
        sides,
      });
    }
  }

  const amounts = fitPortions(
    specs,
    dates.map((date) => dayTargets.find((t) => t.date === date)!.targets),
    fixed,
  );

  // Batches cooked before `from` stay as they were, first; the meals that eat from them point at them.
  const batches: PrepBatch[] = [];
  const keptBatch = new Map<number, number>();
  for (const [i, b] of (old?.batches ?? []).entries())
    if (from !== null && b.date < from) {
      keptBatch.set(i, batches.length);
      batches.push(b);
    }
  const keptMeals = kept.map((m) => ({ ...m, box: m.box === null ? null : (keptBatch.get(m.box) ?? null) }));
  const batchOf = new Map<string, number>();
  const fresh: PrepMeal[] = specs.map((spec) => {
    const a = amounts.get(spec.key)!;
    const sides: PrepSide[] = spec.sides.flatMap((side, i) => {
      const steps = a.steps[i] ?? 0;
      if (!steps) return [];
      return [
        {
          ingredient: side.def.ingredient,
          label: INGREDIENTS[side.def.ingredient].label,
          grams: side.def.step * steps,
          amount: side.def.amount(steps),
          nutrients: sideMacros(side, steps),
        },
      ];
    });
    let box: number | null = null;
    if (isBoxRole(spec.role)) {
      box = batchOf.get(spec.key) ?? null;
      if (box === null) {
        box = batches.length;
        batchOf.set(spec.key, box);
        batches.push({
          date: blocks[spec.block]!.start,
          role: spec.role as BoxRole,
          recipeId: spec.recipe.recipe.id,
          name: spec.recipe.recipe.name,
          servings: 0,
          factor: 0,
          portion: a.portion,
          boxes: [],
          sides,
          ingredients: [],
        });
      }
      const batch = batches[box]!;
      batch.boxes.push({ date: spec.date, slotName: slots[spec.slot]!.name });
      batch.servings = round2(batch.servings + a.portion);
    }
    const recipe = times(spec.recipe.perServing, a.portion);
    const total = mealMacros(spec, a);
    return {
      date: spec.date,
      slot: spec.slot,
      slotName: slots[spec.slot]!.name,
      role: spec.role,
      recipeId: spec.recipe.recipe.id,
      name: spec.recipe.recipe.name,
      portion: a.portion,
      box,
      sides,
      recipe,
      total: { kcal: round2(total.kcal), protein: round2(total.protein), carbs: round2(total.carbs), fat: round2(total.fat) },
    };
  });
  for (const batch of batches.slice(keptBatch.size)) {
    const recipe = byId.get(batch.recipeId)!.recipe;
    batch.factor = round2(batch.servings / servingsOf(recipe));
    batch.ingredients = recipe.items
      .filter((i) => i.ingredient !== 'water' && i.ingredient !== 'ice')
      .map((i) => ({ label: INGREDIENTS[i.ingredient].label, grams: round2(i.grams * batch.factor) }));
  }
  const meals = [...keptMeals, ...fresh].sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot);

  // The list covers the whole plan, kept days included: what was bought for them is part of it.
  const catalog = new Map((input.recipes ?? RECIPES).map((r) => [r.id, r]));
  const recipeOf = (id: string) => byId.get(id)?.recipe ?? catalog.get(id);
  const uses: RecipeUse[] = [
    ...batches.flatMap((b) => {
      const recipe = recipeOf(b.recipeId);
      return recipe ? [{ recipe, servings: b.servings, date: b.date }] : [];
    }),
    ...meals
      .filter((m) => m.box === null)
      .flatMap((m) => {
        const recipe = recipeOf(m.recipeId);
        return recipe ? [{ recipe, servings: m.portion, date: m.date }] : [];
      }),
  ];
  const sideUses: SideUse[] = meals.flatMap((m) =>
    m.sides.map((side) => ({ ingredient: side.ingredient as IngredientId, grams: side.grams, date: m.date })),
  );
  const shopping = shoppingList({
    uses,
    sides: sideUses,
    basket,
    candidates: index.candidates,
    dict,
    start: settings.start,
  });

  const shops: PrepShop[] = basket.map((key) => ({
    key,
    name: dict.stores[key] ?? onlineShop(key)?.name ?? key,
    online: isOnlineShop(key),
    url: onlineShop(key)?.url ?? null,
  }));

  return {
    ok: true,
    plan: {
      createdAt: input.createdAt ?? new Date().toISOString(),
      settings,
      shops,
      goal: input.goal,
      checkIn: input.checkIn,
      dayTargets,
      slots,
      choices,
      meals,
      batches,
      shopping,
      bought: [],
    },
  };
}

/** The item of a rotation for day `n`. */
function at(list: string[] | undefined, n: number): string | undefined {
  return list?.length ? list[n % list.length] : undefined;
}

/**
 * The plan again with the same goal and targets, from `from` on (another seed, or other choices):
 * the days before it and the boxes cooked before it stay. A ticked line stays ticked while the
 * plan needs no more of it than before - more means another pack to buy.
 */
function remake(
  plan: PrepPlan,
  input: RemakeInput,
  from: string,
  change: { settings?: PrepSettings; choices?: Choices },
): GenerateResult {
  if (from > planEnd(plan)) return { ok: false, missing: [], message: 'Ten plan już się skończył — ułóż następny.' };
  const result = generatePlan({
    ...input,
    settings: change.settings ?? plan.settings,
    dayTargets: plan.dayTargets,
    goal: plan.goal,
    checkIn: plan.checkIn,
    choices: change.choices,
    keep: { plan, from },
    createdAt: plan.createdAt,
  });
  if (!result.ok) return result;
  const before = new Map(plan.shopping.map((i) => [i.key, i.grams]));
  const after = new Map(result.plan.shopping.map((i) => [i.key, i.grams]));
  return {
    ok: true,
    plan: {
      ...result.plan,
      ...(plan.id !== undefined && { id: plan.id }),
      // The plan stays the user's: its name and when it was set to be followed.
      ...(plan.name !== undefined && { name: plan.name }),
      ...(plan.setAt !== undefined && { setAt: plan.setAt }),
      bought: plan.bought.filter((k) => after.has(k) && after.get(k)! <= (before.get(k) ?? 0)),
    },
  };
}

export type RemakeInput = Pick<GenerateInput, 'index' | 'dict' | 'favorites' | 'recipes'>;

/** The plan's last day. */
const planEnd = (plan: PrepPlan) => planDates(plan.settings.start, plan.settings.days).at(-1)!;

/** Another plan of the same settings from `from` on (today): a new seed; what is eaten or cooked stays. */
export function rerollPlan(plan: PrepPlan, input: RemakeInput, seed: number, from: string): GenerateResult {
  return remake(plan, input, from, { settings: { ...plan.settings, seed } });
}

/**
 * Whether a recipe of the plan can still be swapped from `from` on: it is eaten on a day still ahead,
 * and as a box only in a block not cooked yet.
 */
export function canSwap(plan: PrepPlan, role: Role, recipeId: string, from: string): boolean {
  return plan.meals.some(
    (m) =>
      m.role === role &&
      m.recipeId === recipeId &&
      m.date >= from &&
      (m.box === null || (plan.batches[m.box]?.date ?? '') >= from),
  );
}

/** Why there is nothing to swap to: the same hints the form gives. */
export function noSwapMessage(plan: PrepPlan, role: Role): string {
  const tips = [
    'inny sklep',
    plan.settings.online ? null : 'sklep internetowy',
    plan.settings.exclude.length ? 'mniej wykluczeń' : null,
  ].filter(Boolean);
  return `Nie ma innego przepisu na ${ROLE_WORDS[role]} w tym koszyku. Więcej da ${tips.join(', ')} w następnym planie.`;
}

/**
 * What can replace a recipe of the plan in a role, best first - the list „Wymień” shows. Empty
 * when the recipe can no longer be swapped (eaten, cooked) or nothing else fits.
 */
export function swapChoices(plan: PrepPlan, role: Role, out: string, input: RemakeInput, from: string): SwapOption[] {
  if (!canSwap(plan, role, out, from)) return [];
  const { ctx } = contextOf({ ...input, settings: plan.settings, dayTargets: plan.dayTargets, goal: plan.goal, checkIn: plan.checkIn });
  return swapOptions(ctx, plan.choices, role, out);
}

/**
 * One recipe of the plan replaced, from `from` on, everywhere it is used in this role - by `to`
 * when the user chose one (it must be one of `swapChoices`), else by the best one the plan does not
 * use yet. Every other choice stays, portions and the list follow. Boxes cooked before `from` keep
 * their dish. The recipe swapped out does not come back by itself („Inny plan”); the one chosen
 * leaves the avoid list.
 */
export function swapRecipe(
  plan: PrepPlan,
  role: Role,
  out: string,
  input: RemakeInput,
  from: string,
  to?: string,
): GenerateResult {
  if (!canSwap(plan, role, out, from))
    return { ok: false, missing: [], message: 'To danie jest już zjedzone albo ugotowane — wymiana dotyczy dni, które są przed Tobą.' };
  const settings = {
    ...plan.settings,
    avoid: [...new Set([...plan.settings.avoid, out])].filter((id) => id !== to),
  };
  const { ctx } = contextOf({ ...input, settings, dayTargets: plan.dayTargets, goal: plan.goal, checkIn: plan.checkIn });
  const next =
    to === undefined
      ? swapCandidate(ctx, plan.choices, role, out)
      : (swapOptions(ctx, plan.choices, role, out).find((o) => o.recipe.recipe.id === to)?.recipe ?? null);
  if (!next)
    return {
      ok: false,
      missing: [],
      message: to === undefined ? noSwapMessage(plan, role) : 'Ten przepis nie pasuje już do planu — wybierz inny.',
    };
  const blocks = cookingBlocks(plan.settings.start, plan.settings.days);
  const choices = {
    ...plan.choices,
    [role]: (plan.choices[role] ?? []).map((id, i) =>
      id === out && !(isBoxRole(role) && blocks[i]!.start < from) ? next.recipe.id : id,
    ),
  };
  return remake(plan, input, from, { settings, choices });
}
