import { expect, test } from 'vitest';
import { DATASET } from '../test/fixtures';
import { activeFilterChips } from './active-filters';
import { EMPTY_FILTERS, type Filters } from './filters';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

const FILTERS: Filters = {
  ...EMPTY_FILTERS,
  q: 'skyr',
  toggles: ['vegan'],
  nutriscore: ['a'],
  nova: [4],
  ecoscore: ['a-plus'],
  withoutAllergens: ['en:milk'],
  brands: ['piatnica'],
  ranges: { kcal: { min: 0, max: 200 }, protein: { min: 10, max: null }, price: { min: null, max: 9.99 } },
};

test('one chip per active value, with readable labels', () => {
  expect(activeFilterChips(FILTERS, DATASET.dictionaries).map((c) => plain(c.label))).toEqual([
    '„skyr”',
    'Wegańskie',
    'Nutri-Score A',
    'NOVA 4',
    'Eco-Score A+',
    'bez: Mleko',
    'Marka: Piątnica',
    'Kalorie: 0–200 kcal',
    'Białko: od 10 g',
    'Cena: do 9,99 zł',
  ]);
});

test('removing a chip removes exactly that value', () => {
  const chips = activeFilterChips(FILTERS, DATASET.dictionaries);
  const kcal = chips.find((c) => c.label.startsWith('Kalorie'))!;
  const after = kcal.remove(FILTERS);
  expect(after.ranges.kcal).toBeUndefined();
  expect(after.ranges.protein).toEqual({ min: 10, max: null });
  const nova = chips.find((c) => c.label === 'NOVA 4')!;
  expect(nova.remove(FILTERS).nova).toEqual([]);
});

test('no filters, no chips', () => {
  expect(activeFilterChips(EMPTY_FILTERS, DATASET.dictionaries)).toEqual([]);
});
