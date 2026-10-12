/**
 * Online shops with product data in ./data — the store keys the app treats as
 * "sklep internetowy": bought with delivery, not on the way home. Static, so
 * code that only needs to know WHICH stores are online (filters, recipe
 * baskets) does not load the data. `shops.test.ts` keeps it equal to the files.
 */
export interface OnlineShop {
  id: string;
  name: string;
  /** Home page, https. */
  url: string;
  /**
   * `sklep` sells on its own site; `producent` is a brand site that lists its products with
   * nutrition and sends buyers to other online shops - the link says so.
   */
  kind: 'sklep' | 'producent';
}

export const ONLINE_SHOPS: readonly OnlineShop[] = [
  { id: 'beketo', name: 'BeKeto', url: 'https://beketo.pl', kind: 'sklep' },
  { id: 'bezmiesny', name: 'Bezmięsny Mięsny', url: 'https://bezmiesnymiesny.pl', kind: 'sklep' },
  { id: 'cocoa', name: 'Cocoa', url: 'https://cocoa.pl', kind: 'sklep' },
  { id: 'cocofarm', name: 'CocoFarm', url: 'https://cocofarm.pl', kind: 'producent' },
  { id: 'diet-food', name: 'Diet-Food', url: 'https://sklep.diet-food.pl', kind: 'sklep' },
  { id: 'feel-fit', name: 'Feel Fit', url: 'https://feel-fit.pl', kind: 'producent' },
  { id: 'fitiron', name: 'FitIron', url: 'https://fitironsklep.pl', kind: 'sklep' },
  { id: 'guiltfree', name: 'GuiltFree', url: 'https://guiltfree.pl', kind: 'sklep' },
  { id: 'myprotein', name: 'Myprotein', url: 'https://www.myprotein.pl', kind: 'sklep' },
];

const IDS = new Set(ONLINE_SHOPS.map((s) => s.id));

export const isOnlineShop = (key: string): boolean => IDS.has(key);

export const onlineShop = (key: string): OnlineShop | undefined => ONLINE_SHOPS.find((s) => s.id === key);
