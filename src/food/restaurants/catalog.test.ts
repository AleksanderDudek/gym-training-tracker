import { describe, expect, test } from 'vitest';
import { CHAINS } from './catalog';
import { energyAgrees, normalizeChain } from './normalize';
import { CHAIN_KINDS, MENU_CATEGORIES, type ChainData, type MenuItemData } from './types';

const item = (name: string, portion = '1 szt.', over: Partial<MenuItemData> = {}): MenuItemData => ({
  name,
  category: 'burger',
  portion,
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

const chain = (items: MenuItemData[]): ChainData => ({
  id: 'test',
  name: "Mc Test's",
  kind: 'fast-food',
  market: 'PL',
  source: { url: 'https://example.com/tabela.pdf', title: 'Tabela', checked: '2026-10-12' },
  items,
});

describe('normalizeChain', () => {
  test('energy has to come from the macros, within rounding', () => {
    expect(energyAgrees({ kcal: 544, protein: 27, carbs: 42, fat: 29 })).toBe(true);
    expect(energyAgrees({ kcal: 509, protein: 20, carbs: 30, fat: 14 })).toBe(false);
    // Small items get an absolute margin: a 0-kcal espresso with 0.1 g of everything is fine.
    expect(energyAgrees({ kcal: 5, protein: 0.3, carbs: 0, fat: 0.1 })).toBe(true);
    expect(normalizeChain(chain([item('Honey', '1 szt.', { kcal: 509, protein: 20, carbs: 30, fat: 14 })])).items[0]!.inconsistent).toBe(true);
  });

  test('ids from names; same names get the portion, same name and portion a counter', () => {
    const c = normalizeChain(
      chain([item('Big Mac'), item('Frytki', 'małe'), item('Frytki', 'duże'), item('Cola', '0,4 l'), item('Cola', '0,4 l')]),
    );
    expect(c.items.map((i) => i.id)).toEqual(['big-mac', 'frytki-male', 'frytki-duze', 'cola-0-4-l', 'cola-0-4-l-2']);
    expect(c.items.map((i) => i.order)).toEqual([0, 1, 2, 3, 4]);
  });

  test('search text holds the chain, name, portion and category, folded and without apostrophes', () => {
    const [big] = normalizeChain(chain([item('WieśMac')])).items;
    expect(big!.searchText).toBe('mc tests wiesmac 1 szt burgery');
  });
});

// Every chain file in ./data, checked the way the products pipeline checks Open Food Facts:
// a transcription slip shows up as numbers that cannot be true together.
describe.each(CHAINS.map((c) => [c.id, c] as const))('menu data: %s', (_, c) => {
  test('the chain says what it is and where the numbers come from', () => {
    expect(c.id).toMatch(/^[a-z0-9-]+$/);
    expect(c.name.trim()).not.toBe('');
    expect(CHAIN_KINDS).toContain(c.kind);
    expect(c.market).toMatch(/^[A-Z]{2,3}$/);
    expect(c.source.url).toMatch(/^https:\/\//);
    expect(c.source.title.trim()).not.toBe('');
    expect(c.source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.items.length).toBeGreaterThanOrEqual(10);
  });

  test('ids are unique and every item has a known category and a portion', () => {
    expect(new Set(c.items.map((i) => i.id)).size).toBe(c.items.length);
    for (const i of c.items) {
      expect(MENU_CATEGORIES, i.name).toContain(i.category);
      expect(i.name.trim(), i.name).not.toBe('');
      expect(i.portion.trim(), i.name).not.toBe('');
      if (i.grams !== null) expect(i.grams, i.name).toBeGreaterThan(0);
    }
  });

  // A slip in transcription shows up as numbers that cannot be true together. When the chain's own
  // table has them that way (checked against the source), the position is listed in
  // `source.inconsistent`, kept as published and shown with a warning.
  const listed = (i: { name: string; portion: string }) =>
    c.source.inconsistent?.includes(i.name) || c.source.inconsistent?.includes(`${i.name} · ${i.portion}`);

  test('numbers are physical: no negatives, sugars within carbs, saturated within fat', () => {
    for (const i of c.items) {
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
        expect(Number.isFinite(i[k]) && i[k] >= 0, `${i.name}: ${k}`).toBe(true);
      }
      for (const k of ['sugars', 'fiber', 'saturatedFat', 'salt'] as const) {
        const v = i[k];
        if (v !== null) expect(Number.isFinite(v) && v >= 0, `${i.name}: ${k}`).toBe(true);
      }
      if (listed(i)) continue;
      if (i.sugars !== null) expect(i.sugars, i.name).toBeLessThanOrEqual(i.carbs + 0.05);
      if (i.saturatedFat !== null) expect(i.saturatedFat, i.name).toBeLessThanOrEqual(i.fat + 0.05);
    }
  });

  test('energy agrees with the macros, unless the position is listed as the chain\'s own error', () => {
    expect(c.items.filter((i) => !energyAgrees(i) && !listed(i)).map((i) => i.name)).toEqual([]);
  });

  test('every listed position exists, is flagged and is explained in the note', () => {
    for (const entry of c.source.inconsistent ?? []) {
      const hits = c.items.filter((i) => i.name === entry || `${i.name} · ${i.portion}` === entry);
      expect(hits.length, entry).toBeGreaterThan(0);
      expect(hits.every((i) => i.inconsistent)).toBe(true);
      expect(c.source.note, entry).toBeTruthy();
    }
  });
});

test('there are chains', () => {
  expect(CHAINS.length).toBeGreaterThan(0);
  expect(new Set(CHAINS.map((c) => c.id)).size).toBe(CHAINS.length);
});
