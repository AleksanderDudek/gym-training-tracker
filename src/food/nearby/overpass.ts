import { text } from '../../i18n';
import { storeKey } from '../lib/stores';
import type { LatLon, Shop } from './types';

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

/** One request may take this long before the next server is tried. */
const REQUEST_TIMEOUT_MS = 30_000;

const SHOP_TYPES = ['supermarket', 'convenience', 'discount', 'grocery'];

export class OverpassUnavailable extends Error {
  constructor() {
    super(text({ pl: 'Serwer map (OpenStreetMap) jest teraz przeciążony.', en: 'The map server (OpenStreetMap) is overloaded right now.' }));
    this.name = 'OverpassUnavailable';
  }
}

/**
 * Cash & carry halls of the chains with product data (OpenStreetMap tags them `shop=wholesale`):
 * named by brand, so a builders' merchant or a furniture wholesaler stays out.
 */
const WHOLESALE_BRANDS = ['Selgros', 'Makro'];

/** Food shops around a point; `out center` gives buildings (ways) a position too. */
export function buildQuery(center: LatLon, radius: number): string {
  const around = `around:${Math.round(radius)},${center.lat},${center.lon}`;
  return (
    `[out:json][timeout:25];(` +
    `nwr["shop"~"^(${SHOP_TYPES.join('|')})$"](${around});` +
    `nwr["shop"="wholesale"]["brand"~"^(${WHOLESALE_BRANDS.join('|')})",i](${around});` +
    `);out center tags;`
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

export function address(tags: Record<string, string>): string | null {
  const street = tags['addr:street'] ?? tags['addr:place'];
  if (!street) return null;
  return [street, tags['addr:housenumber']].filter(Boolean).join(' ');
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
  const elements = elementsOf(json);

  const seen = new Set<string>();
  const shops: Shop[] = [];
  for (const element of elements) {
    const id = `${element.type}/${element.id}`;
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    // A chain is named by its brand tag; an independent shop only by its name.
    const raw = tags.brand ?? tags.name;
    if (seen.has(id) || lat === undefined || lon === undefined || !raw) continue;
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
  retryDelayMs?: number;
  timeoutMs?: number;
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
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}

/**
 * Asks each server in turn, then the first once more after a pause. A
 * response counts only if it is Overpass JSON: the busy servers answer with an
 * HTML page, sometimes with status 200.
 *
 * The request is a form POST with no headers set, a "simple" request: a
 * preflight OPTIONS is refused by Overpass (406), so a JSON body would fail in
 * the browser before it was ever sent.
 */
export function fetchShops(center: LatLon, radius: number, options: FetchOptions = {}): Promise<Shop[]> {
  return fetchOverpass(buildQuery(center, radius), parseShops, options);
}

/** One Overpass question with the servers' fallbacks; `parse` turns the JSON into the answer or throws. */
export async function fetchOverpass<T>(query: string, parse: (json: unknown) => T, options: FetchOptions = {}): Promise<T> {
  const {
    signal,
    fetchImpl = fetch,
    endpoints = OVERPASS_ENDPOINTS,
    retryDelayMs = 2000,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options;
  const body = new URLSearchParams({ data: query });
  const attempts = [...endpoints, ...endpoints.slice(0, 1)];

  for (const [i, endpoint] of attempts.entries()) {
    if (i === attempts.length - 1 && retryDelayMs > 0) await sleep(retryDelayMs, signal);
    const attempt = withTimeout(signal, timeoutMs);
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', body, signal: attempt.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) continue;
      return parse(await response.json());
    } catch (error) {
      // The caller's own abort ends everything; a timeout or a bad answer
      // only ends this server's turn.
      if (signal?.aborted) throw error;
    } finally {
      attempt.done();
    }
  }
  throw new OverpassUnavailable();
}
