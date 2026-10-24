/**
 * The very first visit fetches before the service worker controls the page (it installs only after
 * the page has loaded), so those files never land in its runtime caches and are missing offline.
 * A file that matters offline is remembered here when it is requested past the worker, and fetched
 * once more when the worker takes over (`controllerchange`): through it, into its copy — mostly from
 * the browser's HTTP cache. A request still on its way settles first, so a file is never downloaded
 * twice at the same time.
 */

/**
 * A file's address — or, for a chunk whose hashed name only the build knows, how to get it once it
 * has loaded (asked after `settled`; `undefined` skips it).
 */
export type WarmUrl = string | (() => string | undefined);

interface Planned {
  /** What the fetch waits for (never rejects). */
  settled: Promise<unknown>;
  /** The file tells where someone looked (an OSM leaf): „Usuń wszystkie dane” drops it. */
  trail: boolean;
}

/** What to fetch at the takeover, each after what it waits for. */
const waiting = new Map<WarmUrl, Planned>();
let listening = false;
/** Counts the resets: the trail planned before one is not fetched. */
let resets = 0;

const ignore = () => {};

/**
 * The page's side of the service worker; `undefined` without one: plain http, an old browser, or a
 * sandboxed frame that refuses even to say (reading it throws there).
 */
function container(): ServiceWorkerContainer | undefined {
  try {
    return typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  } catch {
    return undefined;
  }
}

function takeOver(): void {
  const planned = resets;
  for (const [url, { settled, trail }] of waiting)
    void settled
      .then(() => {
        // „Usuń wszystkie dane” in the meantime: the areas the person saw are not fetched into the
        // worker's copy any more.
        if (trail && resets !== planned) return undefined;
        const href = typeof url === 'function' ? url() : url;
        if (!href) return undefined;
        // Read to the end: nothing is left half-read between the worker and the page.
        return fetch(href)
          .then((response) => response.blob())
          .then(ignore, ignore);
      })
      .catch(ignore);
  waiting.clear();
}

/**
 * Fetches `url` again when the service worker takes over the page, after `settled` (the page's own
 * request, or whatever ends with it) settles either way; a failure is ignored. Call it when the
 * request STARTS: whether it went past the worker is decided now. Nothing when the browser has no
 * service worker or one already controls the page — then the request went through it. One address
 * asked for several times is fetched once, after all of them. `trail`: the file tells where someone
 * looked (an OSM leaf), so „Usuń wszystkie dane” drops it (`forgetRefetches`).
 */
export function refetchWhenControlled(
  url: WarmUrl,
  settled: Promise<unknown> = Promise.resolve(),
  { trail = false }: { trail?: boolean } = {},
): void {
  // Handled before anything else: a failed request handed in here is never an unhandled rejection,
  // whether the page needs the fetch again or not.
  const done = settled.then(ignore, ignore);
  const sw = container();
  if (!sw || sw.controller) return;
  if (!listening) {
    listening = true;
    sw.addEventListener('controllerchange', takeOver, { once: true });
  }
  const before = waiting.get(url);
  waiting.set(url, { settled: before ? Promise.all([before.settled, done]) : done, trail: trail || before?.trail === true });
}

/**
 * „Usuń wszystkie dane”: the trail waiting for the takeover (the leaves: the areas the person saw)
 * is not fetched — the worker would save it right after the reset; nor is the trail the takeover has
 * planned but not started yet. The shared files (the products, the shop chunk, the index) still are:
 * they are the same for everyone, and the reset leaves their copies. A takeover fetch of the trail
 * already on its way goes through the worker, which keeps no trail asked for before the reset
 * (`src/swPlugins.ts`).
 */
export function forgetRefetches(): void {
  resets++;
  for (const [url, { trail }] of waiting) if (trail) waiting.delete(url);
}
