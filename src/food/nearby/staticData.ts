import osmPlaces from 'virtual:osm-places';
import { inflate } from '../lib/inflate';
import { decodeLeaf, leafPath, validateIndex, type OsmElement, type OsmIndex } from './osmFormat';

/**
 * The app's own copy of the OpenStreetMap data for Poland, as the build cut it: one small index
 * (which cells exist, the coverage polygon, the data date) and a few hundred gzipped "leaf" files,
 * each a cell of the quadtree with at most ~500 places. A position needs one to a few leaves; they
 * come from the app's own server (and then from the service worker), never from a third party.
 *
 * Failures are typed, because the page reacts differently:
 * - `network`: no connection (or a timeout) — keep what is on screen, retry when online;
 * - `unavailable`: the server answered but the data is missing or broken — ask Overpass instead;
 * - `moved`: a leaf is gone because a new data version was deployed — the index is re-read and the
 *   page selects again.
 */

export type StaticFailure = 'network' | 'unavailable' | 'moved';

export class StaticDataError extends Error {
  constructor(readonly kind: StaticFailure) {
    super(`OSM data: ${kind}`);
    this.name = 'StaticDataError';
  }
}

export const failureOf = (error: unknown): StaticFailure => (error instanceof StaticDataError ? error.kind : 'unavailable');

export interface LeafRef {
  d: number;
  i: number;
  j: number;
  rows: number;
  sha10: string;
}

/** The index's leaves as objects (the file keeps them as compact arrays). */
export const leafRefs = (index: OsmIndex): LeafRef[] => index.leaves.map(([d, i, j, rows, sha10]) => ({ d, i, j, rows, sha10 }));

/** Whether this build carries the data at all (`null` in tests and in builds without the file). */
export const hasStaticData = (): boolean => osmPlaces.index !== null;

const INDEX_TIMEOUT_MS = 10_000;
const LEAF_TIMEOUT_MS = 20_000;
/** A failed leaf is tried once more after this pause: one dropped packet should not cost a city. */
const RETRY_PAUSE_MS = 2000;
/** The index is re-read from the server at most this often (after a 404 for a leaf). */
const REFRESH_EVERY_MS = 60_000;
/** Decoded leaves kept in memory: a 10 km circle in Warsaw needs ~35. */
const MEMORY_LEAVES = 40;
/** The service worker's caches (`src/sw.ts`): leaves first from the cache, the index refreshed in the background. */
export const LEAF_CACHE = 'gt-osm';
const INDEX_CACHE = 'gt-osm-index';

const indexUrl = (): string => new URL(import.meta.env.BASE_URL + osmPlaces.index, document.baseURI).href;
const leafUrl = (leaf: LeafRef): string => new URL(leafPath([leaf.d, leaf.i, leaf.j, leaf.rows, leaf.sha10]), indexUrl()).href;
/** The cell part of a leaf's file name: another data version of the same cell shares it. */
const cellPrefix = (leaf: Pick<LeafRef, 'd' | 'i' | 'j'>) => `/t/${leaf.d}-${leaf.i}-${leaf.j}.`;

/** `fetch` with a timeout that works without `AbortSignal.timeout` (Safari before 16). */
async function fetchWithin(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    // `priority` (Chromium): the places beat the 3 MB products download that may run at the same time.
    return await fetch(url, { ...init, signal: controller.signal, priority: 'high' } as RequestInit);
  } catch {
    throw new StaticDataError('network');
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- The index ---------------- */

let index: Promise<OsmIndex> | null = null;
let refreshedAt = -Infinity;

async function readIndex(response: Response): Promise<OsmIndex> {
  if (!response.ok) throw new StaticDataError(response.status >= 500 ? 'network' : 'unavailable');
  const parsed = validateIndex(await response.json().catch(() => null));
  if (!parsed) throw new StaticDataError('unavailable');
  return parsed;
}

/** Keeps a request as THE index until it fails; a failed one is forgotten, so the next ask tries again. */
function keep(request: Promise<OsmIndex>): Promise<OsmIndex> {
  index = request;
  request.catch(() => {
    if (index === request) index = null;
  });
  return request;
}

/** The index, read once per page (the service worker serves it at once and refreshes it behind). */
export function loadIndex(): Promise<OsmIndex> {
  return index ?? keep(fetchWithin(indexUrl(), INDEX_TIMEOUT_MS).then(readIndex));
}

/**
 * The index straight from the server, past the service worker's copy: a leaf of the copy's version
 * is gone, so a new version was deployed. The fresh index also replaces the copy in the cache.
 */
export function refreshIndex(): Promise<OsmIndex> {
  if (Date.now() - refreshedAt < REFRESH_EVERY_MS && index) return index;
  refreshedAt = Date.now();
  return keep(
    fetchWithin(`${indexUrl()}?r=${Date.now()}`, INDEX_TIMEOUT_MS, { cache: 'no-store' }).then(async (response) => {
      const fresh = await readIndex(response.clone());
      if (typeof caches !== 'undefined') await caches.open(INDEX_CACHE).then((c) => c.put(indexUrl(), response)).catch(() => {});
      return fresh;
    }),
  );
}

/* ---------------- Leaves ---------------- */

export interface LoadedLeaf {
  elements: OsmElement[];
  /** Another data version of the same cell, from the device: the right one could not be fetched. */
  older: boolean;
}

const memory = new Map<string, LoadedLeaf>();
const pending = new Map<string, Promise<LoadedLeaf>>();
/** When each leaf on its way started loading: the page calls a long wait slow. */
const started = new Map<string, number>();

/** When a leaf still on its way started loading; `undefined` when it is not loading. */
export function leafStartedAt(leaf: LeafRef): number | undefined {
  return started.get(leafUrl(leaf));
}

function remember(url: string, leaf: LoadedLeaf): LoadedLeaf {
  memory.delete(url);
  memory.set(url, leaf);
  while (memory.size > MEMORY_LEAVES) memory.delete(memory.keys().next().value!);
  return leaf;
}

/** A leaf already in memory, synchronously — a warm page renders in one go. */
export function leafNow(leaf: LeafRef): LoadedLeaf | undefined {
  return memory.get(leafUrl(leaf));
}

async function decode(response: Response): Promise<OsmElement[]> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return decodeLeaf(JSON.parse(await inflate(bytes)));
}

/** The same cell from an older data version, if the device kept one (offline after a data update). */
async function olderVersion(leaf: LeafRef, url: string): Promise<OsmElement[] | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(LEAF_CACHE);
    const prefix = cellPrefix(leaf);
    for (const request of await cache.keys()) {
      if (request.url === url || !new URL(request.url).pathname.includes(prefix)) continue;
      const response = await cache.match(request);
      if (response) return await decode(response);
    }
  } catch {
    // An unreadable cache is no fallback.
  }
  return null;
}

/** Drops the other data versions of a cell once the right one is here: a bounded trail on the device. */
async function dropOlder(leaf: LeafRef, url: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(LEAF_CACHE);
    const prefix = cellPrefix(leaf);
    for (const request of await cache.keys())
      if (request.url !== url && new URL(request.url).pathname.includes(prefix)) await cache.delete(request);
  } catch {
    // Nothing to tidy.
  }
}

async function fetchLeaf(leaf: LeafRef, url: string): Promise<LoadedLeaf> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetchWithin(url, LEAF_TIMEOUT_MS);
    } catch (error) {
      if (attempt === 0) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      const older = await olderVersion(leaf, url);
      if (older) return { elements: older, older: true };
      throw error;
    }
    if (response.status === 404) {
      // A new data version was deployed and this file went with the old one.
      void refreshIndex().catch(() => {});
      throw new StaticDataError('moved');
    }
    if (!response.ok) {
      if (attempt === 0) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      throw new StaticDataError(response.status >= 500 ? 'network' : 'unavailable');
    }
    try {
      const elements = await decode(response);
      void dropOlder(leaf, url);
      return { elements, older: false };
    } catch {
      // A broken copy (a cut-off download in the cache) is thrown away and fetched again, once.
      if (typeof caches !== 'undefined') await caches.open(LEAF_CACHE).then((c) => c.delete(url)).catch(() => {});
      if (attempt === 0) continue;
      throw new StaticDataError('unavailable');
    }
  }
}

/** A leaf from memory, the service worker or the server; one request per file however many ask. */
export function loadLeaf(leaf: LeafRef): Promise<LoadedLeaf> {
  const url = leafUrl(leaf);
  const known = memory.get(url);
  if (known && !known.older) return Promise.resolve(known);
  let request = pending.get(url);
  if (!request) {
    started.set(url, Date.now());
    request = fetchLeaf(leaf, url)
      .then((loaded) => remember(url, loaded))
      .finally(() => {
        pending.delete(url);
        started.delete(url);
      });
    pending.set(url, request);
  }
  return request;
}

/**
 * The very first visit fetches before the service worker controls the page, so those files would
 * be missing offline. When it takes over, what is already known is fetched once more through it
 * (from the browser's HTTP cache, mostly) and lands in its copy.
 */
function cacheThroughWorker(): void {
  if (osmPlaces.index === null) return;
  if (index) void fetch(indexUrl()).catch(() => {});
  for (const url of memory.keys()) void fetch(url).catch(() => {});
}
if (typeof navigator !== 'undefined' && navigator.serviceWorker && !navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', cacheThroughWorker, { once: true });

/** Forgets everything in memory (tests). */
export function __resetStaticData(): void {
  index = null;
  refreshedAt = -Infinity;
  memory.clear();
  pending.clear();
  started.clear();
}
