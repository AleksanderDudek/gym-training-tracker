/**
 * Which OpenStreetMap objects „W pobliżu” uses, as ONE rule for everyone who asks: the Overpass
 * queries, the parsers of their answers, the osmium filter that cuts the app's own copy of the
 * Polish data out of a Geofabrik extract, and the script that writes that copy. If they disagreed,
 * a place would show up in Poland (the copy) and not abroad (Overpass), or the other way round.
 *
 * No imports, on purpose: the data script and the Vite plugin load this file outside the app,
 * where nothing may pull in the app's language module (`src/i18n.ts`) or the browser.
 */

export type OsmTags = Record<string, string>;

/** Places to eat at: fast food, restaurants, cafés, petrol stations, food courts, ice cream. */
export const AMENITIES = ['fast_food', 'restaurant', 'cafe', 'fuel', 'food_court', 'ice_cream'] as const;
/** Grocery shops: their chain's ready products are on offer, and recipes are bought there. */
export const SHOP_TYPES = ['supermarket', 'convenience', 'discount', 'grocery'] as const;
/** Shops that are food places of their own: bakery and café chains (Tchibo is a `shop=coffee`). */
export const FOOD_SHOPS = { bakery: 'bakery', pastry: 'bakery', coffee: 'cafe' } as const;
/**
 * Cash & carry halls of the chains with product data (OpenStreetMap tags them `shop=wholesale`):
 * named by brand, so a builders' merchant or a furniture wholesaler stays out.
 */
export const WHOLESALE_BRANDS = ['Selgros', 'Makro'] as const;

/** The tags the app reads; the app's copy of the data keeps these and nothing else. */
export const OSM_COLUMNS = [
  'amenity',
  'shop',
  'name',
  'brand',
  'opening_hours',
  'cuisine',
  'addr:street',
  'addr:place',
  'addr:housenumber',
] as const;

const includes = (list: readonly string[], value: string | undefined) => value !== undefined && list.includes(value);

const WHOLESALE_BRAND = new RegExp(`^(${WHOLESALE_BRANDS.join('|')})`, 'i');

/** „Marszałkowska 10” from the address tags; `null` without a street or a place. */
export function address(tags: OsmTags): string | null {
  const street = tags['addr:street'] ?? tags['addr:place'];
  if (!street) return null;
  return [street, tags['addr:housenumber']].filter(Boolean).join(' ');
}

/** A Selgros or Makro hall: `shop=wholesale` with one of the brands (the brand tag, as Overpass asks). */
export function isWholesaleHall(tags: OsmTags): boolean {
  return tags.shop === 'wholesale' && WHOLESALE_BRAND.test(tags.brand ?? '');
}

/** What „Zakupy i przepisy” asks for: grocery shops and the cash & carry halls. */
export function matchesShopsQuery(tags: OsmTags): boolean {
  return includes(SHOP_TYPES, tags.shop) || isWholesaleHall(tags);
}

/** What „Zjedz teraz” asks for: places to eat, grocery shops, bakeries and coffee shops. */
export function matchesPlacesQuery(tags: OsmTags): boolean {
  return includes(AMENITIES, tags.amenity) || includes(SHOP_TYPES, tags.shop) || includes(Object.keys(FOOD_SHOPS), tags.shop);
}

/** Named by its brand, else its name — the label every list shows; an object with neither is skipped. */
export function labelOf(tags: OsmTags): string | undefined {
  return tags.brand ?? tags.name;
}

/** The osmium `tags-filter` expressions that keep everything either query could ask for. */
export function osmiumFilterExpressions(): string[] {
  return [
    `nwr/amenity=${AMENITIES.join(',')}`,
    `nwr/shop=${[...SHOP_TYPES, ...Object.keys(FOOD_SHOPS), 'wholesale'].join(',')}`,
  ];
}
