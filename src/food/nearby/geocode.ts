import { LANG, text, type Lang } from '../../i18n';

/**
 * The public Nominatim server. Its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/) allows at most one request a second,
 * requires caching, and forbids search-as-you-type: `geocode` is called only when the user
 * submits a search, and enforces the other two itself.
 */
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** "An absolute maximum of 1 request per second." */
const MIN_GAP_MS = 1000;
/** Nominatim answers in well under a second; a request hanging this long is not coming back. */
const REQUEST_TIMEOUT_MS = 15_000;
/** Shorter queries match half the country. */
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 5;
const CACHE_SIZE = 50;

export interface GeoHit {
  label: string;
  lat: number;
  lon: number;
}

export class GeocodeUnavailable extends Error {
  constructor() {
    super(
      text({
        pl: 'Wyszukiwarka adresów (OpenStreetMap) nie odpowiada.',
        en: 'The address search (OpenStreetMap) isn’t responding.',
      }),
    );
    this.name = 'GeocodeUnavailable';
  }
}

interface GeocodeOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  lang?: Lang;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * When the latest request went out, or is booked to: each call books the next free second before
 * it waits, so two searches started together still go out a second apart.
 */
let lastRequestAt = Number.NEGATIVE_INFINITY;

/** "Clients sending repeatedly the same query may be classified as faulty and blocked." */
const cache = new Map<string, GeoHit[]>();

function remember(key: string, hits: GeoHit[]): void {
  cache.delete(key);
  cache.set(key, hits);
  const oldest = cache.keys().next().value;
  if (cache.size > CACHE_SIZE && oldest !== undefined) cache.delete(oldest);
}

/** Nominatim sends coordinates as strings; `Number('')` would be 0, a point off Africa. */
function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** "Pałac Kultury i Nauki, 1, plac Defilad, Śródmieście, Warszawa, …, Polska" -> its first three parts. */
function shortLabel(displayName: string): string {
  return displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
}

/** Nominatim JSON -> hits; throws on anything but a list. One place listed twice (a node and its building) shows once. */
function parseHits(json: unknown): GeoHit[] {
  if (!Array.isArray(json)) throw new Error('Not a Nominatim response');
  const seen = new Set<string>();
  const hits: GeoHit[] = [];
  for (const entry of json as unknown[]) {
    const place = entry as { lat?: unknown; lon?: unknown; display_name?: unknown } | null;
    const lat = coordinate(place?.lat, 90);
    const lon = coordinate(place?.lon, 180);
    const name = place?.display_name;
    if (lat === null || lon === null || typeof name !== 'string') continue;
    const label = shortLabel(name);
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (!label || seen.has(key)) continue;
    seen.add(key);
    hits.push({ label, lat, lon });
  }
  return hits;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Waits out the gap, but a search the user replaced or left ends at once, not a second later. */
function pause(ms: number, sleep: (ms: number) => Promise<void>, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal!.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    sleep(ms)
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener('abort', onAbort));
  });
}

/** A signal that fires on the caller's abort OR after `ms`. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), ms);
  const onAbort = () => controller.abort(signal!.reason);
  if (signal?.aborted) onAbort();
  signal?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * Places matching an address or a name, at most five. A plain GET with no headers set, a "simple"
 * CORS request: the browser's Referer identifies the app, which the policy accepts.
 */
export async function geocode(query: string, options: GeocodeOptions = {}): Promise<GeoHit[]> {
  const { signal, fetchImpl = fetch, lang = LANG, now = Date.now, sleep = defaultSleep } = options;
  const q = query.trim().replace(/\s+/g, ' ');
  if (q.length < MIN_QUERY_LENGTH) return [];
  const key = `${lang}|${q.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return [...cached];
  if (signal?.aborted) throw signal.reason;

  const t = now();
  const slot = Math.max(t, lastRequestAt + MIN_GAP_MS);
  lastRequestAt = slot;
  await pause(slot - t, sleep, signal);
  if (signal?.aborted) throw signal.reason;

  const params = new URLSearchParams({ format: 'jsonv2', limit: String(RESULT_LIMIT), q, 'accept-language': lang });
  const attempt = withTimeout(signal, REQUEST_TIMEOUT_MS);
  let hits: GeoHit[];
  try {
    const response = await fetchImpl(`${NOMINATIM_URL}?${params}`, { signal: attempt.signal });
    if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
    hits = parseHits(await response.json());
  } catch (error) {
    // The caller's own abort is theirs to handle; a timeout, a refusal or a bad answer is ours.
    if (signal?.aborted) throw error;
    throw new GeocodeUnavailable();
  } finally {
    attempt.done();
  }
  remember(key, hits);
  return [...hits];
}
