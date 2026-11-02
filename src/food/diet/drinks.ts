import type { DayRow } from './db';

/**
 * Hydration: what a day's drinks were, not only how much. EFSA (2010) counts water from all drinks
 * towards the adequate intake, and coffee and tea in usual amounts hydrate about as well as water
 * (Maughan et al., 2016, the Beverage Hydration Index; Killer et al., 2014) — so every kind counts
 * towards the day's total. The kinds still matter for two other things:
 *
 * - a sugar-sweetened drink brings calories and sugar, so it also goes into the food diary as an
 *   estimate (`SWEET_PER_100`), otherwise a can of cola would hydrate and vanish from the day;
 * - coffee and tea bring caffeine, shown against EFSA's (2015) safe daily amount.
 */
export type DrinkKind = 'water' | 'zero' | 'sweet' | 'coffee' | 'tea' | 'other';

/** In the order of the card's chips: the most common first. */
export const DRINK_KINDS: readonly DrinkKind[] = ['water', 'zero', 'coffee', 'tea', 'sweet', 'other'];

/** One drink as logged: kind and ml; the diary entry it made (sweet drinks) so „−” takes both back. */
export interface Drink {
  kind: DrinkKind;
  ml: number;
  /** HH:MM, when it was logged; old water rows have none. */
  at?: string;
  /** The food-diary entry a sweet drink added. */
  entryId?: number;
}

/** The card's amounts: a glass, a can, a bottle. */
export const DRINK_STEPS = [250, 330, 500] as const;

/**
 * A sugar-sweetened drink per 100 ml, as an estimate: regular cola (USDA FoodData Central: 42 kcal,
 * 10.6 g sugars) — orange juice and sweetened iced tea land within a few kcal. All of it sugar, so
 * carbs = sugars; no protein, fat or fibre.
 */
export const SWEET_PER_100 = { kcal: 42, sugars: 10.6 } as const;

/** Caffeine per 100 ml (USDA FoodData Central: brewed coffee 40 mg, brewed black tea 20 mg). */
export const CAFFEINE_PER_100: Partial<Record<DrinkKind, number>> = { coffee: 40, tea: 20 };

/**
 * EFSA (2015, Scientific Opinion on the safety of caffeine): up to 400 mg a day raises no safety
 * concern for healthy adults; 200 mg in pregnancy and while breastfeeding.
 */
export const CAFFEINE_SAFE_MG = { adult: 400, pregnancy: 200 } as const;

/** A day's drinks stop here (20 l): more is a typo, not a day. */
export const DRINKS_MAX_ML = 20_000;
/** Drinks kept on a day — far more than anyone drinks; the oldest go first. */
export const DRINKS_KEPT = 100;

/**
 * The day's drinks. Rows from before the kinds (a bare `water` total) read as one water drink, so
 * nothing logged earlier is lost.
 */
export function drinksOf(day: Pick<DayRow, 'drinks' | 'water'> | undefined): Drink[] {
  if (!day) return [];
  if (day.drinks) return day.drinks;
  return day.water && day.water > 0 ? [{ kind: 'water', ml: day.water }] : [];
}

export interface Hydration {
  /** All drinks, ml — what the bar and the target compare. */
  total: number;
  /** ml by kind, only kinds drunk this day, in `DRINK_KINDS` order. */
  byKind: { kind: DrinkKind; ml: number }[];
  /** Caffeine from coffee and tea, mg (an estimate). */
  caffeineMg: number;
  /** Calories the sweet drinks added to the food diary (an estimate). */
  sweetKcal: number;
}

export function hydration(drinks: readonly Drink[]): Hydration {
  const sums = new Map<DrinkKind, number>();
  for (const d of drinks) sums.set(d.kind, (sums.get(d.kind) ?? 0) + d.ml);
  const ml = (kind: DrinkKind) => sums.get(kind) ?? 0;
  return {
    total: drinks.reduce((s, d) => s + d.ml, 0),
    byKind: DRINK_KINDS.filter((k) => ml(k) > 0).map((kind) => ({ kind, ml: ml(kind) })),
    caffeineMg: Math.round(DRINK_KINDS.reduce((s, k) => s + (ml(k) * (CAFFEINE_PER_100[k] ?? 0)) / 100, 0)),
    sweetKcal: sweetValues(ml('sweet')).kcal,
  };
}

/** What a sweet drink of `ml` brings to the food diary: kcal, and sugar as both carbs and sugars. */
export function sweetValues(ml: number): { kcal: number; sugars: number } {
  return { kcal: Math.round((ml * SWEET_PER_100.kcal) / 100), sugars: Math.round((ml * SWEET_PER_100.sugars) / 10) / 10 };
}

/** The caffeine limit for this person: lower with the pregnancy/breastfeeding flag. */
export const caffeineSafeMg = (pregnancy: boolean): number => (pregnancy ? CAFFEINE_SAFE_MG.pregnancy : CAFFEINE_SAFE_MG.adult);

const KINDS = new Set<string>(DRINK_KINDS);

/** A drink from a backup or an old row: known kind, ml 1–2000, time and entry id kept when sane. */
export function cleanDrink(raw: unknown): Drink | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !KINDS.has(r.kind)) return null;
  if (typeof r.ml !== 'number' || !Number.isFinite(r.ml) || r.ml <= 0 || r.ml > 2000) return null;
  return {
    kind: r.kind as DrinkKind,
    ml: Math.round(r.ml),
    ...(typeof r.at === 'string' && /^\d{2}:\d{2}$/.test(r.at) && { at: r.at }),
    ...(typeof r.entryId === 'number' && Number.isInteger(r.entryId) && r.entryId > 0 && { entryId: r.entryId }),
  };
}
