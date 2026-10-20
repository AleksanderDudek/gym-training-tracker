import { describe, expect, test } from 'vitest';
import { formatPrice } from '../lib/format';
import type { IndexedProduct } from '../lib/types';
import type { Recipe } from '../recipes/catalog';
import type { Candidates } from '../recipes/resolve';
import { makeProduct } from '../test/fixtures';
import { PREP_DICT, prepCandidates } from '../test/prep';
import { SIDES } from './sides';
import { amountText, packSize, packsFor, priceSum, pricedEnough, shoppingList, shoppingText } from './shopping';
import type { PrepPlan } from './types';

const recipe = (id: string, items: Recipe['items'], servings = 1): Recipe => ({
  id,
  name: id,
  kind: 'slone',
  minutes: 10,
  tool: '',
  description: '',
  items,
  steps: [],
  servings,
});

const START = '2026-10-20';

describe('pack sizes', () => {
  test('what is taken off the shelf: a family pack and a multipack count whole', () => {
    expect(packSize('450 g')).toBe(450);
    expect(packSize('1 kg')).toBe(1000);
    expect(packSize('0,5 l')).toBe(500);
    expect(packSize('4 x 125 g')).toBe(500);
    expect(packSize('2×500g')).toBe(1000);
    expect(packSize('150gr')).toBe(150);
    expect(packSize('60 gram')).toBe(60);
    expect(packSize('0,9 L')).toBe(900);
    expect(packSize('opakowanie')).toBeNull();
    expect(packSize(null)).toBeNull();
  });

  test('a pack that covers all but 5 % counts as one', () => {
    expect(packsFor(450, 450)).toBe(1);
    expect(packsFor(470, 450)).toBe(1);
    expect(packsFor(480, 450)).toBe(2);
    expect(packsFor(1, 450)).toBe(1);
  });
});

describe('the shopping list', () => {
  const candidates = prepCandidates();

  test('adds up every use of an ingredient: a batch of three servings and a fresh meal', () => {
    const curry = recipe('curry', [{ ingredient: 'skyr', grams: 300 }, { ingredient: 'chickenFillet', grams: 600 }], 2);
    const bowl = recipe('bowl', [{ ingredient: 'skyr', grams: 200 }]);
    const list = shoppingList({
      uses: [
        { recipe: curry, servings: 3, date: START },
        { recipe: bowl, servings: 1.5, date: '2026-10-21' },
      ],
      sides: [],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    const skyr = list.find((i) => i.key === 'skyr')!;
    // 300 × 3/2 + 200 × 1.5 = 750 g, in 450 g packs.
    expect(skyr.grams).toBe(750);
    expect(skyr.packs).toBe(2);
    expect(amountText(skyr)).toBe('2 opak. · po 450 g');
    expect(skyr.price).toBeCloseTo(2 * 5.49, 2);
    expect(skyr).toMatchObject({ group: 'visit', aisle: 'nabial', shop: 'biedronka' });
    const chicken = list.find((i) => i.key === 'chickenFillet')!;
    // Raw chicken has no product in the data: grams, on the visit.
    expect(chicken).toMatchObject({ grams: 900, product: null, packs: null, group: 'visit', aisle: 'mieso' });
    expect(amountText(chicken)).toBe('900 g');
  });

  test('countable staples in pieces, rolls too; water never', () => {
    const r = recipe('eggs', [
      { ingredient: 'egg', grams: 150 },
      { ingredient: 'water', grams: 300 },
    ]);
    const list = shoppingList({
      uses: [{ recipe: r, servings: 4, date: START }],
      sides: [{ ingredient: 'roll', grams: 2 * SIDES.roll.step, date: START }],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    expect(list.map((i) => i.key).sort()).toEqual(['egg', 'roll']);
    expect(amountText(list.find((i) => i.key === 'egg')!)).toBe('12 szt.');
    expect(amountText(list.find((i) => i.key === 'roll')!)).toBe('2 szt.');
  });

  test('pantry goods are checked at home, online products ordered with their links', () => {
    const r = recipe('shake', [
      { ingredient: 'whey', grams: 30 },
      { ingredient: 'konjac', grams: 200 },
      { ingredient: 'skyr', grams: 150 },
    ]);
    const list = shoppingList({
      uses: [{ recipe: r, servings: 2, date: START }],
      sides: [],
      basket: ['biedronka', 'myprotein'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    expect(list.map((i) => [i.key, i.group])).toEqual([
      ['skyr', 'visit'],
      ['konjac', 'order'],
      ['whey', 'home'],
    ]);
    const konjac = list.find((i) => i.key === 'konjac')!;
    expect(konjac.product?.url).toBe('https://www.myprotein.pl/konjac');
    // The online offer's price, per pack.
    expect(konjac.price).toBeCloseTo(29.99, 2);
  });

  test('a piece short is a meal short: pieces round up', () => {
    const r = recipe('zucchini', [{ ingredient: 'zucchini', grams: 413 }]);
    const [zucchini] = shoppingList({
      uses: [{ recipe: r, servings: 1, date: START }],
      sides: [],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    // 413 g of 300 g zucchini is two, not one.
    expect(amountText(zucchini!)).toBe('2 szt.');
  });

  test('canned tuna is counted after draining: a 500 g can gives 350 g', () => {
    const r = recipe('tuna', [{ ingredient: 'tuna', grams: 400 }]);
    const [tuna] = shoppingList({
      uses: [{ recipe: r, servings: 1, date: START }],
      sides: [],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    expect(tuna).toMatchObject({ packs: 2, drained: true });
    // 400 g drained is more than one can's 350 g: two cans (as gross, one would be enough).
    expect(amountText(tuna!)).toBe('2 opak. · po 500 g (400 g po odsączeniu)');
  });

  test('a price per kilogram is charged by weight', () => {
    const r = recipe('mush', [{ ingredient: 'mushrooms', grams: 250 }]);
    const [mushrooms] = shoppingList({
      uses: [{ recipe: r, servings: 1, date: START }],
      sides: [],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    // One 500 g pack at 11.99 zł/kg.
    expect(mushrooms!.packs).toBe(1);
    expect(mushrooms!.price).toBeCloseTo(6, 1);
  });

  test('raw meat needed from the third day goes into the freezer, with the amount and the day', () => {
    const r = recipe('turkey', [{ ingredient: 'turkeyFillet', grams: 200 }]);
    const [turkey] = shoppingList({
      uses: [
        { recipe: r, servings: 1, date: START },
        { recipe: r, servings: 1, date: '2026-10-21' },
        { recipe: r, servings: 2, date: '2026-10-24' },
      ],
      sides: [],
      basket: ['biedronka'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    expect(turkey!.freeze).toEqual([{ date: '2026-10-24', grams: 400 }]);
  });

  test('the staple a shop sells comes with its product; one product per ingredient for every recipe', () => {
    const rice = candidates.get('rice')![0]!;
    const own: Candidates = new Map(candidates);
    const cheap: IndexedProduct = { ...makeProduct({ code: 'cheap-rice', name: 'Ryż tani', stores: ['lidl'] }), searchText: '' };
    own.set('rice', [rice, cheap]);
    const list = shoppingList({
      uses: [
        { recipe: recipe('a', [{ ingredient: 'rice', grams: 100 }]), servings: 1, date: START },
        { recipe: recipe('b', [{ ingredient: 'rice', grams: 50 }]), servings: 1, date: START },
      ],
      sides: [{ ingredient: 'rice', grams: 2 * SIDES.rice.step, date: START }],
      basket: ['biedronka'],
      candidates: own,
      dict: PREP_DICT,
      start: START,
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: 'rice', grams: 200, packs: 1, product: { code: rice.code } });
  });

  test('sorted for one walk through the shop: produce, chillers, shelves; the order; home', () => {
    const r = recipe('mix', [
      { ingredient: 'oats', grams: 50 },
      { ingredient: 'tomato', grams: 100 },
      { ingredient: 'skyr', grams: 150 },
      { ingredient: 'oil', grams: 10 },
      { ingredient: 'konjac', grams: 100 },
    ]);
    const list = shoppingList({
      uses: [{ recipe: r, servings: 1, date: START }],
      sides: [],
      basket: ['biedronka', 'myprotein'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    expect(list.map((i) => i.key)).toEqual(['tomato', 'skyr', 'oats', 'konjac', 'oil']);
    expect(priceSum(list.filter((i) => i.group !== 'home'))).toEqual({ total: 5.49 + 29.99, known: 2, unknown: 2 });
    // Half the lines priced is enough for a total; fewer is not the cost of the shopping.
    expect(pricedEnough({ known: 2, unknown: 2 })).toBe(true);
    expect(pricedEnough({ known: 1, unknown: 34 })).toBe(false);
    expect(pricedEnough({ known: 0, unknown: 0 })).toBe(false);
  });

  test('as text: shop by shop, aisle by aisle, ticked lines marked', () => {
    const r = recipe('mix', [
      { ingredient: 'tomato', grams: 100 },
      { ingredient: 'skyr', grams: 150 },
      { ingredient: 'konjac', grams: 100 },
    ]);
    const shopping = shoppingList({
      uses: [{ recipe: r, servings: 1, date: START }],
      sides: [],
      basket: ['biedronka', 'myprotein'],
      candidates,
      dict: PREP_DICT,
      start: START,
    });
    const plan = {
      settings: { start: START, days: 7 },
      shops: [
        { key: 'biedronka', name: 'Biedronka', online: false, url: null },
        { key: 'myprotein', name: 'Myprotein', online: true, url: 'https://www.myprotein.pl' },
      ],
      shopping,
      bought: ['skyr'],
    } as unknown as PrepPlan;
    expect(shoppingText(plan)).toBe(
      [
        'Lista zakupów · 20–26 paź',
        '',
        'Biedronka',
        '  Warzywa i owoce',
        '  [ ] Pomidor — 1 szt.',
        '  Nabiał i jajka',
        `  [x] Skyr naturalny — 1 opak. · 450 g · ok. ${formatPrice(5.49)}`,
        '',
        'Myprotein (zamówienie)',
        `  [ ] Makaron konjac (shirataki) — 1 opak. · 500 g · ok. ${formatPrice(29.99)}`,
        '',
        `Razem ok. ${formatPrice(35.48)} (ceny znane dla 2 z 3 pozycji).`,
      ].join('\n'),
    );
  });
});
