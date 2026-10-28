/**
 * A phone closes a browser tab it needs memory for — most often while the camera app is in front,
 * sometimes while the model reads the photo. The page then starts afresh and the photo screen is
 * gone without a word. So before the camera opens, a small marker goes into `localStorage`; once
 * the photo is here it is kept in a local cache until the result shows. If the app starts with a
 * marker left (`interrupted()`), it reopens the photo screen and says what happened. Every normal
 * ending — a result, an error, a cancelled picker, the sheet closed, the page left by hand — clears
 * both. The photo never leaves the device.
 */

export type RunStage = 'camera' | 'reading';

export interface Interrupted {
  stage: RunStage;
  /** How many analyses in a row ended this way (1 for the first). */
  tries: number;
}

const KEY = 'gt-photo-run';
const CACHE = 'gt-photo-pending';
const PHOTO = 'pending-photo';
/** Older than this, a marker is not news — the person has long moved on. */
const FRESH_MS = 30 * 60 * 1000;

interface Marker {
  stage: RunStage;
  at: number;
  tries: number;
}

function read(): Marker | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<Marker>;
    if ((m.stage !== 'camera' && m.stage !== 'reading') || typeof m.at !== 'number') return null;
    return { stage: m.stage, at: m.at, tries: typeof m.tries === 'number' ? m.tries : 0 };
  } catch {
    return null;
  }
}

function write(m: Marker): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Without storage there is nothing to recover from; the photo still works.
  }
}

/** The camera or gallery is about to open. `tries`: analyses already interrupted before this one. */
export function markCamera(tries = 0): void {
  write({ stage: 'camera', at: Date.now(), tries });
}

/** The photo is here and goes to the model: it is kept until `clearRun()`. */
export async function markReading(photo: Blob, tries = 0): Promise<void> {
  write({ stage: 'reading', at: Date.now(), tries: tries + 1 });
  try {
    const cache = await caches.open(CACHE);
    // Bytes rather than the Blob itself: not every Response implementation (jsdom’s) reads a Blob body.
    await cache.put(PHOTO, new Response(await photo.arrayBuffer(), { headers: { 'content-type': photo.type || 'image/jpeg' } }));
  } catch {
    // No Cache API (or no space): after a crash it says so, just without the photo.
  }
}

/** The run ended in a way the person saw. */
export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  if (typeof caches !== 'undefined') caches.delete(CACHE).catch(() => undefined);
}

/** A run the system cut short, if the app has just started again within half an hour of it. */
export function interrupted(now = Date.now()): Interrupted | null {
  const m = read();
  if (!m) {
    // A photo kept by a run whose marker went with a reload by hand.
    if (typeof caches !== 'undefined') caches.delete(CACHE).catch(() => undefined);
    return null;
  }
  if (now - m.at > FRESH_MS || now < m.at) {
    clearRun();
    return null;
  }
  return { stage: m.stage, tries: m.tries };
}

/** The photo kept by `markReading`, if it survived. */
export async function pendingPhoto(): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(CACHE)).match(PHOTO);
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

let leaving = false;

/** Leaving the page by hand (reload, another site) is not the system closing it. Once, at start. */
export function clearRunOnLeave(): void {
  if (leaving || typeof addEventListener !== 'function') return;
  leaving = true;
  addEventListener('pagehide', () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
  });
}
