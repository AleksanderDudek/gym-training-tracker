import { describe, expect, test } from 'vitest';
import { buildPlacesQuery, parsePlaces } from './places';

describe('places to eat from OpenStreetMap', () => {
  test('one query for restaurants, cafés, petrol stations, ice cream, grocery shops, bakeries and coffee shops', () => {
    const q = buildPlacesQuery({ lat: 52.2, lon: 21 }, 1000);
    expect(q).toContain('"amenity"~"^(fast_food|restaurant|cafe|fuel|food_court|ice_cream)$"');
    expect(q).toContain('"shop"~"^(supermarket|convenience|discount|grocery|bakery|pastry|coffee)$"');
  });

  test('kinds: a grocery shop carries its chain key, a bakery or a coffee shop is a food place of its own', () => {
    const el = (id: number, tags: Record<string, string>) => ({ type: 'node', id, lat: 52, lon: 21, tags });
    const places = parsePlaces({
      elements: [
        el(1, { shop: 'convenience', brand: 'Żabka' }),
        el(2, { shop: 'bakery', name: 'Gorąco Polecam' }),
        el(3, { shop: 'coffee', brand: 'Tchibo' }),
        el(4, { amenity: 'ice_cream', name: 'Grycan' }),
        el(5, { amenity: 'fast_food', brand: 'KFC', 'addr:street': 'Złota', 'addr:housenumber': '1', cuisine: 'chicken' }),
        el(6, { shop: 'hardware', name: 'Castorama' }),
        { type: 'node', id: 7, lat: 52, lon: 21, tags: { amenity: 'cafe' } },
      ],
    });
    expect(places.map((p) => [p.name, p.kind, p.shop])).toEqual([
      ['Żabka', 'shop', 'zabka'],
      ['Gorąco Polecam', 'bakery', null],
      ['Tchibo', 'cafe', null],
      ['Grycan', 'ice_cream', null],
      ['KFC', 'fast_food', null],
    ]);
    expect(places[4]).toMatchObject({ address: 'Złota 1', cuisine: 'chicken', id: 'node/5' });
  });
});
