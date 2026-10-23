import { AMENITIES, FOOD_SHOPS, OSM_COLUMNS, SHOP_TYPES, WHOLESALE_BRANDS, labelOf, matchesPlacesQuery, matchesShopsQuery } from './osmTags';
import { elementsOf, fetchOverpass, type Element, type FetchOptions } from './overpass';
import type { LatLon } from './types';

/**
 * „W pobliżu” asked live, from the public Overpass servers: abroad, at the border, or when the app's
 * own copy of the data cannot be read. ONE question serves both views — places to eat, grocery
 * shops and the cash & carry halls — and one cache keeps it, so switching between „Zjedz teraz” and
 * „Zakupy i przepisy” never asks again.
 */

/** Places, shops and halls around a point; `out center` gives buildings (ways) a position too. */
export function buildOsmQuery(center: LatLon, radius: number): string {
  const around = `around:${Math.round(radius)},${center.lat},${center.lon}`;
  return (
    `[out:json][timeout:25];(` +
    `nwr["amenity"~"^(${AMENITIES.join('|')})$"](${around});` +
    `nwr["shop"~"^(${[...SHOP_TYPES, ...Object.keys(FOOD_SHOPS)].join('|')})$"](${around});` +
    `nwr["shop"="wholesale"]["brand"~"^(${WHOLESALE_BRANDS.join('|')})",i](${around});` +
    `);out tags center qt;`
  );
}

/**
 * The elements as both views read them, slimmed for the device's cache: the position folded in
 * (a way's `center`), only the tags the app reads, and nothing unnamed or outside both questions.
 * A city's answer shrinks to about a quarter.
 */
export function slimElements(elements: readonly Element[]): Element[] {
  const seen = new Set<string>();
  const slim: Element[] = [];
  for (const element of elements) {
    const id = `${element.type}/${element.id}`;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    if (seen.has(id) || lat === undefined || lon === undefined || !labelOf(tags)) continue;
    if (!matchesPlacesQuery(tags) && !matchesShopsQuery(tags)) continue;
    seen.add(id);
    const kept: Record<string, string> = {};
    for (const key of OSM_COLUMNS) if (tags[key] !== undefined) kept[key] = tags[key];
    slim.push({ type: element.type, id: element.id, lat, lon, tags: kept });
  }
  return slim;
}

/** The live answers, both views in one, on this device: fresh a day, kept a week as a fallback. */
export const OSM_KEY = 'produkty-pl:osm';

export function fetchOsm(center: LatLon, radius: number, options: FetchOptions = {}): Promise<Element[]> {
  return fetchOverpass(buildOsmQuery(center, radius), (json) => slimElements(elementsOf(json)), options);
}

/** The eat view's own cache from before both views shared one (a different shape): removed once. */
export const LEGACY_PLACES_KEY = 'produkty-pl:places';

export function dropLegacyCaches(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(LEGACY_PLACES_KEY);
  } catch {
    // Forbidden storage: nothing was saved there either.
  }
}
