import { distanceMeters } from './geo';
import type { LatLon, PlacedShop, Shop } from './types';

/** A shop mapped twice (a node and its building) sits within a few metres of itself. */
const SAME_SHOP_METRES = 30;

export interface Placement {
  /** Shops of chains we have product data for, inside the radius, nearest first. */
  known: PlacedShop[];
  /** Other shops inside the radius: found, but nothing can be planned on them. */
  otherCount: number;
}

export function placeShops(shops: Shop[], center: LatLon, radius: number, knownChains: Set<string>): Placement {
  const inside = shops
    .map((shop) => ({ ...shop, distance: distanceMeters(center, shop) }))
    .filter((shop) => shop.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  const known: PlacedShop[] = [];
  let otherCount = 0;
  for (const shop of inside) {
    if (!shop.chain || !knownChains.has(shop.chain)) {
      otherCount++;
      continue;
    }
    const duplicate = known.some((k) => k.chain === shop.chain && distanceMeters(k, shop) < SAME_SHOP_METRES);
    if (!duplicate) known.push(shop);
  }
  return { known, otherCount };
}

export interface ChainSummary {
  chain: string;
  count: number;
  nearest: PlacedShop;
}

/** One line per chain, nearest chain first: this order IS the store ranking for the recipes. */
export function summarizeChains(known: PlacedShop[]): ChainSummary[] {
  const byChain = new Map<string, ChainSummary>();
  for (const shop of known) {
    const entry = byChain.get(shop.chain!);
    if (entry) entry.count++;
    else byChain.set(shop.chain!, { chain: shop.chain!, count: 1, nearest: shop });
  }
  return [...byChain.values()].sort((a, b) => a.nearest.distance - b.nearest.distance);
}
