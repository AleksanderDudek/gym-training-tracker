import { distanceMeters } from './geo';
import type { LatLon, Shop } from './types';

export type ShopCache = Pick<Storage, 'getItem' | 'setItem'>;
export type Circle = LatLon & { radius: number };

const KEY = 'produkty-pl:shops';
const TTL_MS = 24 * 3600 * 1000;
// A 10 km answer in a city is thousands of shops; four answers is plenty of
// reuse without filling the storage the position and radius share.
const MAX_ENTRIES = 4;

interface Entry extends Circle {
  fetchedAt: number;
  shops: Shop[];
}

function load(storage: ShopCache | null): Entry[] {
  try {
    const raw = storage?.getItem(KEY);
    const entries = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(entries) ? (entries as Entry[]) : [];
  } catch {
    return [];
  }
}

function store(storage: ShopCache | null, entries: Entry[]): void {
  try {
    storage?.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Full or forbidden: the next visit simply asks the server again.
  }
}

/** Whether the circle `outer` contains the circle around `center` of `radius`. */
export function covers(outer: Circle, center: LatLon, radius: number): boolean {
  return distanceMeters(outer, center) + radius <= outer.radius;
}

/**
 * Shops from an earlier answer whose circle contains the one asked for now:
 * shrinking the radius, or moving a few metres, needs no new request to a
 * server that is often busy. Storage failures read as "nothing cached".
 */
export function readCache(storage: ShopCache | null, center: LatLon, radius: number, now: number): Shop[] | null {
  for (const entry of load(storage)) {
    if (now - entry.fetchedAt <= TTL_MS && covers(entry, center, radius)) return entry.shops;
  }
  return null;
}

/** `circle` is the query circle (rounded centre), never the exact position. */
export function writeCache(storage: ShopCache | null, circle: Circle, shops: Shop[], now: number): void {
  const fresh = load(storage).filter((e) => now - e.fetchedAt <= TTL_MS);
  store(
    storage,
    [{ lat: circle.lat, lon: circle.lon, radius: circle.radius, fetchedAt: now, shops }, ...fresh].slice(
      0,
      MAX_ENTRIES,
    ),
  );
}

/** Drops expired answers, so a trail of past places does not stay on the device. */
export function pruneCache(storage: ShopCache | null, now: number): void {
  const entries = load(storage);
  const fresh = entries.filter((e) => now - e.fetchedAt <= TTL_MS);
  if (fresh.length !== entries.length) store(storage, fresh);
}
