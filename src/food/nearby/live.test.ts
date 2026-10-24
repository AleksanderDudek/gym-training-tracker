import { describe, expect, test } from 'vitest';
import { buildOsmQuery, dropLegacyCaches, slimElements } from './live';
import { shopsOf } from './overpass';
import { placesOf } from './places';

describe('the live question for both views', () => {
  test('one query asks for places, shops and the cash & carry halls around the rounded circle', () => {
    const q = buildOsmQuery({ lat: 52.23, lon: 21.012 }, 1250);
    expect(q).toContain('nwr["amenity"~"^(fast_food|restaurant|cafe|fuel|food_court|ice_cream)$"](around:1250,52.23,21.012);');
    expect(q).toContain('nwr["shop"~"^(supermarket|convenience|discount|grocery|bakery|pastry|coffee)$"](around:1250,52.23,21.012);');
    expect(q).toContain('nwr["shop"="wholesale"]["brand"~"^(Selgros|Makro)",i](around:1250,52.23,21.012);');
    expect(q).toMatch(/^\[out:json\]\[timeout:25\];\(.*\);out tags center qt;$/);
  });

  test('answers are slimmed for the device: position folded in, only the tags the app reads, nothing unnamed', () => {
    const slim = slimElements([
      { type: 'way', id: 7, center: { lat: 52.1, lon: 21.2 }, tags: { shop: 'supermarket', brand: 'Lidl', name: 'Lidl', wheelchair: 'yes', 'name:en': 'Lidl' } },
      { type: 'node', id: 8, lat: 52.1, lon: 21.2, tags: { amenity: 'restaurant' } },
      { type: 'node', id: 9, lat: 52.1, lon: 21.2, tags: { shop: 'clothes', name: 'Reserved' } },
      { type: 'way', id: 7, center: { lat: 52.1, lon: 21.2 }, tags: { shop: 'supermarket', name: 'Lidl' } },
    ]);
    expect(slim).toEqual([{ type: 'way', id: 7, lat: 52.1, lon: 21.2, tags: { shop: 'supermarket', brand: 'Lidl', name: 'Lidl' } }]);
    // Both views still read it.
    expect(shopsOf(slim).map((s) => s.chain)).toEqual(['lidl']);
    expect(placesOf(slim).map((p) => p.kind)).toEqual(['shop']);
  });

  test('the old eat-view cache is removed once, and a forbidden storage is fine', () => {
    const removed: string[] = [];
    dropLegacyCaches({ removeItem: (k) => void removed.push(k) });
    expect(removed).toEqual(['produkty-pl:places']);
    expect(() =>
      dropLegacyCaches({
        removeItem: () => {
          throw new Error('denied');
        },
      }),
    ).not.toThrow();
  });
});
