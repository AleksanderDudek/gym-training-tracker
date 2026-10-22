import { describe, expect, test } from 'vitest';
import { brandIndex } from './brands';
import { CHAINS } from './catalog';

describe('chains from OpenStreetMap brands', () => {
  const menuOf = brandIndex(CHAINS);
  const id = (brand: string) => menuOf(brand)?.id ?? null;

  test('every chain file says how it appears in OpenStreetMap', () => {
    expect(CHAINS.filter((c) => !c.osm?.brands.length).map((c) => c.id)).toEqual([]);
  });

  test('brands as people tag them: case, diacritics, apostrophes, a suffix after the brand', () => {
    expect(id("McDonald's")).toBe('mcdonalds');
    expect(id('MCDONALDS')).toBe('mcdonalds');
    expect(id('Żabka')).toBe('zabka-cafe');
    expect(id('Zabka Nano')).toBe('zabka-cafe');
    expect(id('ORLEN Stop Cafe')).toBe('orlen');
    expect(id('BP Express')).toBe('bp');
    expect(id('Green Caffe Nero')).toBe('green-caffe-nero');
    expect(id('T-Pizza')).toBe('telepizza');
  });

  test('a word that only starts the same is not the brand', () => {
    expect(id('Bperfect')).toBeNull();
    expect(id('Subwayland')).toBeNull();
    expect(id('Bar Mleczny Pod Arkadami')).toBeNull();
    expect(id('Max')).toBeNull();
  });
});
