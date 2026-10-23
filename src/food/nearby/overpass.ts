import { text } from '../../i18n';
import { storeKey } from '../lib/stores';
import { SHOP_TYPES, WHOLESALE_BRANDS, address, labelOf, matchesShopsQuery } from './osmTags';
import type { LatLon, Shop } from './types';

export { address } from './osmTags';

/**
 * Public Overpass servers, tried in order. They are busy and flaky: measured
 * 2026-10-10, five requests to the main one gave 200 twice, 504 and 406 (with
 * an HTML page) otherwise. Every server here is NAMED to the user on the page
 * that sends their (rounded) position, so adding one means changing that text.
 */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * One request may take this long before the next server is tried. A busy main server answers a city
 * centre's places in ~35 s (measured 2026-10-23, Warsaw, 1.25 km): cut at 30 s, the answer that was
 * coming was thrown away for a backup that hung.
 */
const REQUEST_TIMEOUT_MS = 50_000;
/** All tries end by then: past two minutes the page shows what it remembers and tries again later. */
const BUDGET_MS = 120_000;
/** A server's own `Retry-After` is honoured up to this; a longer wait is the page's to schedule. */
const MAX_WAIT_MS = 30_000;

export class OverpassUnavailable extends Error {
  constructor() {
    super(text({ pl: 'Serwer map (OpenStreetMap) jest teraz przeciążony.', en: 'The map server (OpenStreetMap) is overloaded right now.' }));
    this.name = 'OverpassUnavailable';
  }
}

/** Food shops around a point; `out center` gives buildings (ways) a position too. */
export function buildQuery(center: LatLon, radius: number): string {
  const around = `around:${Math.round(radius)},${center.lat},${center.lon}`;
  return (
    `[out:json][timeout:25];(` +
    `nwr["shop"~"^(${SHOP_TYPES.join('|')})$"](${around});` +
    `nwr["shop"="wholesale"]["brand"~"^(${WHOLESALE_BRANDS.join('|')})",i](${around});` +
    `);out tags center qt;`
  );
}

export interface Element {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * The elements of a complete Overpass answer. Throws on anything else: not Overpass JSON at all, or
 * JSON carrying a runtime error (a timeout or running out of memory comes with status 200, partial
 * elements and a `remark` - taken as an answer it would say "nothing here" and be cached for a day).
 */
export function elementsOf(json: unknown): Element[] {
  const response = json as { elements?: unknown; remark?: unknown } | null;
  const elements = response?.elements;
  if (!Array.isArray(elements)) throw new Error('Not an Overpass response');
  if (typeof response?.remark === 'string' && /error|timed out|out of memory/i.test(response.remark)) {
    throw new Error(`Overpass: ${response.remark}`);
  }
  return elements as Element[];
}

/**
 * Overpass JSON -> shops. Throws on anything that is not a complete answer:
 * not Overpass JSON at all, or JSON carrying a runtime error. Overpass reports
 * a timeout or running out of memory with status 200 and partial (often empty)
 * elements plus a `remark`; taken as an answer it would say "no shops here"
 * and be cached for a day.
 */
export function parseShops(json: unknown): Shop[] {
  return shopsOf(elementsOf(json));
}

/**
 * The shops among OpenStreetMap elements — grocery shops and cash & carry halls, the rest left out:
 * the same elements also carry the restaurants of „Zjedz teraz”.
 */
export function shopsOf(elements: readonly Element[]): Shop[] {
  const seen = new Set<string>();
  const shops: Shop[] = [];
  for (const element of elements) {
    const id = `${element.type}/${element.id}`;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    // A chain is named by its brand tag; an independent shop only by its name.
    const raw = labelOf(tags);
    if (seen.has(id) || lat === undefined || lon === undefined || !raw || !matchesShopsQuery(tags)) continue;
    seen.add(id);
    shops.push({
      id,
      name: tags.name ?? raw,
      chain: storeKey(raw)?.key ?? null,
      lat,
      lon,
      address: address(tags),
      openingHours: tags.opening_hours ?? null,
    });
  }
  return shops;
}

export interface FetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  endpoints?: string[];
  /** The pause before a server is asked again; a busy or rate-limited server waits a multiple of it. */
  retryDelayMs?: number;
  timeoutMs?: number;
  /** Every try, waits included, ends this long after the start. */
  budgetMs?: number;
  /** Told before each pause between tries, with its length: the page says "trying again in 6 s". */
  onWait?: (ms: number) => void;
}

/**
 * A signal that fires on the caller's abort OR after `ms`: a server that takes
 * the connection and never answers must not hold up the servers after it.
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), ms);
  const onAbort = () => controller.abort(signal!.reason);
  signal?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The pause a busy server asked for: `Retry-After` in seconds (or as a date), capped; without one, a
 * multiple of the base pause - a rate limit (429) waits longer than a full server (502, 503, 504).
 */
export function pauseFor(response: Response, baseMs: number, nowMs = Date.now()): number {
  const header = response.headers.get('retry-after');
  const seconds = header === null ? NaN : Number(header);
  const asked = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - nowMs : NaN;
  if (Number.isFinite(asked)) return Math.min(MAX_WAIT_MS, Math.max(baseMs, asked));
  return response.status === 429 ? 5 * baseMs : 3 * baseMs;
}

/**
 * Food shops around a point, from the first server that answers.
 *
 * The request is a form POST with no headers set, a "simple" request: a
 * preflight OPTIONS is refused by Overpass (406), so a JSON body would fail in
 * the browser before it was ever sent.
 */
export function fetchShops(center: LatLon, radius: number, options: FetchOptions = {}): Promise<Shop[]> {
  return fetchOverpass(buildQuery(center, radius), parseShops, options);
}

/**
 * One Overpass question with the servers' fallbacks; `parse` turns the JSON into the answer or throws.
 *
 * The servers take turns, each asked twice. A response counts only if it is Overpass JSON: the busy
 * servers answer with an HTML page, sometimes with status 200. A server that says it is busy (502,
 * 503, 504 - "currently at capacity, retry using exponential backoff") or rate-limited (429) is
 * asked again only after the pause it names, or a growing one; a timeout or a dropped connection
 * just hands the turn to the next. The page learns of each pause (`onWait`), so a long wait is never
 * silent, and everything ends within the budget.
 */
export async function fetchOverpass<T>(query: string, parse: (json: unknown) => T, options: FetchOptions = {}): Promise<T> {
  const {
    signal,
    fetchImpl = fetch,
    endpoints = OVERPASS_ENDPOINTS,
    retryDelayMs = 2000,
    timeoutMs = REQUEST_TIMEOUT_MS,
    budgetMs = BUDGET_MS,
    onWait,
  } = options;
  const body = new URLSearchParams({ data: query });
  const deadline = Date.now() + budgetMs;
  /** When each server may be asked again. */
  const notBefore = new Map<string, number>();

  for (let i = 0; i < endpoints.length * 2; i++) {
    const endpoint = endpoints[i % endpoints.length]!;
    // A second round starts after the base pause at least, later when the server asked for that.
    const wait = Math.max(i >= endpoints.length ? retryDelayMs : 0, (notBefore.get(endpoint) ?? 0) - Date.now());
    // Not worth starting a try the budget would cut short.
    if (deadline - Date.now() - wait < Math.min(timeoutMs, 5_000)) break;
    if (wait > 0) {
      onWait?.(wait);
      await sleep(wait, signal);
    }
    const attempt = withTimeout(signal, Math.min(timeoutMs, deadline - Date.now()));
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', body, signal: attempt.signal });
      if (response.ok && response.headers.get('content-type')?.includes('json')) return parse(await response.json());
      if (response.status === 429 || response.status >= 500) notBefore.set(endpoint, Date.now() + pauseFor(response, retryDelayMs));
    } catch (error) {
      // The caller's own abort ends everything; a timeout, a dropped connection or a bad answer
      // only ends this server's turn.
      if (signal?.aborted) throw error;
    } finally {
      attempt.done();
    }
  }
  throw new OverpassUnavailable();
}
