// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement, useEffect, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { wantedLeaves } from '../nearby/osmGrid';
import { __resetStaticData, leafNow, leafRefs, loadIndex, loadLeaf, MEMORY_LEAVES } from '../nearby/staticData';
import type { LatLon } from '../nearby/types';
import { boxCoverage, osmResponse, osmRow, osmTestData, type OsmTestData } from '../test/osm';
import { AUTO_RETRY_MS } from './useNearbyShops';
import { useStaticAround, type StaticState } from './useStaticAround';

vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

const HERE = { lat: 52.2297, lon: 21.0122 };
const ROWS = Array.from({ length: 9 }, (_, k) =>
  osmRow(`n${k + 1}`, HERE.lat + (k - 4) * 0.003, HERE.lon, { amenity: 'restaurant', name: `Lokal ${k + 1}` }),
);

let data: OsmTestData;
let mode: 'ok' | 'leaves-offline' | 'leaves-503' | 'index-offline' | 'index-503' | 'hold';
let calls: { index: number; leaves: number };
let urls: string[];
/** While set, the index answers only once this settles (a slow first load). */
let indexGate: Promise<void> | null;

beforeEach(() => {
  vi.useFakeTimers();
  __resetStaticData();
  data = osmTestData(ROWS, boxCoverage(51.5, 20, 52.6, 22), 3);
  mode = 'ok';
  calls = { index: 0, leaves: 0 };
  urls = [];
  indexGate = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const isIndex = url.includes('index.json');
      if (isIndex) calls.index++;
      else calls.leaves++;
      urls.push(url);
      if (mode === 'index-offline' && isIndex) throw new TypeError('Failed to fetch');
      if (mode === 'index-503' && isIndex) return new Response('busy', { status: 503 });
      if (mode === 'leaves-offline' && !isIndex) throw new TypeError('Failed to fetch');
      if (mode === 'leaves-503' && !isIndex) return new Response('busy', { status: 503 });
      if (mode === 'hold' && !isIndex) return new Promise<Response>(() => {});
      if (isIndex && indexGate) await indexGate;
      return osmResponse(data, url)!;
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Lets time pass in small steps: the index, the effect, the leaves and the render batch each need a
 * turn, and a failure is stamped with the clock at the end of its step — big steps would drift.
 */
async function settle(ms = 200, step = Math.min(250, Math.max(20, Math.floor(ms / 10)))) {
  for (let passed = 0; passed < ms; passed += step) await act(() => vi.advanceTimersByTimeAsync(step));
}

describe('useStaticAround', () => {
  test('in the data: leaves around the rounded position, complete within the radius, nothing else asked', async () => {
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0]).toMatchObject({ status: 'ready', coverage: 'full', completeWithin: 1000, failure: null });
    expect(result.current[0].items.length).toBeGreaterThan(0);
    expect(result.current[0].dataAsOf).toBe('2026-10-22T20:21:33Z');
  });

  test('leaves unreachable: tries again by itself 30 s, 1 min and 2 min apart, then leaves it to the button', async () => {
    mode = 'leaves-offline';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle(3000); // the first round, with its own retry after 2 s
    expect(result.current[0]).toMatchObject({ status: 'error', failure: 'network' });
    const perRound = calls.leaves;
    expect(result.current[0].retryAt).not.toBeNull();
    for (const pause of AUTO_RETRY_MS) await settle(pause + 3000);
    expect(calls.leaves).toBe(perRound * (1 + AUTO_RETRY_MS.length));
    expect(result.current[0].retryAt).toBeNull();
    // Nothing more by itself…
    await settle(10 * 60_000, 5000);
    expect(calls.leaves).toBe(perRound * (1 + AUTO_RETRY_MS.length));
    // …but the button still works.
    act(() => result.current[1]());
    await settle(3000);
    expect(calls.leaves).toBe(perRound * (2 + AUTO_RETRY_MS.length));
  });

  test('the index unreachable: the same growing pauses, then stop — no spinning in between', async () => {
    mode = 'index-offline';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0]).toMatchObject({ status: 'error', coverage: 'unknown', failure: 'network' });
    for (const pause of AUTO_RETRY_MS) await settle(pause + 500);
    expect(calls.index).toBe(1 + AUTO_RETRY_MS.length);
    expect(result.current[0].retryAt).toBeNull();
    await settle(10 * 60_000, 5000);
    expect(calls.index).toBe(1 + AUTO_RETRY_MS.length);
  });

  test('the index unreachable while the phone is locked: one try when it is looked at, the next only after that one fails', async () => {
    // The first ask fails at once; every later one hangs until its own deadline cuts it (lie-fi).
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (!url.includes('index.json')) return Promise.resolve(osmResponse(data, url)!);
        calls.index++;
        if (calls.index === 1) return Promise.reject(new TypeError('Failed to fetch'));
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError'))),
        );
      }),
    );
    const visibility = (state: 'visible' | 'hidden') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    try {
      renderHook(() => useStaticAround(HERE, 1000));
      await settle();
      expect(calls.index).toBe(1);
      // Locked for five minutes: every due time passes while hidden — nothing is asked meanwhile.
      visibility('hidden');
      await settle(5 * 60_000, 5000);
      expect(calls.index).toBe(1);
      // Looked at: ONE try, which hangs — the old failure must not count as a fresh one for the
      // other slots while it runs.
      visibility('visible');
      await settle(500);
      expect(calls.index).toBe(2);
      // Cut after its 10 s; the next slot (1 min) counts from that failure, the last (2 min) likewise.
      await settle(10_000 + AUTO_RETRY_MS[1]! - 2000);
      expect(calls.index).toBe(2);
      await settle(3000);
      expect(calls.index).toBe(3);
      await settle(10_000 + AUTO_RETRY_MS[2]! - 2000);
      expect(calls.index).toBe(3);
      await settle(3000);
      expect(calls.index).toBe(4);
      await settle(10 * 60_000, 5000);
      expect(calls.index).toBe(4);
    } finally {
      visibility('visible');
    }
  });

  test('a slow connection: "since when" is known while the leaves load', async () => {
    mode = 'hold';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0].status).toBe('loading');
    expect(result.current[0].since).not.toBeNull();
  });

  test('"since when" counts from the start of the lookup — a slow index too — and the index arriving does not restart it', async () => {
    let release = () => {};
    indexGate = new Promise<void>((go) => (release = go));
    mode = 'hold'; // and then the leaves never come
    const start = Date.now();
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0]).toMatchObject({ status: 'loading', coverage: 'unknown', since: start });
    await settle(3000);
    release();
    await settle();
    expect(result.current[0]).toMatchObject({ status: 'loading', coverage: 'full', since: start });
  });

  test('a server error on the index is tried again by itself too: one 503 does not keep the visit off the app’s data', async () => {
    mode = 'index-503';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0]).toMatchObject({ failure: 'unavailable' });
    expect(result.current[0].retryAt).not.toBeNull();
    mode = 'ok';
    await settle(AUTO_RETRY_MS[0]! + 500);
    expect(calls.index).toBe(2);
    expect(result.current[0]).toMatchObject({ status: 'ready', coverage: 'full', failure: null, retryAt: null });
    expect(result.current[0].items.length).toBeGreaterThan(0);
  });

  test('…and so is a server error on a leaf', async () => {
    mode = 'leaves-503';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle(3000); // each leaf asked twice, 2 s apart
    expect(result.current[0]).toMatchObject({ status: 'error', failure: 'unavailable' });
    expect(result.current[0].retryAt).not.toBeNull();
    mode = 'ok';
    await settle(AUTO_RETRY_MS[0]!);
    expect(result.current[0]).toMatchObject({ status: 'ready', failure: null, retryAt: null, completeWithin: 1000 });
  });

  test('near the border, whether Overpass is needed and which files are asked for come from the rounded position: the same for the whole rounding cell', async () => {
    // The coverage ends at 52.6 N (300 m simplification); both points round to 52.588. Measured
    // from the exact position a 1 km circle around the first stays inside the data and around the
    // second it crosses the edge — the rounded position decides, the same for both.
    data = osmTestData(
      Array.from({ length: 6 }, (_, k) => osmRow(`n${k + 1}`, 52.584 + k * 0.0015, 21.0122, { amenity: 'restaurant', name: `Lokal ${k + 1}` })),
      boxCoverage(51.5, 20, 52.6, 22),
      3,
    );
    const look = async (lat: number) => {
      __resetStaticData();
      urls = [];
      const { result, unmount } = renderHook(() => useStaticAround({ lat, lon: 21.0122 }, 1000));
      await settle();
      const seen = { coverage: result.current[0].coverage, leaves: urls.filter((u) => u.includes('/t/')).sort() };
      unmount();
      return seen;
    };
    const first = await look(52.5878);
    expect(first.coverage).toBe('partial');
    expect(first.leaves.length).toBeGreaterThan(0);
    expect(await look(52.5884)).toEqual(first);
  });

  test('the view’s leaves stay in memory while newer ones crowd it: the view completes', async () => {
    // A leaf per row, 1.1 km apart: more leaves than the memory keeps.
    data = osmTestData(
      Array.from({ length: 130 }, (_, k) => osmRow(`n${k + 1}`, 51.6 + k * 0.01, 21, { amenity: 'cafe', name: `Kawiarnia ${k + 1}` })),
      boxCoverage(49, 14, 55, 24),
      1,
    );
    const view = { lat: 52.2, lon: 21 };
    const refs = leafRefs(await loadIndex());
    const wanted = wantedLeaves(refs, view, 8000).leaves;
    const old = wantedLeaves(refs, view, 1000).leaves;
    const others = refs.filter((leaf) => !wanted.includes(leaf));
    // The view's nearest leaves first (an earlier, smaller look), then others until the memory is
    // all but full: the view's own are the oldest in it.
    for (const leaf of [...old, ...others.slice(0, MEMORY_LEAVES - old.length - 1)]) await loadLeaf(leaf);
    expect(wanted.length - old.length).toBeGreaterThanOrEqual(10);
    const { result } = renderHook(() => useStaticAround(view, 8000));
    await settle(1000);
    expect(result.current[0]).toMatchObject({ status: 'ready', completeWithin: 8000 });
    expect(wanted.every((leaf) => leafNow(leaf))).toBe(true);
  });

  test('the last leaf landing between the view’s render and its effect still completes the view', async () => {
    // A position from the GPS is a timer-driven update: React runs its effects after the pending
    // promises, so a leaf can land in between. Real timers and no act(), as in the browser.
    vi.useRealTimers();
    const react = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = react.IS_REACT_ACT_ENVIRONMENT;
    react.IS_REACT_ACT_ENVIRONMENT = false;
    const refs = leafRefs(data.index);
    const a = HERE;
    const b = { lat: HERE.lat + 0.002, lon: HERE.lon }; // another rounding cell, the same leaves
    const wantedA = wantedLeaves(refs, a, 1000).leaves;
    const wantedB = wantedLeaves(refs, b, 1000).leaves;
    expect(wantedB.length).toBeGreaterThan(0);
    expect(wantedB.every((leaf) => wantedA.includes(leaf))).toBe(true);
    const last = wantedB.at(-1)!;
    const held: { release?: () => void } = {};
    // Answers whose bodies are read in microtasks only, the last leaf held until B has rendered.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const text = await osmResponse(data, url)!.text();
        const response = { ok: true, status: 200, headers: new Headers(), body: null, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
        if (url.includes(`/t/${last.d}-${last.i}-${last.j}.`)) await new Promise<void>((go) => (held.release = go));
        else await new Promise((go) => setTimeout(go, 5));
        return response;
      }),
    );
    const seen: { state?: StaticState } = {};
    const onState = (state: StaticState) => (seen.state = state);
    function View({ at }: { at: LatLon }) {
      const [state] = useStaticAround(at, 1000);
      // B is on screen: the held leaf lands now, before B's effect runs.
      useLayoutEffect(() => {
        if (at !== a) held.release?.();
      }, [at]);
      useEffect(() => void onState(state), [state]);
      return null;
    }
    const root = createRoot(document.createElement('div'));
    try {
      root.render(createElement(View, { at: a }));
      // A's leaves are in, all but the held one.
      await vi.waitFor(() => expect(held.release && wantedA.every((leaf) => leaf === last || leafNow(leaf))).toBe(true));
      expect(seen.state?.status).toBe('loading');
      setTimeout(() => root.render(createElement(View, { at: b })), 0);
      await vi.waitFor(() => expect(wantedB.every((leaf) => leafNow(leaf))).toBe(true));
      await vi.waitFor(() => expect(seen.state?.status).toBe('ready'), { timeout: 1000 });
    } finally {
      root.unmount();
      react.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }
  });
});
