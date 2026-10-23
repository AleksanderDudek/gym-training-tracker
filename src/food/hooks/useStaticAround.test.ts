// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { __resetStaticData } from '../nearby/staticData';
import { boxCoverage, osmResponse, osmRow, osmTestData, type OsmTestData } from '../test/osm';
import { AUTO_RETRY_MS } from './useNearbyShops';
import { useStaticAround } from './useStaticAround';

vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

const HERE = { lat: 52.2297, lon: 21.0122 };
const ROWS = Array.from({ length: 9 }, (_, k) =>
  osmRow(`n${k + 1}`, HERE.lat + (k - 4) * 0.003, HERE.lon, { amenity: 'restaurant', name: `Lokal ${k + 1}` }),
);

let data: OsmTestData;
let mode: 'ok' | 'leaves-offline' | 'index-offline' | 'hold';
let calls: { index: number; leaves: number };

beforeEach(() => {
  vi.useFakeTimers();
  __resetStaticData();
  data = osmTestData(ROWS, boxCoverage(51.5, 20, 52.6, 22), 3);
  mode = 'ok';
  calls = { index: 0, leaves: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const isIndex = url.includes('index.json');
      if (isIndex) calls.index++;
      else calls.leaves++;
      if (mode === 'index-offline' && isIndex) throw new TypeError('Failed to fetch');
      if (mode === 'leaves-offline' && !isIndex) throw new TypeError('Failed to fetch');
      if (mode === 'hold' && !isIndex) return new Promise<Response>(() => {});
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

  test('a slow connection: "since when" is known while the leaves load', async () => {
    mode = 'hold';
    const { result } = renderHook(() => useStaticAround(HERE, 1000));
    await settle();
    expect(result.current[0].status).toBe('loading');
    expect(result.current[0].since).not.toBeNull();
  });

  test('near the border, whether Overpass is needed is decided from the rounded position: the same for the whole rounding cell', async () => {
    // The coverage ends at 52.6 N; these two points share the rounding cell 52.594.
    const a = { lat: 52.5936, lon: 21.0122 };
    const b = { lat: 52.5944, lon: 21.0124 };
    const first = renderHook(() => useStaticAround(a, 500));
    await settle();
    const second = renderHook(() => useStaticAround(b, 500));
    await settle();
    expect(first.result.current[0].coverage).toBe(second.result.current[0].coverage);
    expect(first.result.current[0].coverage).toBe('partial');
  });
});
