import { describe, expect, test, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { indexProducts } from '../lib/search';
import type { Nutrition } from '../lib/types';
import { PRODUCTS, makeProduct } from '../test/fixtures';
import * as catalogEn from './catalog';
import { KIND_LABELS, RECIPES } from './catalog';
import * as ingredientsEn from './ingredients';
import { INGREDIENTS } from './ingredients';
import { readyProducts } from './ready';
import { buildCandidates, resolveRecipe, type Candidates, type ResolvedRecipe } from './resolve';
import * as tiersEn from './tiers';
import { TIER_LABELS } from './tiers';

const POLISH = /[ąćęłńóśźż]/i;

type Catalog = typeof import('./catalog');
type Ingredients = typeof import('./ingredients');
type Tiers = typeof import('./tiers');

/** The same modules in Polish: a fresh module graph, read while the language is Polish. */
async function polish() {
  vi.resetModules();
  globalThis.__KB_LANG__ = 'pl';
  try {
    const [catalog, ingredients, resolve, tiers] = await Promise.all([
      import('./catalog'),
      import('./ingredients'),
      import('./resolve'),
      import('./tiers'),
    ]);
    return { catalog, ingredients, resolve, tiers };
  } finally {
    globalThis.__KB_LANG__ = 'en';
  }
}

/** Every text a recipe card, the filters and the shopping list show, in a stable order. */
function displayTexts(catalog: Catalog, ingredients: Ingredients, tiers: Tiers) {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text: string | undefined) => {
    if (text !== undefined) out.push({ where, text });
  };
  for (const [kind, label] of Object.entries(catalog.KIND_LABELS)) add(`kind ${kind}`, label);
  add('no dishes', catalog.NO_DISHES);
  for (const [tier, label] of Object.entries(tiers.TIER_LABELS)) add(`tier ${tier}`, label);
  for (const def of Object.values(ingredients.INGREDIENTS)) add(`ingredient ${def.id}`, def.label);
  for (const r of catalog.RECIPES) {
    add(`${r.id} name`, r.name);
    add(`${r.id} tool`, r.tool);
    add(`${r.id} description`, r.description);
    r.steps.forEach((step, i) => add(`${r.id} step ${i + 1}`, step));
    for (const item of r.items) add(`${r.id} ${item.ingredient} measure`, item.measure);
  }
  return out;
}

/** What a recipe is, without its words: what changes with the language must not be in here. */
const shape = (catalog: Catalog) =>
  catalog.RECIPES.map((r) => ({
    id: r.id,
    kind: r.kind,
    minutes: r.minutes,
    servings: r.servings,
    inspiredBy: r.inspiredBy,
    items: r.items.map((i) => ({ ingredient: i.ingredient, grams: i.grams, pack: i.pack, measured: !!i.measure })),
    steps: r.steps.length,
  }));

const englishTexts = displayTexts(catalogEn, ingredientsEn, tiersEn);

describe('recipes in English', () => {
  test('no Polish letters in any title, description, step, tool, measure or ingredient name', () => {
    expect(englishTexts.length).toBeGreaterThan(800);
    expect(englishTexts.filter((t) => POLISH.test(t.text)).map((t) => `${t.where}: ${t.text}`)).toEqual([]);
  });

  test('every text is translated, not left as it was', async () => {
    const pl = await polish();
    const polishTexts = displayTexts(pl.catalog, pl.ingredients, pl.tiers);
    expect(polishTexts.map((t) => t.where)).toEqual(englishTexts.map((t) => t.where));
    const same = new Set(englishTexts.filter((t, i) => t.text === polishTexts[i]!.text).map((t) => t.text));
    // The same in both languages: a weight, and words English took from elsewhere.
    expect([...same].sort()).toEqual(['200 g', '300 g', '600 g', 'Blender', 'Shake', 'Shaker']);
  });

  test('the words change, the recipes do not: ids, grams, packs, servings, sources and steps stay', async () => {
    const pl = await polish();
    expect(shape(catalogEn)).toEqual(shape(pl.catalog));
  });

  test('spot checks', () => {
    const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
    expect(recipe('banan-baton').name).toBe('Banana and a protein bar');
    expect(recipe('banan-baton').tool).toBe('No dishes');
    expect(recipe('pyry-z-gzikiem').name).toBe('Pyry z gzikiem (potatoes with herby quark)');
    expect(recipe('kurczak-curry').steps[3]).toBe('Stir in the skyr only off the heat so it does not curdle. Serve with the rice.');
    const quark = recipe('leniwe-z-twarogu').items.find((i) => i.ingredient === 'quark')!;
    expect(quark).toMatchObject({ grams: 500, measure: '2½ packs' });
    expect(recipe('sernik-na-zimno').items.find((i) => i.ingredient === 'gelatin')!.measure).toBe('2.5 tbsp');
    // The source a classic was reworked from keeps its own title: it is a Polish page.
    expect(recipe('ogorkowa-z-kurczakiem').inspiredBy?.title).toBe('Zupa ogórkowa');
    expect(INGREDIENTS.quark.label).toBe('Low-fat quark');
    expect(INGREDIENTS.zucchini.label).toBe('Courgette');
    expect(KIND_LABELS).toEqual({
      gotowiec: 'Ready to eat',
      mix: 'Quick mix',
      shake: 'Shake',
      miska: 'Sweet',
      slone: 'Savoury',
      obiad: 'Dinner',
    });
    expect(TIER_LABELS).toEqual({ szybkie: 'Quick', chwila: 'A bit longer', dluzej: 'Longer, at home' });
  });

  test('ready-to-eat groups are named in English', () => {
    const n = (kcal: number, protein: number, carbs: number, fat: number): Nutrition => ({
      kcal,
      protein,
      carbs,
      fat,
      sugars: 0,
      saturatedFat: null,
      fiber: null,
      salt: null,
    });
    const products = indexProducts(
      [
        makeProduct({ code: 'bar', name: 'Baton proteinowy', categories: ['en:protein-bars'], nutrition: n(368, 35, 30, 12) }),
        makeProduct({ code: 'whey', name: 'Odżywka białkowa', categories: ['en:protein-powders'], nutrition: n(386, 75, 8, 6) }),
        makeProduct({ code: 'drink', name: 'Napój proteinowy', categories: ['en:protein-shakes'], nutrition: n(64, 10, 5, 0.5) }),
        makeProduct({ code: 'quark', name: 'Twaróg chudy', categories: ['en:quarks'], nutrition: n(98, 19.8, 3.5, 0.5) }),
        makeProduct({ code: 'skyr', name: 'Skyr naturalny', categories: ['en:skyrs'], nutrition: n(62, 11, 4, 0.2) }),
      ],
      {},
    );
    expect(readyProducts(products, null).map((g) => g.label)).toEqual([
      'Protein bars',
      'Protein drinks and shakes',
      'Skyr, yoghurts and protein desserts',
      'Quark and cottage cheese',
      'Protein powder',
    ]);
  });

  test('matching does not depend on the language: the same products and baskets as in Polish', async () => {
    const pl = await polish();
    // Products named the way a Polish shelf names them (the ingredient's Polish name), with its typical values.
    const shelf = Object.values(pl.ingredients.INGREDIENTS).map((def) =>
      makeProduct({
        code: `p-${def.id}`,
        name: def.label,
        nutrition: { ...def.typical, sugars: def.typical.carbs, saturatedFat: null, fiber: null, salt: null },
        stores: ['biedronka'],
        popularity: 10,
      }),
    );
    const products = indexProducts([...PRODUCTS, ...shelf], {});
    const english = buildCandidates(products);
    const polishCandidates = pl.resolve.buildCandidates(products);
    const codes = (c: Candidates) => Object.fromEntries([...c].map(([id, list]) => [id, list.map((p) => p.code)]));
    expect(codes(english)).toEqual(codes(polishCandidates));
    // Enough of them match for the comparison to mean something.
    expect([...english.values()].filter((list) => list.length > 0).length).toBeGreaterThan(20);

    const summary = (r: ResolvedRecipe) => ({
      id: r.recipe.id,
      available: r.available,
      passes: r.passes,
      missing: r.missing,
      items: r.items.map((i) => [i.def.id, i.product?.code ?? null, i.grams]),
    });
    for (const store of [null, 'biedronka', 'lidl'])
      RECIPES.forEach((recipe, i) => {
        const inPolish = pl.resolve.resolveRecipe(pl.catalog.RECIPES[i]!, polishCandidates, store);
        expect(summary(resolveRecipe(recipe, english, store))).toEqual(summary(inPolish));
      });
  });
});
