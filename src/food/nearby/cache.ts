import { distanceMeters } from './geo';
import type { LatLon, Shop } from './types';

export type ShopCache = Pick<Storage, 'getItem' | 'setItem'>;
export type Circle = LatLon & { radius: number };

const KEY = 'produkty-pl:shops';
/** Places to eat („Zjedz teraz”): restaurants and shops in one answer, kept apart from the shops. */
export const PLACES_KEY = 'produkty-pl:places';
/** An answer this fresh is used without asking the server again. */
const TTL_MS = 24 * 3600 * 1000;
/**
 * An older answer stays this long as the fallback for a busy server: shops and restaurants move less
 * often than the public Overpass servers are overloaded, and last week's map beats an error.
 */
const KEEP_MS = 7 * 24 * 3600 * 1000;
// A 10 km answer in a city is thousands of shops; four answers is plenty of
// reuse without filling the storage the position and radius share.
const MAX_ENTRIES = 4;

interface Entry<T = Shop> extends Circle {
  fetchedAt: number;
  shops: T[];
}

function load<T = Shop>(storage: ShopCache | null, key = KEY): Entry<T>[] {
  try {
    const raw = storage?.getItem(key);
    const entries = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(entries) ? (entries as Entry<T>[]) : [];
  } catch {
    return [];
  }
}

function store<T>(storage: ShopCache | null, entries: Entry<T>[], key = KEY): void {
  try {
    storage?.setItem(key, JSON.stringify(entries));
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
export function readCache<T = Shop>(
  storage: ShopCache | null,
  center: LatLon,
  radius: number,
  now: number,
  key = KEY,
): T[] | null {
  for (const entry of load<T>(storage, key)) {
    if (now - entry.fetchedAt <= TTL_MS && covers(entry, center, radius)) return entry.shops;
  }
  return null;
}

/** `circle` is the query circle (rounded centre), never the exact position. */
export function writeCache<T = Shop>(storage: ShopCache | null, circle: Circle, shops: T[], now: number, key = KEY): void {
  const kept = load<T>(storage, key).filter((e) => now - e.fetchedAt <= KEEP_MS);
  store(
    storage,
    [{ lat: circle.lat, lon: circle.lon, radius: circle.radius, fetchedAt: now, shops }, ...kept].slice(
      0,
      MAX_ENTRIES,
    ),
    key,
  );
}

export interface Cached<T> {
  circle: Circle;
  items: T[];
  fetchedAt: number;
}

/**
 * The best older or smaller answer for here, shown while a new one loads or when it fails: any
 * kept answer whose circle contains the point, the one complete furthest from it first, then the
 * newest. The caller tells the user how old it is.
 */
export function readFallback<T = Shop>(storage: ShopCache | null, center: LatLon, now: number, key = KEY): Cached<T> | null {
  let best: { entry: Entry<T>; reach: number } | null = null;
  for (const entry of load<T>(storage, key)) {
    const reach = entry.radius - distanceMeters(entry, center);
    if (now - entry.fetchedAt > KEEP_MS || reach <= 0) continue;
    if (!best || reach > best.reach || (reach === best.reach && entry.fetchedAt > best.entry.fetchedAt)) best = { entry, reach };
  }
  if (!best) return null;
  const { lat, lon, radius, fetchedAt, shops } = best.entry;
  return { circle: { lat, lon, radius }, items: shops, fetchedAt };
}

/** Drops answers past keeping, so a long trail of past places does not stay on the device. */
export function pruneCache(storage: ShopCache | null, now: number, key = KEY): void {
  const entries = load(storage, key);
  const kept = entries.filter((e) => now - e.fetchedAt <= KEEP_MS);
  if (kept.length !== entries.length) store(storage, kept, key);
}
