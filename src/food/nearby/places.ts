import { storeKey } from '../lib/stores';
import { AMENITIES, FOOD_SHOPS, SHOP_TYPES, address, labelOf } from './osmTags';
import { elementsOf, fetchOverpass, type Element, type FetchOptions } from './overpass';
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

const FOOD_SHOP_KIND: Record<string, PlaceKind> = FOOD_SHOPS;

export function buildPlacesQuery(center: LatLon, radius: number): string {
  const around = `around:${Math.round(radius)},${center.lat},${center.lon}`;
  return (
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"^(${AMENITIES.join('|')})$"](${around});` +
    `nwr["shop"~"^(${[...SHOP_TYPES, ...Object.keys(FOOD_SHOPS)].join('|')})$"](${around});` +
    `);out tags center qt;`
  );
}

const isAmenity = (v: string | undefined): v is (typeof AMENITIES)[number] =>
  (AMENITIES as readonly string[]).includes(v ?? '');

/** Overpass JSON -> places; an element without a position or a name is dropped. */
export function parsePlaces(json: unknown): Place[] {
  return placesOf(elementsOf(json));
}

/** The places to eat among OpenStreetMap elements; cash & carry halls belong to the shops view only. */
export function placesOf(elements: readonly Element[]): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const element of elements) {
    const id = `${element.type}/${element.id}`;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const brand = labelOf(tags);
    if (seen.has(id) || lat === undefined || lon === undefined || !brand) continue;
    const grocery = (SHOP_TYPES as readonly string[]).includes(tags.shop ?? '');
    const kind: PlaceKind | null = isAmenity(tags.amenity)
      ? tags.amenity
      : grocery
        ? 'shop'
        : (FOOD_SHOP_KIND[tags.shop ?? ''] ?? null);
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
