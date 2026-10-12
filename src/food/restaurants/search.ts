import type { Chain, MenuItem } from './types';
import { menuTokens } from './text';

export interface MenuHit {
  chain: Chain;
  item: MenuItem;
}

/**
 * Every position whose chain, name, portion or category holds all the typed
 * words ("big mac", "latte grande", "kfc strips"), chains alphabetically and
 * each in menu order. No words, no hits.
 */
export function searchMenus(chains: Chain[], query: string, limit = Infinity): MenuHit[] {
  const tokens = menuTokens(query);
  if (!tokens.length) return [];
  const hits: MenuHit[] = [];
  for (const chain of chains)
    for (const item of chain.items) {
      if (hits.length >= limit) return hits;
      if (tokens.every((t) => item.searchText.includes(t))) hits.push({ chain, item });
    }
  return hits;
}
