/**
 * The photo model downloads by itself, right after the app starts — the first start included — so
 * the first meal photo works at once and offline. It goes into the copy `gt-photo-model`: through
 * the service worker once it controls the page, written by the photo worker itself before that
 * (the first start). Later starts only check the copy, which takes a moment and downloads nothing.
 *
 * - A couple of seconds after start, when the browser is idle: never alongside the first screen.
 * - On any connection, mobile data too (the owner's call: the feature should simply be there).
 *   Only „Oszczędzanie danych” — a setting the person chose — stops it; then the photo screen
 *   offers „Pobierz model”, and a change of the setting starts it.
 * - Offline it waits for `online`; a dropped download tries again then, or in a minute.
 * - `recognize.ts` (with the dish catalog) loads only then, not with the app's first screen.
 * - A photo screen closed mid-download (which ends the shared worker) is followed by another try.
 */

import { setModelState } from './modelState';

/** The part of the Network Information API this reads (Chrome on Android; none in Safari or Firefox). */
interface Connection extends EventTarget {
  saveData?: boolean;
}

/** Whether to download unasked: yes, unless the person turned on data saving. */
export const allowed = (c: Connection | undefined): boolean => !c?.saveData;

const connection = () => (navigator as Navigator & { connection?: Connection }).connection;

const AFTER_START_MS = 2000;
const RETRY_MS = 60_000;
/** A server that keeps failing is not asked every minute for ever; the photo screen still offers the button. */
const RETRIES = 3;
let failures = 0;

/** A moment on, then when the browser has nothing else to do (or at once where it cannot tell). */
function later(run: () => void, ms = AFTER_START_MS): void {
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: AFTER_START_MS });
    else run();
  }, ms);
}

function attempt(): void {
  const c = connection();
  const now = navigator.onLine && allowed(c);
  import('./recognize')
    .then(({ saveModel }) => saveModel(now))
    .then(
      (saved) => {
        // Not saved although it fetched (a full disk): trying again would only download it again.
        if (saved || now) return;
        // The photo screen says why it is not there yet.
        setModelState({ kind: 'missing', wait: navigator.onLine ? 'saver' : 'offline' });
        if (!navigator.onLine) addEventListener('online', () => later(attempt), { once: true });
        else c?.addEventListener('change', () => later(attempt), { once: true });
      },
      (e: unknown) => {
        if (e instanceof Error && e.message === 'released') return later(attempt);
        if (!navigator.onLine) addEventListener('online', () => later(attempt), { once: true });
        else if (++failures < RETRIES) later(attempt, RETRY_MS);
      },
    );
}

let started = false;

/** Called once at start (`main.tsx`). */
export function downloadModelInBackground(): void {
  if (started) return;
  started = true;
  if (typeof caches === 'undefined') return setModelState({ kind: 'unsupported' });
  later(attempt);
}
