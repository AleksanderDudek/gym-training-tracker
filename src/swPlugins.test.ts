import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetTrail, fromAfterReset, withoutDateHeader } from './swPlugins';
// The service worker as text (`?raw`): the leaves' route must keep its copies without the date.
import swSource from './sw.ts?raw';

describe('a copy without its Date header', () => {
  it('loses the date only: status, status text, the other headers and the body stay as they came', async () => {
    const body = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 3, 250, 1]);
    const response = new Response(body, {
      status: 203,
      statusText: 'Non-Authoritative Information',
      headers: {
        Date: 'Fri, 24 Oct 2026 01:00:00 GMT',
        'Content-Type': 'application/gzip',
        ETag: '"5e67253ddd"',
        'Cache-Control': 'max-age=600',
      },
    });
    const kept = await withoutDateHeader.cacheWillUpdate({ response });
    expect(kept.headers.has('date')).toBe(false);
    expect(kept.status).toBe(203);
    expect(kept.statusText).toBe('Non-Authoritative Information');
    expect(Object.fromEntries(kept.headers)).toEqual({
      'content-type': 'application/gzip',
      etag: '"5e67253ddd"',
      'cache-control': 'max-age=600',
    });
    expect(new Uint8Array(await kept.arrayBuffer())).toEqual(body);
  });

  it('is what the service worker’s route for the OSM leaves uses', () => {
    const start = swSource.indexOf("cacheName: 'gt-osm',");
    const end = swSource.indexOf("cacheName: 'gt-osm-index',");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(swSource.slice(start, end)).toMatch(/\bwithoutDateHeader\b/);
    expect(swSource).toContain("import { forgetTrail, fromAfterReset, withoutDateHeader } from './swPlugins';");
  });
});

/** A Cache Storage on Maps: what Workbox and the reset use of it. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) => (typeof r === 'string' ? r : r.url);
  const cache = (store: Map<string, Response>) => ({
    match: async (r: Request | string) => store.get(key(r))?.clone(),
    put: async (r: Request | string, response: Response) => void store.set(key(r), new Response(await response.blob(), response)),
    delete: async (r: Request | string) => store.delete(key(r)),
    keys: async () => [...store.keys()].map((url) => new Request(url)),
  });
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return cache(store);
  };
  return {
    stores,
    open,
    delete: vi.fn(async (name: string) => stores.delete(name)),
    match: async (r: Request | string, options?: { cacheName?: string }) => stores.get(options?.cacheName ?? '')?.get(key(r))?.clone(),
    keys: async () => [...stores.keys()],
  };
}

/** One request's run through the plugin, as Workbox calls it: the same `state` for every callback. */
function request() {
  return { state: {} };
}

describe('nothing asked for before „Usuń wszystkie dane” is kept', () => {
  beforeEach(() => {
    vi.stubGlobal('caches', fakeCaches());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const forgetRows = () => Promise.resolve();

  it('an answer to a request that began before the reset is not kept, even when it comes after it; one that began after is', async () => {
    const before = request();
    await fromAfterReset.handlerWillStart(before);
    await forgetTrail(['gt-osm'], forgetRows);
    expect(await fromAfterReset.cacheWillUpdate({ response: new Response('leaf'), ...before })).toBeNull();

    const after = request();
    await fromAfterReset.handlerWillStart(after);
    const kept = await fromAfterReset.cacheWillUpdate({ response: new Response('leaf', { status: 200, headers: { etag: '"1"' } }), ...after });
    expect(await kept?.text()).toBe('leaf');
    expect(kept?.headers.get('etag')).toBe('"1"');
    await fromAfterReset.handlerDidComplete(after);
  });

  it('a reset while the body is still arriving: not kept either', async () => {
    const begun = request();
    await fromAfterReset.handlerWillStart(begun);
    let rest = () => {};
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('first half, '));
        rest = () => {
          stream.enqueue(new TextEncoder().encode('second half'));
          stream.close();
        };
      },
    });
    const checked = fromAfterReset.cacheWillUpdate({ response: new Response(body), ...begun });
    await forgetTrail(['gt-osm'], forgetRows);
    rest();
    expect(await checked).toBeNull();
  });

  it('a copy found by a request from before the reset is not used — nor marked as used; after the reset it is', async () => {
    const copy = new Response('tile');
    const before = request();
    await fromAfterReset.handlerWillStart(before);
    await forgetTrail(['osm-tiles'], forgetRows);
    expect(await fromAfterReset.cachedResponseWillBeUsed({ cachedResponse: copy, ...before })).toBeNull();
    const after = request();
    await fromAfterReset.handlerWillStart(after);
    expect(await fromAfterReset.cachedResponseWillBeUsed({ cachedResponse: copy, ...after })).toBe(copy);
  });

  it('the reset waits for a copy already let through to be written, then deletes the caches and what the expiration noted of them', async () => {
    const order: string[] = [];
    const store = caches as unknown as ReturnType<typeof fakeCaches>;
    store.delete.mockImplementation(async (name: string) => {
      order.push(`delete ${name}`);
      return true;
    });
    const writing = request();
    await fromAfterReset.handlerWillStart(writing);
    expect(await fromAfterReset.cacheWillUpdate({ response: new Response('leaf'), ...writing })).not.toBeNull();
    let forgotten = false;
    const reset = forgetTrail(['gt-osm', 'osm-tiles', 'off-images'], async (name) => void order.push(`rows ${name}`)).then(() => (forgotten = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Still being written (the copy, then its expiration row): nothing deleted yet.
    expect(forgotten).toBe(false);
    expect(order).toEqual([]);
    await fromAfterReset.handlerDidComplete(writing);
    await reset;
    expect(order).toEqual(['delete gt-osm', 'rows gt-osm', 'delete osm-tiles', 'rows osm-tiles', 'delete off-images', 'rows off-images']);
  });

  it('a cache or its rows that cannot be deleted do not stop the others', async () => {
    const store = caches as unknown as ReturnType<typeof fakeCaches>;
    store.delete.mockImplementation(async (name: string) => {
      if (name === 'gt-osm') throw new Error('busy');
      return true;
    });
    const rows = vi.fn(async (name: string) => {
      if (name === 'osm-tiles') throw new Error('blocked');
    });
    await expect(forgetTrail(['gt-osm', 'osm-tiles', 'off-images'], rows)).resolves.toBeUndefined();
    expect(store.delete.mock.calls.map(([name]) => name)).toEqual(['gt-osm', 'osm-tiles', 'off-images']);
    expect(rows.mock.calls.map(([name]) => name)).toEqual(['gt-osm', 'osm-tiles', 'off-images']);
  });
});

/**
 * The plugin with Workbox itself (the installed version), as the worker's leaves route has it: a
 * request's `state` must reach every callback, and the order of the plugins must keep a request from
 * before the reset out of both the copy and the expiration's rows.
 */
describe('with Workbox’s own CacheFirst and expiration', () => {
  const LEAF = 'https://app.example/kb/data/osm/v1/t/11-412-391.168d29f8c3.json.gz';

  class ExtendableEvent extends Event {
    promises: Promise<unknown>[] = [];
    waitUntil(promise: Promise<unknown>) {
      this.promises.push(promise);
    }
  }

  /** The expiration's rows of one cache, from Workbox's own database. */
  const rows = (cacheName: string) =>
    new Promise<string[]>((resolve) => {
      const open = indexedDB.open('workbox-expiration');
      // Not there yet: not created here either — Workbox would then find a database without its store.
      open.onupgradeneeded = () => open.transaction?.abort();
      open.onerror = () => resolve([]);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('cache-entries')) {
          db.close();
          return resolve([]);
        }
        const all = db.transaction('cache-entries').objectStore('cache-entries').getAll();
        all.onsuccess = () => {
          db.close();
          resolve((all.result as { cacheName: string; url: string }[]).filter((r) => r.cacheName === cacheName).map((r) => r.url));
        };
      };
    });

  let store: ReturnType<typeof fakeCaches>;

  beforeEach(() => {
    store = fakeCaches();
    vi.stubGlobal('caches', store);
    // A worker's globals, as far as Workbox reads them (its development logs off).
    vi.stubGlobal('self', globalThis);
    vi.stubGlobal('__WB_DISABLE_DEV_LOGS', true);
    vi.stubGlobal('location', new URL('https://app.example/kb/'));
    vi.stubGlobal('ExtendableEvent', ExtendableEvent);
    vi.stubGlobal('FetchEvent', class FetchEvent extends ExtendableEvent {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function leafRoute(cacheName: string) {
    const [{ CacheFirst }, { ExpirationPlugin }, { CacheableResponsePlugin }] = await Promise.all([
      import('workbox-strategies'),
      import('workbox-expiration'),
      import('workbox-cacheable-response'),
    ]);
    return new CacheFirst({
      cacheName,
      plugins: [new CacheableResponsePlugin({ statuses: [200] }), fromAfterReset, new ExpirationPlugin({ maxEntries: 400 }), withoutDateHeader],
    });
  }

  /** The worker answers a page's request: the response, and the end of everything it does after. */
  function handle(strategy: Awaited<ReturnType<typeof leafRoute>>, url: string) {
    const [response, done] = strategy.handleAll({ event: new ExtendableEvent('fetch') as never, request: new Request(url) });
    return { response, done };
  }

  it('a leaf whose body was still arriving at the reset leaves neither a copy nor a row; the next request is kept again', async () => {
    const strategy = await leafRoute('gt-osm-a');
    let rest = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(stream) {
            stream.enqueue(new TextEncoder().encode('{"f":1,'));
            rest = () => {
              stream.enqueue(new TextEncoder().encode('"rows":[]}'));
              stream.close();
            };
          },
        });
        return new Response(body, { headers: { 'content-type': 'application/gzip' } });
      }),
    );
    const before = handle(strategy, LEAF);
    await before.response;
    await forgetTrail(['gt-osm-a'], async () => {});
    rest();
    await before.done;
    expect(store.stores.get('gt-osm-a')?.size ?? 0).toBe(0);
    expect(await rows('gt-osm-a')).toEqual([]);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"f":1,"rows":[]}', { headers: { date: 'Fri, 24 Oct 2026 01:00:00 GMT' } })));
    const after = handle(strategy, LEAF);
    await after.response;
    await after.done;
    expect([...(store.stores.get('gt-osm-a')?.keys() ?? [])]).toEqual([LEAF]);
    expect(store.stores.get('gt-osm-a')?.get(LEAF)?.headers.has('date')).toBe(false);
    expect(await rows('gt-osm-a')).toEqual([LEAF]);
  });

  it('a copy found by a request that began before the reset: answered from the network, nothing noted as used', async () => {
    const strategy = await leafRoute('gt-osm-b');
    await (await store.open('gt-osm-b')).put(LEAF, new Response('copy'));
    let lookedUp = () => {};
    const looked = new Promise<void>((resolve) => (lookedUp = resolve));
    // The reset comes while the worker is looking for the copy.
    const match = store.match;
    store.match = async (r, options) => {
      await looked;
      return match(r, options);
    };
    const network = vi.fn(async () => new Response('fresh'));
    vi.stubGlobal('fetch', network);
    const before = handle(strategy, LEAF);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await forgetTrail(['other-cache'], async () => {});
    lookedUp();
    expect(await (await before.response).text()).toBe('fresh');
    await before.done;
    expect(network).toHaveBeenCalledTimes(1);
    expect(await rows('gt-osm-b')).toEqual([]);
  });
});

describe('the worker’s side of the reset in `sw.ts`', () => {
  /** A route's block in the worker, from its cache name to the next route. */
  const route = (cacheName: string) => {
    const at = swSource.indexOf(`cacheName: '${cacheName}'`);
    expect(at).toBeGreaterThan(-1);
    const end = swSource.indexOf('registerRoute(', at);
    return swSource.slice(at, end < 0 ? undefined : end);
  };

  it.each(['gt-osm', 'osm-tiles', 'off-images'])('the %s route keeps nothing from before a reset: after the 200 filter, before the expiration', (cacheName) => {
    const block = route(cacheName);
    const filter = block.indexOf('new CacheableResponsePlugin(');
    const guard = block.indexOf('fromAfterReset');
    const expiration = block.indexOf('new ExpirationPlugin(');
    expect(filter).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(filter);
    expect(expiration).toBeGreaterThan(guard);
  });

  it('the shared copies (products, shop chunk, OSM index, scanner) keep theirs: they say nothing about the person', () => {
    for (const cacheName of ['gt-food-data', 'gt-shop-data', 'gt-osm-index', 'gt-scanner']) expect(route(cacheName)).not.toContain('fromAfterReset');
  });

  it('the page’s message is handled with the trail caches, Workbox’s own rows deleted, and a reply when done', () => {
    expect(swSource).toMatch(/event\.data\?\.type === 'FORGET_TRAIL'/);
    expect(swSource).toMatch(/event\.waitUntil\(\s*(?:\/\/[^\n]*\n\s*)*forgetTrail\(TRAIL, \(name\) => new CacheExpiration\(name, \{ maxEntries: 1 \}\)\.delete\(\)\)/);
    expect(swSource).toMatch(/reply\?\.postMessage\('done'\)/);
  });
});
