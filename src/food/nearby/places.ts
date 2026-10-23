import { storeKey } from '../lib/stores';
import { address, elementsOf, fetchOverpass, type FetchOptions } from './overpass';
import type { LatLon } from './types';

/**
 * Places to eat around a point, as OpenStreetMap describes them: restaurants, cafés, petrol stations
 * and grocery shops in ONE Overpass question - the same rounded position and fallbacks as the shops.
 * Which menu a place serves is decided later (`placeFoods`), when the menus are loaded: here a place
 * only carries the brand it shows.
 */

export type PlaceKind = 'fast_food' | 'restaurant' | 'cafe' | 'fuel' | 'food_court' | 'ice_cream' | 'bakery' | 'shop';

export interface Place {
  /** `node/123`, `way/456`. */
  id: string;
  name: string;
  /** The `brand` tag, else the name - what the menus are matched against. */
  brand: string;
  kind: PlaceKind;
  /** The grocery chain's key for a shop (biedronka, zabka…); `null` for anything else. */
  shop: string | null;
  lat: number;
  lon: number;
  address: string | null;
  openingHours: string | null;
  /** `cuisine` tag: "burger", "pizza;italian" - shown for places without menu data. */
  cuisine: string | null;
}

const AMENITIES = ['fast_food', 'restaurant', 'cafe', 'fuel', 'food_court', 'ice_cream'] as const;
/** Grocery shops: their chain's ready products are on offer. */
const SHOP_TYPES = ['supermarket', 'convenience', 'discount', 'grocery'];
/** Shops that are food places of their own: bakery and café chains (Tchibo is a `shop=coffee`). */
const FOOD_SHOPS: Record<string, PlaceKind> = { bakery: 'bakery', pastry: 'bakery', coffee: 'cafe' };

export function buildPlacesQuery(center: LatLon, radius: number): string {
  const around = `around:${Math.round(radius)},${center.lat},${center.lon}`;
  return (
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"^(${AMENITIES.join('|')})$"](${around});` +
    `nwr["shop"~"^(${[...SHOP_TYPES, ...Object.keys(FOOD_SHOPS)].join('|')})$"](${around});` +
    `);out center tags;`
  );
}

const isAmenity = (v: string | undefined): v is (typeof AMENITIES)[number] =>
  (AMENITIES as readonly string[]).includes(v ?? '');

/** Overpass JSON -> places; an element without a position or a name is dropped. */
export function parsePlaces(json: unknown): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const element of elementsOf(json)) {
    const id = `${element.type}/${element.id}`;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const brand = tags.brand ?? tags.name;
    if (seen.has(id) || lat === undefined || lon === undefined || !brand) continue;
    const grocery = SHOP_TYPES.includes(tags.shop ?? '');
    const kind: PlaceKind | null = isAmenity(tags.amenity)
      ? tags.amenity
      : grocery
        ? 'shop'
        : (FOOD_SHOPS[tags.shop ?? ''] ?? null);
    if (!kind) continue;
    seen.add(id);
    places.push({
      id,
      name: tags.name ?? brand,
      brand,
      kind,
      shop: grocery ? (storeKey(brand)?.key ?? null) : null,
      lat,
      lon,
      address: address(tags),
      openingHours: tags.opening_hours ?? null,
      cuisine: tags.cuisine ?? null,
    });
  }
  return places;
}

export function fetchPlaces(center: LatLon, radius: number, options: FetchOptions = {}): Promise<Place[]> {
  return fetchOverpass(buildPlacesQuery(center, radius), parsePlaces, options);
}
