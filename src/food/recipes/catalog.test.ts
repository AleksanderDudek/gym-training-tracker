import { describe, expect, test } from 'vitest';
import { makeProduct } from '../test/fixtures';
import type { Nutrition } from '../lib/types';
import { RECIPES, servingsOf } from './catalog';
import { INGREDIENTS, type IngredientId } from './ingredients';
import { divideMacros, isProteinForward, scale, sumMacros } from './macros';

describe('catalog', () => {
  test('ids are unique', () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  test.each(RECIPES.map((r) => [r.id, r] as const))(
    '%s uses only defined ingredients, once each, and has steps',
    (_, recipe) => {
      for (const item of recipe.items) expect(INGREDIENTS[item.ingredient], item.ingredient).toBeDefined();
      // A swap is keyed by ingredient id, so the same ingredient twice would swap both.
      expect(new Set(recipe.items.map((i) => i.ingredient)).size).toBe(recipe.items.length);
      expect(recipe.steps.length).toBeGreaterThan(0);
    },
  );

  test.each(RECIPES.map((r) => [r.id, r] as const))(
    '%s takes a believable time and feeds a whole number of people',
    (_, recipe) => {
      expect(recipe.minutes).toBeGreaterThan(0);
      expect(recipe.minutes).toBeLessThanOrEqual(120);
      expect(Number.isInteger(servingsOf(recipe)) && servingsOf(recipe) >= 1).toBe(true);
    },
  );

  test.each(RECIPES.map((r) => [r.id, r] as const))(
    '%s passes the rule per serving on typical values, before any product is chosen',
    (_, recipe) => {
      const total = sumMacros(recipe.items.map((i) => scale(INGREDIENTS[i.ingredient].typical, i.grams)));
      const serving = divideMacros(total, servingsOf(recipe));
      expect(isProteinForward(serving), JSON.stringify(serving)).toBe(true);
    },
  );

  test('a recipe for several servings is home cooking, not a quick snack split in two', () => {
    for (const recipe of RECIPES.filter((r) => servingsOf(r) > 1))
      expect(recipe.minutes, recipe.id).toBeGreaterThan(20);
  });
});

function nutrition(n: Partial<Nutrition>): Nutrition {
  return {
    kcal: null,
    fat: null,
    saturatedFat: null,
    carbs: null,
    sugars: null,
    fiber: null,
    protein: null,
    salt: null,
    ...n,
  };
}

describe('ingredient matchers', () => {
  const skyr = (name: string, n: Partial<Nutrition>) =>
    INGREDIENTS.skyr.match!(
      makeProduct({
        code: 'x',
        name,
        nutrition: nutrition({ kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugars: 4, ...n }),
      }),
    );

  test('plain skyr in; fruit skyr (sugar) and drinking skyr out', () => {
    expect(skyr('Skyr naturalny', {})).toBe(true);
    expect(skyr('Skyr truskawka', { sugars: 11, carbs: 11 })).toBe(false);
    expect(skyr('Skyr pitny naturalny', {})).toBe(false);
  });

  test('a bound on an unknown value fails rather than passes', () => {
    expect(skyr('Skyr naturalny', { fat: null })).toBe(false);
  });

  test('unknown sugars are judged by carbohydrates, which they can never exceed', () => {
    expect(skyr('Skyr naturalny', { sugars: null, carbs: 4 })).toBe(true);
    expect(skyr('Skyr wanilia', { sugars: null, carbs: 11 })).toBe(false);
  });

  test('a protein yogurt is not a cottage cheese that calls itself high-protein', () => {
    const yogurt = (name: string) =>
      INGREDIENTS.proteinYogurt.match!(
        makeProduct({
          code: 'y',
          name,
          categories: ['en:dairies'],
          nutrition: nutrition({ kcal: 64, protein: 10, carbs: 4, fat: 0.3, sugars: 4 }),
        }),
      );
    expect(yogurt('Jogurt proteinowy naturalny')).toBe(true);
    expect(yogurt('Serek wiejski wysokobiałkowy')).toBe(false);
  });

  test('lean quark in, full-fat quark out', () => {
    const quark = (fat: number) =>
      INGREDIENTS.quark.match!(
        makeProduct({
          code: 'q',
          name: 'Twaróg',
          nutrition: nutrition({ kcal: 99, protein: 19, carbs: 3.5, fat, sugars: 3 }),
        }),
      );
    expect(quark(0.5)).toBe(true);
    expect(quark(8)).toBe(false);
  });

  test('tuna in its own sauce in, tuna in oil out', () => {
    const tuna = (name: string, fat: number) =>
      INGREDIENTS.tuna.match!(
        makeProduct({ code: 't', name, nutrition: nutrition({ kcal: 105, protein: 24, carbs: 0, fat }) }),
      );
    expect(tuna('Tuńczyk w sosie własnym', 1)).toBe(true);
    expect(tuna('Tuńczyk w oleju', 9)).toBe(false);
  });

  test('protein powder must actually be mostly protein', () => {
    const whey = (protein: number) =>
      INGREDIENTS.whey.match!(
        makeProduct({
          code: 'w',
          name: 'Whey protein vanilla',
          nutrition: nutrition({ kcal: 390, protein, carbs: 8, fat: 6 }),
        }),
      );
    expect(whey(75)).toBe(true);
    expect(whey(30)).toBe(false);
  });

  // A matcher for a product with these macros and this name (and categories).
  const matches = (id: IngredientId, name: string, n: Partial<Nutrition>, categories: string[] = []) =>
    INGREDIENTS[id].match!(makeProduct({ code: id, name, categories, nutrition: nutrition(n) }));

  test('shrimp: plain shrimp in, shrimp crackers and shrimp in oil out', () => {
    const shrimp = { kcal: 71, protein: 16, carbs: 0, fat: 0.8 };
    expect(matches('shrimp', 'Krewetki vannamei białe', shrimp)).toBe(true);
    expect(matches('shrimp', 'Krewetki białe gotowane', { kcal: 94, protein: 21, carbs: 0, fat: 1.1 })).toBe(true);
    expect(matches('shrimp', 'Prażynki krewetkowe', { kcal: 498, protein: 2.1, carbs: 61, fat: 27 })).toBe(false);
    expect(matches('shrimp', 'Krewetki w oleju o smaku czosnku', { kcal: 480, protein: 7.5, carbs: 0, fat: 50 })).toBe(
      false,
    );
  });

  test('smoked salmon: smoked slices in, a fresh fillet, a spread and smoked trout out', () => {
    const smoked = { kcal: 191, protein: 20, carbs: 0.2, fat: 12 };
    expect(matches('smokedSalmon', 'Łosoś wędzony na zimno', smoked)).toBe(true);
    expect(matches('smokedSalmon', 'Łosoś plastry', smoked, ['en:smoked-salmons'])).toBe(true);
    expect(
      matches('smokedSalmon', 'Łosoś atlantycki filet ze skórą', { kcal: 203, protein: 21.3, carbs: 0, fat: 13.1 }),
    ).toBe(false);
    expect(matches('smokedSalmon', 'Pasta z łososia wędzonego', { kcal: 300, protein: 10, carbs: 3, fat: 27 })).toBe(
      false,
    );
    expect(
      matches('smokedSalmon', 'Pstrąg łososiowy wędzony w plastrach', { kcal: 198, protein: 20, carbs: 0, fat: 13 }),
    ).toBe(false);
    // Salmon belly is half fat: not the lean slice the recipes were sized on.
    expect(matches('smokedSalmon', 'Łosoś wędzony', { kcal: 250, protein: 22, carbs: 0, fat: 18 })).toBe(false);
  });

  test('salmon fillet: a raw fillet in, smoked or seasoned ready-to-bake salmon out', () => {
    const raw = { kcal: 203, protein: 21.3, carbs: 0, fat: 13.1 };
    expect(matches('salmonFillet', 'Świeży Łosoś Atlantycki Filet', raw)).toBe(true);
    expect(matches('salmonFillet', 'Łosoś wędzony na gorąco', { kcal: 204, protein: 24, carbs: 0, fat: 12 })).toBe(
      false,
    );
    expect(matches('salmonFillet', 'Łosoś atlantycki', raw, ['en:smoked-fishes'])).toBe(false);
    expect(
      matches('salmonFillet', 'Łosoś do piekarnika tajska nuta', { kcal: 178, protein: 21, carbs: 0.6, fat: 10 }),
    ).toBe(false);
  });

  test('white fish: a plain fillet in, fish fingers out', () => {
    expect(matches('whiteFish', 'Mintaj filet bez skóry', { kcal: 79, protein: 19, carbs: 0, fat: 0.3 })).toBe(true);
    expect(matches('whiteFish', 'Paluszki z fileta z dorsza', { kcal: 197, protein: 14, carbs: 16, fat: 8 })).toBe(
      false,
    );
  });

  test('turkey mince: raw mince in, a turkey cold cut out', () => {
    expect(matches('turkeyMince', 'Mięso mielone z indyka', { kcal: 141, protein: 20, carbs: 0, fat: 6.8 })).toBe(true);
    expect(matches('turkeyMince', 'Szynka z indyka', { kcal: 98, protein: 18, carbs: 2, fat: 2 })).toBe(false);
  });

  test('legume pasta in; wheat "protein" pasta, which has three times the carbs, out', () => {
    expect(
      matches('lentilPasta', 'Makaron z soczewicy czerwonej', { kcal: 340, protein: 24, carbs: 54, fat: 1.7 }),
    ).toBe(true);
    expect(matches('lentilPasta', 'Makaron protein', { kcal: 353, protein: 19, carbs: 63, fat: 2 })).toBe(false);
  });

  test('canned tomatoes in; the ones with olive oil, which hide a spoon of fat, out', () => {
    expect(matches('cannedTomatoes', 'Pomidory krojone', { kcal: 19, protein: 1.1, carbs: 3.2, fat: 0 })).toBe(true);
    expect(
      matches('cannedTomatoes', 'Pomidory krojone z oliwą z oliwek i czosnkiem', {
        kcal: 48,
        protein: 1.3,
        carbs: 5.9,
        fat: 1.9,
      }),
    ).toBe(false);
  });

  test('oil: olive and rapeseed oil in, sunflower oil and olive-oil flatbread out', () => {
    const oil = { kcal: 828, protein: 0, carbs: 0, fat: 92 };
    expect(matches('oil', 'Oliwa z oliwek', oil)).toBe(true);
    expect(matches('oil', 'Olej rzepakowy', oil)).toBe(true);
    expect(matches('oil', 'Olej słonecznikowy', oil, ['en:olive-oils'])).toBe(false);
    expect(matches('oil', 'Placek z oliwą', { kcal: 367, protein: 8.4, carbs: 61, fat: 9.6 })).toBe(false);
  });

  test('raw chicken and lean beef have no matcher: the data cannot tell them from cold cuts', () => {
    expect(INGREDIENTS.chickenFillet.match).toBeUndefined();
    expect(INGREDIENTS.leanBeef.match).toBeUndefined();
  });
});
