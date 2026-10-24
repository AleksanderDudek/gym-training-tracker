import osmPlaces from 'virtual:osm-places';
import { refetchWhenControlled } from '../../swWarm';
import { inflate } from '../lib/inflate';
import { onReset } from '../lib/onReset';
import { decodeLeaf, leafPath, validateIndex, type OsmElement, type OsmIndex } from './osmFormat';

/**
 * The app's own copy of the OpenStreetMap data for Poland, as the build cut it: one small index
 * (which cells exist, the coverage polygon, the data date) and a few hundred gzipped "leaf" files,
 * each a cell of the quadtree with at most ~500 places. A position needs one to a few leaves; they
 * come from the app's own server (and then from the service worker), never from a third party.
 *
 * Failures are typed, because the page reacts differently:
 * - `network`: no connection (or a timeout) — keep what is on screen, retry when online;
 * - `unavailable`: the server answered but the data is missing or broken (or the server itself
 *   fails) — ask Overpass instead;
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

/** How long the server may take to start answering (the headers): the index, a leaf. */
const INDEX_TIMEOUT_MS = 10_000;
const LEAF_TIMEOUT_MS = 20_000;
/**
 * Then the body may go this long without a byte before it counts as stalled. Only silence counts,
 * not the total: a 10 km view on a slow link (~250 kB gzipped in parallel, on EDGE) takes longer than
 * any fixed deadline would allow, but keeps arriving.
 */
const STALL_MS = 10_000;
/** A failed leaf is tried once more after this pause: one dropped packet should not cost a city. */
const RETRY_PAUSE_MS = 2000;
/**
 * Leaves on their way at once; the rest wait their turn, those on screen first, each view's nearest
 * first (`inSlot`). A 10 km view is ~34 leaves:
 * asked all at once, a browser on HTTP/1.1 (6 connections per server) queues most of them with their
 * header deadline already running, and on a slow link the last ones were cut before they started
 * (EDGE: 9 of 34 cut and fetched again, the answer after a minute). A few at a time, each deadline
 * counts from its own start, and the nearest finish first.
 */
const LEAF_SLOTS = 8;
/** The index is re-read from the server at most this often (after a 404 for a leaf). */
const REFRESH_EVERY_MS = 60_000;
/**
 * Decoded leaves kept in memory. The leaves on screen are pinned and never dropped; this is the room
 * for the ones around them (the busiest 10 km circle needs ~37 — `osmData.test` keeps the largest
 * 10 km view centred on any leaf under half of this).
 */
export const MEMORY_LEAVES = 96;
/** The service worker's caches (`src/sw.ts`): leaves first from the cache, the index refreshed in the background. */
export const LEAF_CACHE = 'gt-osm';
const INDEX_CACHE = 'gt-osm-index';

const indexUrl = (): string => new URL(import.meta.env.BASE_URL + osmPlaces.index, document.baseURI).href;
const leafUrl = (leaf: LeafRef): string => new URL(leafPath([leaf.d, leaf.i, leaf.j, leaf.rows, leaf.sha10]), indexUrl()).href;
/** The cell part of a leaf's file name: another data version of the same cell shares it. */
const cellPrefix = (leaf: Pick<LeafRef, 'd' | 'i' | 'j'>) => `/t/${leaf.d}-${leaf.i}-${leaf.j}.`;

/**
 * Where a request was lost on its way (`fetchFile` reacts to each differently): `headers` — no answer
 * within the deadline; `body` — the answer began, then went silent or broke off; `refused` — no
 * connection at all (offline, a refused or dropped connection before any answer).
 */
type LostAt = 'headers' | 'body' | 'refused';

/** A `network` failure that knows where the request was lost. */
class LostOnWay extends StaticDataError {
  constructor(readonly at: LostAt) {
    super('network');
  }
}

/**
 * `fetch` with a deadline for the headers (`ms`), then the body read chunk by chunk with a timer that
 * every chunk restarts (`STALL_MS`): a slow but steady download finishes however long it takes, a
 * stalled one is cut and must not hang the page. Works without `AbortSignal.timeout` (Safari before
 * 16). Any failure is `network` (`LostOnWay`, saying where); an error answer's body is not read (its
 * status is all that counts).
 */
async function fetchWithin(url: string, ms: number, init: RequestInit = {}): Promise<{ response: Response; body: Uint8Array }> {
  const controller = new AbortController();
  // The abort cancels the request; racing it also ends a read that a browser would leave hanging.
  const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout'))));
  aborted.catch(() => {});
  const within = <T>(step: Promise<T>) => Promise.race([step, aborted]);
  let timer = setTimeout(() => controller.abort(), ms);
  /** Something arrived: the body has `STALL_MS` again for the next chunk. */
  const arrived = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), STALL_MS);
  };
  let answered = false;
  try {
    // `priority` (Chromium): 'high' alone gives the places no head start — every `fetch` gets it.
    // They come before the 3 MB products download that may run at the same time because that one is
    // asked at 'low' (`src/food/data.ts`): a server sends requests of equal priority one after
    // another, in the order asked, and the deadlines here would take the wait behind the products
    // for a lost connection.
    const response = await within(fetch(url, { ...init, signal: controller.signal, priority: 'high' } as RequestInit));
    answered = true;
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      return { response, body: new Uint8Array(0) };
    }
    arrived();
    if (!response.body) return { response, body: new Uint8Array(await within(response.arrayBuffer())) };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await within(reader.read());
      if (done) break;
      chunks.push(value);
      size += value.length;
      arrived();
    }
    const body = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      body.set(chunk, at);
      at += chunk.length;
    }
    return { response, body };
  } catch {
    // Before the answer only the deadline aborts; anything else there is a failed connection.
    throw new LostOnWay(answered ? 'body' : controller.signal.aborted ? 'headers' : 'refused');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Files to fetch past the browser's HTTP cache (`reload`: the answer still goes into it) until a
 * request for them succeeds. Through the service worker the page's abort ends only the page's side:
 * the worker's own request for the file goes on, writing the file's entry in the HTTP cache, and in
 * Chromium every later request in the default mode joins that entry and waits with it. Which
 * failures mark a file:
 * - the body stalled or broke off: the entry is being written and stalls — at once, or the retry,
 *   the automatic tries and the button would all stall with it until the worker's request ends;
 * - no answer within the deadline: only the second time in a row. The first retry joins the entry
 *   and takes the worker's answer when it comes (a link where every answer takes 25 s would
 *   otherwise download each file twice); Chromium itself stops waiting for a writer without an
 *   answer after about 20 s, so a server that never answers costs one retry, not minutes;
 * - no connection at all (offline, refused): nothing is being written, there is nothing to go past.
 * A file's first request keeps the default mode: what was fetched before (the very first visit, the
 * takeover's fetch again) comes from the HTTP cache.
 */
const failedOnWay = new Set<string>();
/** Counts the resets (`forgetStaticData`): a request asked for before one changes nothing kept. */
let resets = 0;
/** Files whose last request got no answer within its deadline (`failedOnWay`: the second marks). */
const unanswered = new Set<string>();

/** Notes where a request for `url` was lost (`failedOnWay`). */
function noteLost(url: string, error: unknown): void {
  const at = error instanceof LostOnWay ? error.at : 'refused';
  if (at === 'body' || (at === 'headers' && unanswered.has(url))) failedOnWay.add(url);
  if (at === 'headers') unanswered.add(url);
  else unanswered.delete(url);
}

/**
 * `fetchWithin`, past the HTTP cache where `failedOnWay` says so. A request asked before a reset
 * (`asked`, see `forgetStaticData`) changes nothing in what the page remembers of its file.
 */
async function fetchFile(url: string, ms: number, asked = resets): Promise<{ response: Response; body: Uint8Array }> {
  try {
    const got = await fetchWithin(url, ms, failedOnWay.has(url) ? { cache: 'reload' } : {});
    if (asked === resets) {
      unanswered.delete(url);
      if (got.response.ok) failedOnWay.delete(url);
    }
    return got;
  } catch (error) {
    if (asked === resets) noteLost(url, error);
    throw error;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- The index ---------------- */

let index: Promise<OsmIndex> | null = null;
let refreshedAt = -Infinity;

function readIndex(response: Response, bytes: Uint8Array): OsmIndex {
  // The server answered with an error: its data is not to be had now — Overpass answers instead.
  if (!response.ok) throw new StaticDataError('unavailable');
  let parsed: OsmIndex | null = null;
  try {
    parsed = validateIndex(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    parsed = null;
  }
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
  if (index) return index;
  const request = keep(fetchFile(indexUrl(), INDEX_TIMEOUT_MS).then(({ response, body }) => readIndex(response, body)));
  // The very first visit asks before the service worker controls the page: once it takes over, the
  // index is fetched again through it, into its copy (the leaves the same way).
  refetchWhenControlled(indexUrl(), request);
  return request;
}

/**
 * The index straight from the server, past the service worker's copy: a leaf of the copy's version
 * is gone, so a new version was deployed. The fresh index also replaces the copy in the cache.
 */
export function refreshIndex(): Promise<OsmIndex> {
  if (Date.now() - refreshedAt < REFRESH_EVERY_MS && index) return index;
  refreshedAt = Date.now();
  return keep(
    fetchWithin(`${indexUrl()}?r=${Date.now()}`, INDEX_TIMEOUT_MS, { cache: 'no-store' }).then(async ({ response, body }) => {
      const fresh = readIndex(response, body);
      if (typeof caches !== 'undefined')
        await caches
          .open(INDEX_CACHE)
          .then((c) => c.put(indexUrl(), new Response(body.slice(), { headers: response.headers })))
          .catch(() => {});
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

/** Most recently used last; pinned leaves (on screen) are never dropped. */
const memory = new Map<string, LoadedLeaf>();
const pending = new Map<string, Promise<LoadedLeaf>>();
/** When each leaf on its way started loading: the page calls a long wait slow. */
const started = new Map<string, number>();
/** How many views hold each leaf on screen. */
const pins = new Map<string, number>();
/** Leaf requests on their way. */
let leavesOnWay = 0;
interface Waiting {
  url: string;
  /** Its place in line: when its leaf was asked for (a retry keeps it). */
  order: number;
  go: () => void;
  drop: (reason: unknown) => void;
}
/** Leaves waiting for one of the `LEAF_SLOTS`, in the order asked. */
const waitingForSlot: Waiting[] = [];
/** Numbers the leaves in the order asked: their place in line for a slot. */
let asks = 0;
/** The slots' generation: `__resetStaticData` counts afresh, and a slot taken before that is not handed on. */
let slotGeneration = 0;

/**
 * Runs a leaf request in one of the slots. A leaf waits in the order it was asked for — a retry too,
 * so the nearest leaf failing once is asked again with the next free slot, not after every farther
 * leaf in line. A slot that frees goes straight to the next leaf on screen (pinned) and only then to
 * the others: after a move (the saved position, then the GPS fix far away) the new place's own leaf
 * does not wait for every leaf the old place still has in line.
 */
async function inSlot<T>(url: string, order: number, task: () => Promise<T>): Promise<T> {
  const generation = slotGeneration;
  if (leavesOnWay < LEAF_SLOTS) leavesOnWay++;
  else
    await new Promise<void>((go, drop) => {
      const behind = waitingForSlot.findIndex((w) => w.order > order);
      waitingForSlot.splice(behind < 0 ? waitingForSlot.length : behind, 0, { url, order, go, drop });
    });
  try {
    return await task();
  } finally {
    if (generation === slotGeneration) handOver();
  }
}

/** A slot is free: to the first leaf in line that is on screen, else to the first in line. */
function handOver(): void {
  const onScreen = waitingForSlot.findIndex((w) => pins.has(w.url));
  const [next] = waitingForSlot.splice(Math.max(onScreen, 0), 1);
  if (next) next.go();
  else leavesOnWay--;
}

/** When a leaf still on its way started loading; `undefined` when it is not loading. */
export function leafStartedAt(leaf: LeafRef): number | undefined {
  return started.get(leafUrl(leaf));
}

function evict(): void {
  for (const url of memory.keys()) {
    if (memory.size <= MEMORY_LEAVES) return;
    if (!pins.has(url)) memory.delete(url);
  }
}

function remember(url: string, leaf: LoadedLeaf): LoadedLeaf {
  memory.delete(url);
  memory.set(url, leaf);
  evict();
  return leaf;
}

/**
 * Holds the leaves of the view on screen in memory until the returned function releases them: the
 * leaves around it may come and go, these may not (a view waiting for a leaf that was dropped would
 * wait forever). Also marks them most recently used.
 */
export function pinLeaves(leaves: readonly LeafRef[]): () => void {
  const urls = leaves.map(leafUrl);
  for (const url of urls) {
    pins.set(url, (pins.get(url) ?? 0) + 1);
    const known = memory.get(url);
    if (known) {
      memory.delete(url);
      memory.set(url, known);
    }
  }
  // No eviction on release: the next view usually pins most of the same leaves a moment later, and
  // the next leaf to arrive tidies the memory anyway.
  return () => {
    for (const url of urls) {
      const n = (pins.get(url) ?? 1) - 1;
      if (n > 0) pins.set(url, n);
      else pins.delete(url);
    }
  };
}

/** A leaf already in memory, synchronously — a warm page renders in one go. */
export function leafNow(leaf: LeafRef): LoadedLeaf | undefined {
  return memory.get(leafUrl(leaf));
}

async function decodeBytes(bytes: Uint8Array): Promise<OsmElement[]> {
  return decodeLeaf(JSON.parse(await inflate(bytes as Uint8Array<ArrayBuffer>)));
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
      if (response) return await decodeBytes(new Uint8Array(await response.arrayBuffer()));
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

/**
 * A leaf „Usuń wszystkie dane” dropped before it was done (in line for a slot, in the pause before a
 * retry, or failed after the reset): nothing more is asked for it. It ends with a request for the
 * same file asked after the reset, if there is one, else as a lost connection.
 */
function forgotten(url: string): Promise<LoadedLeaf> {
  return pending.get(url) ?? Promise.reject(new StaticDataError('network'));
}

/** The leaf `url`, asked for after `asked` resets, `order`-th in line (`inSlot`). */
async function fetchLeaf(leaf: LeafRef, url: string, asked: number, order: number): Promise<LoadedLeaf> {
  for (let attempt = 0; ; attempt++) {
    if (asked !== resets) return forgotten(url);
    let got: { response: Response; body: Uint8Array };
    try {
      // The slot is held for the request only, not for the pause before a retry.
      got = await inSlot(url, order, () => fetchFile(url, LEAF_TIMEOUT_MS, asked));
    } catch (error) {
      if (asked !== resets) return forgotten(url);
      if (attempt === 0) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      const older = await olderVersion(leaf, url);
      if (older) return { elements: older, older: true };
      throw error;
    }
    const { response, body } = got;
    // After a reset the device's copy and the page's memory stay as the reset left them.
    const kept = asked === resets;
    if (response.status === 404) {
      // A new data version was deployed and this file went with the old one.
      if (kept) void refreshIndex().catch(() => {});
      throw new StaticDataError('moved');
    }
    if (!response.ok) {
      if (attempt === 0) {
        await sleep(RETRY_PAUSE_MS);
        continue;
      }
      throw new StaticDataError('unavailable');
    }
    try {
      const elements = await decodeBytes(body);
      if (kept) void dropOlder(leaf, url);
      return { elements, older: false };
    } catch {
      // A broken copy (a cut-off download in the cache) is thrown away and fetched again, once.
      if (kept && typeof caches !== 'undefined') await caches.open(LEAF_CACHE).then((c) => c.delete(url)).catch(() => {});
      if (attempt === 0) continue;
      throw new StaticDataError('unavailable');
    }
  }
}

/** A leaf from memory, the service worker or the server; one request per file however many ask. */
export function loadLeaf(leaf: LeafRef): Promise<LoadedLeaf> {
  const url = leafUrl(leaf);
  const known = memory.get(url);
  if (known && !known.older) {
    remember(url, known);
    return Promise.resolve(known);
  }
  let request = pending.get(url);
  if (!request) {
    const asked = resets;
    started.set(url, Date.now());
    const loading: Promise<LoadedLeaf> = fetchLeaf(leaf, url, asked, ++asks)
      .then((loaded) => (asked === resets ? remember(url, loaded) : loaded))
      .finally(() => {
        // After a reset another request for the file may be on its way: that one stays tracked.
        if (pending.get(url) !== loading) return;
        pending.delete(url);
        started.delete(url);
      });
    request = loading;
    pending.set(url, request);
    // The very first visit: fetched past the service worker, so once it takes over the leaf is
    // fetched again through it (after this request), into its copy — the area works offline. A
    // leaf tells where someone looked: a reset before the takeover drops it (`src/swWarm.ts`).
    refetchWhenControlled(url, request, { trail: true });
  }
  return request;
}

/**
 * „Usuń wszystkie dane”: forgets what the page holds of the areas seen — the leaves, the index and
 * which files are on their way or failed. Registered when this module loads (`../lib/onReset`), so
 * the reset never downloads it. The leaves waiting for a slot are dropped, and so is a leaf in the
 * pause before its retry: nothing is asked for them after the reset. Those on their way are not
 * stopped (each keeps its slot until it ends) but no longer kept, and a view asking again starts its
 * own request. What they bring the service worker no longer keeps either (`src/swPlugins.ts`).
 */
export function forgetStaticData(): void {
  resets++;
  index = null;
  memory.clear();
  pending.clear();
  started.clear();
  failedOnWay.clear();
  unanswered.clear();
  for (const waiting of waitingForSlot.splice(0)) waiting.drop(new StaticDataError('network'));
}

onReset(forgetStaticData);

/** Forgets everything in memory, the slots counted afresh (tests). */
export function __resetStaticData(): void {
  forgetStaticData();
  refreshedAt = -Infinity;
  pins.clear();
  // The requests still on their way (an earlier test's) keep nothing and hand no slot on.
  slotGeneration++;
  leavesOnWay = 0;
}
