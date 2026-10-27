// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { dishById } from './dishes';
import { DISH_CHOICES_KEY, choiceWords, gramsOf, itemEstimate, newItem, plateFood, plateTotal, rememberItems, searchDishes, type PlateItem } from './plate';

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
