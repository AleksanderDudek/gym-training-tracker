import { normalizeChain } from './normalize';
import type { ChainData } from './types';

/**
 * Every chain file in ./data, normalized, alphabetically. Its own module (and
 * chunk): the app loads it on demand (`useRestaurants`), so the menus never
 * ride along with the diary or any page that only needs the helpers.
 */
const files = import.meta.glob<ChainData>('./data/*.json', { eager: true, import: 'default' });

export const CHAINS = Object.values(files)
  .map(normalizeChain)
  .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
