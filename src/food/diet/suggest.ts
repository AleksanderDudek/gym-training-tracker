import type { Food } from './foods';
import type { DietProfile, Fit, MacroTargets } from './profiles';

/**
 * "What should I eat now?" as a transparent score, and the reasons it gives.
 * A suggestion is good when it fills about one meal's share of what is left,
 * closes the protein gap, suits the diet profile and can be had: at home, or
 * in a shop nearby. The three best are starred.
 */

export interface Remaining {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Context {
  remaining: Remaining;
  targets: MacroTargets;
  profile: DietProfile;
  /** Meals still to eat today, including this one (at least 1). */
  mealsLeft: number;
  /** Chains near the user, nearest first. */
  nearby: string[];
  /** Display name of a chain. */
  storeName: (chain: string) => string;
  /** Distance label of the nearest shop of a chain, when known ("300 m"). */
  distance?: (chain: string) => string | null;
}

export interface Suggestion {
  food: Food;
  score: number;
  best: boolean;
  fit: Fit;
  reasons: string[];
  /** Where to get it: "masz w domu", "Biedronka · 300 m". */
  where: string | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function availability(food: Food, ctx: Context): { score: number; where: string | null } {
  // A set is a habit of the user's own: as much at hand as food at home, wherever its parts come from.
  if (food.source === 'set') return { score: 0.3, where: 'Twój zestaw' };
  if (food.atHome) return { score: 0.3, where: 'masz w domu' };
  if (food.everywhere) return { score: 0.25, where: 'w każdym większym sklepie' };
  const nearIndex = ctx.nearby.findIndex((chain) => food.stores.includes(chain));
  const chain = ctx.nearby[nearIndex];
  if (chain !== undefined) {
    const distance = ctx.distance?.(chain);
    return { score: nearIndex === 0 ? 0.3 : 0.2, where: [ctx.storeName(chain), distance].filter(Boolean).join(' · ') };
  }
  if (food.stores.length) return { score: 0.05, where: food.stores.map(ctx.storeName).join(', ') };
  return { score: 0, where: null };
}

const g = (n: number) => `${Math.round(n)} g`;

function evaluate(food: Food, ctx: Context): Omit<Suggestion, 'best'> {
  const n = food.nutrients;
  const protein = n.protein ?? 0;
  const carbs = n.carbs ?? 0;
  const fat = n.fat ?? 0;
  const mealKcal = Math.max(150, ctx.remaining.kcal / Math.max(1, ctx.mealsLeft));
  const mealProtein = Math.max(10, ctx.remaining.protein / Math.max(1, ctx.mealsLeft));

  const kcalFit = 1 - clamp01(Math.abs(n.kcal - mealKcal) / mealKcal);
  const proteinFit = ctx.remaining.protein > 0 ? clamp01(protein / mealProtein) : 0.5;
  const fit =
    n.protein === null
      ? { level: 'ok' as const, reason: 'makroskładniki nieznane' }
      : ctx.profile.fit({ kcal: n.kcal, protein, carbs, fat });
  const fitScore = fit.level === 'great' ? 1 : fit.level === 'ok' ? 0.4 : -1;

  let penalty = 0;
  const reasons: string[] = [];
  if (n.kcal > ctx.remaining.kcal + 100) {
    penalty -= 1.5;
    reasons.push(`przekracza budżet o ${Math.round(n.kcal - ctx.remaining.kcal)} kcal`);
  }
  if (ctx.targets.carbs.max !== null && carbs > Math.max(0, ctx.remaining.carbs) + 5) {
    penalty -= 1;
    reasons.push(`${g(carbs)} węglowodanów przy limicie ${ctx.targets.carbs.max} g`);
  }
  if (fat > Math.max(0, ctx.remaining.fat) + 10) {
    penalty -= 0.5;
    reasons.push(`dużo tłuszczu (${g(fat)})`);
  }

  const { score: availabilityScore, where } = availability(food, ctx);
  if (protein >= 15 && ctx.remaining.protein > 0)
    reasons.unshift(`uzupełnia białko: ${g(protein)} z brakujących ${g(ctx.remaining.protein)}`);
  if (n.kcal <= ctx.remaining.kcal)
    reasons.push(`${n.kcal} z ${Math.round(Math.max(0, ctx.remaining.kcal))} kcal, które zostały`);
  reasons.push(fit.reason);

  // What this person stars is what they eat: a nudge, not a trump card.
  const favoriteBonus = food.favorite ? 0.3 : 0;
  if (food.favorite) reasons.unshift('Twoje ulubione');
  const score = 2 * kcalFit + 2 * proteinFit + fitScore + availabilityScore + favoriteBonus + penalty;
  return { food, score: Math.round(score * 100) / 100, fit, reasons, where };
}

/** Ranked suggestions for what is left of the day; add-ons (butter, oil) are never suggested alone. */
export function suggest(foods: Food[], ctx: Context, limit = 12): Suggestion[] {
  const ranked = foods
    .filter((f) => f.role !== 'addon' && f.nutrients.kcal >= 50)
    .map((f) => evaluate(f, ctx))
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'pl'))
    .slice(0, limit);
  return ranked.map((s, i) => ({ ...s, best: i < 3 && s.score > 2 && s.fit.level !== 'avoid' }));
}

/** How far apart two foods' macros are, in grams. Unknown macros count as far. */
function macroDistance(a: Food, b: Food): number {
  const d = (x: number | null, y: number | null) => (x === null || y === null ? 30 : Math.abs(x - y));
  return (
    d(a.nutrients.protein, b.nutrients.protein) * 1.5 +
    d(a.nutrients.carbs, b.nutrients.carbs) +
    d(a.nutrients.fat, b.nutrients.fat)
  );
}

export const SWAP_TOLERANCE = 0.12;

/** Two foods eaten as one meal: "½ opak. Burrito + Skyr". Bought where BOTH can be had. */
export const isPair = (food: Food) => food.key.startsWith('combo:');

export function combine(first: Food, second: Food): Food {
  // The bigger part leads ("Burrito + skyr"), so a pair has one name and one key whichever way it was found.
  const [a, b] =
    second.nutrients.kcal > first.nutrients.kcal ||
    (second.nutrients.kcal === first.nutrients.kcal && second.key < first.key)
      ? [second, first]
      : [first, second];
  const add = (x: number | null, y: number | null) => (x === null || y === null ? null : Math.round((x + y) * 10) / 10);
  const sourced = (f: Food) => (f.atHome || f.everywhere ? null : f.stores);
  const [sa, sb] = [sourced(a), sourced(b)];
  const atHome = a.atHome && b.atHome;
  return {
    key: `combo:${a.key}|${b.key}`,
    name: `${a.name} + ${b.name}`,
    detail: 'zestaw dwóch pozycji',
    source: a.source,
    amountLabel: `${a.amountLabel} + ${b.amountLabel}`,
    nutrients: {
      kcal: a.nutrients.kcal + b.nutrients.kcal,
      protein: add(a.nutrients.protein, b.nutrients.protein),
      carbs: add(a.nutrients.carbs, b.nutrients.carbs),
      fat: add(a.nutrients.fat, b.nutrients.fat),
    },
    per100: null,
    grams: null,
    // One shop for both when there is one; otherwise none is named rather than a wrong one.
    stores: sa && sb ? sa.filter((c) => sb.includes(c)) : (sa ?? sb ?? []),
    atHome,
    ...(!atHome && !sa && !sb && { everywhere: true }),
    role: 'main',
  };
}

/** Below this a planned item is a snack, and a snack is replaced by one thing, not two. */
const COMBO_FROM_KCAL = 450;
/** Pairs are built from this many of the most protein-dense parts: enough choice, few hundred pairs. */
const COMBO_PARTS = 40;

/** Pairs of foods that together come to about the calories of `item`. */
function combos(item: Food, foods: Food[], low: number, high: number): Food[] {
  const kcal = item.nutrients.kcal;
  const density = (f: Food) => (f.nutrients.protein ?? 0) / Math.max(1, f.nutrients.kcal);
  const parts = foods
    .filter(
      (f) =>
        f.role !== 'addon' &&
        f.key !== item.key &&
        f.nutrients.protein !== null &&
        f.nutrients.kcal >= kcal * 0.2 &&
        f.nutrients.kcal <= kcal * 0.8,
    )
    .sort((a, b) => density(b) - density(a))
    .slice(0, COMBO_PARTS);
  const pairs: Food[] = [];
  for (const [i, a] of parts.entries())
    for (const b of parts.slice(i + 1)) {
      const total = a.nutrients.kcal + b.nutrients.kcal;
      if (total >= low && total <= high) pairs.push(combine(a, b));
    }
  return pairs;
}

/**
 * What can replace a planned item: about the same calories (±12%), so the
 * day still adds up, the closest macros first (protein weighs most, so a swap
 * does not quietly drop the day's protein), then diet fit and availability.
 * A big item (a whole catering pack) rarely has a single equal, so when
 * singles are few, pairs of foods that add up to it are offered too.
 */
export function swaps(item: Food, foods: Food[], ctx: Context, limit = 10): Suggestion[] {
  const low = item.nutrients.kcal * (1 - SWAP_TOLERANCE);
  const high = item.nutrients.kcal * (1 + SWAP_TOLERANCE);
  const singles = foods.filter(
    (f) =>
      f.key !== item.key &&
      f.nutrients.kcal >= low &&
      f.nutrients.kcal <= high &&
      (item.role === 'addon' || f.role !== 'addon'),
  );
  const candidates =
    singles.length < limit / 2 && item.nutrients.kcal >= COMBO_FROM_KCAL
      ? [...singles, ...combos(item, foods, low, high)]
      : singles;
  return (
    candidates
      .map((f) => {
        const e = evaluate(f, ctx);
        const distance = macroDistance(item, f);
        const reasons = [
          `${f.nutrients.kcal} kcal zamiast ${item.nutrients.kcal}`,
          ...e.reasons.filter((r) => !r.includes('kcal, które')),
        ];
        const delta = (f.nutrients.protein ?? 0) - (item.nutrients.protein ?? 0);
        if (Math.abs(delta) >= 5)
          reasons.unshift(delta > 0 ? `+${Math.round(delta)} g białka` : `${Math.round(delta)} g białka`);
        const fitScore = e.fit.level === 'great' ? 1 : e.fit.level === 'ok' ? 0.4 : -1;
        return {
          ...e,
          reasons,
          score: Math.round((fitScore + availability(f, ctx).score - distance / 40) * 100) / 100,
        };
      })
      // Singles first, whatever the scores: one thing in place of one thing is
      // the swap a person means; pairs are the fallback, listed after them.
      .sort(
        (a, b) =>
          Number(isPair(a.food)) - Number(isPair(b.food)) ||
          b.score - a.score ||
          a.food.name.localeCompare(b.food.name, 'pl'),
      )
      .slice(0, limit)
      .map((s, i) => ({ ...s, best: i === 0 && s.fit.level !== 'avoid' }))
  );
}

export interface Slot {
  name: string;
  share: number;
  roles: Food['role'][];
}

export const DAY_SLOTS: Slot[] = [
  { name: 'Śniadanie', share: 0.25, roles: ['light'] },
  { name: 'Obiad', share: 0.35, roles: ['main'] },
  { name: 'Kolacja', share: 0.3, roles: ['main', 'light'] },
  { name: 'Przekąska', share: 0.1, roles: ['light'] },
];

/** A small deterministic generator: the same seed picks the same day; another seed, another day. */
export function random(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface AutoMeal {
  slot: string;
  suggestion: Suggestion;
}

/**
 * "Ułóż dzień": a meal per slot, each scored against ITS share of the day
 * (breakfast a quarter, dinner a third…), never the same food twice. Picks
 * among the five best with a seeded weight, so a day is stable until the user
 * asks for another, and two clicks give two different days.
 */
export function autoDay(foods: Food[], ctx: Omit<Context, 'mealsLeft' | 'remaining'>, seed: number): AutoMeal[] {
  const rand = random(seed);
  const used = new Set<string>();
  const meals: AutoMeal[] = [];
  for (const slot of DAY_SLOTS) {
    const remaining = {
      kcal: ctx.targets.kcal * slot.share,
      protein: ctx.targets.protein.target * slot.share,
      carbs: ctx.targets.carbs.target * slot.share,
      fat: ctx.targets.fat.target * slot.share,
    };
    const pool = foods.filter((f) => slot.roles.includes(f.role) && !used.has(f.key));
    const chosen = pickWeighted(suggest(pool, { ...ctx, remaining, mealsLeft: 1 }, 5), rand);
    if (!chosen) continue;
    used.add(chosen.food.key);
    meals.push({ slot: slot.name, suggestion: chosen });
  }
  return meals;
}

/** One of the ranked, better ranks likelier (weights 5, 4, 3, 2, 1); never one that does not fit the diet. */
function pickWeighted(ranked: Suggestion[], rand: () => number): Suggestion | null {
  const fit = ranked.filter((s) => s.fit.level !== 'avoid');
  const [first] = fit;
  if (!first) return null;
  const weight = (i: number) => fit.length - i;
  let pick = rand() * fit.reduce((sum, _, i) => sum + weight(i), 0);
  for (const [i, suggestion] of fit.entries()) {
    pick -= weight(i);
    if (pick <= 0) return suggestion;
  }
  return first;
}

/** The slots still ahead when this many meals are left: the day ends with dinner and a snack. */
export function restSlots(meals: number): Slot[] {
  const [, lunch, dinner, snack] = DAY_SLOTS as [Slot, Slot, Slot, Slot];
  if (meals >= 4) return DAY_SLOTS;
  if (meals === 3) return [lunch, dinner, snack];
  if (meals === 2) return [dinner, snack];
  if (meals === 1) return [dinner];
  return [];
}

/**
 * The rest of the day as meals whose sum lands on what is left. Each slot gets its share of what is
 * STILL left after the meals already picked - so a big first meal makes the next ones smaller and
 * the last one absorbs the error - and never the same food twice. When the slots' meals cannot hold
 * it all (2000 kcal left for dinner and a snack, portions of 500), more items join as „Dodatkowo”
 * until the rest is close: a variant must add up to what is left, not to two plates.
 */
export function restOfDay(foods: Food[], ctx: Context, seed: number): AutoMeal[] {
  const rand = random(seed);
  const slots = restSlots(ctx.mealsLeft);
  const used = new Set<string>();
  const meals: AutoMeal[] = [];
  let left = { ...ctx.remaining };
  slots.forEach((slot, i) => {
    const shares = slots.slice(i).reduce((sum, s) => sum + s.share, 0);
    const part = slot.share / shares;
    const remaining = {
      kcal: Math.max(0, left.kcal * part),
      protein: Math.max(0, left.protein * part),
      carbs: Math.max(0, left.carbs * part),
      fat: Math.max(0, left.fat * part),
    };
    if (remaining.kcal < MIN_MEAL_KCAL) return;
    const pool = foods.filter((f) => slot.roles.includes(f.role) && !used.has(f.key));
    const chosen = pickWeighted(suggest(pool, { ...ctx, remaining, mealsLeft: 1 }, 5), rand);
    if (!chosen) return;
    used.add(chosen.food.key);
    meals.push({ slot: slot.name, suggestion: chosen });
    left = minus(left, chosen.food);
  });
  for (let extra = 0; extra < MAX_EXTRAS && left.kcal > Math.max(EXTRA_FROM_KCAL, ctx.remaining.kcal * EXTRA_SHARE); extra++) {
    const pool = foods.filter((f) => !used.has(f.key) && f.nutrients.kcal <= left.kcal * 1.15);
    const chosen = pickWeighted(suggest(pool, { ...ctx, remaining: left, mealsLeft: 1 }, 5), rand);
    if (!chosen) break;
    used.add(chosen.food.key);
    meals.push({ slot: 'Dodatkowo', suggestion: chosen });
    left = minus(left, chosen.food);
  }
  return meals;
}

const minus = (left: Remaining, food: Food): Remaining => ({
  kcal: left.kcal - food.nutrients.kcal,
  protein: left.protein - (food.nutrients.protein ?? 0),
  carbs: left.carbs - (food.nutrients.carbs ?? 0),
  fat: left.fat - (food.nutrients.fat ?? 0),
});

/** Extra items join while more than this is left - in kcal, and as a share of the rest. */
const EXTRA_FROM_KCAL = 250;
const EXTRA_SHARE = 0.15;
const MAX_EXTRAS = 3;

/** Below this a slot is not a meal: what is left goes to the meals that can still hold it. */
const MIN_MEAL_KCAL = 80;

export interface RestVariant {
  meals: AutoMeal[];
  kcal: number;
  protein: number;
}

/**
 * Several different rests of the day, the closest to what is left first: the kcal miss, and protein
 * short of what is left counting three times as much (the diet's first macro).
 */
export function restVariants(foods: Food[], ctx: Context, seed: number, count = 3): RestVariant[] {
  if (ctx.remaining.kcal < MIN_MEAL_KCAL) return [];
  const seen = new Set<string>();
  const out: RestVariant[] = [];
  for (let i = 0; i < count * 4 && out.length < count; i++) {
    const meals = restOfDay(foods, ctx, seed + i * 7919);
    const key = meals.map((m) => m.suggestion.food.key).sort().join('|');
    if (!meals.length || seen.has(key)) continue;
    seen.add(key);
    out.push({
      meals,
      kcal: Math.round(meals.reduce((sum, m) => sum + m.suggestion.food.nutrients.kcal, 0)),
      protein: Math.round(meals.reduce((sum, m) => sum + (m.suggestion.food.nutrients.protein ?? 0), 0)),
    });
  }
  const miss = (v: RestVariant) =>
    Math.abs(v.kcal - ctx.remaining.kcal) + 3 * Math.max(0, ctx.remaining.protein - v.protein);
  return out.sort((a, b) => miss(a) - miss(b));
}
