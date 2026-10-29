// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { dishById } from './dishes';
import type { Food } from '../diet/foods';
import {
  DISH_CHOICES_KEY,
  choiceWords,
  gramsOf,
  itemEstimate,
  itemRange,
  likelyAlts,
  newItem,
  plateFood,
  plateTotal,
  rememberItems,
  searchDishes,
  similarFoods,
  type PlateItem,
} from './plate';

const dish = (id: string) => {
  const d = dishById(id);
  if (!d) throw new Error(`no dish ${id}`);
  return d;
};

beforeEach(() => localStorage.clear());

describe('plate', () => {
  it('a portion is a multiple of the dish’s typical serving', () => {
    const item: PlateItem = { dish: dish('pierogiRuskie'), portion: 1.5, choices: {} };
    expect(gramsOf(item)).toBe(Math.round(dish('pierogiRuskie').portion.g * 1.5));
  });

  it('the total adds kcal and macros, and its range is narrower than the sum of ranges', () => {
    const a: PlateItem = { dish: dish('pierogiRuskie'), portion: 1, choices: { fat: 'usual' } };
    const b: PlateItem = { dish: dish('pizza'), portion: 1, choices: {} };
    const [ea, eb] = [itemEstimate(a), itemEstimate(b)];
    const t = plateTotal([a, b]);
    expect(t.kcal).toBe(Math.round(ea.kcal + eb.kcal));
    expect(t.high - t.low).toBeLessThan(ea.high - ea.low + (eb.high - eb.low));
    expect(t.low).toBeLessThan(t.kcal);
  });

  it('the diary food carries the answered scales in its name and the estimate in its numbers', () => {
    const item: PlateItem = { dish: dish('pierogiRuskie'), portion: 1, choices: { fat: 'fatty' } };
    const food = plateFood(item);
    expect(food).toMatchObject({ key: 'dish:pierogiRuskie', source: 'dish', grams: gramsOf(item) });
    expect(food.name).toContain('tłuste');
    expect(food.nutrients.kcal).toBe(itemEstimate(item).kcal);
    expect(choiceWords({ ...item, choices: { fat: 'usual' } })).toEqual([]);
  });

  it('remembers the portion and scales per dish and offers them next time', () => {
    expect(newItem(dish('pierogiRuskie'))).toMatchObject({ portion: 1, choices: {} });
    rememberItems([{ dish: dish('pierogiRuskie'), portion: 1.5, choices: { fat: 'fatty' } }]);
    expect(newItem(dish('pierogiRuskie'))).toMatchObject({ portion: 1.5, choices: { fat: 'fatty' } });
    localStorage.setItem(DISH_CHOICES_KEY, '{broken');
    expect(newItem(dish('pierogiRuskie')).portion).toBe(1);
  });

  it('finds dishes by Polish name or by the model phrase, the name first', () => {
    expect(searchDishes('pierogi').map((d) => d.id)).toContain('pierogiRuskie');
    expect(searchDishes('pad thai')[0]?.id).toBe('padThai');
    expect(searchDishes('xyzzy')).toEqual([]);
  });
});

describe('a first guess', () => {
  it('the other likely dishes are those with a tenth of the probability or more', () => {
    const alts = likelyAlts([
      { dish: dish('padThai'), score: 0.4 },
      { dish: dish('ramen'), score: 0.3 },
      { dish: dish('pho'), score: 0.05 },
    ]);
    expect(alts.map((d) => d.id)).toEqual(['ramen']);
  });

  it('its range covers each other likely dish at its usual portion; the total widens with it', () => {
    const guess: PlateItem = { ...newItem(dish('padThai')), alts: [dish('greekSalad'), dish('lasagna')] };
    const own = itemEstimate(guess);
    const range = itemRange(guess);
    expect(range.low).toBeLessThanOrEqual(itemEstimate(newItem(dish('greekSalad'))).low);
    expect(range.high).toBeGreaterThanOrEqual(itemEstimate(newItem(dish('lasagna'))).high);
    expect(range.low).toBeLessThan(own.low);
    const total = plateTotal([guess]);
    expect(total.kcal).toBe(own.kcal);
    expect([total.low, total.high]).toEqual([range.low, range.high]);
    // Confirmed, it is back to its own range.
    expect(itemRange({ ...guess, alts: undefined })).toEqual({ low: own.low, high: own.high });
  });
});

describe('the database check', () => {
  const food = (key: string, name: string, kcal: number, extra: Partial<Food> = {}): Food => ({
    key,
    name,
    detail: '',
    source: 'product',
    amountLabel: '100 g',
    nutrients: { kcal, protein: 5, carbs: 20, fat: 5 },
    per100: { kcal, protein: 5, carbs: 20, fat: 5 },
    grams: 100,
    stores: [],
    atHome: false,
    role: 'main',
    ...extra,
  });

  it('leaves out what only shares a word (energy far from the dish) and second copies of a food', () => {
    const kcal = dish('schabowyPlate').per100.kcal;
    const found = similarFoods(dish('schabowyPlate'), () => [
      food('p:1', 'Panierka do schabowego', kcal * 2.4),
      food('p:2', 'Kotlet schabowy z puree', kcal * 0.8),
      food('p:3', 'Kotlet Schabowy z puree', kcal * 0.8),
      food('p:4', 'Kotlet schabowy', kcal * 1.3),
    ]);
    expect(found.map((f) => f.key)).toEqual(['p:2', 'p:4']);
  });

  it('asks with the whole name, then fewer words; skips foods without values per 100 g, sets and repeats', () => {
    const asked: string[] = [];
    const found = similarFoods(dish('pierogiRuskie'), (q) => {
      asked.push(q);
      if (q === 'Pierogi ruskie') return [food('p:1', 'Pierogi ruskie A', 210), food('s:1', 'Zestaw', 300, { source: 'set' }), food('p:2', 'Bez wartości', 100, { per100: null })];
      return [food('p:1', 'Pierogi ruskie A', 210), food('p:3', 'Pierogi z mięsem', 230), food('p:4', 'Pierogi z serem', 190)];
    });
    expect(asked).toEqual(['Pierogi ruskie', 'Pierogi']);
    expect(found.map((f) => f.key)).toEqual(['p:1', 'p:3', 'p:4']);
  });

  it('counted from a database food: its values per 100 g at the portion’s grams, the scales still move them; the entry says whose', () => {
    const ref = { key: 'p:1', name: 'Pierogi ruskie Jawo', detail: '', per100: { kcal: 220, protein: 7, carbs: 30, fat: 8 } };
    const item: PlateItem = { ...newItem(dish('pierogiRuskie')), ref };
    const grams = gramsOf(item);
    expect(itemEstimate(item).kcal).toBe(Math.round(2.2 * grams));
    const fatty = itemEstimate({ ...item, choices: { fat: 'fatty' } });
    expect(fatty.kcal).toBeGreaterThan(itemEstimate(item).kcal);
    expect(plateFood(item).amountLabel).toBe(`${grams} g, wartości jak Pierogi ruskie Jawo`);
    expect(plateFood(item).nutrients.kcal).toBe(Math.round(2.2 * grams));
  });
});
