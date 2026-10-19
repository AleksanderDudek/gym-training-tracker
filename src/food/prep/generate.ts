import { DIET_PROFILES, type MacroTargets } from '../diet/profiles';
import type { Dictionaries } from '../lib/types';
import { isOnlineShop, onlineShop } from '../online/shops';
import { RECIPES, servingsOf, type Recipe } from '../recipes/catalog';
import { INGREDIENTS } from '../recipes/ingredients';
import type { Macros } from '../recipes/macros';
import type { RecipeIndex } from '../recipes/resolve';
import { cookingBlocks, planDates } from './blocks';
import type { CheckIn } from './checkin';
import { planRecipes, type PlanRecipe } from './candidates';
import { fitPortions, mealMacros, type MealSpec } from './portions';
import { selectRecipes, swapCandidate, type SelectContext } from './select';
import { resolveSide, sideMacros, sidesFor, type ResolvedSide, type SideDef } from './sides';
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
  const choices = selection.choices;
  const byId = new Map(pool.map((r) => [r.recipe.id, r]));
  const gone = Object.values(choices)
    .flat()
    .filter((id) => !byId.has(id));
  if (gone.length)
    return {
      ok: false,
      missing: [],
      message: 'Któregoś przepisu z planu nie da się już kupić w tym koszyku — ułóż plan od nowa.',
    };

  const basket = basketOf(settings);
  const slots = ctx.slots;
  const blocks = cookingBlocks(settings.start, settings.days);
  const dates = planDates(settings.start, settings.days);
  const blockOf = (date: string) => blocks.findIndex((b) => b.dates.includes(date));
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
  for (const [d, date] of dates.entries()) {
    let snack = 0;
    for (const [s, slot] of slots.entries()) {
      const block = blockOf(date);
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
  );

  const batches: PrepBatch[] = [];
  const batchOf = new Map<string, number>();
  const meals: PrepMeal[] = specs.map((spec) => {
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
  for (const batch of batches) {
    const recipe = byId.get(batch.recipeId)!.recipe;
    batch.factor = round2(batch.servings / servingsOf(recipe));
    batch.ingredients = recipe.items
      .filter((i) => i.ingredient !== 'water' && i.ingredient !== 'ice')
      .map((i) => ({ label: INGREDIENTS[i.ingredient].label, grams: round2(i.grams * batch.factor) }));
  }

  const uses: RecipeUse[] = [
    ...batches.map((b) => ({ recipe: byId.get(b.recipeId)!.recipe, servings: b.servings, date: b.date })),
    ...meals.filter((m) => m.box === null).map((m) => ({ recipe: byId.get(m.recipeId)!.recipe, servings: m.portion, date: m.date })),
  ];
  const sideUses: SideUse[] = specs.flatMap((spec) => {
    const a = amounts.get(spec.key)!;
    return spec.sides.map((side, i) => ({ def: side.def, steps: a.steps[i] ?? 0, date: spec.date }));
  });
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

/** The plan again with the same goal and targets: another seed ("Inny plan") or other choices. */
function remake(plan: PrepPlan, input: RemakeInput, change: { settings?: PrepSettings; choices?: Choices }): GenerateResult {
  const result = generatePlan({
    ...input,
    settings: change.settings ?? plan.settings,
    dayTargets: plan.dayTargets,
    goal: plan.goal,
    checkIn: plan.checkIn,
    choices: change.choices,
    createdAt: plan.createdAt,
  });
  if (!result.ok) return result;
  const keys = new Set(result.plan.shopping.map((i) => i.key));
  return {
    ok: true,
    plan: {
      ...result.plan,
      ...(plan.id !== undefined && { id: plan.id }),
      // What is in the trolley stays ticked while the plan still needs it.
      bought: plan.bought.filter((k) => keys.has(k)),
    },
  };
}

export type RemakeInput = Pick<GenerateInput, 'index' | 'dict' | 'favorites' | 'recipes'>;

/** Another plan of the same settings: a new seed. */
export function rerollPlan(plan: PrepPlan, input: RemakeInput, seed: number): GenerateResult {
  return remake(plan, input, { settings: { ...plan.settings, seed } });
}

/**
 * One recipe of the plan replaced, everywhere it is used in this role, by the best one the plan does
 * not use yet; every other choice stays, portions and the list follow. The recipe swapped out does
 * not come back in this plan.
 */
export function swapRecipe(plan: PrepPlan, role: Role, out: string, input: RemakeInput): GenerateResult {
  const settings = { ...plan.settings, avoid: [...new Set([...plan.settings.avoid, out])] };
  const { ctx } = contextOf({ ...input, settings, dayTargets: plan.dayTargets, goal: plan.goal, checkIn: plan.checkIn });
  const next = swapCandidate(ctx, plan.choices, role, out);
  if (!next) return { ok: false, missing: [], message: `Nie ma innego przepisu na ${ROLE_WORDS[role]} w tym koszyku.` };
  const choices = { ...plan.choices, [role]: (plan.choices[role] ?? []).map((id) => (id === out ? next.recipe.id : id)) };
  return remake(plan, input, { settings, choices });
}
