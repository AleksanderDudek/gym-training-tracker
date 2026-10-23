import type { Food } from '../diet/foods';
import { combine, suggest, type Context, type Suggestion } from '../diet/suggest';
import { restaurantFood } from '../restaurants/food';
import type { Chain } from '../restaurants/types';
import { distanceMeters } from './geo';
import type { OpenState } from './hours';
import type { Place } from './places';
import type { LatLon } from './types';

/**
 * „Zjedz teraz”: every place around, what can be eaten there, and how well it fits what is left of
 * today. The scoring is the diary's own (`suggest`): a meal's share of the kcal left, the protein
 * gap, the diet profile's fit, penalties over budget - so a place is as good as its best dish for
 * this moment. Distance discounts it: hungry people do not walk two kilometres for a slightly better
 * wrap.
 */

/** Walking pace for "4 min pieszo": 4.8 km/h, an unhurried city walk with crossings. */
export const WALK_M_PER_MIN = 80;

/** How much of a place's score the edge of the radius costs (linear from the user's spot). */
export const DISTANCE_WEIGHT = 0.5;

/** A single item under this share of one meal's kcal makes pairs worth looking at. */
const PAIR_BELOW = 0.6;
/** Pairs are built from the best this many singles: enough for a skyr and a bar, not a combinatorial menu. */
const PAIR_FROM = 6;

export interface PlaceFoods {
  /** The chain whose menu the place serves, when known. */
  menu: Chain | null;
  /** Shown as the place's chain: the menu's name, the shop chain's name, or nothing. */
  label: string | null;
  foods: Food[];
}

/**
 * What can be had at a place: its chain's menu (positions as served) and, in a grocery shop, its
 * ready protein products. A Żabka has both: Żabka Café and the shelf.
 */
export function placeFoods(
  place: Place,
  menuOf: (brand: string) => Chain | null,
  readyFor: (shop: string) => Food[],
  shopName: (shop: string) => string,
): PlaceFoods {
  const found = menuOf(place.brand);
  const near = found?.osm?.near;
  // A local chain's common name elsewhere is another business.
  const menu = found && near && distanceMeters(place, near) > near.km * 1000 ? null : found;
  const foods = [
    ...(menu ? menu.items.map((item) => restaurantFood(menu, item)) : []),
    ...(place.shop ? readyFor(place.shop) : []),
  ];
  // A shop is named by its chain („Żabka”), not by the café counter inside it.
  return { menu, label: place.shop ? shopName(place.shop) : (menu?.name ?? null), foods };
}

/** A restaurant position without the chain in brackets — the card already says where. */
export function dishName(food: Food): string {
  const suffix = ` (${food.detail})`;
  return food.source === 'restaurant' && food.name.endsWith(suffix) ? food.name.slice(0, -suffix.length) : food.name;
}

export interface RankedPlace {
  place: Place;
  distance: number;
  walkMin: number;
  open: OpenState | null;
  /** Chain shown with the place. */
  label: string | null;
  /** Grouping for the list: one row per chain (the best-placed venue), independent places alone. */
  chainKey: string;
  /** Everything to eat here, best first (singles, and pairs when no single makes a meal). */
  options: Suggestion[];
  best: Suggestion | null;
  /** The best option's score, discounted by distance; `-Infinity` without data. */
  score: number;
}

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

/** Everything to eat at one place, ranked for now. */
export function rankFoods(foods: Food[], ctx: Context, mealKcal: number): Suggestion[] {
  // Nothing here comes from a shop down the road: availability must not tilt the order.
  const here: Context = { ...ctx, nearby: [] };
  const singles = suggest(foods, here, foods.length);
  const top = singles[0];
  if (!top || top.food.nutrients.kcal >= PAIR_BELOW * mealKcal) return singles;
  const base = singles.slice(0, PAIR_FROM).map((s) => s.food);
  const pairs: Food[] = [];
  for (let i = 0; i < base.length; i++)
    for (let j = i + 1; j < base.length; j++) {
      const pair = combine(base[i]!, base[j]!);
      if (pair.nutrients.kcal <= ctx.remaining.kcal + 100) pairs.push(pair);
    }
  return [...singles, ...suggest(pairs, here, pairs.length)].sort((a, b) => b.score - a.score);
}

export function rankPlaces(input: {
  places: Place[];
  center: LatLon;
  radius: number;
  foodsOf: (place: Place) => PlaceFoods;
  ctx: Context;
  mealKcal: number;
  openOf: (place: Place) => OpenState | null;
}): RankedPlace[] {
  // The same chain's menu is ranked once, whatever the number of its venues around.
  const memo = new Map<string, Suggestion[]>();
  return input.places
    .map((place) => {
      const distance = distanceMeters(input.center, place);
      return { place, distance };
    })
    .filter((p) => p.distance <= input.radius)
    .map(({ place, distance }) => {
      const { menu, label, foods } = input.foodsOf(place);
      const chainKey = menu ? `menu:${menu.id}` : place.shop ? `shop:${place.shop}` : place.id;
      const key = `${menu?.id ?? ''}|${place.shop ?? ''}`;
      let options = foods.length ? memo.get(key) : [];
      if (!options) {
        options = rankFoods(foods, input.ctx, input.mealKcal);
        memo.set(key, options);
      }
      const best = options[0] ?? null;
      return {
        place,
        distance,
        walkMin: walkMinutes(distance),
        open: input.openOf(place),
        label,
        chainKey,
        options,
        best,
        score: best ? best.score - DISTANCE_WEIGHT * (distance / Math.max(1, input.radius)) : -Infinity,
      };
    });
}

/* ---------------- The list under the map ---------------- */

export type SortKey = 'best' | 'protein' | 'near' | 'light';

export interface EatPick {
  place: RankedPlace;
  /** The dish that answers this sort: the best fit, the most protein, the lightest real meal. */
  dish: Suggestion;
}

const usable = (s: Suggestion, ctx: Context) => s.fit.level !== 'avoid' && s.food.nutrients.kcal <= ctx.remaining.kcal + 100;

/** The dish a place is listed with under a sort; `null` when nothing there answers it. */
export function dishFor(place: RankedPlace, sort: SortKey, ctx: Context, mealKcal: number): Suggestion | null {
  if (!place.best) return null;
  if (sort === 'protein') {
    const fits = place.options.filter((s) => usable(s, ctx));
    return fits.reduce<Suggestion | null>(
      (top, s) => (!top || (s.food.nutrients.protein ?? 0) > (top.food.nutrients.protein ?? 0) ? s : top),
      null,
    ) ?? place.best;
  }
  if (sort === 'light') {
    // The lightest thing that is still a meal-ish portion, not a sachet of ketchup.
    const floor = Math.max(150, 0.4 * mealKcal);
    const fits = place.options.filter((s) => s.fit.level !== 'avoid' && s.food.nutrients.kcal >= floor);
    return fits.reduce<Suggestion | null>(
      (top, s) => (!top || s.food.nutrients.kcal < top.food.nutrients.kcal ? s : top),
      null,
    ) ?? place.best;
  }
  return place.best;
}

/**
 * The list under the map: one row per chain (its best-placed venue - with the distance discount
 * that is the nearest), places without anything to eat left out, ordered by the sort.
 */
export function picks(places: RankedPlace[], sort: SortKey, ctx: Context, mealKcal: number): EatPick[] {
  const byChain = new Map<string, RankedPlace>();
  for (const p of places) {
    if (!p.best) continue;
    const seen = byChain.get(p.chainKey);
    if (!seen || p.score > seen.score) byChain.set(p.chainKey, p);
  }
  const rows = [...byChain.values()].map((place) => ({ place, dish: dishFor(place, sort, ctx, mealKcal)! }));
  const protein = (r: EatPick) => r.dish.food.nutrients.protein ?? 0;
  const order: Record<SortKey, (a: EatPick, b: EatPick) => number> = {
    best: (a, b) => b.place.score - a.place.score,
    protein: (a, b) => protein(b) - protein(a) || a.place.distance - b.place.distance,
    near: (a, b) => a.place.distance - b.place.distance,
    light: (a, b) => a.dish.food.nutrients.kcal - b.dish.food.nutrients.kcal || a.place.distance - b.place.distance,
  };
  return rows.sort(order[sort]);
}
