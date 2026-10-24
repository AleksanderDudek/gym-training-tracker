/**
 * Workbox plugins of the service worker (`src/sw.ts`), and its part of „Usuń wszystkie dane”. No
 * imports: the service worker and a test both load it.
 */

/**
 * A Workbox plugin (`cacheWillUpdate`) that keeps the copy without its `Date` header. For files that
 * never change under their name (the OSM leaves, named by a hash of their content): the expiration
 * then judges a copy by when it was LAST USED, which it keeps track of itself, never by when the
 * server sent it — without the header Workbox never calls a kept copy too old, and a cell visited
 * every few months still works offline.
 *
 * Goes after `CacheableResponsePlugin`, so only a `200` reaches it.
 */
export const withoutDateHeader = {
  cacheWillUpdate: async ({ response }: { response: Response }): Promise<Response> => {
    const headers = new Headers(response.headers);
    headers.delete('date');
    return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
  },
};

/** Counts the resets (`forgetTrail`): a request that began before the last one keeps nothing. */
let resets = 0;
/** Copies let through by `fromAfterReset` and still being written (each settles when written). */
const writing = new Set<Promise<void>>();

/** What Workbox keeps for the plugin per request (`state`, the same object in every callback). */
interface Begun {
  /** `resets` when the request began. */
  began?: number;
  /** Ends this request's entry in `writing`. */
  written?: () => void;
}

const current = (state: Begun | undefined) => state?.began === resets;

/**
 * A Workbox plugin for the copies that tell where someone looked and what at (the OSM leaves, the
 * map tiles, the product photos): nothing a request brings is kept if the request BEGAN before the
 * last „Usuń wszystkie dane” — the page may long have given up on it (the worker's own request goes
 * on), been reloaded or closed. Nor is a copy found by such a request marked as used.
 *
 * Goes after `CacheableResponsePlugin` (only a `200` reaches it, never an opaque answer it could not
 * copy) and before `ExpirationPlugin`, whose `cachedResponseWillBeUsed` notes every use of a copy.
 */
export const fromAfterReset = {
  handlerWillStart: async ({ state }: { state?: Begun }): Promise<void> => {
    if (state) state.began = resets;
  },
  /** A copy found from before the reset: the request goes to the network, the use is not noted. */
  cachedResponseWillBeUsed: async ({ cachedResponse, state }: { cachedResponse?: Response | null; state?: Begun }) =>
    current(state) ? (cachedResponse ?? null) : null,
  cacheWillUpdate: async ({ response, state }: { response: Response; state?: Begun }): Promise<Response | null> => {
    // Read to the end first: a reset while the body is still arriving counts too, and from here to
    // the written copy it is the reset that waits (`forgetTrail`).
    const body = await response.blob();
    if (!state || !current(state)) return null;
    let done = () => {};
    const written = new Promise<void>((resolve) => (done = resolve));
    writing.add(written);
    state.written = () => {
      writing.delete(written);
      done();
    };
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  },
  /** After the copy is written (and the expiration has noted it), or failed to be. */
  handlerDidComplete: async ({ state }: { state?: Begun }): Promise<void> => {
    state?.written?.();
  },
};

/**
 * „Usuń wszystkie dane” in the worker (the page's message, `src/sw.ts`): from now on nothing asked
 * for before is kept (`fromAfterReset`), the copies already let through are waited for — written in
 * a moment, from what has arrived — and then the caches `names` go, each with what the expiration
 * noted of it (`forgetRows`: the rows of the `workbox-expiration` database). Also in a worker that
 * has just started for the message: nothing here depends on what it did before.
 */
export async function forgetTrail(names: readonly string[], forgetRows: (name: string) => Promise<void>): Promise<void> {
  resets++;
  await Promise.all(writing);
  for (const name of names) {
    await caches.delete(name).catch(() => false);
    await forgetRows(name).catch(() => undefined);
  }
}
