import type { Product } from '../lib/types';

/** Energy and the three macronutrients, per 100 g or per amount. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * THE RULE of this tab: more protein than carbohydrate AND more protein than
 * fat, each on its own, strictly. Judged on what is actually eaten — a
 * recipe's totals, or a ready product per 100 g. Unknown never passes.
 */
export function isProteinForward(m: { protein: number | null; carbs: number | null; fat: number | null }): boolean {
  if (m.protein === null || m.carbs === null || m.fat === null) return false;
  return m.protein > m.carbs && m.protein > m.fat;
}

/** A product's macros per 100 g, or null unless all four are known. */
export function macrosOf(p: Product): Macros | null {
  const { kcal, protein, carbs, fat } = p.nutrition;
  if (kcal === null || protein === null || carbs === null || fat === null) return null;
  return { kcal, protein, carbs, fat };
}

export function scale(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  const r = (n: number) => Math.round(n * f * 100) / 100;
  return { kcal: r(per100.kcal), protein: r(per100.protein), carbs: r(per100.carbs), fat: r(per100.fat) };
}

export function sumMacros(list: Macros[]): Macros {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of list) {
    total.kcal += m.kcal;
    total.protein += m.protein;
    total.carbs += m.carbs;
    total.fat += m.fat;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { kcal: r(total.kcal), protein: r(total.protein), carbs: r(total.carbs), fat: r(total.fat) };
}

/**
 * One of `servings` equal portions. Deliberately NOT rounded: dividing every
 * macro by the same number keeps the rule's strict order, while rounding to
 * a hundredth could turn a 10.00 > 9.99 total into a 3.33 = 3.33 tie.
 */
export function divideMacros(m: Macros, servings: number): Macros {
  return { kcal: m.kcal / servings, protein: m.protein / servings, carbs: m.carbs / servings, fat: m.fat / servings };
}

/** How much of the energy comes from protein (4 kcal per gram). */
export function proteinEnergyShare(m: Macros): number {
  return m.kcal > 0 ? Math.min(1, (m.protein * 4) / m.kcal) : 0;
}
