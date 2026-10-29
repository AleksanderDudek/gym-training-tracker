import { say } from '../../i18n';
import type { Food, MealRole } from '../diet/foods';
import { normalizeForSearch } from '../lib/text';
import {
  DISHES,
  FAT_SCALE,
  SAUCE_SCALE,
  SWEET_SCALE,
  estimate,
  adjustedPer100,
  type Choices,
  type Dish,
  type DishGroup,
  type Estimate,
  type Macros,
} from './dishes';

/**
 * A plate from a photo: the dishes the person confirmed, each with a portion (a multiple of the
 * dish's typical serving) and the scales they answered. Pure — the screen and the tests share it.
 */

export interface PlateItem {
  dish: Dish;
  /** Multiple of `dish.portion.g`, in steps of ¼ (`PORTION_STEPS`). */
  portion: number;
  choices: Choices;
  /**
   * The model's first guess, not yet confirmed: the other dishes it found likely. The range covers
   * them; another suggestion replaces this item instead of joining it. Gone once the person
   * touches the item.
   */
  alts?: readonly Dish[];
  /** Values per 100 g from a food in the database with a similar name, in place of the catalog's. */
  ref?: PlateRef;
}

/** A food from the app's database („Podobne w bazie”): its name and values per 100 g. */
export interface PlateRef {
  key: string;
  name: string;
  detail: string;
  per100: { kcal: number; protein: number; carbs: number; fat: number };
}

/** A suggestion with less of the probability than this is not one of the „other likely dishes”. */
export const ALT_SHARE = 0.1;

/** ¼ to 3 portions. A quarter is a bite of cake; three is a family-size plate. */
export const PORTION_STEPS: readonly number[] = Array.from({ length: 12 }, (_, i) => (i + 1) / 4);

export const gramsOf = (item: PlateItem) => Math.round(item.dish.portion.g * item.portion);

/** The words under the slider: how big the portion is next to a typical one. */
export function portionWord(portion: number): string {
  if (portion <= 0.5) return say('mała porcja', 'small portion');
  if (portion < 1) return say('mniejsza niż zwykle', 'smaller than usual');
  if (portion === 1) return say('zwykła porcja', 'usual portion');
  if (portion <= 1.5) return say('większa niż zwykle', 'larger than usual');
  return say('duża porcja', 'large portion');
}

/** The values the item is counted from: the catalog's, or the chosen database food's (sugars stay the dish's, at most its carbs). */
function baseOf(item: PlateItem): Macros | undefined {
  const r = item.ref?.per100;
  return r && { ...r, sugars: Math.min(item.dish.per100.sugars, r.carbs) };
}

export function itemEstimate(item: PlateItem): Estimate {
  return estimate(item.dish, gramsOf(item), item.choices, baseOf(item));
}

/**
 * The honest range of an item: its own, or — while it is the model's unconfirmed guess — wide
 * enough for each other likely dish at the portion it would have (`newItem`).
 */
export function itemRange(item: PlateItem): { low: number; high: number } {
  const e = itemEstimate(item);
  let { low, high } = e;
  for (const dish of item.alts ?? []) {
    const alt = itemEstimate(newItem(dish));
    low = Math.min(low, alt.low);
    high = Math.max(high, alt.high);
  }
  return { low, high };
}

/** The other likely dishes of a photo: those with at least `ALT_SHARE` of the top five's probability. */
export function likelyAlts(suggestions: readonly { dish: Dish; score: number }[]): Dish[] {
  const total = suggestions.reduce((s, x) => s + x.score, 0) || 1;
  return suggestions.slice(1).flatMap((s) => (s.score / total >= ALT_SHARE ? [s.dish] : []));
}

export function plateTotal(items: readonly PlateItem[]): Estimate {
  const all = items.map(itemEstimate);
  const ranges = items.map(itemRange);
  const sum = (k: keyof Estimate) => all.reduce((s, e) => s + e[k], 0);
  // Independent errors add in quadrature, not linearly: a plate of three is not three times as unsure.
  // An unconfirmed guess may be lopsided (pho is lighter than pad thai): each side is added on its own.
  const kcal = Math.round(sum('kcal'));
  const below = Math.sqrt(all.reduce((s, e, i) => s + (e.kcal - ranges[i]!.low) ** 2, 0));
  const above = Math.sqrt(all.reduce((s, e, i) => s + (ranges[i]!.high - e.kcal) ** 2, 0));
  return {
    kcal,
    protein: Math.round(sum('protein') * 10) / 10,
    carbs: Math.round(sum('carbs') * 10) / 10,
    fat: Math.round(sum('fat') * 10) / 10,
    sugars: Math.round(sum('sugars') * 10) / 10,
    low: Math.max(0, Math.round(kcal - below)),
    high: Math.round(kcal + above),
  };
}

const LIGHT: readonly DishGroup[] = ['breakfast', 'snack', 'drink', 'fruit', 'dessert', 'side'];

/** The answered scales as words, for the entry's name: „tłuste, dużo sosu”. */
export function choiceWords(item: PlateItem): string[] {
  const words: string[] = [];
  const word = (levels: readonly { id: string; label: string }[], id: string | undefined) => levels.find((l) => l.id === id)?.label;
  if (item.choices.fat && item.choices.fat !== 'usual') words.push(word(FAT_SCALE.levels, item.choices.fat)!);
  if (item.choices.sweet && item.choices.sweet !== 'usual') words.push(word(SWEET_SCALE.levels, item.choices.sweet)!);
  if (item.choices.sauce && item.choices.sauce !== 'usual') words.push(word(SAUCE_SCALE.levels, item.choices.sauce)!);
  return words;
}

/** The diary food for one plate item: a snapshot with the portion and the answered scales in its name. */
export function plateFood(item: PlateItem): Food {
  const grams = gramsOf(item);
  const e = itemEstimate(item);
  const per100 = adjustedPer100(item.dish, item.choices, baseOf(item));
  const words = choiceWords(item);
  const ref = item.ref?.name;
  return {
    key: `dish:${item.dish.id}`,
    name: words.length ? `${item.dish.label} (${words.join(', ')})` : item.dish.label,
    detail: say('ze zdjęcia, szacunek', 'from a photo, an estimate'),
    source: 'dish',
    // The diary shows the amount, so that is where it says whose values were used.
    amountLabel: ref ? say(`${grams} g, wartości jak ${ref}`, `${grams} g, values as ${ref}`) : `${grams} g`,
    nutrients: { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat },
    per100: { kcal: per100.kcal, protein: per100.protein, carbs: per100.carbs, fat: per100.fat },
    grams,
    stores: [],
    atHome: false,
    role: LIGHT.includes(item.dish.group) ? 'light' : ('main' satisfies MealRole),
  };
}

/** Dishes whose name or model phrase matches every word typed, best (name starts with it) first. */
export function searchDishes(query: string, limit = 8): Dish[] {
  const words = normalizeForSearch(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored = DISHES.flatMap((dish) => {
    const name = normalizeForSearch(dish.label);
    const all = `${name} ${normalizeForSearch(dish.prompts.join(' '))}`;
    if (!words.every((w) => all.includes(w))) return [];
    return [{ dish, rank: name.startsWith(words[0]!) ? 0 : name.includes(words[0]!) ? 1 : 2 }];
  });
  return scored.sort((a, b) => a.rank - b.rank || a.dish.label.localeCompare(b.dish.label)).slice(0, limit).map((s) => s.dish);
}

/* ---------------- What the person chose last time, per dish ---------------- */

const KEY = 'produkty-pl:dish-choices';

type Remembered = Record<string, { portion: number; choices: Choices }>;

function readAll(): Remembered {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Remembered) : {};
  } catch {
    return {};
  }
}

/** A new plate item: the portion and scales chosen last time for this dish, else one usual portion. */
export function newItem(dish: Dish): PlateItem {
  const last = readAll()[dish.id];
  const portion = last && PORTION_STEPS.includes(last.portion) ? last.portion : 1;
  const choices: Choices = {};
  if (dish.adjust.fat && FAT_SCALE.levels.some((l) => l.id === last?.choices.fat)) choices.fat = last!.choices.fat;
  if (dish.adjust.sweet && SWEET_SCALE.levels.some((l) => l.id === last?.choices.sweet)) choices.sweet = last!.choices.sweet;
  if (dish.adjust.sauce && SAUCE_SCALE.levels.some((l) => l.id === last?.choices.sauce)) choices.sauce = last!.choices.sauce;
  return { dish, portion, choices };
}

/** Kept on this device only; at most 200 dishes, the oldest dropped. */
export function rememberItems(items: readonly PlateItem[]): void {
  try {
    const all = readAll();
    for (const i of items) {
      delete all[i.dish.id];
      all[i.dish.id] = { portion: i.portion, choices: i.choices };
    }
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete all[k];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Without storage the next plate starts from usual portions.
  }
}

export const DISH_CHOICES_KEY = KEY;

/**
 * Foods in the app's database whose name is like the dish's („Podobne w bazie”): the whole name
 * first, then its first two words, then the first one; only foods with values per 100 g. `find`
 * is the diary's own search (`searchFoods`), so the list is what typing the name would show.
 * A name match far from the dish in energy (`PLAUSIBLE`) is something else that shares a word —
 * breadcrumbs „do schabowego”, a dry pasta for a cooked one — and a second copy of the same food
 * (same name, same kcal) adds nothing.
 */
/** How far from the dish's kcal/100 g a food may be and still be the same kind of thing. */
const PLAUSIBLE = [0.5, 2] as const;

export function similarFoods(dish: Dish, find: (query: string) => readonly Food[], limit = 3): PlateRef[] {
  const words = dish.label
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const queries = [...new Set([words.join(' '), words.slice(0, 2).join(' '), words[0] ?? ''])].filter(Boolean);
  const out: PlateRef[] = [];
  for (const q of queries) {
    for (const f of find(q)) {
      if (out.length >= limit) return out;
      if (!f.per100 || f.source === 'set' || f.source === 'dish') continue;
      const ratio = f.per100.kcal / dish.per100.kcal;
      if (!(ratio >= PLAUSIBLE[0] && ratio <= PLAUSIBLE[1])) continue;
      const same = (r: PlateRef) => r.key === f.key || (normalizeForSearch(r.name) === normalizeForSearch(f.name) && r.per100.kcal === f.per100!.kcal);
      if (out.some(same)) continue;
      out.push({ key: f.key, name: f.name, detail: f.detail, per100: { kcal: f.per100.kcal, protein: f.per100.protein, carbs: f.per100.carbs, fat: f.per100.fat } });
    }
  }
  return out;
}
