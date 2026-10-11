// Chain matching lives in src/lib/stores.ts: the app needs it too, to read
// the brand of an OpenStreetMap shop.
export { parseStores, storeKey } from '../../../src/food/lib/stores';
export type { Store } from '../../../src/food/lib/stores';

/**
 * A supermarket's own brand is sold only there. Each entry was checked
 * against the store tags the data does have: Delikate 39/39 at Biedronka,
 * Pilos 49/49 at Lidl, Go Active 39/39 at Biedronka, K-Classic 49/50 at
 * Kaufland. National brands (Piątnica, Mlekovita) are deliberately absent: they
 * are sold everywhere and the data cannot say where.
 * Keys are brand keys as transform.brandKey writes them.
 */
export const PRIVATE_LABELS: Record<string, string> = {
  biedronka: 'biedronka',
  'go-active': 'biedronka',
  delikate: 'biedronka',
  fruvita: 'biedronka',
  marinero: 'biedronka',
  'kraina-wedlin': 'biedronka',
  vitanella: 'biedronka',
  'plony-natury': 'biedronka',
  pano: 'biedronka',
  lidl: 'lidl',
  pilos: 'lidl',
  milbona: 'lidl',
  crownfield: 'lidl',
  freshona: 'lidl',
  vemondo: 'lidl',
  pikok: 'lidl',
  solevita: 'lidl',
  deluxe: 'lidl',
  nixe: 'lidl',
  vitasia: 'lidl',
  bellarom: 'lidl',
  combino: 'lidl',
  sondey: 'lidl',
  tastino: 'lidl',
  dulano: 'lidl',
  italiamo: 'lidl',
  'kuchnia-lidla': 'lidl',
  kaufland: 'kaufland',
  'k-classic': 'kaufland',
  'k-bio': 'kaufland',
  auchan: 'auchan',
  carrefour: 'carrefour',
  tesco: 'tesco',
  aldi: 'aldi',
  milsani: 'aldi',
  netto: 'netto',
  zabka: 'zabka',
  szamamm: 'zabka',
  lewiatan: 'lewiatan',
  intermarche: 'intermarche',
};

/** The chains a product's brands tie it to, without duplicates. */
export function storesFromBrands(brandKeys: string[]): string[] {
  return [...new Set(brandKeys.map((b) => PRIVATE_LABELS[b]).filter((s): s is string => !!s))];
}
