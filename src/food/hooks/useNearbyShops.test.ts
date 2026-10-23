// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OverpassUnavailable, type FetchOptions } from '../nearby/overpass';
import type { LatLon } from '../nearby/types';
import { AUTO_RETRY_MS, useAround } from './useNearbyShops';

const HERE = { lat: 52.2297, lon: 21.0122 };
const KEY = 'test:around';

type Item = { id: string };
const fail = () => Promise.reject(new OverpassUnavailable());

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

/** Lets the settle delay pass and the (fake) server answer. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(500));

describe('useAround', () => {
  test('a failed search is retried by itself, further and further apart, then left to the button', async () => {
    const fetcher = vi.fn<(c: LatLon, r: number, o: FetchOptions) => Promise<Item[]>>(fail);
    const { result } = renderHook(() => useAround<Item>(HERE, 1000, fetcher, KEY, 'nie wyszło'));
    await settle();
    expect(result.current[0].status).toBe('error');
    expect(result.current[0].retryAt).toBe(Date.now() + AUTO_RETRY_MS[0]!);
    for (const [i, pause] of AUTO_RETRY_MS.entries()) {
      expect(fetcher).toHaveBeenCalledTimes(i + 1);
      await act(() => vi.advanceTimersByTimeAsync(pause - 1000));
      expect(fetcher).toHaveBeenCalledTimes(i + 1);
      await act(() => vi.advanceTimersByTimeAsync(1000));
      await settle();
    }
    expect(fetcher).toHaveBeenCalledTimes(AUTO_RETRY_MS.length + 1);
    // Out of automatic tries: no countdown, the button stays.
    expect(result.current[0].retryAt).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(fetcher).toHaveBeenCalledTimes(AUTO_RETRY_MS.length + 1);
    act(() => result.current[1]());
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(AUTO_RETRY_MS.length + 2);
  });

  test('a hidden page waits with its retry until it is looked at again', async () => {
    const fetcher = vi.fn<(c: LatLon, r: number, o: FetchOptions) => Promise<Item[]>>(fail);
    renderHook(() => useAround<Item>(HERE, 1000, fetcher, KEY, 'nie wyszło'));
    await settle();
    setVisibility('hidden');
    await act(() => vi.advanceTimersByTimeAsync(AUTO_RETRY_MS[0]! + 5000));
    expect(fetcher).toHaveBeenCalledTimes(1);
    act(() => setVisibility('visible'));
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('an answer kept on the device shows while the new one loads and stays, with its age, when it fails', async () => {
    const savedAt = Date.now() - 3 * 24 * 3600 * 1000;
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ lat: 52.23, lon: 21.012, radius: 1250, fetchedAt: savedAt, shops: [{ id: 'node/1' }] }]),
    );
    let reject!: (e: unknown) => void;
    const fetcher = vi.fn(() => new Promise<Item[]>((_, r) => (reject = r)));
    const { result } = renderHook(() => useAround<Item>(HERE, 1000, fetcher, KEY, 'nie wyszło'));
    await settle();
    expect(result.current[0]).toMatchObject({ status: 'loading', items: [{ id: 'node/1' }], savedAt });
    expect(result.current[0].completeWithin).toBe(1000);
    await act(async () => reject(new OverpassUnavailable()));
    expect(result.current[0]).toMatchObject({ status: 'error', items: [{ id: 'node/1' }], savedAt });
  });

  test('the server’s own pause shows as a countdown while the search goes on', async () => {
    const fetcher = vi.fn(
      (_c: LatLon, _r: number, options: FetchOptions) =>
        new Promise<Item[]>((resolve) => {
          options.onWait?.(6000);
          setTimeout(() => resolve([{ id: 'node/2' }]), 6000);
        }),
    );
    const { result } = renderHook(() => useAround<Item>(HERE, 1000, fetcher, KEY, 'nie wyszło'));
    await settle();
    expect(result.current[0].status).toBe('loading');
    expect(result.current[0].retryAt).toBeGreaterThan(Date.now());
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(result.current[0]).toMatchObject({ status: 'ready', items: [{ id: 'node/2' }], savedAt: null, retryAt: null });
  });
});
