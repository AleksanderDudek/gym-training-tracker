import type { MacroTargets } from '../diet/profiles';
import type { Macros } from '../recipes/macros';
import type { PlanRecipe } from './candidates';
import { sideMacros, type ResolvedSide } from './sides';

/** Servings a meal may have: what a spoon or a ladle can measure, from half to two and a half. */
export const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5] as const;
const ONE = PORTIONS.indexOf(1);

export interface MealSpec {
  /** Index of the day (into the targets). */
  day: number;
  share: number;
  recipe: PlanRecipe;
  /** Meals with the same key share one portion and one set of sides: the equal boxes of a batch. */
  key: string;
  /** The sides this meal may get (at most one carb and one fat). */
  sides: ResolvedSide[];
}

export interface MealAmounts {
  portion: number;
  /** Steps of each of the meal's sides, in the order of `MealSpec.sides`. */
  steps: number[];
}

const rel = (x: number, ref: number) => x / Math.max(ref, 1);

/**
 * How far a day is from its targets; 0 is perfect. Energy weighs most. Protein below the target
 * (and much more below the minimum) is a shortfall; far above it, it crowds out the rest. A carb
 * LIMIT (keto, low carb) is a limit - crossing it costs a step; otherwise carbohydrates and fat
 * drift towards their targets, with fat's minimum and maximum enforced. Each meal stays near its
 * share of the day.
 */
export function dayScore(m: Macros, t: MacroTargets, meals: readonly { kcal: number; share: number }[]): number {
  let s = 50 * rel(m.kcal - t.kcal, t.kcal) ** 2;
  const p = rel(m.protein - t.protein.target, t.protein.target);
  if (p < 0) s += 20 * p ** 2;
  if (m.protein < t.protein.min) s += 40 * rel(t.protein.min - m.protein, t.protein.target) ** 2;
  if (p > 0.25) s += 4 * (p - 0.25) ** 2;
  // Any gram over a carb limit costs a step, not only a slope: "1 g ponad limit" is still over.
  if (t.carbs.max !== null && m.carbs > t.carbs.max + 0.05) s += 0.5 + 60 * rel(m.carbs - t.carbs.max, t.carbs.max) ** 2;
  s += (t.carbs.max !== null ? 0.5 : 2) * rel(m.carbs - t.carbs.target, Math.max(t.carbs.target, 50)) ** 2;
  if (m.fat < t.fat.min) s += 20 * rel(t.fat.min - m.fat, t.fat.target) ** 2;
  if (t.fat.max !== null && m.fat > t.fat.max) s += 20 * rel(m.fat - t.fat.max, t.fat.target) ** 2;
  s += rel(m.fat - t.fat.target, t.fat.target) ** 2;
  for (const meal of meals) s += 3 * (rel(meal.kcal, m.kcal) - meal.share) ** 2;
  return s;
}

interface Var {
  key: string;
  fixed: boolean;
  /** Index into PORTIONS. */
  portion: number;
  steps: number[];
  max: number[];
  days: number[];
}

/** A small cost for leaving one serving and for every side step: ties go to the simpler meal. */
function cost(v: Var): number {
  return 0.05 * (PORTIONS[v.portion]! - 1) ** 2 + 0.02 * v.steps.reduce((a, b) => a + b, 0);
}

type Field = number; // -1: the portion, otherwise the index of a side
interface Move {
  v: Var;
  field: Field;
  delta: 1 | -1;
}

function canMove({ v, field, delta }: Move): boolean {
  if (field === -1) {
    if (v.fixed) return false;
    const next = v.portion + delta;
    return next >= 0 && next < PORTIONS.length;
  }
  const next = v.steps[field]! + delta;
  return next >= 0 && next <= v.max[field]!;
}

function apply({ v, field, delta }: Move, sign: 1 | -1 = 1): void {
  if (field === -1) v.portion += delta * sign;
  else v.steps[field]! += delta * sign;
}

/**
 * Portions and sides for every meal, so that each day meets its targets as closely as the recipes
 * allow. Coordinate descent: the best single step (a quarter serving, a side step) while one
 * improves the plan, then the best pair of steps on one day (less dish, more rice) while that does.
 * Deterministic: the same meals give the same amounts.
 */
export function fitPortions(meals: readonly MealSpec[], targets: readonly MacroTargets[]): Map<string, MealAmounts> {
  const vars = new Map<string, Var>();
  const sizes = new Map<string, number[]>();
  for (const m of meals) {
    let v = vars.get(m.key);
    if (!v) {
      v = {
        key: m.key,
        fixed: m.recipe.fixed,
        portion: ONE,
        steps: m.sides.map(() => 0),
        max: m.sides.map((s) => s.def.max),
        days: [],
      };
      vars.set(m.key, v);
      sizes.set(m.key, []);
    }
    if (!v.days.includes(m.day)) v.days.push(m.day);
    sizes.get(m.key)!.push((m.share * targets[m.day]!.kcal) / Math.max(1, m.recipe.perServing.kcal));
  }
  // Start at the serving closest to the meal's share of its days.
  for (const v of vars.values()) {
    if (v.fixed) continue;
    const want = sizes.get(v.key)!.reduce((a, b) => a + b, 0) / sizes.get(v.key)!.length;
    v.portion = PORTIONS.reduce((best, p, i) => (Math.abs(p - want) < Math.abs(PORTIONS[best]! - want) ? i : best), 0);
  }

  const byDay = new Map<number, MealSpec[]>();
  for (const m of meals) byDay.set(m.day, [...(byDay.get(m.day) ?? []), m]);

  const scoreDay = (day: number): number => {
    const list = byDay.get(day) ?? [];
    const total: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const kcals: { kcal: number; share: number }[] = [];
    for (const m of list) {
      const v = vars.get(m.key)!;
      const macros = mealMacros(m, { portion: PORTIONS[v.portion]!, steps: v.steps });
      total.kcal += macros.kcal;
      total.protein += macros.protein;
      total.carbs += macros.carbs;
      total.fat += macros.fat;
      kcals.push({ kcal: macros.kcal, share: m.share });
    }
    return dayScore(total, targets[day]!, kcals);
  };

  const dayScores = new Map<number, number>();
  for (const day of byDay.keys()) dayScores.set(day, scoreDay(day));

  /** The change of the whole plan's score if these moves were made. */
  const gain = (moves: Move[]): number => {
    const days = new Set(moves.flatMap((m) => m.v.days));
    const touched = new Set(moves.map((m) => m.v));
    const before = [...days].reduce((s, d) => s + dayScores.get(d)!, 0) + [...touched].reduce((s, v) => s + cost(v), 0);
    moves.forEach((m) => apply(m));
    const after = [...days].reduce((s, d) => s + scoreDay(d), 0) + [...touched].reduce((s, v) => s + cost(v), 0);
    [...moves].reverse().forEach((m) => apply(m, -1));
    return after - before;
  };

  const commit = (moves: Move[]) => {
    moves.forEach((m) => apply(m));
    for (const d of new Set(moves.flatMap((m) => m.v.days))) dayScores.set(d, scoreDay(d));
  };

  const movesOf = (v: Var): Move[] => {
    const out: Move[] = [];
    for (const field of [-1, ...v.steps.map((_, i) => i)])
      for (const delta of [1, -1] as const) {
        const move = { v, field, delta };
        if (canMove(move)) out.push(move);
      }
    return out;
  };

  const EPS = 1e-9;
  for (let round = 0; round < 400; round++) {
    let best: { moves: Move[]; gain: number } | null = null;
    for (const v of vars.values())
      for (const move of movesOf(v)) {
        const g = gain([move]);
        if (g < -EPS && (!best || g < best.gain)) best = { moves: [move], gain: g };
      }
    if (!best) {
      for (const list of byDay.values()) {
        const dayVars = [...new Set(list.map((m) => vars.get(m.key)!))];
        const moves = dayVars.flatMap(movesOf);
        for (const [i, a] of moves.entries())
          for (const b of moves.slice(i + 1)) {
            // Two steps of one field cancel or double: a single move covers both.
            if (a.v === b.v && a.field === b.field) continue;
            const g = gain([a, b]);
            if (g < -EPS && (!best || g < best.gain)) best = { moves: [a, b], gain: g };
          }
      }
    }
    if (!best) break;
    commit(best.moves);
  }

  const out = new Map<string, MealAmounts>();
  for (const v of vars.values()) out.set(v.key, { portion: PORTIONS[v.portion]!, steps: [...v.steps] });
  return out;
}

/** A meal's macros at these amounts: the dish times its portion, plus its sides. */
export function mealMacros(m: Pick<MealSpec, 'recipe' | 'sides'>, a: MealAmounts): Macros {
  const s = m.recipe.perServing;
  const total = { kcal: s.kcal * a.portion, protein: s.protein * a.portion, carbs: s.carbs * a.portion, fat: s.fat * a.portion };
  m.sides.forEach((side, i) => {
    const steps = a.steps[i] ?? 0;
    if (!steps) return;
    const add = sideMacros(side, steps);
    total.kcal += add.kcal;
    total.protein += add.protein;
    total.carbs += add.carbs;
    total.fat += add.fat;
  });
  return total;
}
