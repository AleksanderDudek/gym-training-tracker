import { describe, expect, test } from 'vitest';
import { normalizeChain } from './normalize';
import { portionLabel, restaurantFood } from './food';
import { searchMenus } from './search';
import { sortItems, topProtein } from './sort';
import type { ChainData, MenuItemData } from './types';
import { chainFromParams, chainToParams, restaurantsFromParams, restaurantsToParams } from './url';

const item = (name: string, over: Partial<MenuItemData> = {}): MenuItemData => ({
  name,
  category: 'burger',
  portion: '1 szt.',
  grams: null,
  kcal: 250,
  protein: 13,
  carbs: 30,
  fat: 9,
  sugars: null,
  fiber: null,
  saturatedFat: null,
  salt: null,
  ...over,
});

const data = (id: string, name: string, items: MenuItemData[]): ChainData => ({
  id,
  name,
  kind: 'fast-food',
  market: 'PL',
  source: { url: 'https://example.com', title: 'Tabela', checked: '2026-10-12' },
  items,
});

const MCD = normalizeChain(
  data('mcdonalds', "McDonald's", [
    item('Big Mac', { kcal: 544, protein: 27, carbs: 42, fat: 29, grams: 219 }),
    item('McWrap Klasyczny', { category: 'kanapka', kcal: 560, protein: 30, carbs: 50, fat: 26 }),
    item('Sałatka z kurczakiem', { category: 'salatka', kcal: 300, protein: 28, carbs: 10, fat: 15 }),
    item('Sos czosnkowy', { category: 'sos', portion: '1 opak.', kcal: 160, protein: 18, carbs: 3, fat: 16 }),
    item('Caffè Latte', { category: 'kawa', portion: 'duża', grams: 400, kcal: 190, protein: 12, carbs: 18, fat: 7 }),
    item('Frytki', { category: 'dodatek', portion: 'średnie', kcal: 330, protein: 16, carbs: 42, fat: 16 }),
  ]),
);
const STAR = normalizeChain(
  data('starbucks', 'Starbucks', [
    item('Caffè Latte', { category: 'kawa', portion: 'Grande 473 ml', grams: 473, kcal: 190, protein: 13, carbs: 19, fat: 7 }),
  ]),
);

describe('restaurantFood', () => {
  test('the portion as served, the chain in the name, no gram editing', () => {
    const food = restaurantFood(MCD, MCD.items[0]!);
    expect(food).toMatchObject({
      key: 'restaurant:mcdonalds:big-mac',
      name: "Big Mac (McDonald's)",
      source: 'restaurant',
      amountLabel: '1 szt. · 219 g',
      nutrients: { kcal: 544, protein: 27, carbs: 42, fat: 29 },
      per100: null,
      grams: null,
      role: 'main',
      atHome: false,
    });
  });

  test('a size already in the portion is not repeated; drinks keep their size words; sauces are add-ons', () => {
    expect(portionLabel(STAR.items[0]!)).toBe('Grande 473 ml');
    expect(portionLabel(MCD.items[4]!)).toBe('duża');
    expect(restaurantFood(MCD, MCD.items[3]!).role).toBe('addon');
    expect(restaurantFood(MCD, MCD.items[2]!).role).toBe('light');
  });
});

describe('searchMenus', () => {
  test('every word anywhere in chain, name, portion or category; apostrophes do not matter', () => {
    const hits = (q: string) => searchMenus([MCD, STAR], q).map((h) => `${h.chain.id}:${h.item.id}`);
    expect(hits('big mac')).toEqual(['mcdonalds:big-mac']);
    expect(hits('mcdonalds wrap')).toEqual(['mcdonalds:mcwrap-klasyczny']);
    expect(hits('latte')).toEqual(['mcdonalds:caffe-latte', 'starbucks:caffe-latte']);
    expect(hits('latte grande')).toEqual(['starbucks:caffe-latte']);
    expect(hits('salatka')).toEqual(['mcdonalds:salatka-z-kurczakiem']);
    expect(hits('  ')).toEqual([]);
    expect(searchMenus([MCD, STAR], 'latte', 1)).toHaveLength(1);
  });
});

describe('sorting', () => {
  test('sorts keep the menu order on ties', () => {
    expect(sortItems(MCD.items, 'kcal').map((i) => i.id)[0]).toBe('sos-czosnkowy');
    expect(sortItems(MCD.items, 'bialko').map((i) => i.id)[0]).toBe('mcwrap-klasyczny');
    expect(sortItems(MCD.items, 'menu').map((i) => i.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('"Najwięcej białka": at least 15 g, by protein per kcal, never a sauce or fries', () => {
    expect(topProtein(MCD.items).map((i) => i.id)).toEqual(['salatka-z-kurczakiem', 'mcwrap-klasyczny', 'big-mac']);
  });
});

describe('page state in the address', () => {
  test('round trip; defaults stay out of the address', () => {
    const state = { category: 'kawa' as const, sort: 'bialko' as const, item: 'caffe-latte' };
    expect(chainToParams(state).toString()).toBe('kat=kawa&sort=bialko&p=caffe-latte');
    expect(chainFromParams(chainToParams(state))).toEqual(state);
    expect(chainToParams({ category: null, sort: 'menu', item: null }).toString()).toBe('');
    const search = { q: 'big mac', item: 'mcdonalds/big-mac' };
    expect(restaurantsFromParams(restaurantsToParams(search))).toEqual(search);
  });

  test('unknown values from a hand-edited link fall back to the defaults', () => {
    expect(chainFromParams(new URLSearchParams('kat=constructor&sort=toString'))).toEqual({
      category: null,
      sort: 'menu',
      item: null,
    });
  });
});
