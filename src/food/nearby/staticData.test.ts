// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { boxCoverage, osmResponse, osmRow, osmTestData, type OsmTestData } from '../test/osm';

vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

const WARSAW = boxCoverage(51.5, 20, 53, 22);
const ROWS = Array.from({ length: 12 }, (_, k) =>
  osmRow(`n${k + 1}`, 52.2297 + k * 0.004, 21.0122, { amenity: 'restaurant', name: `Lokal ${k + 1}` }),
);

let data: OsmTestData;
let requests: string[];
let respond: (url: string) => Promise<Response>;

/** A fresh module each test: its memory (index, leaves) must not carry over. */
async function load() {
  vi.resetModules();
  return import('./staticData');
}

/** A Cache Storage on a Map: enough of it for the leaves' fallback and tidying. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      keys: async () => [...store.keys()].map((url) => new Request(url)),
      match: async (r: Request | string) => store.get(typeof r === 'string' ? r : r.url)?.clone(),
      put: async (r: Request | string, response: Response) => void store.set(typeof r === 'string' ? r : r.url, response),
      delete: async (r: Request | string) => store.delete(typeof r === 'string' ? r : r.url),
    };
  };
  return { stores, open };
}

beforeEach(() => {
  data = osmTestData(ROWS, WARSAW, 4);
  requests = [];
  respond = async (url) => osmResponse(data, url) ?? new Response('?', { status: 500 });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url);
      return respond(url);
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the app’s own OSM data', () => {
  test('the index is read once per page; a leaf is fetched once however many ask, then known at once', async () => {
    const s = await load();
    const index = await s.loadIndex();
    await s.loadIndex();
    expect(requests.filter((u) => u.endsWith('index.json'))).toHaveLength(1);
    const [leaf] = s.leafRefs(index);
    expect(s.leafNow(leaf!)).toBeUndefined();
    const [a, b] = await Promise.all([s.loadLeaf(leaf!), s.loadLeaf(leaf!)]);
    expect(a).toBe(b);
    expect(requests.filter((u) => u.includes('/t/'))).toHaveLength(1);
    expect(s.leafNow(leaf!)?.elements.length).toBe(leaf!.rows);
    expect(s.leafNow(leaf!)?.elements[0]).toMatchObject({ type: 'node', tags: { amenity: 'restaurant' } });
  });

  test('a leaf gone after a deploy (404) re-reads the index past the service worker and says „moved”', async () => {
    const s = await load();
    const index = await s.loadIndex();
    const [leaf] = s.leafRefs(index);
    data.files.clear();
    await expect(s.loadLeaf(leaf!)).rejects.toMatchObject({ kind: 'moved' });
    await vi.waitFor(() => expect(requests.some((u) => /index\.json\?r=\d+/.test(u))).toBe(true));
  });

  test('a network failure is tried once more, then reported as „network”', async () => {
    vi.useFakeTimers();
    const s = await load();
    const index = await s.loadIndex();
    const [leaf] = s.leafRefs(index);
    respond = async () => {
      throw new TypeError('Failed to fetch');
    };
    const loading = s.loadLeaf(leaf!);
    const failed = expect(loading).rejects.toMatchObject({ kind: 'network' });
    await vi.advanceTimersByTimeAsync(2500);
    await failed;
    expect(requests.filter((u) => u.includes('/t/'))).toHaveLength(2);
  });

  test('offline after a data update: an older version of the same cell on the device stands in, marked older', async () => {
    vi.useFakeTimers();
    const caches = fakeCaches();
    vi.stubGlobal('caches', caches);
    const s = await load();
    const index = await s.loadIndex();
    const [leaf] = s.leafRefs(index);
    // The device kept this cell from the previous version (another hash in the file name).
    const oldUrl = new URL(`data/osm/v1/t/${leaf!.d}-${leaf!.i}-${leaf!.j}.0123456789.json.gz`, document.baseURI).href;
    const json = [...data.files.values()][0]!;
    await (await caches.open('gt-osm')).put(oldUrl, new Response(json));
    respond = async () => {
      throw new TypeError('Failed to fetch');
    };
    const loading = s.loadLeaf(leaf!);
    await vi.advanceTimersByTimeAsync(2500);
    const loaded = await loading;
    expect(loaded.older).toBe(true);
    expect(loaded.elements.length).toBeGreaterThan(0);
  });

  test('a broken copy is thrown away and fetched again, once; the fresh one tidies older versions of the cell', async () => {
    const caches = fakeCaches();
    vi.stubGlobal('caches', caches);
    const s = await load();
    const index = await s.loadIndex();
    const [leaf] = s.leafRefs(index);
    const cache = await caches.open('gt-osm');
    const oldUrl = new URL(`data/osm/v1/t/${leaf!.d}-${leaf!.i}-${leaf!.j}.0123456789.json.gz`, document.baseURI).href;
    await cache.put(oldUrl, new Response('{}'));
    let first = true;
    respond = async (url) => {
      if (url.includes('/t/') && first) {
        first = false;
        return new Response('{"f":1,"cut off');
      }
      return osmResponse(data, url)!;
    };
    const loaded = await s.loadLeaf(leaf!);
    expect(loaded.older).toBe(false);
    expect(requests.filter((u) => u.includes('/t/'))).toHaveLength(2);
    await vi.waitFor(async () => expect(await cache.match(oldUrl)).toBeUndefined());
  });

  test('the leaves on screen are pinned: the memory makes room by dropping others, never those', async () => {
    data = osmTestData(
      Array.from({ length: 130 }, (_, k) => osmRow(`n${k + 1}`, 52 + k * 0.01, 21, { amenity: 'cafe', name: `Kawiarnia ${k + 1}` })),
      WARSAW,
      1,
    );
    const s = await load();
    const refs = s.leafRefs(await s.loadIndex());
    expect(refs.length).toBeGreaterThan(s.MEMORY_LEAVES);
    const onScreen = refs.slice(0, 10);
    const release = s.pinLeaves(onScreen);
    for (const leaf of refs) await s.loadLeaf(leaf);
    expect(onScreen.every((leaf) => s.leafNow(leaf))).toBe(true);
    // Unpinned leaves loaded first made room; the most recent ones are kept.
    expect(s.leafNow(refs[20]!)).toBeUndefined();
    expect(s.leafNow(refs.at(-1)!)).toBeDefined();
    release();
  });

  test('an index the app cannot read means „unavailable” (Overpass answers instead), not a crash', async () => {
    respond = async () => new Response(JSON.stringify({ f: 2 }), { headers: { 'content-type': 'application/json' } });
    const s = await load();
    await expect(s.loadIndex()).rejects.toMatchObject({ kind: 'unavailable' });
    // The next ask tries again.
    respond = async (url) => osmResponse(data, url)!;
    await expect(s.loadIndex()).resolves.toMatchObject({ f: 1 });
  });
});
