import { random } from '../diet/suggest';
import { servingsOf } from '../recipes/catalog';
import type { IngredientId } from '../recipes/ingredients';
import type { PlanRecipe } from './candidates';
import { isBoxRole, type Choices, type Cooking, type Role, type Slot, type SlotKind } from './types';

/** The longest a fresh meal may take: a weekday breakfast, a snack, a supper, a lunch made on the day. */
const FRESH_MINUTES: Record<Exclude<Role, 'lunchBox' | 'dinnerBox'>, number> = {
  breakfast: 15,
  snack: 10,
  lunch: 25,
  dinner: 20,
};

/**
 * Whether a recipe can play a role. Boxes are batch meals; fresh meals are one serving and quick.
 * Gotowce and the shaker mixes are snacks: a bar and a drink are not a supper, and a breakfast
 * whose size cannot change leaves the day nothing to adjust.
 */
export function fitsRole(r: PlanRecipe, role: Role): boolean {
  if (isBoxRole(role)) return r.batch;
  const { kind, minutes } = r.recipe;
  if (servingsOf(r.recipe) !== 1 || minutes > FRESH_MINUTES[role]) return false;
  switch (role) {
    case 'breakfast':
      return kind !== 'obiad' && kind !== 'mix' && !r.fixed;
    case 'snack':
      return kind !== 'obiad';
    case 'lunch':
      return kind === 'obiad' || kind === 'slone';
    case 'dinner':
      return kind === 'obiad' || kind === 'slone' || kind === 'miska';
  }
}

/** The slot a role feeds: its size decides which recipes fit it best. */
const SLOT_OF: Record<Role, SlotKind> = {
  breakfast: 'breakfast',
  snack: 'snack',
  lunch: 'lunch',
  lunchBox: 'lunch',
  dinner: 'dinner',
  dinnerBox: 'dinner',
};

export interface SelectContext {
  pool: PlanRecipe[];
  slots: Slot[];
  /** Cooking blocks of the plan. */
  blocks: number;
  days: number;
  cooking: Cooking;
  /** The plan's average daily kcal. */
  dayKcal: number;
  /** The style caps carbohydrates (keto, low carb): the best-fitting recipes go first whenever there are enough. */
  carbLimited: boolean;
  /** Starred recipes (ids). */
  favorites: ReadonlySet<string>;
  /** Never chosen (swapped out of this plan). */
  avoid: ReadonlySet<string>;
  seed: number;
}

/** The roles a plan of these slots needs, in the order they are chosen: the big meals first. */
export function rolesFor(slots: Slot[], cooking: Cooking): Role[] {
  const kinds = new Set(slots.map((s) => s.kind));
  const roles: Role[] = ['lunchBox'];
  if (kinds.has('dinner')) roles.push(cooking === 'both' ? 'dinnerBox' : 'dinner');
  roles.push('breakfast');
  if (kinds.has('snack')) roles.push('snack');
  return roles;
}

/** How many recipes a role gets: one per block for boxes, a few that alternate for fresh meals. */
function countFor(role: Role, ctx: SelectContext): number {
  if (isBoxRole(role)) return ctx.blocks;
  if (role === 'dinner') return ctx.days >= 7 ? 3 : 2;
  return 2;
}

/** The kcal one serving should come close to: the slot's share of an average day. */
function slotKcal(role: Role, ctx: SelectContext): number {
  const slot = ctx.slots.find((s) => s.kind === SLOT_OF[role]);
  return (slot?.share ?? 0.25) * ctx.dayKcal;
}

/**
 * How good a recipe is for a role, given what the plan already holds. Fit to the style first, then
 * protein per kcal, a serving close to the meal's size (twice as much when the portion is fixed),
 * quick for a fresh meal, a starred recipe, and packs shared with recipes already chosen.
 */
export function scoreFor(r: PlanRecipe, role: Role, ctx: SelectContext, chosen: ReadonlySet<IngredientId>): number {
  const kcal = Math.max(1, r.perServing.kcal);
  // Under a carb limit an "ok" recipe is what breaks the limit: it comes only when the best are used up.
  const fit = r.fit.level === 'great' ? 1 : ctx.carbLimited ? -0.2 : 0.4;
  const density = Math.min(1, (r.perServing.protein * 4) / kcal / 0.5);
  const size = 1 - Math.min(1, Math.abs(Math.log(slotKcal(role, ctx) / kcal)) / Math.log(2.5));
  const quick = isBoxRole(role) ? 0 : 0.3 * (1 - Math.min(1, r.recipe.minutes / FRESH_MINUTES[role]));
  const favorite = ctx.favorites.has(r.recipe.id) ? 0.3 : 0;
  const shared = Math.min(0.3, 0.1 * r.bought.filter((i) => chosen.has(i)).length);
  // A fixed portion under a carb limit brings carbohydrates nothing can take back out.
  const locked = ctx.carbLimited && r.fixed ? 0.6 : 0;
  return fit + density + (r.fixed ? 2 : 1) * size + quick + favorite + shared - locked;
}

/** The candidates of a role. */
function candidatesFor(role: Role, ctx: SelectContext): PlanRecipe[] {
  return ctx.pool.filter((r) => fitsRole(r, role) && !ctx.avoid.has(r.recipe.id));
}

/** One of the four best, the better likelier (weights 4, 3, 2, 1) - the same seed, the same pick. */
function pick<T>(ranked: T[], rand: () => number): T | undefined {
  const top = ranked.slice(0, 4);
  const weight = (i: number) => top.length - i;
  let left = rand() * top.reduce((sum, _, i) => sum + weight(i), 0);
  for (const [i, item] of top.entries()) {
    left -= weight(i);
    if (left <= 0) return item;
  }
  return top[0];
}

export interface Selection {
  choices: Choices;
  /** Roles nothing in the basket can fill. */
  missing: Role[];
}

/**
 * The recipes of a plan, role by role: a box dish for every cooking block, a few fresh suppers, two
 * breakfasts and two snacks that alternate. Every role first gets one recipe (the big meals first),
 * then the rest of its share, so a style with few recipes (keto) still fills every meal. A recipe
 * plays one role only - the same dish twice in a day is not a plan; boxes repeat their own dishes
 * when they run out. Without a batch dish a quick fresh lunch takes the boxes' place; without a box
 * supper, a fresh one.
 */
export function selectRecipes(ctx: SelectContext): Selection {
  const rand = random(ctx.seed);
  const used = new Set<string>();
  const chosen = new Set<IngredientId>();
  const picks = new Map<Role, string[]>();
  const missing: Role[] = [];

  /**
   * The best of what is left for a role, seeded; null when nothing is left. `strict` takes only what
   * fits the style fully ("pasuje"): under a carb limit an "ok" recipe brings carbohydrates that no
   * portion can take back out, so it comes only when a meal would otherwise have nothing.
   */
  const take = (role: Role, strict: boolean): string | null => {
    const pool = candidatesFor(role, ctx).filter((r) => !used.has(r.recipe.id) && (!strict || r.fit.level === 'great'));
    if (!pool.length) return null;
    const ranked = pool
      .map((r) => ({ r, score: scoreFor(r, role, ctx, chosen) }))
      .sort((a, b) => b.score - a.score || a.r.recipe.id.localeCompare(b.r.recipe.id));
    const picked = pick(ranked, rand)!.r;
    used.add(picked.recipe.id);
    for (const i of picked.bought) chosen.add(i);
    return picked.recipe.id;
  };

  const strict = ctx.carbLimited;
  // The first recipe of a role: one that fits fully, else (a fresh meal only) one that is "ok". A box
  // never settles for "ok": its carbohydrates would sit in four days at once.
  const first = (role: Role): string | null =>
    take(role, strict) ?? (strict && !isBoxRole(role) ? take(role, false) : null);
  const roles: Role[] = [];
  for (const role of rolesFor(ctx.slots, ctx.cooking)) {
    let playing = role;
    let id = first(role);
    if (!id && isBoxRole(role)) {
      playing = role === 'lunchBox' ? 'lunch' : 'dinner';
      id = first(playing);
    }
    if (!id) {
      missing.push(playing);
      continue;
    }
    picks.set(playing, [id]);
    roles.push(playing);
  }
  // The rest in turns, one recipe per role a round: a scarce style shares its few recipes fairly.
  for (let progress = true; progress; ) {
    progress = false;
    for (const role of roles) {
      const ids = picks.get(role)!;
      if (ids.length >= countFor(role, ctx)) continue;
      const next = take(role, strict);
      if (next) {
        ids.push(next);
        progress = true;
      }
    }
  }

  const choices: Choices = {};
  for (const role of roles) choices[role] = isBoxRole(role) ? fillBlocks(picks.get(role)!, ctx.blocks) : picks.get(role)!;
  return { choices, missing };
}

/** One recipe per block: with fewer dishes than blocks, they take turns (A, B, A), never one block after itself while there are two. */
function fillBlocks(ids: string[], blocks: number): string[] {
  return Array.from({ length: blocks }, (_, b) => ids[b % ids.length]!);
}

/**
 * What replaces a recipe of the plan in a role: the best candidate the plan does not use yet,
 * judged against what the rest of the plan buys. Null when there is none.
 */
export function swapCandidate(ctx: SelectContext, choices: Choices, role: Role, out: string): PlanRecipe | null {
  const inPlan = new Set(Object.values(choices).flat());
  const keep = ctx.pool.filter((r) => inPlan.has(r.recipe.id) && r.recipe.id !== out);
  const chosen = new Set(keep.flatMap((r) => r.bought));
  // A box under a carb limit takes only a dish that fits fully, as in the selection.
  const strict = ctx.carbLimited && isBoxRole(role);
  const options = ctx.pool.filter(
    (r) =>
      fitsRole(r, role) &&
      !inPlan.has(r.recipe.id) &&
      !ctx.avoid.has(r.recipe.id) &&
      r.recipe.id !== out &&
      (!strict || r.fit.level === 'great'),
  );
  return (
    options
      .map((r) => ({ r, score: scoreFor(r, role, ctx, chosen) }))
      .sort((a, b) => b.score - a.score || a.r.recipe.id.localeCompare(b.r.recipe.id))[0]?.r ?? null
  );
}
