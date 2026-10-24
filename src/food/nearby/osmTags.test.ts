import { describe, expect, test } from 'vitest';
import osmTagsSource from './osmTags.ts?raw';
import { AMENITIES, FOOD_SHOPS, SHOP_TYPES, address, isWholesaleHall, labelOf, matchesPlacesQuery, matchesShopsQuery, osmiumFilterExpressions } from './osmTags';
import { buildQuery, parseShops, shopsOf, type Element } from './overpass';
import { buildPlacesQuery, parsePlaces, placesOf } from './places';

describe('one rule for which OpenStreetMap objects count', () => {
  test('the Overpass queries are exactly what they were before the rule moved here (golden strings)', () => {
    expect(buildQuery({ lat: 52.2318, lon: 21.006 }, 1500)).toBe(
      '[out:json][timeout:25];(nwr["shop"~"^(supermarket|convenience|discount|grocery)$"](around:1500,52.2318,21.006);nwr["shop"="wholesale"]["brand"~"^(Selgros|Makro)",i](around:1500,52.2318,21.006););out tags center qt;',
    );
    expect(buildPlacesQuery({ lat: 52.2, lon: 21 }, 1000)).toBe(
      '[out:json][timeout:25];(nwr["amenity"~"^(fast_food|restaurant|cafe|fuel|food_court|ice_cream)$"](around:1000,52.2,21);nwr["shop"~"^(supermarket|convenience|discount|grocery|bakery|pastry|coffee)$"](around:1000,52.2,21););out tags center qt;',
    );
  });

  test('which view an object belongs to', () => {
    // A petrol station with a convenience shop: a place to eat and a shop.
    const station = { amenity: 'fuel', shop: 'convenience', name: 'Orlen' };
    expect([matchesPlacesQuery(station), matchesShopsQuery(station)]).toEqual([true, true]);
    // A bakery: a place to eat only.
    const bakery = { shop: 'bakery', name: 'Putka' };
    expect([matchesPlacesQuery(bakery), matchesShopsQuery(bakery)]).toEqual([true, false]);
    // A Selgros hall: a shop only, whatever the case of the brand.
    const hall = { shop: 'wholesale', brand: 'SELGROS cash & carry', name: 'Selgros' };
    expect([matchesPlacesQuery(hall), matchesShopsQuery(hall), isWholesaleHall(hall)]).toEqual([false, true, true]);
    // A builders' merchant is a wholesaler too — and neither.
    const merchant = { shop: 'wholesale', name: 'Hurtownia Budowlana' };
    expect([matchesPlacesQuery(merchant), matchesShopsQuery(merchant)]).toEqual([false, false]);
    expect(matchesPlacesQuery({ shop: 'yes', name: 'Sklep' })).toBe(false);
  });

  test('the label is the brand, else the name; an address is street (or place) and number', () => {
    expect(labelOf({ brand: 'Żabka', name: 'Żabka Nano' })).toBe('Żabka');
    expect(labelOf({ name: 'Bar u Zdzisia' })).toBe('Bar u Zdzisia');
    expect(labelOf({ amenity: 'restaurant' })).toBeUndefined();
    expect(address({ 'addr:street': 'Marszałkowska', 'addr:housenumber': '10' })).toBe('Marszałkowska 10');
    expect(address({ 'addr:place': 'Truskaw', 'addr:housenumber': '6a' })).toBe('Truskaw 6a');
    expect(address({ 'addr:housenumber': '6a' })).toBeNull();
  });

  test('the osmium filter keeps every value either query asks for', () => {
    const expressions = osmiumFilterExpressions().join(' ');
    for (const value of [...AMENITIES, ...SHOP_TYPES, ...Object.keys(FOOD_SHOPS), 'wholesale']) expect(expressions).toContain(value);
    expect(osmiumFilterExpressions()).toEqual([
      'nwr/amenity=fast_food,restaurant,cafe,fuel,food_court,ice_cream',
      'nwr/shop=supermarket,convenience,discount,grocery,bakery,pastry,coffee,wholesale',
    ]);
  });

  test('one answer for both views: shops leave the restaurants out, places leave the halls out', () => {
    const elements: Element[] = [
      { type: 'node', id: 1, lat: 52.23, lon: 21.01, tags: { amenity: 'fast_food', brand: "McDonald's", name: "McDonald's" } },
      { type: 'node', id: 2, lat: 52.23, lon: 21.01, tags: { shop: 'convenience', brand: 'Żabka', name: 'Żabka' } },
      { type: 'way', id: 3, center: { lat: 52.24, lon: 21.0 }, tags: { shop: 'wholesale', brand: 'Selgros', name: 'Selgros' } },
      { type: 'node', id: 4, lat: 52.23, lon: 21.01, tags: { shop: 'wholesale', name: 'Hurtownia Budowlana' } },
    ];
    expect(shopsOf(elements).map((s) => s.id)).toEqual(['node/2', 'way/3']);
    expect(placesOf(elements).map((p) => p.id)).toEqual(['node/1', 'node/2']);
    expect(parseShops({ elements }).map((s) => s.id)).toEqual(['node/2', 'way/3']);
    expect(parsePlaces({ elements }).map((p) => p.id)).toEqual(['node/1', 'node/2']);
  });

  test('the rule imports nothing: the data script and the Vite plugin load it outside the app', () => {
    expect(osmTagsSource).not.toMatch(/^\s*import\s(?!type\b)/m);
  });
});
