// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowed } from './background';

/**
 * When the photo model downloads unasked. `navigator.serviceWorker` and `navigator.connection`
 * (jsdom has neither) are small imitations; the module starts once per load, so each test loads it
 * afresh.
 */

const saveModel = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock('./recognize', () => ({ saveModel }));

class FakeContainer extends EventTarget {
  controller: object | null = null;
}

class FakeConnection extends EventTarget {
  constructor(public type?: string) {
    super();
  }
}

let sw: FakeContainer;
let net: FakeConnection | undefined;

/** The module loads afresh each time, and so does the state it writes: `modelState` reads that one. */
let modelState: () => unknown = () => undefined;

async function start() {
  vi.resetModules();
  const { downloadModelInBackground } = await import('./background');
  ({ modelState } = await import('./modelState'));
  downloadModelInBackground();
}

/** Past the start delay (jsdom has no `requestIdleCallback`, so the idle wait is none). */
const idle = () => vi.advanceTimersByTimeAsync(3000);

beforeEach(() => {
  vi.useFakeTimers();
  sw = new FakeContainer();
  net = undefined;
  saveModel.mockReset().mockResolvedValue(true);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => sw });
  Object.defineProperty(navigator, 'connection', { configurable: true, get: () => net });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  vi.stubGlobal('caches', {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('allowed', () => {
  it('downloads on any connection, mobile data included; only data saving stops it', () => {
    expect(allowed(undefined)).toBe(true);
    expect(allowed(new FakeConnection('cellular'))).toBe(true);
    expect(allowed(Object.assign(new FakeConnection('wifi'), { saveData: true }))).toBe(false);
  });
});

describe('downloadModelInBackground', () => {
  it('starts a couple of seconds after the first start — before any service worker controls the page', async () => {
    await start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveModel).not.toHaveBeenCalled();
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('on mobile data it downloads too', async () => {
    net = new FakeConnection('cellular');
    await start();
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('with data saving or offline it only looks, says why, and downloads once that changes', async () => {
    net = Object.assign(new FakeConnection('wifi'), { saveData: true });
    saveModel.mockResolvedValueOnce(false);
    await start();
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(false);
    expect(modelState()).toEqual({ kind: 'missing', wait: 'saver' });
    (net as FakeConnection & { saveData: boolean }).saveData = false;
    net.dispatchEvent(new Event('change'));
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(true);

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    saveModel.mockClear().mockResolvedValueOnce(false);
    await start();
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(false);
    expect(modelState()).toEqual({ kind: 'missing', wait: 'offline' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    dispatchEvent(new Event('online'));
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(true);
  });

  it('a dropped download is tried again when the network is back; a closed photo screen, soon after; a failing server a few times, a minute apart', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    saveModel.mockRejectedValueOnce(new Error('HTTP 0')).mockRejectedValueOnce(new Error('released'));
    await start();
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(1);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    dispatchEvent(new Event('online'));
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(2);
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(3);

    saveModel.mockReset().mockRejectedValue(new Error('HTTP 500'));
    await start();
    await idle();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(saveModel).toHaveBeenCalledTimes(3);
  });

  it('without the Cache API there is no copy to fill', async () => {
    vi.stubGlobal('caches', undefined);
    await start();
    await idle();
    expect(saveModel).not.toHaveBeenCalled();
    expect(modelState()).toEqual({ kind: 'unsupported' });
  });
});
