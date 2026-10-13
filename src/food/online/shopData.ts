import type { ShopData } from './types';

/**
 * Every shop file in ./data. Its own module (and chunk): `loadDataset` imports
 * it together with the product base, so nothing else carries the data.
 */
const files = import.meta.glob<ShopData>('./data/*.json', { eager: true, import: 'default' });

export const SHOPS: ShopData[] = Object.values(files).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
