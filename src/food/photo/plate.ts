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
}

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

export function itemEstimate(item: PlateItem): Estimate {
  return estimate(item.dish, gramsOf(item), item.choices);
}

export function plateTotal(items: readonly PlateItem[]): Estimate {
  const all = items.map(itemEstimate);
  const sum = (k: keyof Estimate) => all.reduce((s, e) => s + e[k], 0);
  // Independent errors add in quadrature, not linearly: a plate of three is not three times as unsure.
  const kcal = Math.round(sum('kcal'));
  const spread = Math.sqrt(all.reduce((s, e) => s + ((e.high - e.low) / 2) ** 2, 0));
  return {
    kcal,
    protein: Math.round(sum('protein') * 10) / 10,
    carbs: Math.round(sum('carbs') * 10) / 10,
    fat: Math.round(sum('fat') * 10) / 10,
    sugars: Math.round(sum('sugars') * 10) / 10,
    low: Math.max(0, Math.round(kcal - spread)),
    high: Math.round(kcal + spread),
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
  const per100 = adjustedPer100(item.dish, item.choices);
  const words = choiceWords(item);
  return {
    key: `dish:${item.dish.id}`,
    name: words.length ? `${item.dish.label} (${words.join(', ')})` : item.dish.label,
    detail: say('ze zdjęcia, szacunek', 'from a photo, an estimate'),
    source: 'dish',
    amountLabel: `${grams} g`,
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
