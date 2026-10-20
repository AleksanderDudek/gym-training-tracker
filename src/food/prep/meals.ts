import type { DayTotals } from '../diet/day';
import type { Food } from '../diet/foods';
import type { Macros } from '../recipes/macros';
import { portionLabel } from './format';
import type { PrepMeal, PrepPlan } from './types';

/** "1¼ porcji + 75 g ryżu (suchego)": what goes on the plate. */
export const mealAmount = (m: Pick<PrepMeal, 'portion' | 'sides'>): string =>
  [portionLabel(m.portion), ...m.sides.map((s) => s.amount)].join(' + ');

/** What a planned meal logs as: the recipe with its portion and sides, at home (it was bought). */
export function mealFood(meal: PrepMeal): Food {
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    key: `recipe:${meal.recipeId}`,
    name: meal.name,
    detail: 'z planu posiłków',
    source: 'recipe',
    amountLabel: mealAmount(meal),
    nutrients: { kcal: Math.round(meal.total.kcal), protein: r(meal.total.protein), carbs: r(meal.total.carbs), fat: r(meal.total.fat) },
    per100: null,
    grams: null,
    stores: [],
    atHome: true,
    role: meal.role === 'lunchBox' || meal.role === 'dinnerBox' || meal.role === 'lunch' ? 'main' : 'light',
  };
}

/** The meals of a date, in the order of the day. */
export const mealsOn = (plan: PrepPlan, date: string): PrepMeal[] =>
  plan.meals.filter((m) => m.date === date).sort((a, b) => a.slot - b.slot);

/** A day's planned totals, as the diary adds up what was eaten. */
export function dayPlanTotals(plan: PrepPlan, date: string): DayTotals {
  const sum: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of mealsOn(plan, date)) {
    sum.kcal += m.total.kcal;
    sum.protein += m.total.protein;
    sum.carbs += m.total.carbs;
    sum.fat += m.total.fat;
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return { kcal: Math.round(sum.kcal), protein: r(sum.protein), carbs: r(sum.carbs), fat: r(sum.fat), unknownMacros: 0 };
}

/** The average planned day: what the summary says the plan gives. */
export function averageDay(plan: PrepPlan): DayTotals {
  const days = plan.dayTargets.map((d) => dayPlanTotals(plan, d.date));
  const mean = (pick: (t: DayTotals) => number) => Math.round(days.reduce((s, d) => s + pick(d), 0) / Math.max(1, days.length));
  return { kcal: mean((d) => d.kcal), protein: mean((d) => d.protein), carbs: mean((d) => d.carbs), fat: mean((d) => d.fat), unknownMacros: 0 };
}

/**
 * How far the shopping is: lines ticked of the lines to buy. Pantry goods („Sprawdź w domu”) are not
 * shopping unless they run out, so they count on neither side.
 */
export function shoppingProgress(plan: Pick<PrepPlan, 'shopping'>, bought: ReadonlySet<string>): { done: number; total: number } {
  const toBuy = plan.shopping.filter((i) => i.group !== 'home');
  return { done: toBuy.filter((i) => bought.has(i.key)).length, total: toBuy.length };
}
