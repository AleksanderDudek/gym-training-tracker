import { normalizeForSearch } from '../lib/text';
import type { Product } from '../lib/types';
import type { Macros } from './macros';
import { isProteinBar, isProteinDrink } from './ready';

/**
 * - `store`:  bought for the recipe; must be found in the chosen store's data.
 * - `staple`: sold by every supermarket (milk, eggs, fruit, vegetables); a
 *   store's product is used when known, otherwise typical values.
 * - `pantry`: bought once, kept at home (protein powder, spices, water).
 */
export type IngredientRole = 'store' | 'staple' | 'pantry';

type Bound = 'kcal' | 'protein' | 'carbs' | 'fat' | 'sugars';

export interface IngredientDef {
  id: string;
  label: string;
  role: IngredientRole;
  /** Per 100 g: the fallback for staples, and the baseline every recipe is tested on. */
  typical: Macros;
  /** Which products can play this part. Absent: never bought as a product (water, salt). */
  match?: (p: Product) => boolean;
}

const folded = new WeakMap<Product, string>();
function nameOf(p: Product): string {
  let n = folded.get(p);
  if (n === undefined) {
    n = normalizeForSearch(p.name);
    folded.set(p, n);
  }
  return n;
}

function inCategory(p: Product, ...tags: string[]): boolean {
  return tags.some((t) => p.categories.includes(t));
}

/**
 * Sanity bounds per 100 g. They do two jobs: keep crowd-sourced typos out, and
 * say what the recipe needs ("plain", "lean") in numbers rather than in names,
 * which nobody types consistently. A bound on an unknown value fails.
 */
function within(p: Product, bounds: Partial<Record<Bound, [number, number]>>): boolean {
  for (const [key, [min, max]] of Object.entries(bounds) as [Bound, [number, number]][]) {
    // Sugars are part of carbohydrates, so when sugars are unknown the carbs
    // bound them from above: carbs <= max proves sugars <= max.
    const value = key === 'sugars' && p.nutrition.sugars === null && min === 0 ? p.nutrition.carbs : p.nutrition[key];
    if (value === null || value < min || value > max) return false;
  }
  return true;
}

/** A box of several: "pudełko x 4 batony", "12 x 45 g", "zestaw". One pack of it is not one portion. */
const MULTIPACK = /\bpudelk\w*|\bbox\b|\bzestaw\w*|\bkarton\w*|\b\d+ ?(x|szt\w*|sztuk\w*) ?\d*/;

const DRINKABLE = /\b(pitn\w*|drink|napoj\w*|shake|koktajl\w*)\b/;
const FROZEN = (p: Product) => inCategory(p, 'en:frozen-fruits', 'en:frozen-foods') || /mrozon/.test(nameOf(p));

/**
 * Words that make meat or fish a finished product - a cold cut, a sausage, a
 * breaded or ready meal - rather than the raw piece a recipe cooks. Smoked
 * salmon has the protein of a raw fillet, so the bounds alone cannot tell
 * them apart; the name can.
 */
const NOT_RAW =
  /\b(pieczon\w*|wedzon\w*|grill\w*|gotowan\w*|smazon\w*|sous|szynk\w*|szyneczk\w*|poledwic\w*|parow\w*|kielbas\w*|panier\w*|nugget\w*|kotlet\w*|salat\w*|pasztet\w*|plastr\w*|paski|stowki|kabanos\w*|krakowsk\w*|morlinsk\w*|piratki|glodniaki|warzyw\w*|zapiekank\w*|pierog\w*|kanapk\w*|tortill\w*|marynow\w*|marynat\w*|sos\w*|ciescie)\b/;

const DEFINITIONS = {
  skyr: {
    id: 'skyr',
    label: 'Skyr naturalny',
    role: 'store',
    typical: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
    match: (p) =>
      (/\bskyr\b/.test(nameOf(p)) || inCategory(p, 'en:skyrs', 'en:plain-skyrs')) &&
      !DRINKABLE.test(nameOf(p)) &&
      within(p, { protein: [9, 15], sugars: [0, 5.5], fat: [0, 3], kcal: [40, 100] }),
  },
  whey: {
    id: 'whey',
    label: 'Białko w proszku (np. serwatkowe)',
    role: 'pantry',
    typical: { kcal: 390, protein: 75, carbs: 8, fat: 6 },
    match: (p) =>
      (inCategory(p, 'en:protein-powders', 'en:whey-powder') ||
        /\b(whey|wpc|wpi)\b|odzywka bialkowa|bialko serwatkowe|protein powder/.test(nameOf(p))) &&
      within(p, { protein: [60, 95], carbs: [0, 15], fat: [0, 12], kcal: [320, 430] }),
  },
  cottage: {
    id: 'cottage',
    label: 'Serek wiejski',
    role: 'store',
    typical: { kcal: 97, protein: 11, carbs: 2, fat: 5 },
    match: (p) =>
      (inCategory(p, 'en:cottage-cheeses') || /serek wiejski|cottage/.test(nameOf(p))) &&
      within(p, { protein: [9, 16], sugars: [0, 4], fat: [0, 6] }),
  },
  quark: {
    id: 'quark',
    label: 'Twaróg chudy',
    role: 'store',
    typical: { kcal: 99, protein: 19.8, carbs: 3.5, fat: 0.5 },
    match: (p) =>
      (inCategory(p, 'en:quarks', 'en:lean-quark') || /\b(twarog\w*|twarozek|quark)\b/.test(nameOf(p))) &&
      within(p, { protein: [15, 25], fat: [0, 2], sugars: [0, 5] }),
  },
  proteinYogurt: {
    id: 'proteinYogurt',
    label: 'Jogurt, skyr lub pudding proteinowy',
    role: 'store',
    typical: { kcal: 64, protein: 10, carbs: 4, fat: 0.3 },
    match: (p) =>
      /\b(protein\w*|bialkow\w*|wysokobialkow\w*|high protein)\b/.test(nameOf(p)) &&
      !/serek wiejski|cottage|twarog|twarozek/.test(nameOf(p)) &&
      inCategory(p, 'en:yogurts', 'en:dairies', 'en:fermented-milk-products', 'en:dairy-desserts') &&
      !DRINKABLE.test(nameOf(p)) &&
      within(p, { protein: [8, 20], sugars: [0, 6], fat: [0, 3] }),
  },
  tuna: {
    id: 'tuna',
    label: 'Tuńczyk w sosie własnym',
    role: 'store',
    typical: { kcal: 105, protein: 24, carbs: 0, fat: 1 },
    match: (p) =>
      (inCategory(p, 'en:tunas') || /\b(tunczyk\w*|tuna)\b/.test(nameOf(p))) &&
      /sos\w* wlasn|w wodzie|in water|in brine|naturz|bulion|solank/.test(nameOf(p)) &&
      within(p, { protein: [18, 32], fat: [0, 3], carbs: [0, 2] }),
  },
  chicken: {
    id: 'chicken',
    label: 'Pierś z kurczaka lub indyka w plastrach',
    role: 'store',
    typical: { kcal: 105, protein: 21, carbs: 1, fat: 2 },
    match: (p) =>
      /(piers|filet|poledwic|szynk)\w*.*\b(kurcz|indyk)|(kurcz|indyk)\w*.*\b(piers|filet|poledwic|szynk)/.test(
        nameOf(p),
      ) && within(p, { protein: [18, 32], fat: [0, 5], carbs: [0, 3] }),
  },
  oats: {
    id: 'oats',
    label: 'Płatki owsiane',
    role: 'store',
    typical: { kcal: 370, protein: 13, carbs: 60, fat: 7 },
    match: (p) =>
      (inCategory(p, 'en:oat-flakes', 'en:rolled-oats') || /platki owsiane/.test(nameOf(p))) &&
      within(p, { protein: [10, 18], carbs: [50, 70], fat: [4, 10], sugars: [0, 3] }),
  },
  milk: {
    id: 'milk',
    label: 'Mleko 2% (lub chudsze)',
    role: 'staple',
    typical: { kcal: 50, protein: 3.3, carbs: 4.8, fat: 2 },
    match: (p) =>
      /\bmleko\b/.test(nameOf(p)) &&
      inCategory(p, 'en:milks', 'en:semi-skimmed-milks', 'en:skimmed-milks') &&
      !/kakao|czekolad|smak|kokos|owsian|sojow|migdal|ryzow/.test(nameOf(p)) &&
      within(p, { protein: [3, 4.5], fat: [0, 2], sugars: [3.5, 5.5] }),
  },
  kefir: {
    id: 'kefir',
    label: 'Kefir naturalny',
    role: 'staple',
    typical: { kcal: 51, protein: 3.4, carbs: 4.4, fat: 2 },
    match: (p) =>
      (inCategory(p, 'en:kefirs') || /\bkefir\w*\b/.test(nameOf(p))) &&
      within(p, { protein: [3, 6], sugars: [0, 5], fat: [0, 2.5] }),
  },
  raspberries: {
    id: 'raspberries',
    label: 'Maliny mrożone',
    role: 'staple',
    typical: { kcal: 52, protein: 1.2, carbs: 5.4, fat: 0.7 },
    match: (p) =>
      /\bmalin\w*\b/.test(nameOf(p)) && FROZEN(p) && within(p, { protein: [0, 3], sugars: [0, 8], fat: [0, 1.5] }),
  },
  strawberries: {
    id: 'strawberries',
    label: 'Truskawki (świeże lub mrożone)',
    role: 'staple',
    typical: { kcal: 32, protein: 0.7, carbs: 5.7, fat: 0.3 },
    match: (p) =>
      /\btruskaw\w*\b/.test(nameOf(p)) && FROZEN(p) && within(p, { protein: [0, 2], sugars: [0, 8], fat: [0, 1] }),
  },
  blueberries: {
    id: 'blueberries',
    label: 'Borówki (świeże lub mrożone)',
    role: 'staple',
    typical: { kcal: 57, protein: 0.7, carbs: 12, fat: 0.3 },
    match: (p) =>
      /\b(borowk|jagod)\w*\b/.test(nameOf(p)) &&
      FROZEN(p) &&
      within(p, { protein: [0, 2], sugars: [0, 12], fat: [0, 1] }),
  },
  egg: { id: 'egg', label: 'Jajko', role: 'staple', typical: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.9 } },
  eggWhites: {
    id: 'eggWhites',
    label: 'Białka jaj',
    role: 'staple',
    typical: { kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 },
  },
  // Raw meat and fish are STAPLES: every supermarket sells chicken breast and
  // frozen fish, while Open Food Facts barely knows them (fresh meat is often
  // weighed at the counter, without a barcode). Making them `store` would hide
  // a chicken dinner from Kaufland because nobody scanned its chicken. Where a
  // packaged one is known, it is used; otherwise typical values.
  chickenFillet: {
    id: 'chickenFillet',
    label: 'Filet z piersi kurczaka (surowy)',
    role: 'staple',
    // No match, on purpose. The "Filet z piersi kurczaka" products in the data
    // are mostly weighed at a deli counter (in-store 2xxx codes) with no
    // category, and a butter-flavoured cold cut has a raw fillet's macros:
    // nothing tells them apart, and naming a cold cut for a roast is worse
    // than typical values.
    typical: { kcal: 106, protein: 22.5, carbs: 0, fat: 1.8 },
  },
  turkeyMince: {
    id: 'turkeyMince',
    label: 'Mięso mielone z indyka',
    role: 'staple',
    // Plain turkey mince, not the leaner breast-only kind: the recipes must
    // pass the rule with whichever one the shop has.
    typical: { kcal: 145, protein: 19.5, carbs: 0, fat: 7.5 },
    match: (p) =>
      /\bmielon\w*/.test(nameOf(p)) &&
      /\b(indyk\w*|indycz\w*)/.test(nameOf(p)) &&
      !NOT_RAW.test(nameOf(p)) &&
      within(p, { protein: [17, 25], fat: [0, 10], carbs: [0, 2] }),
  },
  leanBeef: {
    id: 'leanBeef',
    label: 'Wołowina chuda (udziec lub ligawa)',
    role: 'staple',
    // No match: the data has tartare and salami, not a piece of beef to stew.
    typical: { kcal: 125, protein: 21.5, carbs: 0, fat: 4.3 },
  },
  salmonFillet: {
    id: 'salmonFillet',
    label: 'Łosoś, filet (świeży lub mrożony)',
    role: 'staple',
    typical: { kcal: 205, protein: 20.5, carbs: 0, fat: 13.5 },
    match: (p) =>
      /\blosos\w*/.test(nameOf(p)) &&
      !NOT_RAW.test(nameOf(p)) &&
      // A seasoned ready-to-bake fillet ("do piekarnika", "po tajsku") is a
      // meal, not the plain fish the recipe seasons itself.
      !/\b(pasta|paprykarz\w*|metk\w*|onigiri|gniazd\w*|bezrybn\w*|roslinn\w*|pstrag\w*|brzuszk\w*|piekarnik\w*|express|nuta|po \w+|koperk\w*|ziol\w*)\b/.test(
        nameOf(p),
      ) &&
      !inCategory(p, 'en:smoked-fishes', 'en:canned-fishes', 'en:fish-analogues', 'en:meat-analogues') &&
      within(p, { protein: [18, 24], fat: [1.5, 16], carbs: [0, 1] }),
  },
  whiteFish: {
    id: 'whiteFish',
    label: 'Filet z dorsza lub mintaja (bez skóry)',
    role: 'staple',
    typical: { kcal: 78, protein: 17.5, carbs: 0, fat: 0.8 },
    match: (p) =>
      /\b(dorsz\w*|mintaj\w*|morszczuk\w*|miruna)\b/.test(nameOf(p)) &&
      !NOT_RAW.test(nameOf(p)) &&
      !/\b(paluszk\w*|kawior\w*|zlot\w*)\b/.test(nameOf(p)) &&
      within(p, { protein: [14, 22], fat: [0, 2], carbs: [0, 1] }),
  },
  // Shrimp are not in every shop - a convenience store has none - and the
  // data has them at Biedronka, Lidl and Auchan, so they decide the store.
  shrimp: {
    id: 'shrimp',
    label: 'Krewetki (mrożone, obrane)',
    role: 'store',
    typical: { kcal: 75, protein: 17, carbs: 0.3, fat: 0.8 },
    match: (p) =>
      /\bkrewet\w*/.test(nameOf(p)) &&
      !/\b(prazyn\w*|pasta|sajgon\w*|oleju|chips\w*|zupa|na raz)\b/.test(nameOf(p)) &&
      within(p, { protein: [10, 24], fat: [0, 2.5], carbs: [0, 2] }),
  },
  // Smoked salmon varies from 10 to 18 g of fat per 100 g, so the product
  // matters as much as it does for skyr: bought for the recipe, in that shop.
  smokedSalmon: {
    id: 'smokedSalmon',
    label: 'Łosoś wędzony',
    role: 'store',
    typical: { kcal: 185, protein: 20.5, carbs: 0.3, fat: 11.5 },
    match: (p) =>
      /\blosos\w*/.test(nameOf(p)) &&
      (inCategory(p, 'en:smoked-salmons') || /\bwedzon\w*/.test(nameOf(p))) &&
      !/\b(pasta|salat\w*|onigiri|roslinn\w*|pstrag\w*|brzuszk\w*|kanapk\w*|serek|twarozek|a.la)\b/.test(nameOf(p)) &&
      !inCategory(p, 'en:fish-analogues', 'en:meat-analogues') &&
      within(p, { protein: [17, 26], fat: [1, 16], carbs: [0, 2] }),
  },

  tomato: { id: 'tomato', label: 'Pomidor', role: 'staple', typical: { kcal: 18, protein: 0.9, carbs: 2.6, fat: 0.2 } },
  cucumber: {
    id: 'cucumber',
    label: 'Ogórek',
    role: 'staple',
    typical: { kcal: 15, protein: 0.7, carbs: 2.5, fat: 0.1 },
  },
  chives: {
    id: 'chives',
    label: 'Szczypiorek',
    role: 'staple',
    typical: { kcal: 30, protein: 3.3, carbs: 1.8, fat: 0.7 },
  },
  spinach: {
    id: 'spinach',
    label: 'Szpinak (świeży lub mrożony)',
    role: 'staple',
    typical: { kcal: 23, protein: 2.9, carbs: 1.4, fat: 0.4 },
  },
  onion: { id: 'onion', label: 'Cebula', role: 'staple', typical: { kcal: 36, protein: 1.1, carbs: 7, fat: 0.1 } },
  garlic: { id: 'garlic', label: 'Czosnek', role: 'staple', typical: { kcal: 149, protein: 6.4, carbs: 31, fat: 0.5 } },
  pepper: {
    id: 'pepper',
    label: 'Papryka czerwona',
    role: 'staple',
    typical: { kcal: 28, protein: 1, carbs: 4.6, fat: 0.3 },
  },
  zucchini: {
    id: 'zucchini',
    label: 'Cukinia',
    role: 'staple',
    typical: { kcal: 17, protein: 1.2, carbs: 2.1, fat: 0.3 },
  },
  radish: {
    id: 'radish',
    label: 'Rzodkiewka',
    role: 'staple',
    typical: { kcal: 16, protein: 0.7, carbs: 1.8, fat: 0.1 },
  },
  dill: { id: 'dill', label: 'Koperek', role: 'staple', typical: { kcal: 43, protein: 3.5, carbs: 5, fat: 1.1 } },
  lemon: {
    id: 'lemon',
    label: 'Cytryna lub limonka (sok)',
    role: 'staple',
    typical: { kcal: 22, protein: 0.4, carbs: 6.9, fat: 0.2 },
  },
  broccoli: {
    id: 'broccoli',
    label: 'Brokuł (świeży lub mrożony)',
    role: 'staple',
    typical: { kcal: 32, protein: 2.8, carbs: 3.3, fat: 0.4 },
    match: (p) =>
      /^brokul\w*/.test(nameOf(p)) &&
      inCategory(p, 'en:broccoli', 'en:frozen-broccolis') &&
      within(p, { kcal: [15, 45], protein: [1.5, 5], carbs: [0, 7], fat: [0, 1] }),
  },
  mushrooms: {
    id: 'mushrooms',
    label: 'Pieczarki',
    role: 'staple',
    typical: { kcal: 22, protein: 3.1, carbs: 2.3, fat: 0.3 },
    match: (p) =>
      /^pieczark\w*/.test(nameOf(p)) &&
      !/\b(marynow\w*|w occie|sos\w*|pasta)\b/.test(nameOf(p)) &&
      within(p, { kcal: [10, 40], protein: [1.5, 5], carbs: [0, 5], fat: [0, 1] }),
  },
  passata: {
    id: 'passata',
    label: 'Passata pomidorowa',
    role: 'staple',
    typical: { kcal: 32, protein: 1.4, carbs: 5, fat: 0.2 },
    match: (p) =>
      (/\bpassat\w*|\bprzecier pomidor\w*/.test(nameOf(p)) || inCategory(p, 'en:strained-tomatoes')) &&
      !/\b(sos\w*|ketchup\w*|koncentrat\w*)\b/.test(nameOf(p)) &&
      within(p, { kcal: [15, 45], protein: [0.8, 2.5], carbs: [2.5, 7.5], fat: [0, 1] }),
  },
  cannedTomatoes: {
    id: 'cannedTomatoes',
    label: 'Pomidory krojone z puszki',
    role: 'staple',
    typical: { kcal: 21, protein: 1.1, carbs: 3.3, fat: 0.2 },
    // The fat bound keeps out the "with olive oil and garlic" kind.
    match: (p) =>
      (inCategory(p, 'en:canned-tomatoes', 'en:peeled-tomatoes') ||
        /\bpomidor\w* (krojon\w*|cale|bez skork\w*)|\bpelati\b/.test(nameOf(p))) &&
      within(p, { kcal: [12, 35], protein: [0.5, 2], carbs: [1.5, 6], fat: [0, 1] }),
  },
  beans: {
    id: 'beans',
    label: 'Fasola czerwona z puszki (odsączona)',
    role: 'staple',
    typical: { kcal: 100, protein: 7.5, carbs: 13, fat: 0.6 },
    // Canned, not dry: dry beans are three times as dense and would read as a typo.
    match: (p) =>
      (inCategory(p, 'en:canned-red-kidney-beans') || /\bfasol\w* czerwon\w*|\bkidney\b/.test(nameOf(p))) &&
      within(p, { kcal: [80, 125], protein: [6, 10], carbs: [9, 17], fat: [0, 1.5] }),
  },
  rice: {
    id: 'rice',
    label: 'Ryż biały (suchy)',
    role: 'staple',
    typical: { kcal: 350, protein: 7.2, carbs: 78, fat: 0.7 },
    match: (p) =>
      /\bryz\w*/.test(nameOf(p)) &&
      (inCategory(p, 'en:white-rices', 'en:long-grain-rices', 'en:basmati-rices', 'en:jasmine-rices') ||
        /\bryz\w* (bialy|basmati|jasminow\w*|dlugoziarnist\w*)/.test(nameOf(p))) &&
      within(p, { kcal: [330, 370], protein: [6, 9.5], carbs: [72, 82], fat: [0, 1.5] }),
  },
  lentilPasta: {
    id: 'lentilPasta',
    label: 'Makaron z soczewicy lub ciecierzycy',
    role: 'staple',
    // Twice the protein of wheat pasta, which is what lets a pasta dinner keep
    // the rule. "Protein" pasta made of wheat (19 g / 63 g) is kept out by the bounds.
    typical: { kcal: 345, protein: 25, carbs: 54, fat: 1.8 },
    match: (p) =>
      /\bmakaron\w*/.test(nameOf(p)) &&
      /\b(soczewic\w*|ciecierzyc\w*|fasol\w*|groch\w*|edamame|straczk\w*)\b/.test(nameOf(p)) &&
      within(p, { kcal: [320, 380], protein: [20, 30], carbs: [40, 60], fat: [0, 4] }),
  },
  parmesan: {
    id: 'parmesan',
    label: 'Parmezan lub grana padano',
    role: 'staple',
    typical: { kcal: 400, protein: 32.5, carbs: 0, fat: 29.5 },
    match: (p) =>
      /\b(parmezan\w*|parmigiano|grana padano)\b/.test(nameOf(p)) &&
      within(p, { protein: [28, 38], fat: [24, 33], carbs: [0, 2] }),
  },
  // Ready to eat, for the no-dishes sets (gotowce). Fruit has no product match:
  // Open Food Facts lists a handful of bananas with three different energies,
  // so USDA FoodData Central (SR Legacy 09040, 09003) is the honest number. The
  // typical values of the bought ones are medians of their matches in the
  // dataset of 2026-10 (15 rolls, 27 rice cakes, 25 crispbreads, 37 bars, 46 drinks).
  banana: { id: 'banana', label: 'Banan', role: 'staple', typical: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 } },
  apple: { id: 'apple', label: 'Jabłko', role: 'staple', typical: { kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 } },
  roll: {
    id: 'roll',
    label: 'Bułka grahamka lub kajzerka',
    role: 'staple',
    typical: { kcal: 260, protein: 9.1, carbs: 51, fat: 1.4 },
    // A plain roll, not a sweet bun, a burger bun or breadcrumbs ("bułka tarta").
    match: (p) =>
      /^(bulk[ai]|kajzerk\w*)\b|grahamk/.test(nameOf(p)) &&
      !/\b(tart\w*|burger\w*|hot ?dog\w*|maslan\w*|slodk\w*|drozdzow\w*|maslem)\b/.test(nameOf(p)) &&
      within(p, { kcal: [230, 310], protein: [7, 13], fat: [0, 5], sugars: [0, 6] }),
  },
  riceCakes: {
    id: 'riceCakes',
    label: 'Wafle ryżowe naturalne',
    role: 'store',
    typical: { kcal: 385, protein: 8.1, carbs: 78, fat: 3.3 },
    // The fat bound keeps out the chocolate-coated ones, the sugar bound the sweet flavours.
    match: (p) =>
      (/\bwafl\w* ryzow\w*|\bryzow\w* wafl\w*|\brice cakes?\b/.test(nameOf(p)) ||
        inCategory(p, 'en:puffed-rice-cakes')) &&
      within(p, { kcal: [340, 420], protein: [5, 12], fat: [0, 6], sugars: [0, 5] }),
  },
  crispbread: {
    id: 'crispbread',
    label: 'Pieczywo chrupkie',
    role: 'store',
    typical: { kcal: 362, protein: 8.6, carbs: 73, fat: 1.5 },
    match: (p) =>
      (/\bpieczyw\w* chrupk\w*|\bchrupk\w* pieczyw\w*|knackebrot|crispbread/.test(nameOf(p)) ||
        inCategory(p, 'en:crispbreads')) &&
      within(p, { kcal: [300, 420], protein: [6, 15], carbs: [50, 85], fat: [0, 7] }),
  },
  proteinBar: {
    id: 'proteinBar',
    label: 'Baton białkowy',
    role: 'store',
    typical: { kcal: 382, protein: 33, carbs: 29, fat: 16 },
    // A third of the bar protein is what makes it a protein bar; below that it is
    // a candy bar with a word on the wrapper.
    match: (p) =>
      !MULTIPACK.test(nameOf(p)) &&
      isProteinBar(p, nameOf(p)) &&
      !/\b(powder|proszk\w*|odzywk\w*)\b/.test(nameOf(p)) &&
      within(p, { protein: [30, 55], kcal: [250, 450] }),
  },
  proteinDrink: {
    id: 'proteinDrink',
    label: 'Napój proteinowy lub skyr pitny',
    role: 'store',
    typical: { kcal: 61, protein: 10, carbs: 4.8, fat: 0.5 },
    // Ready to drink: a powder (300+ kcal) or a sweet milkshake stays out.
    match: (p) =>
      !MULTIPACK.test(nameOf(p)) &&
      isProteinDrink(p, nameOf(p)) && within(p, { kcal: [30, 120], protein: [6, 15], sugars: [0, 8], fat: [0, 3] }),
  },
  // Bought online more often than not (src/food/online): protein mixes, keto bread and pasta,
  // plant-based "meat". Physical shops that sell an equal product count too - the basket logic
  // then needs no delivery. Typical values: medians of the matches in the merged data of 2026-10.
  proteinPancakeMix: {
    id: 'proteinPancakeMix',
    label: 'Mieszanka na białkowe naleśniki',
    role: 'store',
    typical: { kcal: 390, protein: 54, carbs: 28, fat: 6 },
    match: (p) =>
      /\b(nalesnik\w*|pancake\w*|placuszk\w*)\b/.test(nameOf(p)) && within(p, { protein: [40, 80], kcal: [300, 420] }),
  },
  mugCake: {
    id: 'mugCake',
    label: 'Mieszanka na białkowe ciasto w kubku',
    role: 'store',
    typical: { kcal: 376, protein: 43, carbs: 33, fat: 6.7 },
    match: (p) =>
      /\bmug ?cake\b|ciast\w* w kubku/.test(nameOf(p)) && within(p, { protein: [35, 70], kcal: [300, 420] }),
  },
  peanutPowder: {
    id: 'peanutPowder',
    label: 'Masło orzechowe w proszku',
    role: 'store',
    typical: { kcal: 408, protein: 50, carbs: 26, fat: 12 },
    match: (p) =>
      /maslo orzechowe w proszku|peanut (butter )?powder|\bpb2\b/.test(nameOf(p)) &&
      within(p, { protein: [40, 65], fat: [0, 15] }),
  },
  proteinCrisps: {
    id: 'proteinCrisps',
    label: 'Chipsy białkowe',
    role: 'store',
    typical: { kcal: 432, protein: 33.5, carbs: 42, fat: 13.3 },
    match: (p) =>
      !MULTIPACK.test(nameOf(p)) && /\b(chips\w*|crisps?)\b/.test(nameOf(p)) && within(p, { protein: [30, 60], fat: [0, 20] }),
  },
  ketoPasta: {
    id: 'ketoPasta',
    label: 'Makaron keto lub białkowy (suchy)',
    role: 'store',
    typical: { kcal: 284, protein: 36, carbs: 9.8, fat: 4.8 },
    // The protein bound is what makes it: a lentil pasta (24 g) is `lentilPasta`, wheat pasta 12 g.
    match: (p) =>
      /\bmakaron\w*|\bpasta\b|\bpenne\b|\bfusilli\b/.test(nameOf(p)) &&
      within(p, { protein: [30, 60], carbs: [0, 30] }),
  },
  konjac: {
    id: 'konjac',
    label: 'Makaron konjac (shirataki)',
    role: 'store',
    typical: { kcal: 6, protein: 0, carbs: 1.3, fat: 0 },
    match: (p) => /\b(konjac\w*|konjak\w*|shirataki)\b/.test(nameOf(p)) && within(p, { kcal: [0, 40], fat: [0, 1] }),
  },
  proteinBread: {
    id: 'proteinBread',
    label: 'Chleb białkowy (keto)',
    role: 'store',
    typical: { kcal: 255, protein: 29, carbs: 8, fat: 10 },
    match: (p) =>
      // A bread, not a ham "tostowa" or a baking mix.
      /\bchleb\w*/.test(nameOf(p)) &&
      !/chrupk|mieszank|wypiek|szynk|szyneczk/.test(nameOf(p)) &&
      within(p, { protein: [20, 40], carbs: [0, 20], fat: [0, 15] }),
  },
  ketoPizzaBase: {
    id: 'ketoPizzaBase',
    label: 'Spód do pizzy keto',
    role: 'store',
    typical: { kcal: 215, protein: 14, carbs: 7, fat: 7 },
    match: (p) => /spod\w* do pizz|pizza base/.test(nameOf(p)) && within(p, { protein: [12, 40], carbs: [0, 15] }),
  },
  ketoTortilla: {
    id: 'ketoTortilla',
    label: 'Tortilla keto (niskowęglowodanowa)',
    role: 'store',
    typical: { kcal: 248, protein: 19.7, carbs: 11.6, fat: 12.9 },
    match: (p) => /\btortill\w*|\bwrap\w*/.test(nameOf(p)) && within(p, { protein: [15, 40], carbs: [0, 25] }),
  },
  plantProtein: {
    id: 'plantProtein',
    label: 'Białko roślinne w proszku (groch, ryż, dynia, konopie)',
    role: 'store',
    typical: { kcal: 384, protein: 75, carbs: 6, fat: 5.4 },
    // A powder made from plants: by its source in the name, and mostly protein - a "vege mix" of
    // greens with 20 g of it is a superfood, not a protein powder.
    match: (p) =>
      /\b(bialk\w*|protein\w*)\b/.test(nameOf(p)) &&
      /\b(grochu|groch\w*|ryzu|ryzow\w*|pestek dyni|dyni|konopn\w*|konopi|slonecznik\w*|pea|vege\w*|vegan\w*|plant|roslinn\w*|soj\w*)\b/.test(
        nameOf(p),
      ) &&
      !/\b(baton\w*|bar|shake w puszce|napoj\w*|nalesnik\w*|ciast\w*)\b/.test(nameOf(p)) &&
      within(p, { protein: [45, 92], carbs: [0, 25], kcal: [300, 450] }),
  },
  zeroSyrup: {
    id: 'zeroSyrup',
    label: 'Syrop zero (bez cukru)',
    role: 'store',
    typical: { kcal: 2, protein: 0, carbs: 0.5, fat: 0 },
    match: (p) =>
      /\bsyrop\w*/.test(nameOf(p)) &&
      /\b(zero|bez cukru|0 ?kcal|sugar free|fit)\b/.test(nameOf(p)) &&
      within(p, { kcal: [0, 40], carbs: [0, 15], fat: [0, 1] }),
  },
  zeroSauce: {
    id: 'zeroSauce',
    label: 'Sos zero (bez cukru), np. słodkie chili lub BBQ',
    role: 'store',
    typical: { kcal: 17, protein: 0.1, carbs: 4.1, fat: 0 },
    match: (p) =>
      /\bsos\w*/.test(nameOf(p)) &&
      !/\bsojow\w*|\bsyrop\w*/.test(nameOf(p)) &&
      /\b(zero|bez cukru|0 ?kcal|sugar free|fit|light)\b/.test(nameOf(p)) &&
      within(p, { kcal: [0, 60], carbs: [0, 15], fat: [0, 3] }),
  },
  plantDeli: {
    id: 'plantDeli',
    label: 'Roślinna wędlina (pepperoni, szynka, kabanosy)',
    role: 'store',
    typical: { kcal: 260, protein: 28, carbs: 10, fat: 10 },
    match: (p) =>
      inCategory(p, 'en:meat-analogues') &&
      /pepperoni|boczek|szynk\w*|kabanos\w*|salami|chorizo|polędwic|poledwic|suszon\w*/.test(nameOf(p)) &&
      within(p, { protein: [20, 45], fat: [0, 15] }),
  },
  plantMeat: {
    id: 'plantMeat',
    label: 'Roślinne mięso do smażenia (kebab, kawałki, filety)',
    role: 'store',
    typical: { kcal: 226, protein: 21, carbs: 6.3, fat: 13 },
    match: (p) =>
      inCategory(p, 'en:meat-analogues') &&
      /kebab|gyros|kawalk\w*|filet\w*|szarpan\w*|strips/.test(nameOf(p)) &&
      within(p, { protein: [15, 40], fat: [0, 17] }),
  },
  cocoa: {
    id: 'cocoa',
    label: 'Kakao bez cukru',
    role: 'pantry',
    typical: { kcal: 350, protein: 21, carbs: 12, fat: 11 },
    match: (p) =>
      (inCategory(p, 'en:cocoa-powders', 'en:unsweetened-cocoa-powders') || /\bkakao\b/.test(nameOf(p))) &&
      within(p, { protein: [15, 30], sugars: [0, 3], fat: [5, 25] }),
  },
  coffee: {
    id: 'coffee',
    label: 'Kawa (espresso lub mocna kawa)',
    role: 'pantry',
    typical: { kcal: 2, protein: 0.1, carbs: 0, fat: 0.2 },
  },
  // Pantry, but never free: a tablespoon of oil is 9 g of fat, as much as an
  // egg, so it is weighed in every recipe that fries or roasts.
  oil: {
    id: 'oil',
    label: 'Oliwa z oliwek lub olej rzepakowy',
    role: 'pantry',
    typical: { kcal: 824, protein: 0, carbs: 0, fat: 91.6 },
    match: (p) =>
      (/\boliwa\b|\bolej\w* rzepakow\w*/.test(nameOf(p)) || inCategory(p, 'en:olive-oils', 'en:rapeseed-oils')) &&
      !/slonecznik|sonnenblum|sunflower/.test(nameOf(p)) &&
      within(p, { kcal: [800, 900], fat: [88, 100], carbs: [0, 0.5], protein: [0, 0.5] }),
  },
  spices: {
    id: 'spices',
    label: 'Przyprawy (papryka, oregano, kmin, chili)',
    role: 'pantry',
    typical: { kcal: 280, protein: 13, carbs: 24, fat: 10 },
  },
  curry: {
    id: 'curry',
    label: 'Curry w proszku',
    role: 'pantry',
    typical: { kcal: 293, protein: 12.7, carbs: 28, fat: 11 },
  },
  // EU labels count polyols as carbohydrate (erythritol: 0 kcal, 100 g carbs),
  // and so does the rule: the cheesecake passes even when they count.
  sweetener: {
    id: 'sweetener',
    label: 'Erytrytol (lub inny słodzik)',
    role: 'pantry',
    typical: { kcal: 0, protein: 0, carbs: 100, fat: 0 },
  },
  potatoStarch: {
    id: 'potatoStarch',
    label: 'Mąka ziemniaczana',
    role: 'pantry',
    typical: { kcal: 343, protein: 0.1, carbs: 85, fat: 0.1 },
  },
  cinnamon: {
    id: 'cinnamon',
    label: 'Cynamon',
    role: 'pantry',
    typical: { kcal: 247, protein: 4, carbs: 27.5, fat: 1.2 },
  },
  water: { id: 'water', label: 'Woda', role: 'pantry', typical: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  ice: { id: 'ice', label: 'Lód', role: 'pantry', typical: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  saltPepper: {
    id: 'saltPepper',
    label: 'Sól i pieprz',
    role: 'pantry',
    typical: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  },
} satisfies Record<string, IngredientDef>;

/** An ingredient a recipe can name: a typo in the catalog is a type error, not a crash. */
export type IngredientId = keyof typeof DEFINITIONS;

export const INGREDIENTS: Record<IngredientId, IngredientDef> = DEFINITIONS;
