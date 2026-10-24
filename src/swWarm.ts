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

/** What to fetch at the takeover, each after what it waits for (never rejects). */
const waiting = new Map<WarmUrl, Promise<unknown>>();
let listening = false;
/** The takeover's fetches still on their way (each never rejects). */
const fetching = new Set<Promise<void>>();
/** Counts the resets: a fetch planned before one is not made. */
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
  for (const [url, settled] of waiting)
    void settled
      .then(() => {
        // „Usuń wszystkie dane” in the meantime: what the page saw is not fetched into the worker's
        // copy any more.
        if (resets !== planned) return undefined;
        const href = typeof url === 'function' ? url() : url;
        if (!href) return undefined;
        // Read to the end: nothing is left half-read between the worker and the page.
        const fetched = fetch(href)
          .then((response) => response.blob())
          .then(ignore, ignore);
        fetching.add(fetched);
        return fetched.then(() => void fetching.delete(fetched));
      })
      .catch(ignore);
  waiting.clear();
}

/**
 * Fetches `url` again when the service worker takes over the page, after `settled` (the page's own
 * request, or whatever ends with it) settles either way; a failure is ignored. Call it when the
 * request STARTS: whether it went past the worker is decided now. Nothing when the browser has no
 * service worker or one already controls the page — then the request went through it. One address
 * asked for several times is fetched once, after all of them.
 */
export function refetchWhenControlled(url: WarmUrl, settled: Promise<unknown> = Promise.resolve()): void {
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
  waiting.set(url, before ? Promise.all([before, done]) : done);
}

/**
 * „Usuń wszystkie dane”: the files waiting for the takeover are not fetched — the worker would save
 * the areas the person saw (`gt-osm`) right after the reset. Also those the takeover has planned but
 * not started yet. The shared files among them (the products, the shop chunk, the index) are saved on
 * the next visit instead. Settles when the takeover's fetches already on their way have ended, to whether there
 * were any: what the worker saves of them comes after the reset and is swept again
 * (`src/food/backup.ts`).
 */
export function forgetRefetches(): Promise<boolean> {
  resets++;
  waiting.clear();
  const onWay = [...fetching];
  return Promise.all(onWay).then(() => onWay.length > 0);
}
