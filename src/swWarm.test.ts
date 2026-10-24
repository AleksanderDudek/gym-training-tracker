// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Files fetched before the service worker took over the page. `navigator.serviceWorker` (jsdom has
 * none) is a small imitation: no controller until the test hands the page over. The module keeps
 * what it waits for at module level, so each test loads it afresh.
 */

const BASE = 'https://aleksanderdudek.github.io/gym-training-tracker/';
const INDEX = `${BASE}data/osm/v1/index.json`;
const LEAF = `${BASE}data/osm/v1/t/11-412-391.168d29f8c3.json.gz`;
const PRODUCTS = `${BASE}data/products.19a087023af2.json.gz`;
const CHUNK = `${BASE}assets/shopData-CPHrJmUd.js`;

class FakeContainer extends EventTarget {
  controller: object | null = null;
}

let sw: FakeContainer;
let fetched: string[];
let responses: Response[];

async function load() {
  vi.resetModules();
  return import('./swWarm');
}

/** The worker claims the page, as `clientsClaim()` does on the first visit. */
function takeOver() {
  sw.controller = {};
  sw.dispatchEvent(new Event('controllerchange'));
}

/** Lets the promise chains run: no timers are involved. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A request of the page still on its way, settled by the test. */
function onItsWay() {
  let resolve = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  sw = new FakeContainer();
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
  fetched = [];
  responses = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetched.push(url);
      const response = new Response('x');
      responses.push(response);
      return response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe('files fetched before the service worker controlled the page', () => {
  test('are fetched again once it takes over, each after its own request settled — a failed one too', async () => {
    const { refetchWhenControlled } = await load();
    const leaf = onItsWay();
    const products = onItsWay();
    refetchWhenControlled(INDEX);
    refetchWhenControlled(LEAF, leaf.promise);
    refetchWhenControlled(PRODUCTS, products.promise);
    await flush();
    expect(fetched).toEqual([]);

    takeOver();
    await flush();
    // The leaf and the products are still on their way: fetching them now would download them twice.
    expect(fetched).toEqual([INDEX]);

    leaf.reject(new TypeError('Failed to fetch'));
    await flush();
    expect(fetched).toEqual([INDEX, LEAF]);

    products.resolve();
    await flush();
    expect(fetched).toEqual([INDEX, LEAF, PRODUCTS]);
    // Read to the end, nothing left hanging between the worker and the page.
    expect(responses.every((r) => r.bodyUsed)).toBe(true);

    // Only the first takeover: a new version taking over later fetches nothing more.
    takeOver();
    await flush();
    expect(fetched).toHaveLength(3);
  });

  test('an address asked for twice is fetched once, after both its requests', async () => {
    const { refetchWhenControlled } = await load();
    const first = onItsWay();
    const second = onItsWay();
    refetchWhenControlled(LEAF, first.promise);
    refetchWhenControlled(LEAF, second.promise);
    takeOver();
    first.resolve();
    await flush();
    expect(fetched).toEqual([]);
    second.reject(new TypeError('Failed to fetch'));
    await flush();
    expect(fetched).toEqual([LEAF]);
  });

  test('a chunk whose name only the build knows is asked for its address after its request', async () => {
    const { refetchWhenControlled } = await load();
    const chunk = onItsWay();
    let address: string | undefined;
    const asked = vi.fn(() => address);
    refetchWhenControlled(asked, chunk.promise);
    takeOver();
    await flush();
    expect(asked).not.toHaveBeenCalled();
    // The chunk has loaded and tells its own address.
    address = CHUNK;
    chunk.resolve();
    await flush();
    expect(asked).toHaveBeenCalledTimes(1);
    expect(fetched).toEqual([CHUNK]);
  });

  test('a chunk that never told its address (it failed to load) is skipped', async () => {
    const { refetchWhenControlled } = await load();
    refetchWhenControlled(() => undefined);
    refetchWhenControlled(INDEX);
    takeOver();
    await flush();
    expect(fetched).toEqual([INDEX]);
  });

  test('a fetch that fails again is let go: no error, the others still come', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        fetched.push(url);
        if (url === LEAF) throw new TypeError('Failed to fetch');
        return new Response('x');
      }),
    );
    const { refetchWhenControlled } = await load();
    refetchWhenControlled(LEAF);
    refetchWhenControlled(INDEX);
    takeOver();
    await flush();
    expect(fetched).toEqual([LEAF, INDEX]);
  });

  test('nothing when the worker already controls the page: the request went through it', async () => {
    sw.controller = {};
    const listen = vi.spyOn(sw, 'addEventListener');
    const { refetchWhenControlled } = await load();
    refetchWhenControlled(PRODUCTS);
    sw.dispatchEvent(new Event('controllerchange'));
    await flush();
    expect(listen).not.toHaveBeenCalled();
    expect(fetched).toEqual([]);
  });

  test('a failed request handed in is handled even when nothing is fetched again: a controlled page, no service worker', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => void unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { refetchWhenControlled } = await load();
      sw.controller = {};
      // The shop chunk failed to load (offline after an update, not in the worker's copy yet).
      refetchWhenControlled(CHUNK, Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
      refetchWhenControlled(CHUNK, Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
      // Node reports a rejection nobody handled once the current task is over.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  test('„Usuń wszystkie dane” before the takeover: nothing waiting for it is fetched — what is asked for after the reset is', async () => {
    const { forgetRefetches, refetchWhenControlled } = await load();
    const leaf = onItsWay();
    refetchWhenControlled(INDEX);
    refetchWhenControlled(LEAF, leaf.promise);
    refetchWhenControlled(PRODUCTS);
    expect(await forgetRefetches()).toBe(false);
    // The person opens „W pobliżu” again before the worker takes over: that area is fetched into its copy.
    refetchWhenControlled(INDEX);
    takeOver();
    leaf.resolve();
    await flush();
    expect(fetched).toEqual([INDEX]);
  });

  test('a reset after the takeover: a fetch still waiting for its request is not made, one on its way is waited for', async () => {
    const answers: (() => void)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        fetched.push(url);
        return new Promise<Response>((answer) => answers.push(() => answer(new Response('x'))));
      }),
    );
    const { forgetRefetches, refetchWhenControlled } = await load();
    const leaf = onItsWay();
    refetchWhenControlled(INDEX);
    refetchWhenControlled(LEAF, leaf.promise);
    takeOver();
    await flush();
    expect(fetched).toEqual([INDEX]);

    let ended: boolean | undefined;
    void forgetRefetches().then((wereOnWay) => (ended = wereOnWay));
    leaf.resolve();
    await flush();
    // The leaf's fetch was waiting for the page's request: not made after the reset.
    expect(fetched).toEqual([INDEX]);
    // The index is on its way: the reset hears when it has ended (what the worker saves of it is swept then).
    expect(ended).toBeUndefined();
    answers[0]!();
    await flush();
    expect(ended).toBe(true);
  });

  test('nothing without service workers (plain http, an old browser), and no error where reading them throws', async () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    const { refetchWhenControlled } = await load();
    expect(() => refetchWhenControlled(PRODUCTS)).not.toThrow();
    // A sandboxed frame: the browser refuses to say.
    Object.defineProperty(navigator, 'serviceWorker', {
      get: () => {
        throw new DOMException('The document is sandboxed', 'SecurityError');
      },
      configurable: true,
    });
    expect(() => refetchWhenControlled(PRODUCTS)).not.toThrow();
    await flush();
    expect(fetched).toEqual([]);
  });
});
