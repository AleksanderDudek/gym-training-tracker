import { describe, expect, test } from 'vitest';
import { makeProduct } from '../test/fixtures';
import type { Nutrition } from '../lib/types';
import { GOTOWIEC_MIN_PROTEIN, NO_DISHES, RECIPES, passesRule, servingsOf } from './catalog';
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
    '%s passes its rule per serving on typical values, before any product is chosen',
    (_, recipe) => {
      const total = sumMacros(recipe.items.map((i) => scale(INGREDIENTS[i.ingredient].typical, i.grams)));
      const serving = divideMacros(total, servingsOf(recipe));
      expect(passesRule(recipe, serving), JSON.stringify(serving)).toBe(true);
    },
  );

  test('a classic links the Wikibooks cookbook page it was reworked from, over https', () => {
    const classics = RECIPES.filter((r) => r.inspiredBy);
    expect(classics.length).toBeGreaterThanOrEqual(16);
    for (const { id, inspiredBy } of classics) {
      expect(inspiredBy!.title.trim(), id).not.toBe('');
      const url = new URL(inspiredBy!.url);
      expect(url.protocol, id).toBe('https:');
      expect(url.hostname, id).toMatch(/^(pl|en)\.wikibooks\.org$/);
      expect(url.pathname, id).toMatch(/^\/wiki\/(Ksi%C4%85%C5%BCka_kucharska\/|Cookbook:)/);
      // A title from the English cookbook is marked as English.
      expect(inspiredBy!.lang ?? 'pl', id).toBe(url.hostname.split('.')[0]);
    }
  });

  test('a recipe that is not a gotowiec still meets THE RULE, a gotowiec the protein floor', () => {
    const banana = { kcal: 330, protein: 16, carbs: 50, fat: 8 };
    expect(passesRule({ kind: 'gotowiec' }, banana)).toBe(true);
    expect(passesRule({ kind: 'miska' }, banana)).toBe(false);
    expect(passesRule({ kind: 'gotowiec' }, { ...banana, protein: GOTOWIEC_MIN_PROTEIN - 0.1 })).toBe(false);
    expect(passesRule({ kind: 'shake' }, { kcal: 200, protein: 30, carbs: 10, fat: 3 })).toBe(
      isProteinForward({ protein: 30, carbs: 10, fat: 3 }),
    );
  });

  test('gotowce: no dishes, a minute or two, two or three things, at least one bought or eaten as it is', () => {
    const gotowce = RECIPES.filter((r) => r.kind === 'gotowiec');
    expect(gotowce.length).toBeGreaterThanOrEqual(10);
    for (const r of gotowce) {
      expect(r.tool, r.id).toBe(NO_DISHES);
      expect(r.minutes, r.id).toBeLessThanOrEqual(2);
      expect(r.items.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.items.length, r.id).toBeLessThanOrEqual(3);
      expect(servingsOf(r), r.id).toBe(1);
      // Nothing that has to be cooked or measured out of a bag at home.
      for (const i of r.items) expect(INGREDIENTS[i.ingredient].role, `${r.id}: ${i.ingredient}`).not.toBe('pantry');
    }
    // The set the request names.
    expect(
      gotowce.some(
        (r) => r.items.some((i) => i.ingredient === 'banana') && r.items.some((i) => i.ingredient === 'proteinBar'),
      ),
    ).toBe(true);
  });

  test('only gotowce are "Bez naczyń", and pack amounts are only for things sold one per pack', () => {
    for (const r of RECIPES.filter((x) => x.kind !== 'gotowiec')) expect(r.tool, r.id).not.toBe(NO_DISHES);
    const packed = RECIPES.flatMap((r) => r.items.filter((i) => i.pack).map((i) => i.ingredient));
    expect(new Set(packed)).toEqual(new Set(['proteinBar', 'proteinDrink', 'proteinCrisps']));
  });

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

  test('protein bar: a third protein in; a candy bar with a protein word and a powder out', () => {
    const bar = { kcal: 380, protein: 33, carbs: 29, fat: 16 };
    expect(matches('proteinBar', 'Baton proteinowy o smaku malinowym', bar)).toBe(true);
    expect(matches('proteinBar', 'Crunchy bar', bar, ['en:protein-bars'])).toBe(true);
    expect(matches('proteinBar', 'Go On Protein baton', { kcal: 424, protein: 20, carbs: 44, fat: 18 })).toBe(false);
    expect(matches('proteinBar', 'Protein bar powder', bar, ['en:protein-bars'])).toBe(false);
  });

  test('protein drink: a ready-to-drink shake or drinking skyr in; a powder and a sweet milkshake out', () => {
    expect(
      matches('proteinDrink', 'Napój proteinowy o smaku waniliowym', { kcal: 59, protein: 10, carbs: 4.6, fat: 0.1 }),
    ).toBe(true);
    expect(matches('proteinDrink', 'Skyr pitny wysokobiałkowy', { kcal: 64, protein: 7.6, carbs: 4.3, fat: 1.8 })).toBe(
      true,
    );
    expect(matches('proteinDrink', 'Protein shake vanilla', { kcal: 393, protein: 13, carbs: 82, fat: 1.1 })).toBe(
      false,
    );
    expect(
      matches('proteinDrink', 'Shake proteinowy czekoladowy', { kcal: 95, protein: 6, carbs: 14, fat: 2, sugars: 13 }),
    ).toBe(false);
  });

  test('rice cakes and crispbread: plain in, chocolate-coated and a typo (8 g carbs) out', () => {
    expect(
      matches('riceCakes', 'Wafle ryżowe naturalne', { kcal: 386, protein: 10, carbs: 77, fat: 3.4, sugars: 0.5 }),
    ).toBe(true);
    expect(
      matches('riceCakes', 'Wafle ryżowe w czekoladzie', { kcal: 492, protein: 7, carbs: 60, fat: 23, sugars: 30 }),
    ).toBe(false);
    expect(matches('crispbread', 'Pieczywo chrupkie żytnie', { kcal: 353, protein: 8.7, carbs: 72, fat: 0.9 })).toBe(
      true,
    );
    expect(
      matches('crispbread', 'Maca razowa', { kcal: 375, protein: 9.4, carbs: 7.8, fat: 1.4 }, ['en:crispbreads']),
    ).toBe(false);
  });

  test('roll: a plain roll in; breadcrumbs, a burger bun and a sweet bun out', () => {
    const roll = { kcal: 270, protein: 9, carbs: 54, fat: 1.5, sugars: 2 };
    expect(matches('roll', 'Bułka grahamka', roll)).toBe(true);
    expect(matches('roll', 'Kajzerka pszenna', roll)).toBe(true);
    expect(matches('roll', 'Bułka tarta', { ...roll, kcal: 355 })).toBe(false);
    expect(matches('roll', 'Bułka burger', roll)).toBe(false);
    expect(matches('roll', 'Bułka słodka z kruszonką', roll)).toBe(false);
  });

  test('fruit has no matcher: crowd-sourced bananas disagree with each other', () => {
    expect(INGREDIENTS.banana.match).toBeUndefined();
    expect(INGREDIENTS.apple.match).toBeUndefined();
  });

  test('raw chicken and lean beef have no matcher: the data cannot tell them from cold cuts', () => {
    expect(INGREDIENTS.chickenFillet.match).toBeUndefined();
    expect(INGREDIENTS.leanBeef.match).toBeUndefined();
    expect(INGREDIENTS.turkeyFillet.match).toBeUndefined();
  });

  test('herring: plain or matjas fillets in; herring in oil or cream, a salad and smoked herring out', () => {
    const fillet = { kcal: 175, protein: 16, carbs: 0.5, fat: 12.5 };
    expect(matches('herring', "Filety śledziowe a'la matjas", fillet)).toBe(true);
    expect(matches('herring', 'Matjas podwójny filet ze śledzia', fillet)).toBe(true);
    expect(matches('herring', 'Filety śledziowe w oleju', fillet)).toBe(false);
    expect(matches('herring', 'Śledź w śmietanie', fillet)).toBe(false);
    expect(matches('herring', 'Sałatka śledziowa', fillet)).toBe(false);
    expect(matches('herring', 'Śledź wędzony', fillet)).toBe(false);
  });

  test('sauerkraut and brined cucumbers: the vegetable in; a salad, dumplings and crisps out', () => {
    const kraut = { kcal: 19, protein: 1.1, carbs: 3.4, fat: 0.2 };
    expect(matches('sauerkraut', 'Kapusta kiszona z Charsznicy', kraut)).toBe(true);
    expect(matches('sauerkraut', 'Kapusta biała kiszona', kraut)).toBe(true);
    expect(matches('sauerkraut', 'Kiszona kapusta', kraut)).toBe(true);
    expect(matches('sauerkraut', 'Surówka z kapusty kiszonej', kraut)).toBe(false);
    expect(matches('sauerkraut', 'Pierogi z kapustą kiszoną i grzybami', kraut)).toBe(false);
    const cucumber = { kcal: 12, protein: 0.6, carbs: 1.8, fat: 0.1 };
    expect(matches('brinedCucumber', 'Ogórki kiszone', cucumber)).toBe(true);
    expect(matches('brinedCucumber', 'Sałatka z ogórków kiszonych', cucumber)).toBe(false);
    expect(matches('brinedCucumber', 'Chipsy o smaku ogórków kiszonych', cucumber)).toBe(false);
  });

  test('wheat flour in; a pizza, pancake or bread mix out; gelatin in, a cream fixer out', () => {
    const flour = { kcal: 345, protein: 11, carbs: 72, fat: 1.4 };
    expect(matches('flour', 'Mąka pszenna typ 450', flour)).toBe(true);
    expect(matches('flour', 'Mąka pszenna do pizzy z drożdżami', flour)).toBe(false);
    expect(matches('flour', 'Mąka pszenna naleśnikowa', flour)).toBe(false);
    expect(matches('flour', 'Mąka pszenna mieszanka do chleba', flour)).toBe(false);
    const gelatin = { kcal: 335, protein: 84, carbs: 0, fat: 0.1 };
    expect(matches('gelatin', 'Żelatyna wieprzowa', gelatin)).toBe(true);
    expect(matches('gelatin', 'Żelatyna fix do bitej śmietany', gelatin)).toBe(false);
  });
});
