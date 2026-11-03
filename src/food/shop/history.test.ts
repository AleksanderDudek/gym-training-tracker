import { describe, expect, test } from 'vitest';
import { addDays } from '../diet/model';
import type { Entry } from '../diet/db';
import type { FoodSet } from '../diet/foods';
import { indexProducts } from '../lib/search';
import type { IndexedProduct } from '../lib/types';
import { makeProduct } from '../test/fixtures';
import { PREP_DICT, prepCandidates } from '../test/prep';
import { historyAmount, historyList, historyText, type HistoryInput, type HistoryItem } from './history';
import type { ShopRhythm } from './rhythm';

// Tuesday; the default rhythm shops on Saturday 7 Nov for the 7 days up to Friday 13 Nov.
const TODAY = '2026-11-03';
const SATURDAY: ShopRhythm = { kind: 'weekdays', days: [6], at: '10:00' };
const candidates = prepCandidates();

const entry = (date: string, over: Partial<Entry>): Entry => ({
  date,
  time: '08:00',
  name: 'x',
  amountLabel: '',
  kcal: 100,
  protein: 1,
  carbs: 1,
  fat: 1,
  source: 'quick',
  ...over,
});

/** The `n` days before today, most recent first. */
const daysBack = (n: number, skip = 0) => Array.from({ length: n }, (_, i) => addDays(TODAY, -1 - skip - i));

const skyrMaliny = (date: string, amountLabel = '1 porcja') =>
  entry(date, { source: 'recipe', key: 'recipe:skyr-maliny', name: 'Skyr z malinami', amountLabel });

function product(code: string, name: string, quantity: string | null, kcal = 100): IndexedProduct {
  return indexProducts(
    [makeProduct({ code, name, quantity, nutrition: { kcal, protein: 10, carbs: 5, fat: 2, sugars: 1, saturatedFat: 1, fiber: 0, salt: 0 }, stores: ['biedronka'] })],
    {},
  )[0]!;
}

function list(entries: Entry[], over: Partial<HistoryInput> = {}) {
  return historyList({ entries, today: TODAY, rhythm: SATURDAY, basket: ['biedronka'], candidates, dict: PREP_DICT, ...over });
}

const find = (items: HistoryItem[], key: string) => items.find((i) => i.key === key);

describe('the window and the divisor', () => {
  test('fewer than three logged days: no list yet', () => {
    const l = list(daysBack(2).map((d) => skyrMaliny(d)));
    expect(l).toMatchObject({ enough: false, logged: 2, main: [], sometimes: [], home: [] });
    expect(l.period).toEqual({ shop: '2026-11-07', until: '2026-11-13', days: 7 });
  });

  test('four weeks before today: today and anything older are left out', () => {
    const inside = daysBack(3).map((d) => skyrMaliny(d));
    const l = list([...inside, skyrMaliny(TODAY), skyrMaliny(addDays(TODAY, -29)), skyrMaliny(addDays(TODAY, -40))]);
    expect(l).toMatchObject({ from: '2026-10-06', to: '2026-11-02', logged: 3, enough: true });
  });

  test('only logged days divide: a day without entries is no data, not a fast', () => {
    // 7 logged days spread over 4 weeks eat the same per day as 14 logged days in a row.
    const sparse = list(daysBack(7).map((d, i) => skyrMaliny(addDays(d, -i * 2))));
    const dense = list(daysBack(14).map((d) => skyrMaliny(d)));
    expect(sparse.logged).toBe(7);
    expect(find(sparse.main, 'skyr')!.grams).toBe(1400);
    expect(find(dense.main, 'skyr')!.grams).toBe(1400);
  });
});

describe('recipes become their ingredients, bought by the plan list’s rules', () => {
  test('a recipe every day: per-day average times the period, in packs, by aisle, pantry at home', () => {
    const l = list(daysBack(14).map((d) => skyrMaliny(d)));
    // Skyr 200 g a day × 7 days = 1400 g in 450 g pots: 4 pots.
    expect(find(l.main, 'skyr')).toMatchObject({ grams: 1400, packs: 4, packGrams: 450, aisle: 'nabial', from: 'recipe', days: 14 });
    expect(historyAmount(find(l.main, 'skyr')!)).toBe('4 opak. · po 450 g');
    expect(find(l.main, 'skyr')!.price).toBeCloseTo(4 * 5.49, 2);
    expect(find(l.main, 'raspberries')).toMatchObject({ grams: 700, aisle: 'mrozonki' });
    // Protein powder is a pantry good: checked at home, not on the list.
    expect(find(l.main, 'whey')).toBeUndefined();
    expect(find(l.home, 'whey')).toMatchObject({ grams: 105, group: 'home' });
    // One walk through the shop: dairy, then the freezers.
    expect(l.main.map((i) => i.aisle)).toEqual(['nabial', 'mrozonki']);
  });

  test('servings count: two servings on a day is twice the ingredients', () => {
    const l = list(daysBack(7).map((d) => skyrMaliny(d, '2 porcje')));
    expect(find(l.main, 'skyr')!.grams).toBe(2800);
  });

  test('the same ingredient from two recipes adds up; water is never bought', () => {
    const entries = daysBack(7).flatMap((d) => [
      skyrMaliny(d),
      entry(d, { source: 'recipe', key: 'recipe:shake-truskawkowy', name: 'Shake', amountLabel: '1 porcja' }),
    ]);
    const l = list(entries);
    expect(find(l.main, 'skyr')!.grams).toBe((200 + 150) * 7);
    expect([...l.main, ...l.sometimes, ...l.home].some((i) => i.key === 'water')).toBe(false);
  });

  test('countable staples come in pieces', () => {
    const l = list(daysBack(7).map((d) => entry(d, { source: 'recipe', key: 'recipe:banan-baton', name: 'Banan i baton', amountLabel: '1 porcja' })));
    expect(find(l.main, 'banana')).toMatchObject({ pieces: 7 });
    expect(historyAmount(find(l.main, 'banana')!)).toBe('7 szt.');
  });

  test('a recipe removed from the catalog is not bought (it is skipped)', () => {
    const l = list(daysBack(3).map((d) => entry(d, { source: 'recipe', key: 'recipe:nie-ma-takiego', name: 'Stary przepis', amountLabel: '1 porcja' })));
    expect(l).toMatchObject({ main: [], sometimes: [], skipped: 3 });
  });
});

describe('products and own foods', () => {
  const yoghurt = product('5901', 'Jogurt naturalny Pilos', '400 g', 60);
  const lookup = (code: string) => (code === yoghurt.code ? yoghurt : undefined);

  test('a product logged by barcode is its own line, in packs of its own size', () => {
    // 200 g on each of 7 logged days: 1400 g in 400 g pots = 4 pots (3,5 rounds up).
    const l = list(daysBack(7).map((d) => entry(d, { source: 'product', key: 'product:5901', name: 'Jogurt naturalny Pilos', amountLabel: '200 g', kcal: 120 })), {
      product: lookup,
    });
    const line = find(l.main, 'product:5901')!;
    expect(line).toMatchObject({ grams: 1400, packs: 4, packGrams: 400, from: 'product', days: 7 });
    expect(line.product).toMatchObject({ code: '5901', name: 'Jogurt naturalny Pilos', quantity: '400 g' });
    expect(historyAmount(line)).toBe('4 opak. · po 400 g');
  });

  test('a product stands in the aisle of the first ingredient whose matcher takes it', () => {
    const skyr = indexProducts(
      [makeProduct({ code: '5902', name: 'Skyr naturalny Piątnica', quantity: '150 g', nutrition: { kcal: 63, protein: 11, carbs: 4, fat: 0.2, sugars: 4, saturatedFat: 0.1, fiber: 0, salt: 0.1 } })],
      {},
    )[0]!;
    const l = list(daysBack(3).map((d) => entry(d, { source: 'product', key: 'product:5902', name: 'Skyr', amountLabel: '150 g' })), {
      product: (code) => (code === '5902' ? skyr : undefined),
    });
    expect(find(l.main, 'product:5902')).toMatchObject({ aisle: 'nabial', packs: 7 });
  });

  test('the same product in a recipe and logged on its own is one line, both amounts', () => {
    // The basket buys the recipe's skyr as p-skyr (450 g pots); 150 g of it logged by barcode on 7 days too.
    const skyr = candidates.get('skyr')![0]!;
    const days = daysBack(7);
    const l = list([...days.map((d) => skyrMaliny(d)), ...days.slice(0, 3).map((d) => entry(d, { source: 'product', key: `product:${skyr.code}`, name: 'Skyr', amountLabel: '150 g' }))], {
      product: (code) => (code === skyr.code ? skyr : undefined),
    });
    expect(find(l.main, 'skyr')).toBeUndefined();
    // (200 g × 7 + 150 g × 3) / 7 days × 7 = 1850 g: 5 pots (4,1 rounds up).
    expect(find(l.main, `product:${skyr.code}`)).toMatchObject({ grams: 1850, packs: 5, aisle: 'nabial', days: 7 });
  });

  test('logged in pieces: the grams come from its kcal and the label', () => {
    // 1 pot logged as „1 opak.” for 240 kcal at 60 kcal/100 g is 400 g.
    const l = list(daysBack(7).map((d) => entry(d, { source: 'product', key: 'product:5901', name: 'Jogurt', amountLabel: '1 opak.', kcal: 240 })), { product: lookup });
    expect(find(l.main, 'product:5901')).toMatchObject({ grams: 2800, packs: 7 });
  });

  test('a product the base does not know (scanned from Open Food Facts): its name and grams, no packs', () => {
    const l = list(daysBack(7).map((d) => entry(d, { source: 'product', key: 'product:999', name: 'Kefir z OFF', amountLabel: '250 g' })));
    const line = find(l.main, 'product:999')!;
    expect(line).toMatchObject({ label: 'Kefir z OFF', product: null, packs: null, grams: 1750, aisle: 'inne', price: null });
    expect(historyAmount(line)).toBe('1,75 kg');
  });

  test('an own food without grams: portions as logged', () => {
    const l = list(daysBack(3).map((d) => entry(d, { source: 'custom', key: 'custom:4', name: 'Chleb żytni', amountLabel: '1 kromka' })));
    const line = find(l.main, 'custom:4')!;
    expect(line).toMatchObject({ from: 'own', portions: { count: 7, label: '1 kromka' }, aisle: 'inne' });
    expect(historyAmount(line)).toBe('7 × 1 kromka');
  });

  test('a set is its parts; a recipe inside a set is its ingredients', () => {
    const sets = new Map<number, FoodSet>([
      [
        2,
        {
          id: 2,
          name: 'Śniadanie',
          parts: [
            { name: 'Jogurt naturalny Pilos', amountLabel: '200 g', kcal: 120, protein: 8, carbs: 8, fat: 6, key: 'product:5901' },
            { name: 'Skyr z malinami', amountLabel: '1 porcja', kcal: 250, protein: 30, carbs: 20, fat: 2, key: 'recipe:skyr-maliny' },
          ],
        },
      ],
    ]);
    const l = list(daysBack(7).map((d) => entry(d, { source: 'set', key: 'set:2', name: 'Śniadanie', amountLabel: '…' })), { sets, product: lookup });
    expect(find(l.main, 'product:5901')!.grams).toBe(1400);
    expect(find(l.main, 'skyr')!.grams).toBe(1400);
  });
});

describe('what the list leaves out, and what it only suggests', () => {
  test('restaurants, photo dishes, plan items and quick entries are skipped and counted', () => {
    const days = daysBack(3);
    const entries = [
      ...days.map((d) => skyrMaliny(d)),
      entry(days[0]!, { source: 'restaurant', key: 'restaurant:kfc:strips', name: 'Stripsy' }),
      entry(days[1]!, { source: 'dish', key: 'dish:pierogiRuskie', name: 'Pierogi' }),
      entry(days[1]!, { source: 'plan', key: 'plan:Obiad', name: 'Obiad z cateringu' }),
      entry(days[2]!, { name: 'Słodki napój (szacunek)' }),
    ];
    const l = list(entries);
    expect(l.skipped).toBe(4);
    expect([...l.main, ...l.sometimes].map((i) => i.key).sort()).toEqual(['raspberries', 'skyr']);
  });

  test('eaten on one day only: „Czasem”, not the list', () => {
    const days = daysBack(5);
    const l = list([...days.map((d) => skyrMaliny(d)), entry(days[0]!, { source: 'custom', key: 'custom:9', name: 'Tort', amountLabel: '1 kawałek' })]);
    expect(find(l.main, 'custom:9')).toBeUndefined();
    expect(find(l.sometimes, 'custom:9')).toMatchObject({ days: 1, portions: { count: 2, label: '1 kawałek' } });
  });
});

describe('the rhythm sets how much', () => {
  test('every 3 days buys for 3 days; Tuesday and Friday buys up to the next trip', () => {
    const entries = daysBack(14).map((d) => skyrMaliny(d));
    const every = list(entries, { rhythm: { kind: 'every', days: 3, from: '2026-11-04', at: '18:00' } });
    expect(every.period).toEqual({ shop: '2026-11-04', until: '2026-11-06', days: 3 });
    expect(find(every.main, 'skyr')!.grams).toBe(600);
    // Today is a Tuesday: the trip is today, and buys for Tuesday to Thursday.
    const twice = list(entries, { rhythm: { kind: 'weekdays', days: [2, 5], at: '17:00' } });
    expect(twice.period).toEqual({ shop: TODAY, until: '2026-11-05', days: 3 });
  });
});

describe('the list as text', () => {
  test('aisle by aisle, ticks, the rest, and where it comes from', () => {
    const days = daysBack(14);
    const l = list([...days.map((d) => skyrMaliny(d)), entry(days[0]!, { source: 'custom', key: 'custom:9', name: 'Tort', amountLabel: '1 kawałek' })]);
    const text = historyText(l, new Set(['skyr']));
    expect(text).toMatch(/^Zakupy z dziennika · sob\., 7 lis \(jedzenie na 7–13 lis\)\n\nLista\n {2}Nabiał i jajka\n {2}\[x\] Skyr naturalny — 4 opak\. · po 450 g · ok\. 21,96/);
    expect(text).toContain('  Mrożonki\n  [ ] Maliny mrożone — 2 opak. · po 500 g');
    expect(text).toContain('\n\nCzasem (zjedzone raz)\n  [ ] Tort — 1 × 1 kawałek');
    expect(text).toContain('\n\nSprawdź w domu\n  [ ] Białko w proszku');
    expect(text).toMatch(/Średnia z 14 zapisanych dni z ostatnich 4 tygodni — zajrzyj do lodówki\.$/);
  });
});
