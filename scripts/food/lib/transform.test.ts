import { describe, expect, test } from 'vitest';
import { USED_COLUMNS, rowToProduct } from './transform';
import { splitLine, toRow } from './tsv';
import type { Product } from '../../../src/food/lib/types';

function row(overrides: Record<string, string> = {}): Record<string, string> {
  const base = Object.fromEntries(USED_COLUMNS.map((c) => [c, '']));
  return { ...base, code: '590', product_name: 'Skyr', ...overrides };
}

function product(overrides: Record<string, string> = {}): Product {
  const result = rowToProduct(row(overrides));
  if (!result.ok) throw new Error(`expected a product, got ${result.reason}`);
  return result.product;
}

describe('skipping', () => {
  test('a row with no code', () => {
    expect(rowToProduct(row({ code: '  ' }))).toEqual({ ok: false, reason: 'no-code' });
  });
  test('a row with no name', () => {
    expect(rowToProduct(row({ product_name: ' ' }))).toEqual({ ok: false, reason: 'no-name' });
  });
});

describe('text', () => {
  test('decodes entities in the name and trims it', () => {
    expect(product({ product_name: ' M&amp;M white ' }).name).toBe('M&M white');
  });
  test('empty optional text is null', () => {
    const p = product();
    expect([p.genericName, p.quantity, p.servingSize, p.ingredientsText]).toEqual([null, null, null, null]);
  });
});

describe('numbers', () => {
  test('empty numbers are null, never zero', () => {
    expect(product().nutrition.kcal).toBeNull();
    expect(product().additivesCount).toBeNull();
  });
  test('parses nutrition per 100 g', () => {
    expect(product({ 'energy-kcal_100g': '63', proteins_100g: '11.0', salt_100g: '0.1' }).nutrition).toMatchObject({
      kcal: 63,
      protein: 11,
      salt: 0.1,
    });
  });
  test('derives kcal from kJ when kcal is missing', () => {
    expect(product({ 'energy-kj_100g': '418.4' }).nutrition.kcal).toBe(100);
  });
  test('prefers the stated kcal over kJ', () => {
    expect(product({ 'energy-kcal_100g': '50', 'energy-kj_100g': '418.4' }).nutrition.kcal).toBe(50);
  });
  test('drops impossible values rather than trusting them', () => {
    const p = product({ 'energy-kcal_100g': '3000', fat_100g: '120', sugars_100g: '-1', 'energy-kj_100g': '' });
    expect([p.nutrition.kcal, p.nutrition.fat, p.nutrition.sugars]).toEqual([null, null, null]);
  });
  test('rounds to two decimals so the JSON stays small', () => {
    expect(product({ fat_100g: '3.3333333' }).nutrition.fat).toBe(3.33);
  });
  test('parses counts', () => {
    expect(product({ additives_n: '3', unique_scans_n: '12' })).toMatchObject({ additivesCount: 3, popularity: 12 });
  });
});

describe('grades', () => {
  test('unknown and not-applicable are null', () => {
    const p = product({ nutriscore_grade: 'unknown', environmental_score_grade: 'not-applicable' });
    expect([p.nutriscore, p.ecoscore, p.nova]).toEqual([null, null, null]);
  });
  test('valid grades are kept', () => {
    expect(product({ nutriscore_grade: 'b', nova_group: '4', environmental_score_grade: 'a-plus' })).toMatchObject({
      nutriscore: 'b',
      nova: 4,
      ecoscore: 'a-plus',
    });
  });
  test('an out-of-range NOVA group is null', () => {
    expect(product({ nova_group: '7' }).nova).toBeNull();
  });
});

describe('diet', () => {
  test('comes from the ingredients analysis', () => {
    expect(product({ ingredients_analysis_tags: 'en:palm-oil-free,en:non-vegan,en:vegetarian' })).toMatchObject({
      vegan: 'no',
      vegetarian: 'yes',
      palmOil: 'free',
    });
    expect(product({ ingredients_analysis_tags: 'en:maybe-vegan,en:may-contain-palm-oil' })).toMatchObject({
      vegan: 'maybe',
      palmOil: 'maybe',
    });
  });
  test('unknown status is null', () => {
    expect(product({ ingredients_analysis_tags: 'en:vegan-status-unknown' }).vegan).toBeNull();
  });
  test('a vegan label upgrades both, since vegan implies vegetarian', () => {
    expect(product({ labels_tags: 'en:vegan' })).toMatchObject({ vegan: 'yes', vegetarian: 'yes' });
  });
});

describe('lists', () => {
  test('split on commas, trimmed, empties dropped', () => {
    expect(
      product({ categories_tags: 'en:dairies, en:yogurts,', allergens: 'en:milk', traces_tags: 'en:nuts' }),
    ).toMatchObject({ categories: ['en:dairies', 'en:yogurts'], allergens: ['en:milk'], traces: ['en:nuts'] });
  });
  test('brands are keyed by tag and carry their original spelling', () => {
    const result = rowToProduct(row({ brands: 'Piątnica, Bakoma', brands_tags: 'piatnica,bakoma' }));
    expect(result.ok && result.product.brands).toEqual(['piatnica', 'bakoma']);
    expect(result.ok && result.brandLabels).toEqual([
      ['piatnica', 'Piątnica'],
      ['bakoma', 'Bakoma'],
    ]);
  });
  test('brand keys fold the language prefix and diacritics, so one brand is one key', () => {
    const variants = ['xx:tarczyński', 'tarczyński', 'xx:tarczynski'].map((tag) => {
      const r = rowToProduct(row({ brands: 'Tarczyński', brands_tags: tag }));
      return r.ok && r.product.brands;
    });
    expect(variants).toEqual([['tarczynski'], ['tarczynski'], ['tarczynski']]);
  });
  test('a brand listed twice on one product is kept once', () => {
    const r = rowToProduct(row({ brands: 'Kamiś, Kamis', brands_tags: 'xx:kamiś,kamis' }));
    expect(r.ok && r.product.brands).toEqual(['kamis']);
  });
  test('a private-label brand adds its chain to the stores', () => {
    expect(product({ brands: 'Pilos', brands_tags: 'pilos' }).stores).toEqual(['lidl']);
  });
  test('observed stores come first and an inferred one is not repeated', () => {
    expect(product({ brands: 'Pilos', brands_tags: 'pilos', stores: 'Auchan, lidl' }).stores).toEqual([
      'auchan',
      'lidl',
    ]);
  });
  test('an inferred chain still gets its label', () => {
    const r = rowToProduct(row({ brands: 'Go Active', brands_tags: 'go-active' }));
    expect(r.ok && r.storeLabels).toEqual([['biedronka', 'Biedronka']]);
  });
  test('stores are normalised to chain keys', () => {
    const result = rowToProduct(row({ stores: 'biedronka, Lidl' }));
    expect(result.ok && result.product.stores).toEqual(['biedronka', 'lidl']);
    expect(result.ok && result.storeLabels).toEqual([
      ['biedronka', 'Biedronka'],
      ['lidl', 'Lidl'],
    ]);
  });
});

describe('images', () => {
  test('stores Open Food Facts photos as compact paths', () => {
    expect(
      product({ image_url: 'https://images.openfoodfacts.org/images/products/590/front_pl.3.400.jpg' }).images.front,
    ).toBe('590/front_pl.3.400.jpg');
  });
  test('drops anything that is not https', () => {
    expect(product({ image_url: 'javascript:alert(1)', image_nutrition_url: 'http://x/a.jpg' }).images).toMatchObject({
      front: null,
      nutrition: null,
    });
  });
});

describe('tsv', () => {
  test('a line becomes a row keyed by the header', () => {
    expect(toRow(['a', 'b'], splitLine('1\t2'))).toEqual({ a: '1', b: '2' });
  });
  test('a line with the wrong number of fields is rejected', () => {
    expect(toRow(['a', 'b'], splitLine('1\t2\t3'))).toBeNull();
  });
});
