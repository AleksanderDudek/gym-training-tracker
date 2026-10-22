/**
 * Chains checked and found NOT to publish a nutrition table with full macros from their own
 * sources (only aggregators have numbers, or only kcal, or nothing). On the map their venues have
 * no menu here; the place card says why instead of "unknown menu". Names are proper nouns; `brands`
 * are their OpenStreetMap brand tags, matched like the menus' (`brandIndex`).
 */
export interface Unpublished {
  name: string;
  osm: { brands: string[] };
  /** What the chain does publish, when anything: only energy, only allergens. */
  partial?: 'kcal' | 'allergens';
  /** When it was checked (YYYY-MM). */
  checked: string;
}

export const UNPUBLISHED: Unpublished[] = [
  { name: "Domino's Pizza", osm: { brands: ["Domino's", "Domino's Pizza", 'Dominos'] }, checked: '2026-10' },
  { name: 'Sphinx', osm: { brands: ['Sphinx'] }, checked: '2026-10' },
  { name: 'Shell', osm: { brands: ['Shell'] }, checked: '2026-10' },
  { name: 'Bobby Burger', osm: { brands: ['Bobby Burger'] }, checked: '2026-10' },
];
