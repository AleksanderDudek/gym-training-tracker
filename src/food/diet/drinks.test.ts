import { describe, expect, test } from 'vitest';
import { caffeineSafeMg, cleanDrink, drinksOf, hydration, sweetValues, type Drink } from './drinks';

describe('hydration', () => {
  test('every kind counts towards the total; by kind in the chips order, only kinds drunk', () => {
    const drinks: Drink[] = [
      { kind: 'coffee', ml: 250 },
      { kind: 'water', ml: 500 },
      { kind: 'water', ml: 250 },
      { kind: 'sweet', ml: 330 },
    ];
    const h = hydration(drinks);
    expect(h.total).toBe(1330);
    expect(h.byKind).toEqual([
      { kind: 'water', ml: 750 },
      { kind: 'coffee', ml: 250 },
      { kind: 'sweet', ml: 330 },
    ]);
    expect(h.sweetKcal).toBe(139);
  });

  test('caffeine from coffee (40 mg/100 ml) and tea (20 mg/100 ml) only', () => {
    expect(hydration([{ kind: 'coffee', ml: 250 }, { kind: 'tea', ml: 500 }, { kind: 'zero', ml: 330 }]).caffeineMg).toBe(200);
    expect(hydration([{ kind: 'water', ml: 2000 }]).caffeineMg).toBe(0);
  });

  test('nothing drunk: zeros', () => {
    expect(hydration([])).toEqual({ total: 0, byKind: [], caffeineMg: 0, sweetKcal: 0 });
  });
});

describe('a sweet drink in the food diary', () => {
  test('an estimate as for cola: 42 kcal and 10.6 g sugar per 100 ml', () => {
    expect(sweetValues(250)).toEqual({ kcal: 105, sugars: 26.5 });
    expect(sweetValues(330)).toEqual({ kcal: 139, sugars: 35 });
  });
});

describe('EFSA caffeine', () => {
  test('400 mg for adults, 200 mg with the pregnancy flag', () => {
    expect(caffeineSafeMg(false)).toBe(400);
    expect(caffeineSafeMg(true)).toBe(200);
  });
});

describe('old rows and backups', () => {
  test('a day on the old water total reads as one water drink', () => {
    expect(drinksOf({ water: 750 })).toEqual([{ kind: 'water', ml: 750 }]);
    expect(drinksOf({})).toEqual([]);
    expect(drinksOf(undefined)).toEqual([]);
    // Drinks win over a leftover total.
    expect(drinksOf({ drinks: [{ kind: 'tea', ml: 250 }], water: 750 })).toEqual([{ kind: 'tea', ml: 250 }]);
  });

  test('cleanDrink keeps known kinds, sane amounts, a HH:MM time and an entry id', () => {
    expect(cleanDrink({ kind: 'tea', ml: 249.6, at: '07:30', entryId: 3 })).toEqual({ kind: 'tea', ml: 250, at: '07:30', entryId: 3 });
    expect(cleanDrink({ kind: 'tea', ml: 250, at: 'rano', entryId: -1 })).toEqual({ kind: 'tea', ml: 250 });
    expect(cleanDrink({ kind: 'piwo', ml: 500 })).toBeNull();
    expect(cleanDrink({ kind: 'water', ml: 2500 })).toBeNull();
    expect(cleanDrink('woda')).toBeNull();
  });
});
