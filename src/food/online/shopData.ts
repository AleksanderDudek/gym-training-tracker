import type { ChainData } from '../chains/types';
import type { ShopData } from './types';

/**
 * Every shop file in ./data, and every chain file in ../chains/data. Their own module (and chunk):
 * `loadDataset` imports it together with the product base, so nothing else carries the data — and
 * the service worker keeps this one chunk the way it keeps the base (`src/sw.ts`).
 */
const files = import.meta.glob<ShopData>('./data/*.json', { eager: true, import: 'default' });
const chainFiles = import.meta.glob<ChainData>('../chains/data/*.json', { eager: true, import: 'default' });

export const SHOPS: ShopData[] = Object.values(files).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

export const CHAIN_DATA: ChainData[] = Object.values(chainFiles).sort((a, b) => a.name.localeCompare(b.name, 'pl'));

/**
 * This chunk's own address (`assets/shopData-<hash>.js` in the build, a name only the build knows):
 * the very first visit fetches it once more for the service worker's copy (`src/swWarm.ts`).
 */
export const CHUNK_URL: string = import.meta.url;
