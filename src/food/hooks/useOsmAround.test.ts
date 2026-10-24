// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { aroundNotes } from '../components/nearby/aroundText';
import { SHOPS_KEY } from '../nearby/cache';
import { OSM_KEY } from '../nearby/live';
import { roundingMargin } from '../nearby/osmGrid';
import { __resetStaticData } from '../nearby/staticData';
import type { LatLon } from '../nearby/types';
import { boxCoverage, osmResponse, osmRow, osmTestData, type OsmTestData } from '../test/osm';
import { AUTO_RETRY_MS } from './useNearbyShops';
import { useOsmAround, type OsmState } from './useOsmAround';

vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

// Overpass's tries without pauses (a busy server fails at once) unless a test gives the pauses back,
// and how many searches were asked.
const overpassSearches = vi.hoisted(() => ({ count: 0, retryDelayMs: 0 }));
vi.mock('../nearby/live', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nearby/live')>();
  return {
    ...actual,
    fetchOsm: (...[center, radius, options]: Parameters<typeof actual.fetchOsm>) => {
      overpassSearches.count++;
      return actual.fetchOsm(center, radius, { ...options, retryDelayMs: overpassSearches.retryDelayMs });
    },
  };
});

const WARSAW = { lat: 52.2297, lon: 21.0122 };
const POLAND = boxCoverage(49, 14.2, 54.8, 24.1);
const ROWS = [
  osmRow('n1', 52.2297, 21.0122, { amenity: 'fast_food', name: 'Bar' }),
  osmRow('n2', 52.2317, 21.0122, { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka' }),
];
/** What Overpass knows around Warsaw. */
const OVERPASS = { elements: [{ type: 'node', id: 3, lat: 52.2299, lon: 21.0122, tags: { amenity: 'fast_food', name: 'Bar Live' } }] };

/** The coverage ends at 52.6 N (300 m simplification). */
const BORDER = boxCoverage(51.5, 20, 52.6, 22);
/** The rounded circle with its margin touches the edge, so Overpass is asked; the exact 1 km circle is inside the data. */
const NEAR_BORDER = { lat: 52.588, lon: 21.0122 };
/** The 1 km circle itself crosses the edge: the app's data is complete within ~810 m. */
const AT_BORDER = { lat: 52.59, lon: 21.0122 };
const BORDER_ROWS = [
  ...Array.from({ length: 5 }, (_, k) =>
    osmRow(`n${k + 1}`, NEAR_BORDER.lat - 0.004 + k * 0.0015, NEAR_BORDER.lon, { amenity: 'restaurant', name: `Lokal ${k + 1}` }),
  ),
  osmRow('n9', NEAR_BORDER.lat + 0.001, NEAR_BORDER.lon, { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka' }),
];
/** What Overpass knows around the border position: a place on the Polish side and one across the edge. */
const ACROSS = {
  elements: [
    { type: 'node', id: 31, lat: AT_BORDER.lat - 0.002, lon: AT_BORDER.lon, tags: { amenity: 'restaurant', name: 'Lokal PL' } },
    { type: 'node', id: 32, lat: AT_BORDER.lat + 0.008, lon: AT_BORDER.lon, tags: { amenity: 'restaurant', name: 'Za granicą' } },
  ],
};
const DAY = 24 * 3600 * 1000;

let data: OsmTestData;
let index: 'ok' | 'offline' | '503';
let leaves: 'ok' | 'offline' | '503' | 'hold';
/**
 * `hold`: a busy server that answers nothing until the search is called off; `slow`: a busy but
 * working one, its answer (`ACROSS`) 20 s after the request; `empty`: nothing around.
 */
let overpass: 'ok' | '504' | 'hold' | 'slow' | 'empty';
let requests: string[];
/** Overpass requests called off before their answer. */
let aborted: number;
let held: (() => void)[];

beforeEach(() => {
  vi.useFakeTimers();
  __resetStaticData();
  window.localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  data = osmTestData(ROWS, POLAND, 3);
  index = 'ok';
  leaves = 'ok';
  overpass = 'ok';
  requests = [];
  aborted = 0;
  held = [];
  overpassSearches.count = 0;
  overpassSearches.retryDelayMs = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(url);
      if (url.includes('overpass')) {
        if (overpass === '504') return new Response('<html>busy</html>', { status: 504 });
        const json = (body: object) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
        if (overpass === 'hold' || overpass === 'slow')
          return new Promise<Response>((ok, fail) => {
            let answered = false;
            const answer =
              overpass === 'slow'
                ? setTimeout(() => {
                    answered = true;
                    ok(json(ACROSS));
                  }, 20_000)
                : undefined;
            init?.signal?.addEventListener('abort', () => {
              if (answered) return;
              aborted++;
              clearTimeout(answer);
              fail(new DOMException('aborted', 'AbortError'));
            });
          });
        return json(overpass === 'empty' ? { elements: [] } : OVERPASS);
      }
      const isIndex = url.includes('index.json');
      if (isIndex && index === 'offline') throw new TypeError('Failed to fetch');
      if (isIndex && index === '503') return new Response('busy', { status: 503 });
      if (!isIndex && leaves === 'offline') throw new TypeError('Failed to fetch');
      if (!isIndex && leaves === '503') return new Response('busy', { status: 503 });
      if (!isIndex && leaves === 'hold') await new Promise<void>((go) => held.push(go));
      return osmResponse(data, url) ?? new Response('?', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Back to jsdom's own getter, if a test went offline.
  delete (navigator as { onLine?: boolean }).onLine;
});

/** Lets time pass in small steps (see `useStaticAround.test.ts`). */
async function settle(ms = 1000, step = Math.min(250, Math.max(20, Math.floor(ms / 10)))) {
  for (let passed = 0; passed < ms; passed += step) await act(() => vi.advanceTimersByTimeAsync(step));
}

const mount = (position: LatLon) => renderHook(() => useOsmAround({ status: 'ready', position, source: 'gps' }, 1000));
const names = (state: OsmState) => state.items.map((e) => e.tags?.name).sort();
const asked = (what: 'index' | 'overpass') => requests.filter((u) => u.includes(what === 'index' ? 'index.json' : 'overpass')).length;

describe('useOsmAround', () => {
  test('no index (the connection failing): Overpass stands in; the button reads the index again, and the app’s data takes over', async () => {
    index = 'offline';
    const { result } = mount(WARSAW);
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready' });
    expect(names(result.current[0])).toEqual(['Bar Live']);
    const before = asked('index');
    index = 'ok';
    act(() => result.current[1]());
    await settle();
    expect(asked('index')).toBe(before + 1);
    expect(result.current[0]).toMatchObject({ source: 'static', status: 'ready', coverage: 'full' });
    expect(names(result.current[0])).toEqual(['Bar', 'Biedronka']);
  });

  test('the button after both failed tries both: the index and Overpass', async () => {
    index = 'offline';
    overpass = '504';
    const { result } = mount(WARSAW);
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'error' });
    const before = { index: asked('index'), overpass: asked('overpass') };
    act(() => result.current[1]());
    await settle();
    expect(asked('index')).toBe(before.index + 1);
    expect(asked('overpass')).toBeGreaterThan(before.overpass);
  });

  test('one 503 on the index: Overpass stands in, the index is read again by itself after 30 s, and the app’s data takes over', async () => {
    index = '503';
    const { result } = mount(WARSAW);
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready' });
    expect(names(result.current[0])).toEqual(['Bar Live']);
    index = 'ok';
    await settle(AUTO_RETRY_MS[0]!);
    expect(asked('index')).toBe(2);
    expect(result.current[0]).toMatchObject({ source: 'static', status: 'ready', coverage: 'full' });
    expect(names(result.current[0])).toEqual(['Bar', 'Biedronka']);
    expect(asked('overpass')).toBe(1);
  });

  test('the app’s data coming back does not blank a ready Overpass answer: it stays, nothing asked again, until the data is ready', async () => {
    index = 'offline';
    const { result } = mount(WARSAW);
    await settle();
    expect(names(result.current[0])).toEqual(['Bar Live']);
    index = 'ok';
    leaves = 'hold';
    await settle(AUTO_RETRY_MS[0]!); // the index's automatic try
    expect(asked('index')).toBe(2);
    expect(held.length).toBeGreaterThan(0);
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready', coverage: 'full' });
    expect(names(result.current[0])).toEqual(['Bar Live']);
    leaves = 'ok';
    for (const go of held.splice(0)) go();
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'static', status: 'ready' });
    expect(names(result.current[0])).toEqual(['Bar', 'Biedronka']);
    expect(asked('overpass')).toBe(1);
  });

  test('…and while the leaves fail, the Overpass answer stays on screen instead of an empty error', async () => {
    index = 'offline';
    const { result } = mount(WARSAW);
    await settle();
    index = 'ok';
    leaves = 'offline';
    await settle(AUTO_RETRY_MS[0]! + 5000); // the index is back; each leaf tried twice, 2 s apart
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready', error: null });
    expect(names(result.current[0])).toEqual(['Bar Live']);
    expect(asked('overpass')).toBe(1);
  });

  test('…an empty Overpass answer for this place is an answer too: it stays until the app’s data is ready — no „Szukam…” flash in between', async () => {
    index = 'offline';
    overpass = 'empty';
    const { result } = mount(WARSAW);
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready', items: [] });
    index = 'ok';
    leaves = 'hold';
    await settle(AUTO_RETRY_MS[0]!); // the index's automatic try
    expect(asked('index')).toBe(2);
    expect(held.length).toBeGreaterThan(0);
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready', items: [] });
    leaves = 'ok';
    for (const go of held.splice(0)) go();
    await settle();
    // (The fixture's copy has places Overpass did not return: in real data only a place deleted since
    // the copy would differ.)
    expect(result.current[0]).toMatchObject({ source: 'static', status: 'ready' });
    expect(asked('overpass')).toBe(1);
  });

  test('…and an empty one stays too when the leaves then fail: a working answer is not traded for an error', async () => {
    index = 'offline';
    overpass = 'empty';
    const { result } = mount(WARSAW);
    await settle();
    index = 'ok';
    leaves = 'offline';
    await settle(AUTO_RETRY_MS[0]! + 5000);
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'ready', error: null, items: [] });
    expect(asked('overpass')).toBe(1);
  });

  test('…nor the answer of the place just left: moving to another rounding cell as the app’s data comes back asks Overpass nothing for it — wherever in the cell', async () => {
    // Two spots of the rounding cell 52.241: the circle Overpass answered around Warsaw (52.230,
    // 1250 m) still reaches the first, not the second.
    const visit = async (lat: number) => {
      __resetStaticData();
      window.localStorage.clear();
      requests = [];
      overpassSearches.count = 0;
      index = 'offline';
      leaves = 'ok';
      const { result, rerender, unmount } = renderHook(({ position }) => useOsmAround({ status: 'ready', position, source: 'gps' }, 1000), {
        initialProps: { position: WARSAW },
      });
      await settle();
      expect(names(result.current[0])).toEqual(['Bar Live']);
      // The app's server is back. The user moves 0.2 s before the index's automatic try, which brings
      // the index back inside the new place's settle time (0.4 s) — before its search would go out.
      index = 'ok';
      leaves = 'hold';
      await settle(AUTO_RETRY_MS[0]! - 1200, 100);
      rerender({ position: { lat, lon: WARSAW.lon } });
      await settle(1500, 20);
      const seen = { searches: overpassSearches.count, index: asked('index'), source: result.current[0].source, status: result.current[0].status };
      unmount();
      return seen;
    };
    const reached = await visit(52.2408);
    expect(reached).toEqual({ searches: 1, index: 2, source: 'static', status: 'loading' });
    expect(await visit(52.2414)).toEqual(reached);
  });

  test('a leaf the server fails is tried again by itself while Overpass stands in — without asking Overpass again each time', async () => {
    leaves = '503';
    overpass = '504';
    const { result } = mount(WARSAW);
    await settle(5 * 60_000, 500);
    // Every automatic try of the leaf ran…
    expect(requests.filter((u) => u.includes('/t/'))).toHaveLength(2 * (1 + AUTO_RETRY_MS.length));
    // …and Overpass kept its own pace: the first search and its own automatic tries, no more.
    expect(overpassSearches.count).toBe(1 + AUTO_RETRY_MS.length);
    expect(result.current[0]).toMatchObject({ source: 'live', status: 'error', retryAt: null });
  });

  test('a circle that only comes near the border: the app’s data is complete, so a failing Overpass costs nothing — ready, no error, the digest written', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    overpass = '504';
    const { result } = mount(NEAR_BORDER);
    await settle(3000);
    expect(asked('overpass')).toBeGreaterThan(0);
    expect(result.current[0]).toMatchObject({
      source: 'mixed',
      shown: 'static',
      coverage: 'partial',
      status: 'ready',
      completeWithin: 1000,
      error: null,
      retryAt: null,
      since: null,
      savedAt: null,
    });
    expect(result.current[0].items).toHaveLength(6);
    // The digest for the circle the app's data covers: the rounded position and its reach.
    const digest = JSON.parse(window.localStorage.getItem(SHOPS_KEY) ?? '[]') as { lat: number; lon: number; radius: number; shops: { name: string }[] }[];
    expect(digest).toHaveLength(1);
    expect(digest[0]).toMatchObject({ lat: 52.588, lon: 21.012, radius: 1000 + roundingMargin(52.588) });
    expect(digest[0]!.shops.map((s) => s.name)).toEqual(['Biedronka']);
  });

  test.each(['504', 'hold'] as const)(
    '…and an answer Overpass gave days ago does not replace the complete data while the new search fails or waits (%s)',
    async (mode) => {
      data = osmTestData(BORDER_ROWS, BORDER, 3);
      // Kept on the device, too old to skip asking: shown while a new search loads or after it fails.
      const saved = { type: 'node', id: 77, lat: 52.589, lon: 21.0122, tags: { amenity: 'restaurant', name: 'Saved' } };
      window.localStorage.setItem(OSM_KEY, JSON.stringify([{ lat: 52.588, lon: 21.012, radius: 1250, fetchedAt: Date.now() - 3 * DAY, shops: [saved] }]));
      overpass = mode;
      const { result } = mount(NEAR_BORDER);
      await settle(3000);
      expect(asked('overpass')).toBeGreaterThan(0);
      expect(result.current[0]).toMatchObject({
        source: 'mixed',
        shown: 'static',
        status: 'ready',
        completeWithin: 1000,
        error: null,
        savedAt: null,
        retryAt: null,
        since: null,
      });
      expect(names(result.current[0])).not.toContain('Saved');
    },
  );

  test('at the border, the Polish side failing offline (Overpass cannot be asked either): said in the app’s own words — no claim that the Polish side is on screen', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'offline'; // the index is cached, the area's leaves were never loaded
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const { result } = mount(AT_BORDER);
    await settle(3000); // each leaf tried twice, 2 s apart
    expect(result.current[0]).toMatchObject({
      source: 'static',
      shown: 'static',
      coverage: 'partial',
      status: 'error',
      items: [],
      error: 'Bez internetu nie mam jeszcze danych tej okolicy — pobiorę je, gdy wróci połączenie.',
      retryAt: null,
    });
    expect(aroundNotes(result.current[0], 'lokale', Date.now())).toEqual({ status: '', clock: null });
  });

  test('…and online while Overpass waits out a busy server’s pause: the same — the app’s data failed, retried by itself; the button tries it again, leaves Overpass’s search and its pause alone, and tries Overpass too once that search has failed', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'offline';
    overpass = '504';
    // The pauses as on the real servers: both answer 504 at once (0.4 s), each is asked again 6 s later.
    overpassSearches.retryDelayMs = 2000;
    const { result } = mount(AT_BORDER);
    await settle(3000);
    expect(result.current[0]).toMatchObject({
      source: 'static',
      shown: 'static',
      status: 'error',
      items: [],
      error: 'Nie udało się pobrać danych okolicy. Sprawdź połączenie z internetem.',
    });
    expect(result.current[0].retryAt).toBeGreaterThan(Date.now());
    expect(aroundNotes(result.current[0], 'lokale', Date.now()).status).toBe('');
    const before = { leaves: requests.filter((u) => u.includes('/t/')).length, overpass: asked('overpass') };
    expect(before.overpass).toBe(2);
    act(() => result.current[1]()); // 3 s: inside the pause, which ends at 6.4 s
    await settle(3000);
    expect(requests.filter((u) => u.includes('/t/')).length).toBeGreaterThan(before.leaves);
    expect(overpassSearches.count).toBe(1);
    expect(asked('overpass')).toBe(before.overpass);
    // The same search goes on after the pause, then fails (the second server at 8.4 s).
    await settle(3000);
    expect(asked('overpass')).toBe(before.overpass + 2);
    expect(overpassSearches.count).toBe(1);
    expect(result.current[0].status).toBe('error');
    act(() => result.current[1]());
    await settle(500);
    expect(overpassSearches.count).toBe(2);
  });

  test('at the border, pressing „Spróbuj ponownie” for the failed Polish side whenever it shows never calls off Overpass’s search: its one answer arrives and is shown', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'offline'; // the Polish side: a dropped connection
    overpass = 'slow'; // a busy but working server: its answer 20 s after the request
    const { result } = mount(AT_BORDER);
    let presses = 0;
    for (let passed = 0; passed < 30_000; passed += 100) {
      await settle(100, 100);
      if (result.current[0].status !== 'error') continue;
      presses++;
      act(() => result.current[1]());
    }
    expect(presses).toBeGreaterThan(1);
    expect(asked('overpass')).toBe(1);
    expect(aborted).toBe(0);
    expect(result.current[0]).toMatchObject({ source: 'mixed', shown: 'live', status: 'ready', error: null });
    expect(names(result.current[0])).toEqual(['Lokal PL', 'Za granicą']);
  }, 30_000);

  test('at the border, the Polish side failed and Overpass answered the whole circle with nothing: that answer is shown — nothing here, no failure to fetch', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'offline';
    overpass = 'empty';
    const { result } = mount(AT_BORDER);
    await settle(3000); // each leaf tried twice, 2 s apart
    expect(result.current[0]).toMatchObject({
      source: 'mixed',
      shown: 'live',
      coverage: 'partial',
      status: 'ready',
      items: [],
      completeWithin: 1000,
      error: null,
      savedAt: null,
      retryAt: null,
    });
    expect(aroundNotes(result.current[0], 'lokale', Date.now())).toEqual({ status: '', clock: null });
    // The app's data is tried again by itself (30 s): the empty answer stays — no „Szukam…” flash.
    const leafAsks = () => requests.filter((u) => u.includes('/t/')).length;
    const before = leafAsks();
    const seen = new Set<string>();
    for (let waited = 0; waited < AUTO_RETRY_MS[0]! + 4000; waited += 250) {
      await settle(250, 250);
      seen.add(`${result.current[0].source}/${result.current[0].shown}/${result.current[0].status}`);
    }
    expect(leafAsks()).toBeGreaterThan(before);
    expect([...seen]).toEqual(['mixed/live/ready']);
  });

  test.each([
    ['still asks', 'hold', true, 'asking', 'Przy granicy: lokale po polskiej stronie mam w aplikacji, o resztę pytam serwer map…'],
    // On the first load the app's own side is awaited, even when Overpass found nothing: only once it
    // has failed does Overpass's empty answer stand for the whole circle.
    ['has answered (nothing across the border)', 'empty', true, 'done', 'Przy granicy: lokale po polskiej stronie wczytuję z aplikacji…'],
    [
      'has failed',
      '504',
      true,
      'failed',
      'Przy granicy: lokale po polskiej stronie wczytuję z aplikacji, po drugiej stronie nie udało się pobrać danych.',
    ],
    [
      'cannot be asked (offline)',
      'hold',
      false,
      'failed',
      'Przy granicy: lokale po polskiej stronie wczytuję z aplikacji, po drugiej stronie nie udało się pobrać danych.',
    ],
  ] as const)('at the border, while the Polish side loads and Overpass %s: „o resztę pytam serwer map” only while it is asked', async (_, mode, online, rest, words) => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'hold';
    overpass = mode;
    if (!online) Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    const { result } = mount(AT_BORDER);
    await settle(3000);
    expect(result.current[0]).toMatchObject({ source: 'mixed', shown: 'static', status: 'loading', rest });
    expect(aroundNotes(result.current[0], 'lokale', Date.now()).status).toBe(words);
  });

  test('at the border, while the Polish side still loads, a failed Overpass is no failure of the page yet: still looking, the rest said to have failed; once the Polish side is in, it is said to be what is shown', async () => {
    data = osmTestData(BORDER_ROWS, BORDER, 3);
    leaves = 'hold';
    overpass = '504';
    const { result } = mount(AT_BORDER);
    await settle(3000);
    expect(asked('overpass')).toBeGreaterThan(0);
    expect(result.current[0]).toMatchObject({ source: 'mixed', shown: 'static', coverage: 'partial', status: 'loading', error: null });
    expect(aroundNotes(result.current[0], 'lokale', Date.now()).status).toBe(
      'Przy granicy: lokale po polskiej stronie wczytuję z aplikacji, po drugiej stronie nie udało się pobrać danych.',
    );
    leaves = 'ok';
    for (const go of held.splice(0)) go();
    await settle();
    expect(result.current[0]).toMatchObject({ source: 'mixed', shown: 'static', status: 'error', error: 'Serwer map (OpenStreetMap) jest teraz przeciążony.' });
    expect(result.current[0].items.length).toBeGreaterThan(0);
    expect(aroundNotes(result.current[0], 'lokale', Date.now()).status).toBe(
      'Po drugiej stronie granicy nie udało się pobrać danych — pokazuję lokale po polskiej stronie.',
    );
  });

  test('opening the page in Poland trims the device’s trail to a week, though Overpass is never asked', async () => {
    const entry = (lat: number, lon: number, age: number) => ({ lat, lon, radius: 1500, fetchedAt: Date.now() - age, shops: [] });
    const fresh = entry(52.52, 13.405, 2 * DAY);
    window.localStorage.setItem(OSM_KEY, JSON.stringify([fresh, entry(50.075, 14.437, 8 * DAY), entry(48.208, 16.373, 30 * DAY)]));
    window.localStorage.setItem(SHOPS_KEY, JSON.stringify([entry(50.06, 19.94, 7 * DAY + 1)]));
    leaves = 'hold'; // nothing complete yet: no digest written over the old one
    const { result } = mount(WARSAW);
    await settle(200);
    expect(JSON.parse(window.localStorage.getItem(OSM_KEY)!)).toEqual([fresh]);
    expect(JSON.parse(window.localStorage.getItem(SHOPS_KEY)!)).toEqual([]);
    expect(result.current[0]).toMatchObject({ source: 'static', status: 'loading' });
    expect(asked('overpass')).toBe(0);
  });
});
