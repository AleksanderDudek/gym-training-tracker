import type { Food, MealRole } from '../diet/foods';
import { formatNumber } from '../lib/format';
import type { Chain, MenuItem } from './types';

export const isDrink = (item: MenuItem): boolean => item.category === 'kawa' || item.category === 'napoj';

/**
 * "1 szt." gets the weight when the chain publishes it: "1 szt. · 219 g". A
 * drink keeps its own size words ("Grande", "0,4 l") - chains weigh drinks in
 * grams or measure them in millilitres, and the data does not say which.
 */
export function portionLabel(item: MenuItem): string {
  if (item.grams === null || isDrink(item) || /\d\s*(g|ml|l)\b/i.test(item.portion)) return item.portion;
  return `${item.portion} · ${formatNumber(item.grams, 0)} g`;
}

function roleOf(item: MenuItem): MealRole {
  // A sauce, a dressing or a syrup is eaten with something, never on its own.
  if (item.category === 'sos') return 'addon';
  return item.kcal >= 350 ? 'main' : 'light';
}

/**
 * A restaurant position as something to eat: the portion as served (no gram
 * editing - a Big Mac comes in one size), the chain in the name, so the diary
 * says where it was eaten.
 */
export function restaurantFood(chain: Chain, item: MenuItem): Food {
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    key: `restaurant:${chain.id}:${item.id}`,
    name: `${item.name} (${chain.name})`,
    // The portion is the amount label; the detail only says where.
    detail: chain.name,
    source: 'restaurant',
    amountLabel: portionLabel(item),
    nutrients: { kcal: Math.round(item.kcal), protein: r(item.protein), carbs: r(item.carbs), fat: r(item.fat) },
    per100: null,
    grams: null,
    stores: [],
    atHome: false,
    role: roleOf(item),
  };
}
