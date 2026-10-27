// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { roomy } from './background';

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

async function start() {
  vi.resetModules();
  const { downloadModelInBackground } = await import('./background');
  downloadModelInBackground();
}

/** Past the start delay (jsdom has no `requestIdleCallback`, so the idle wait is none). */
const idle = () => vi.advanceTimersByTimeAsync(6000);

beforeEach(() => {
  vi.useFakeTimers();
  sw = new FakeContainer();
  net = undefined;
  saveModel.mockReset().mockResolvedValue(true);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => sw });
  Object.defineProperty(navigator, 'connection', { configurable: true, get: () => net });
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('roomy', () => {
  it('spends 59 MB on Wi-Fi or an unknown connection, not on mobile data, 2G or data saver', () => {
    expect(roomy(undefined)).toBe(true);
    expect(roomy(Object.assign(new FakeConnection('wifi'), { effectiveType: '4g' }))).toBe(true);
    expect(roomy(new FakeConnection('cellular'))).toBe(false);
    expect(roomy(Object.assign(new FakeConnection(), { effectiveType: 'slow-2g' }))).toBe(false);
    expect(roomy(Object.assign(new FakeConnection('wifi'), { saveData: true }))).toBe(false);
  });
});

describe('downloadModelInBackground', () => {
  it('waits a few seconds after start, under the service worker', async () => {
    sw.controller = {};
    await start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveModel).not.toHaveBeenCalled();
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('on the first visit, starts only once the service worker takes over the page', async () => {
    await start();
    await idle();
    expect(saveModel).not.toHaveBeenCalled();
    sw.controller = {};
    sw.dispatchEvent(new Event('controllerchange'));
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(1);
  });

  it('on mobile data or offline, only looks at the copy, and downloads once that changes', async () => {
    sw.controller = {};
    net = new FakeConnection('cellular');
    saveModel.mockResolvedValueOnce(false);
    await start();
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(false);
    net.type = 'wifi';
    net.dispatchEvent(new Event('change'));
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(true);

    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    saveModel.mockClear().mockResolvedValueOnce(false);
    await start();
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(false);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    dispatchEvent(new Event('online'));
    await idle();
    expect(saveModel).toHaveBeenLastCalledWith(true);
  });

  it('with the model already in the copy, nothing waits for a change', async () => {
    sw.controller = {};
    net = new FakeConnection('cellular');
    await start();
    await idle();
    net.dispatchEvent(new Event('change'));
    await idle();
    expect(saveModel).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('a dropped download is tried again when the network is back; a closed photo screen, soon after', async () => {
    sw.controller = {};
    saveModel.mockRejectedValueOnce(new Error('HTTP 0')).mockRejectedValueOnce(new Error('released'));
    await start();
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(1);
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(1);
    dispatchEvent(new Event('online'));
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(2);
    await idle();
    expect(saveModel).toHaveBeenCalledTimes(3);
  });

  it('does nothing without a service worker', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => undefined });
    await start();
    await idle();
    expect(saveModel).not.toHaveBeenCalled();
  });
});
