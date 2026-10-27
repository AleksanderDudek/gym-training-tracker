import { dishById, type Dish } from './dishes';
import { PHOTO_MODEL } from './model';
import type { Reply, Request } from './recognize.worker';

/**
 * Recognises the dish on a meal photo, on the device (`recognize.worker.ts`). The first call
 * downloads the model; `warmUp()` starts that as soon as the person reaches for the camera, so the
 * download runs while they frame the shot. `release()` ends the worker and frees its memory
 * (≈ 0.5 GB while loaded) when the photo screen closes; the next photo loads it again from the
 * service worker's copy.
 */

/** The model's step: downloading/loading (share 0–1, or null when unknown) and reading the photo. */
export interface Progress {
  step: 'load' | 'read';
  share: number | null;
}

export interface Suggestion {
  dish: Dish;
  /** Softmax probability over the catalog, 0–1. */
  score: number;
}

/** What the browser downloads the first time, for the notice before it does: the model and the runtime (≈ 4 MB compressed). */
export const MODEL_MB = Math.round(PHOTO_MODEL.bytes / 1e6 + 4);

let worker: Worker | null = null;
let next = 0;
let listen: ((p: Progress) => void) | undefined;
const waiting = new Map<number, { resolve: (s: Suggestion[]) => void; reject: (e: Error) => void }>();

function fail(e: Error) {
  for (const w of waiting.values()) w.reject(e);
  waiting.clear();
}

function start(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./recognize.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }: MessageEvent<Reply>) => {
    if (data.type === 'progress') return listen?.({ step: data.step, share: data.share });
    if (data.type === 'error' && data.id === null) return console.warn('photo model:', data.message);
    const job = waiting.get(data.id!);
    waiting.delete(data.id!);
    if (data.type === 'error') job?.reject(new Error(data.message));
    else job?.resolve(data.top.flatMap(({ id, score }) => (dishById(id) ? [{ dish: dishById(id)!, score }] : [])));
  };
  // A worker that cannot start (old browser, a failed chunk) fails what waits and is made anew next time.
  w.onerror = (e) => {
    e.preventDefault();
    worker = null;
    w.terminate();
    fail(new Error(e.message || 'photo worker failed'));
  };
  worker = w;
  return w;
}

const send = (req: Request) => start().postMessage(req);

export function warmUp(): void {
  send({ type: 'warm', base: document.baseURI });
}

export function recognize(image: Blob, onProgress?: (p: Progress) => void): Promise<Suggestion[]> {
  listen = onProgress;
  const id = ++next;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    send({ type: 'read', id, base: document.baseURI, image });
  });
}

export function release(): void {
  worker?.terminate();
  worker = null;
  listen = undefined;
  fail(new Error('released'));
}
