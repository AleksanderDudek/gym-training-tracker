import { describe, expect, test, vi } from 'vitest';
import { covers, pruneCache, readCache, readFallback, writeCache, type ShopCache } from './cache';
import { distanceMeters, formatDistance } from './geo';
import { OVERPASS_ENDPOINTS, OverpassUnavailable, buildQuery, fetchShops, parseShops, pauseFor } from './overpass';
import { QUERY_MARGIN_M, queryCircle } from './query';
import { DEFAULT_RADIUS, RADIUS_STEPS, radiusLabel, snapRadius } from './radius';
import { placeShops, summarizeChains } from './summary';
import { nearbyFromParams, nearbyToParams } from './url';

const PKIN = { lat: 52.2318, lon: 21.006 }; // Pałac Kultury
const OLD_TOWN = { lat: 52.2497, lon: 21.0122 };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('geo', () => {
  test('distance on the sphere', () => {
    expect(distanceMeters(PKIN, OLD_TOWN)).toBeGreaterThan(2015);
    expect(distanceMeters(PKIN, OLD_TOWN)).toBeLessThan(2050);
    expect(distanceMeters(PKIN, PKIN)).toBe(0);
  });

  test('metres under a kilometre, kilometres with a decimal comma above', () => {
    expect(plain(formatDistance(347))).toBe('350 m');
    expect(plain(formatDistance(1234))).toBe('1,2 km');
    expect(plain(formatDistance(12400))).toBe('12 km');
  });
});

describe('radius', () => {
  test('steps run from 500 m to 10 km and the default is one of them', () => {
    expect(RADIUS_STEPS[0]).toBe(500);
    expect(RADIUS_STEPS.at(-1)).toBe(10000);
    expect(RADIUS_STEPS).toContain(DEFAULT_RADIUS);
  });

  test('any number snaps to the nearest step, garbage to the default', () => {
    expect(snapRadius(1200)).toBe(1000);
    expect(snapRadius(99999)).toBe(10000);
    expect(snapRadius(0)).toBe(500);
    expect(snapRadius(Number.NaN)).toBe(DEFAULT_RADIUS);
  });

  test('labels', () => {
    expect(plain(radiusLabel(500))).toBe('500 m');
    expect(plain(radiusLabel(1500))).toBe('1,5 km');
    expect(plain(radiusLabel(10000))).toBe('10 km');
  });
});

const OVERPASS = {
  version: 0.6,
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 52.232,
      lon: 21.0062,
      tags: {
        shop: 'supermarket',
        brand: 'Biedronka',
        name: 'Biedronka',
        'addr:street': 'Marszałkowska',
        'addr:housenumber': '10',
        opening_hours: 'Mo-Sa 06:00-23:00',
      },
    },
    { type: 'way', id: 2, center: { lat: 52.233, lon: 21.007 }, tags: { shop: 'convenience', name: 'Żabka' } },
    { type: 'node', id: 3, lat: 52.24, lon: 21.01, tags: { shop: 'convenience', name: 'Sklep u Ani' } },
    { type: 'node', id: 4, lat: 52.23, lon: 21.0, tags: { shop: 'supermarket' } },
    { type: 'node', id: 1, lat: 52.232, lon: 21.0062, tags: { shop: 'supermarket', brand: 'Biedronka' } },
  ],
};

describe('overpass', () => {
  test('the query asks for food shops around a point, with centres for buildings', () => {
    const q = buildQuery(PKIN, 1500);
    expect(q).toContain('[out:json]');
    expect(q).toContain('around:1500,52.2318,21.006');
    // Środki budynków; `qt` oszczędza serwerowi sortowania po numerach.
    expect(q).toContain('out tags center qt;');
    expect(q).toMatch(/supermarket\|convenience/);
    // Hale Selgrosa i Makro: hurtownie, ale tylko tych marek.
    expect(q).toContain('nwr["shop"="wholesale"]["brand"~"^(Selgros|Makro)",i](around:1500,52.2318,21.006);');
  });

  test('shops are read from nodes and from ways via their centre; the chain comes from brand, else name', () => {
    const shops = parseShops(OVERPASS);
    expect(shops.map((s) => [s.id, s.chain])).toEqual([
      ['node/1', 'biedronka'],
      ['way/2', 'zabka'],
      ['node/3', 'sklep-u-ani'],
    ]);
    expect(shops[0]).toMatchObject({
      name: 'Biedronka',
      address: 'Marszałkowska 10',
      openingHours: 'Mo-Sa 06:00-23:00',
      lat: 52.232,
      lon: 21.0062,
    });
  });

  test('a shop with neither brand nor name is skipped; a repeated element once', () => {
    expect(parseShops(OVERPASS).map((s) => s.id)).not.toContain('node/4');
    expect(parseShops(OVERPASS).filter((s) => s.id === 'node/1')).toHaveLength(1);
  });

  test('anything that is not Overpass JSON is refused', () => {
    expect(() => parseShops('<html>')).toThrow();
    expect(() => parseShops({ nope: true })).toThrow();
  });

  test('fetch: an HTML error page is a failure even with status 200, and the next server is tried', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html>busy</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(OVERPASS), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    const shops = await fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 0 });
    expect(shops).toHaveLength(3);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://b']);
  });

  test('fetch: a simple form POST, so the browser sends no preflight (Overpass refuses OPTIONS)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(OVERPASS), { headers: { 'content-type': 'application/json' } }));
    await fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a'] });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect(init.headers).toBeUndefined();
  });

  test('fetch: every server failing, each asked twice in turn, is OverpassUnavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('busy', { status: 504 }));
    await expect(
      fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 0 }),
    ).rejects.toBeInstanceOf(OverpassUnavailable);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://b', 'https://a', 'https://b']);
  });

  test('a busy server is asked again only after the pause it names (Retry-After), and the page is told', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response('at capacity', { status: 502, headers: { 'retry-after': '7' } }))
        .mockResolvedValueOnce(new Response('busy', { status: 504 }))
        .mockResolvedValueOnce(json(OVERPASS));
      const onWait = vi.fn();
      const done = fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 1000, onWait });
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      // Server a asked for 7 s; the turn comes back to it after them, not after the base second.
      expect(onWait).toHaveBeenCalledWith(7000);
      await vi.advanceTimersByTimeAsync(6900);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(200);
      expect(await done).toHaveLength(3);
      expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://b', 'https://a']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('pauses: Retry-After in seconds or as a date, capped at half a minute; without it, a refusal waits longest', () => {
    const now = Date.UTC(2026, 9, 23, 12, 0, 0);
    const with_ = (status: number, retryAfter?: string) =>
      new Response('', { status, headers: retryAfter ? { 'retry-after': retryAfter } : {} });
    expect(pauseFor(with_(503, '12'), 2000, now)).toBe(12_000);
    expect(pauseFor(with_(503, new Date(now + 9000).toUTCString()), 2000, now)).toBe(9000);
    expect(pauseFor(with_(429, '600'), 2000, now)).toBe(30_000);
    expect(pauseFor(with_(503, '0'), 2000, now)).toBe(2000);
    // Refused or rate-limited: half a minute, as the Overpass usage policy asks.
    expect(pauseFor(with_(429), 2000, now)).toBe(30_000);
    expect(pauseFor(with_(406), 2000, now)).toBe(30_000);
    expect(pauseFor(with_(504), 2000, now)).toBe(6000);
  });

  test('fetch: offline nothing is sent — the page waits for the connection', async () => {
    const fetchImpl = vi.fn();
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      await expect(fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a'] })).rejects.toMatchObject({ name: 'OverpassOffline' });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (online) Object.defineProperty(navigator, 'onLine', online);
      else delete (navigator as { onLine?: boolean }).onLine;
    }
  });

  test('fetch: a 406 refusal also leaves that server alone for a while', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('not acceptable', { status: 406 }))
      .mockResolvedValueOnce(json(OVERPASS));
    const onWait = vi.fn();
    expect(await fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 0, onWait })).toHaveLength(3);
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual(['https://a', 'https://b']);
  });

  test('fetch: everything ends within the budget, also when servers keep asking to wait', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockResolvedValue(new Response('slow down', { status: 429, headers: { 'retry-after': '30' } }));
      const done = fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 1000, budgetMs: 20_000 });
      const failed = expect(done).rejects.toBeInstanceOf(OverpassUnavailable);
      await vi.advanceTimersByTimeAsync(0);
      await failed;
      // Both asked once; a second round would start after the 30 s they named, past the budget.
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('an Overpass runtime error (a timeout, out of memory) is not an answer, even as JSON with status 200', () => {
    expect(() =>
      parseShops({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 26 seconds.' }),
    ).toThrow();
    expect(() =>
      parseShops({ elements: [], remark: 'runtime error: Query run out of memory using about 2048 MB of RAM.' }),
    ).toThrow();
    expect(parseShops({ elements: [], remark: 'nothing unusual' })).toEqual([]);
  });

  test('fetch: a runtime error moves on to the next server', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ elements: [], remark: 'runtime error: Query timed out' }))
      .mockResolvedValueOnce(json(OVERPASS));
    expect(
      await fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], retryDelayMs: 0 }),
    ).toHaveLength(3);
  });

  test('fetch: a server that never answers is given up on after the per-request timeout', async () => {
    const fetchImpl = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === 'https://b') return Promise.resolve(json(OVERPASS));
      return new Promise<Response>((_, reject) =>
        init!.signal!.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError'))),
      );
    });
    expect(
      await fetchShops(PKIN, 1000, {
        fetchImpl,
        endpoints: ['https://a', 'https://b'],
        retryDelayMs: 0,
        timeoutMs: 20,
      }),
    ).toHaveLength(3);
  });

  test('only servers we name to the user are used', () => {
    expect(OVERPASS_ENDPOINTS.map((u) => new URL(u).hostname)).toEqual(['overpass-api.de', 'overpass.private.coffee']);
  });

  test('fetch: an abort is passed through, not retried', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(
      fetchShops(PKIN, 1000, { fetchImpl, endpoints: ['https://a', 'https://b'], signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('summary', () => {
  const shops = parseShops(OVERPASS);
  const known = new Set(['biedronka', 'zabka']);

  test('only known chains inside the radius, nearest first; the rest are counted', () => {
    const placed = placeShops(shops, PKIN, 1000, known);
    expect(placed.known.map((s) => s.chain)).toEqual(['biedronka', 'zabka']);
    expect(placed.known[0]?.distance).toBeLessThan(50);
    expect(placed.otherCount).toBe(1);
    expect(placeShops(shops, PKIN, 100, known).known.map((s) => s.chain)).toEqual(['biedronka']);
  });

  test('the same shop mapped twice (a node and its building) counts once', () => {
    const twice = [...shops, { ...shops[0]!, id: 'way/99', lat: 52.23205, lon: 21.00625 }];
    expect(placeShops(twice, PKIN, 1000, known).known.filter((s) => s.chain === 'biedronka')).toHaveLength(1);
  });

  test('chains with their nearest shop and how many there are, nearest chain first', () => {
    const extra = [...shops, { ...shops[0]!, id: 'node/50', lat: 52.235, lon: 21.008 }];
    const summary = summarizeChains(placeShops(extra, PKIN, 1000, known).known);
    expect(summary.map((c) => [c.chain, c.count, c.nearest.id])).toEqual([
      ['biedronka', 2, 'node/1'],
      ['zabka', 1, 'way/2'],
    ]);
  });
});

describe('cache', () => {
  function memory(): ShopCache & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  }
  const shops = parseShops(OVERPASS);

  test('a wider answer covers a smaller radius at the same place', () => {
    const storage = memory();
    writeCache(storage, { ...PKIN, radius: 3000 }, shops, 1000);
    expect(readCache(storage, PKIN, 1000, 2000)).toHaveLength(3);
    expect(readCache(storage, PKIN, 5000, 2000)).toBeNull();
  });

  test('a nearby point is covered only if the circle still fits inside the cached one', () => {
    const storage = memory();
    writeCache(storage, { ...PKIN, radius: 1000 }, shops, 0);
    const fiftyMetresNorth = { lat: PKIN.lat + 0.00045, lon: PKIN.lon };
    expect(readCache(storage, fiftyMetresNorth, 900, 0)).not.toBeNull();
    expect(readCache(storage, fiftyMetresNorth, 1000, 0)).toBeNull();
    expect(readCache(storage, OLD_TOWN, 500, 0)).toBeNull();
  });

  test('entries are used without asking for a day', () => {
    const storage = memory();
    writeCache(storage, { ...PKIN, radius: 1000 }, shops, 0);
    expect(readCache(storage, PKIN, 1000, 25 * 3600 * 1000)).toBeNull();
  });

  test('entries past a week are removed, so a long trail of places does not stay on the device', () => {
    const storage = memory();
    const DAY = 24 * 3600 * 1000;
    writeCache(storage, { ...PKIN, radius: 1000 }, shops, 0);
    writeCache(storage, { ...OLD_TOWN, radius: 1000 }, shops, 6 * DAY);
    pruneCache(storage, 8 * DAY);
    expect(JSON.parse(storage.data.get('produkty-pl:shops')!)).toHaveLength(1);
  });

  test('fallback for a busy server: an older or smaller answer covering here, the most complete first, with its age', () => {
    const storage = memory();
    const DAY = 24 * 3600 * 1000;
    writeCache(storage, { ...PKIN, radius: 3000 }, shops, 0);
    writeCache(storage, { ...PKIN, radius: 1000 }, shops.slice(0, 1), 3 * DAY);
    // Two days later than the newest: no fresh answer for 2 km, but last week's 3 km one reaches further.
    expect(readCache(storage, PKIN, 2000, 5 * DAY)).toBeNull();
    const fallback = readFallback(storage, PKIN, 5 * DAY);
    expect(fallback).toMatchObject({ circle: { radius: 3000 }, fetchedAt: 0 });
    expect(fallback?.items).toHaveLength(3);
    // A point outside every kept circle has no fallback; neither has anything past a week.
    expect(readFallback(storage, { lat: 52.4, lon: 21.006 }, 5 * DAY)).toBeNull();
    expect(readFallback(storage, PKIN, 8 * DAY)).toMatchObject({ circle: { radius: 1000 }, fetchedAt: 3 * DAY });
    expect(readFallback(null, PKIN, 0)).toBeNull();
  });

  test('a full storage keeps the newest answers that fit, never the old ones in place of the new', () => {
    const data = new Map<string, string>();
    // Room for about one answer.
    const tight: ShopCache = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        if (v.length > 600) throw new DOMException('full', 'QuotaExceededError');
        data.set(k, v);
      },
    };
    writeCache(tight, { ...PKIN, radius: 1000 }, shops, 0);
    writeCache(tight, { ...OLD_TOWN, radius: 1000 }, shops, 1000);
    const kept = JSON.parse(data.get('produkty-pl:shops')!) as { lat: number }[];
    expect(kept.map((e) => e.lat)).toEqual([OLD_TOWN.lat]);
  });

  test('covers: one circle inside another', () => {
    expect(covers({ lat: PKIN.lat, lon: PKIN.lon, radius: 1000 }, PKIN, 1000)).toBe(true);
    expect(covers({ lat: PKIN.lat, lon: PKIN.lon, radius: 1000 }, OLD_TOWN, 100)).toBe(false);
  });

  test('a broken or missing storage is ignored, never thrown', () => {
    const broken: ShopCache = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(() => writeCache(broken, { ...PKIN, radius: 1000 }, shops, 0)).not.toThrow();
    expect(readCache(broken, PKIN, 1000, 0)).toBeNull();
    expect(readCache(null, PKIN, 1000, 0)).toBeNull();
  });
});

describe('url', () => {
  const base = { view: 'eat' as const, radius: DEFAULT_RADIUS, store: null, product: null, place: null, sort: 'best' as const, closed: false, unknown: false };

  test('view, radius, chain, product, place, sort and filters round-trip; the defaults write nothing', () => {
    const shops = { ...base, view: 'shops' as const, radius: 3000, store: 'lidl', product: '590' };
    expect(nearbyFromParams(nearbyToParams(shops))).toEqual(shops);
    const eat = { ...base, place: 'node/42', sort: 'protein' as const, closed: true, unknown: true };
    expect(nearbyFromParams(nearbyToParams(eat))).toEqual(eat);
    expect(nearbyToParams(eat).toString()).toBe('miejsce=node%2F42&sort=bialko&zamkniete=1&bez-danych=1');
    expect(nearbyToParams(base).toString()).toBe('');
  });

  test('without `widok` the link opens the view used last here', () => {
    expect(nearbyFromParams(new URLSearchParams(''), DEFAULT_RADIUS, 'shops').view).toBe('shops');
    expect(nearbyToParams({ ...base, view: 'shops' }, 'shops').toString()).toBe('');
    expect(nearbyFromParams(new URLSearchParams('widok=zjedz'), DEFAULT_RADIUS, 'shops').view).toBe('eat');
  });

  test('a radius off the steps is snapped; a missing one uses the fallback', () => {
    expect(nearbyFromParams(new URLSearchParams('r=1234')).radius).toBe(1000);
    expect(nearbyFromParams(new URLSearchParams(''), 5000).radius).toBe(5000);
  });

  test('the position is never part of the URL', () => {
    const keys = Object.keys(nearbyFromParams(new URLSearchParams('lat=52&lon=21')));
    expect(keys).not.toContain('lat');
    expect(keys).not.toContain('lon');
    expect(nearbyToParams(nearbyFromParams(new URLSearchParams('lat=52&lon=21'))).toString()).toBe('');
  });
});

describe('query circle', () => {
  test('the centre is rounded to about 100 m, so the exact position never leaves the device', () => {
    const q = queryCircle({ lat: 52.229712345, lon: 21.012298765 }, 1000);
    expect(q.lat).toBe(52.23);
    expect(q.lon).toBe(21.012);
  });

  test('the radius grows by a margin that covers the rounding and a short walk', () => {
    expect(queryCircle(PKIN, 1000).radius).toBe(1000 + QUERY_MARGIN_M);
  });

  test('the asked-for circle always fits inside the query circle, so the answer covers it', () => {
    for (const p of [{ lat: 52.22951, lon: 21.01249 }, { lat: 52.23049, lon: 21.01151 }, PKIN]) {
      const q = queryCircle(p, 1000);
      expect(covers(q, p, 1000)).toBe(true);
    }
  });

  test('moving 100 m stays within the same answer', () => {
    const q = queryCircle(PKIN, 1000);
    expect(covers(q, { lat: PKIN.lat + 0.0009, lon: PKIN.lon }, 1000)).toBe(true);
  });
});
