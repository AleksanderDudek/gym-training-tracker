/**
 * The photo model downloads by itself, soon after the app starts, so the first meal photo works at
 * once and offline. It goes into the service worker's copy (`gt-photo-model` in `src/sw.ts`); later
 * starts only check that copy, which takes a moment and downloads nothing.
 *
 * - Only under a service worker: without one the file would land nowhere and be downloaded again
 *   for the first photo. On the first visit that is right after the worker takes over the page.
 * - Only when the app is idle, a few seconds after start: never alongside the first screen.
 * - Not on „Oszczędzanie danych”, a known mobile connection or 2G: 59 MB is too much to spend
 *   unasked. It starts when the connection changes (Wi-Fi), and the first photo downloads it anyway.
 *   Safari says nothing about the connection, so there it downloads.
 * - `recognize.ts` (with the dish catalog) loads only then, not with the app's first screen.
 * - A dropped download waits for the network to come back; a photo screen closed mid-download
 *   (which ends the shared worker) is followed by another try.
 */

/** The parts of the Network Information API this reads (Chrome on Android; none in Safari or Firefox). */
interface Connection extends EventTarget {
  saveData?: boolean;
  type?: string;
  effectiveType?: string;
}

/** Whether to spend 59 MB on this connection without being asked. Unknown counts as yes. */
export function roomy(c: Connection | undefined): boolean {
  if (!c) return true;
  return !c.saveData && c.type !== 'cellular' && !/2g/.test(c.effectiveType ?? '');
}

/** The page's side of the service worker; `undefined` without one (plain http, an old browser, a sandboxed frame). */
function container(): ServiceWorkerContainer | undefined {
  try {
    return navigator.serviceWorker ?? undefined;
  } catch {
    return undefined;
  }
}

const connection = () => (navigator as Navigator & { connection?: Connection }).connection;

const AFTER_START_MS = 5000;

/** A few seconds on, then when the browser has nothing else to do (or at once where it cannot tell). */
function later(run: () => void): void {
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: AFTER_START_MS });
    else run();
  }, AFTER_START_MS);
}

function attempt(): void {
  const c = connection();
  // Offline or on mobile data it only looks at the copy — the photo screen then says whether the
  // model is there — and downloads once the connection changes.
  const now = navigator.onLine && roomy(c);
  import('./recognize')
    .then(({ saveModel }) => saveModel(now))
    .then(
      (saved) => {
        // Not saved although it could (a full disk): trying again would only download it again.
        if (saved || now) return;
        if (!navigator.onLine) addEventListener('online', () => later(attempt), { once: true });
        else c?.addEventListener('change', () => later(attempt), { once: true });
      },
      (e: unknown) => {
        if (e instanceof Error && e.message === 'released') later(attempt);
        else addEventListener('online', () => later(attempt), { once: true });
      },
    );
}

let started = false;

/** Called once at start (`main.tsx`). */
export function downloadModelInBackground(): void {
  if (started) return;
  started = true;
  const sw = container();
  if (!sw) return;
  if (sw.controller) later(attempt);
  else sw.addEventListener('controllerchange', () => later(attempt), { once: true });
}
