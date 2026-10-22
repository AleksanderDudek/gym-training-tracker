import { describe, expect, test } from 'vitest';
import { productFood, type Food } from '../diet/foods';
import { dayNeeds } from '../diet/now';
import { completeProfile } from '../diet/store';
import type { Context } from '../diet/suggest';
import { normalizeChain } from '../restaurants/normalize';
import type { ChainData, MenuItemData } from '../restaurants/types';
import { brandIndex } from '../restaurants/brands';
import { dishName, picks, placeFoods, rankPlaces, walkMinutes } from './eat';
import type { Place } from './places';

/**
 * „Zjedz teraz”: places around ranked by their best dish for what is left of today. The user stands
 * at the centre; 0.001° of latitude is ~111 m.
 */

const item = (name: string, category: MenuItemData['category'], kcal: number, protein: number, carbs: number, fat: number): MenuItemData => ({
  name, category, portion: '1 szt.', grams: null, kcal, protein, carbs, fat, sugars: null, fiber: null, saturatedFat: null, salt: null,
});
const chain = (id: string, name: string, items: MenuItemData[]): ChainData => ({
  id, name, kind: 'fast-food', osm: { brands: [name] }, market: 'PL', source: { url: 'https://example.com', title: '', checked: '2026-10-01' }, items,
});
const BURGER = normalizeChain(
  chain('burgerownia', 'Burgerownia', [
    item('Wrap z kurczakiem', 'kanapka', 450, 35, 40, 15),
    item('Burger podwójny', 'burger', 950, 45, 60, 60),
    item('Frytki', 'dodatek', 350, 4, 45, 17),
    item('Ketchup', 'sos', 80, 0, 18, 0),
  ]),
);
const SALAD = normalizeChain(
  chain('salatkarnia', 'Sałatkarnia', [
    item('Bowl z łososiem', 'salatka', 520, 30, 45, 22),
    item('Sałatka z kurczakiem', 'salatka', 380, 32, 20, 18),
  ]),
);
const menuOf = brandIndex([BURGER, SALAD]);

const SKYR = productFood(
  { code: 'skyr', name: 'Skyr naturalny', brands: [], quantity: '150 g', categories: [], stores: ['zabka'], nutrition: { kcal: 63, protein: 11, carbs: 4, fat: 0 } } as never,
  { categories: {}, labels: {}, allergens: {}, additives: {}, brands: {}, stores: {} },
)!;
const BAR = productFood(
  { code: 'bar', name: 'Baton proteinowy', brands: [], quantity: '45 g', categories: [], stores: ['zabka'], nutrition: { kcal: 380, protein: 40, carbs: 30, fat: 10 } } as never,
  { categories: {}, labels: {}, allergens: {}, additives: {}, brands: {}, stores: {} },
)!;
const readyFor = (shop: string): Food[] => (shop === 'zabka' ? [SKYR, BAR] : []);

const CENTER = { lat: 52.2, lon: 21.0 };
const place = (id: string, brand: string, northM: number, over: Partial<Place> = {}): Place => ({
  id, name: brand, brand, kind: 'fast_food', shop: null, lat: CENTER.lat + northM / 111_000, lon: CENTER.lon,
  address: null, openingHours: null, cuisine: null, ...over,
});

const profile = completeProfile({ dailyKcal: 2000, targetWeightKg: 75 });
const needs = (eatenKcal = 900, mealsAhead = 2) =>
  dayNeeds({ profile, goalKcal: 2000, eaten: { kcal: eatenKcal, protein: 60, carbs: 100, fat: 30, unknownMacros: 0 }, cheat: null, mealsAhead });
const ctxOf = (n = needs()): Context => ({
  remaining: n.remaining, targets: n.targets, profile: n.profile, mealsLeft: n.mealsLeft, nearby: [], storeName: (s) => s,
});
const foodsOf = (p: Place) => placeFoods(p, menuOf, readyFor, (s) => (s === 'zabka' ? 'Żabka' : s));

describe('what each place offers', () => {
  test('a menu by the brand, the shelf by the shop; a Żabka-like shop has only its shelf here', () => {
    const burger = foodsOf(place('a', 'Burgerownia', 100));
    expect(burger.menu?.id).toBe('burgerownia');
    expect(burger.label).toBe('Burgerownia');
    expect(burger.foods).toHaveLength(4);
    const shop = foodsOf(place('b', 'Żabka', 100, { kind: 'shop', shop: 'zabka' }));
    expect(shop.menu).toBeNull();
    expect(shop.label).toBe('Żabka');
    expect(shop.foods.map((f) => f.key)).toEqual([SKYR.key, BAR.key]);
    expect(foodsOf(place('c', 'Bar u Zdzisia', 100)).foods).toEqual([]);
  });

  test('the card shows a dish without its chain in brackets', () => {
    expect(dishName(foodsOf(place('a', 'Burgerownia', 100)).foods[0]!)).toBe('Wrap z kurczakiem');
    expect(dishName(SKYR)).toBe(SKYR.name);
  });
});

describe('places ranked for now', () => {
  const n = needs();
  const rank = (places: Place[], radius = 1000) =>
    rankPlaces({ places, center: CENTER, radius, foodsOf, ctx: ctxOf(n), mealKcal: n.meal.kcal, openOf: () => null });

  test('only inside the radius, with walking minutes; the best dish leads each place', () => {
    const ranked = rank([place('near', 'Burgerownia', 300), place('far', 'Sałatkarnia', 1500)]);
    expect(ranked.map((r) => r.place.id)).toEqual(['near']);
    expect(ranked[0]!.walkMin).toBe(walkMinutes(ranked[0]!.distance));
    expect(ranked[0]!.walkMin).toBe(4);
    // 550 kcal for one meal, 55 g protein: the wrap, not the double burger.
    expect(ranked[0]!.best?.food.name).toBe('Wrap z kurczakiem (Burgerownia)');
    expect(ranked[0]!.options.find((s) => s.food.name.startsWith('Burger'))?.score).toBeLessThan(ranked[0]!.best!.score);
  });

  test('the same chain farther away scores lower; its menu is ranked once', () => {
    const [a, b] = rank([place('a', 'Burgerownia', 100), place('b', 'Burgerownia', 900)]);
    expect(a!.score).toBeGreaterThan(b!.score);
    expect(a!.options).toBe(b!.options);
  });

  test('a shop with snacks only offers pairs that make a meal', () => {
    const [shop] = rank([place('z', 'Żabka', 200, { kind: 'shop', shop: 'zabka' })]);
    expect(shop!.options.some((s) => s.food.key.startsWith('combo:'))).toBe(true);
  });

  test('a place without data has nothing to offer and no score', () => {
    const [bar] = rank([place('x', 'Bar u Zdzisia', 200)]);
    expect(bar!.best).toBeNull();
    expect(bar!.score).toBe(-Infinity);
  });

  test('the list: one row per chain, by fit, protein, distance or the lightest meal', () => {
    const ranked = rank([
      place('b1', 'Burgerownia', 600),
      place('b2', 'Burgerownia', 150),
      place('s1', 'Sałatkarnia', 400),
      place('x', 'Bar u Zdzisia', 50),
    ]);
    const ctx = ctxOf(n);
    const best = picks(ranked, 'best', ctx, n.meal.kcal);
    expect(best.map((p) => p.place.place.id).sort()).toEqual(['b2', 's1']);
    expect(picks(ranked, 'near', ctx, n.meal.kcal).map((p) => p.place.place.id)).toEqual(['b2', 's1']);
    const protein = picks(ranked, 'protein', ctx, n.meal.kcal);
    expect(protein[0]!.dish.food.nutrients.protein).toBeGreaterThanOrEqual(protein[1]!.dish.food.nutrients.protein!);
    const light = picks(ranked, 'light', ctx, n.meal.kcal);
    expect(light[0]!.dish.food.name).toBe('Sałatka z kurczakiem (Sałatkarnia)');
  });
});

describe('what is left for the next meal', () => {
  test('the day at its goal, minus what is eaten, split over the meals ahead', () => {
    const n = needs(900, 2);
    expect(n.remaining.kcal).toBe(1100);
    expect(n.mealsLeft).toBe(2);
    expect(n.meal.kcal).toBe(550);
  });

  test('a planned cheat meal takes its kcal and one meal', () => {
    const n = dayNeeds({
      profile, goalKcal: 2000, eaten: { kcal: 900, protein: 60, carbs: 100, fat: 30, unknownMacros: 0 },
      cheat: { name: 'Pizza', kcal: 700, protein: 30, carbs: 80, fat: 30 }, mealsAhead: 2,
    });
    expect(n.remaining.kcal).toBe(400);
    expect(n.restMeals).toBe(1);
    expect(n.meal.kcal).toBe(400);
  });

  test('a day already over its goal still aims a meal at a snack’s worth', () => {
    expect(needs(2300, 1).meal.kcal).toBe(150);
  });
});
