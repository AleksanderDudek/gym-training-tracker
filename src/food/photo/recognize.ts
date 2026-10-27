import { dishById, type Dish } from './dishes';
import { PHOTO_MODEL } from './model';
import type { Reply, Request } from './recognize.worker';

/**
 * Recognises the dish on a meal photo, on the device (`recognize.worker.ts`). The first call
 * downloads the model; `warmUp()` starts that as soon as the person reaches for the camera, so the
 * download runs while they frame the shot. `release()` ends the worker and frees its memory
 * (≈ 0.5 GB while loaded) when the photo screen closes; the next photo loads it again from the
 * service worker's copy. `saveModel()` fetches the files into that copy ahead of the first photo,
 * without loading the model (`background.ts` calls it after start).
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
/** The photo screen holds the worker (from `warmUp`/`recognize` to `release`): a finished save leaves it running. */
let held = false;
let saved = false;
const waiting = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

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
    else job?.resolve(data);
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

function ask(req: (id: number) => Request): Promise<Reply> {
  const id = ++next;
  return new Promise<Reply>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    send(req(id));
  });
}

export function warmUp(): void {
  held = true;
  // Progress of a warm-up belongs to no photo yet; the last photo's screen must not take it as its own.
  listen = undefined;
  send({ type: 'warm', base: document.baseURI });
}

export function recognize(image: Blob, onProgress?: (p: Progress) => void): Promise<Suggestion[]> {
  held = true;
  listen = onProgress;
  const done = () => {
    if (listen === onProgress) listen = undefined;
  };
  return ask((id) => ({ type: 'read', id, base: document.baseURI, image }))
    .then((r) => (r.type === 'result' ? r.top : []).flatMap(({ id, score }) => (dishById(id) ? [{ dish: dishById(id)!, score }] : [])))
    .finally(done);
}

/**
 * Fetches what a photo needs into the service worker's copy, without loading the model; true when
 * all of it is there. `fetchMissing: false` only looks. The worker ends afterwards unless the photo
 * screen has taken it meanwhile. Rejects when the download fails or the photo screen releases the
 * worker first.
 */
export function saveModel(fetchMissing = true): Promise<boolean> {
  return ask((id) => ({ type: 'save', id, base: document.baseURI, fetchMissing }))
    .then((r) => (saved = r.type === 'saved' && r.saved))
    .finally(() => {
      if (held || !worker) return;
      worker.terminate();
      worker = null;
    });
}

/** The model is in the service worker's copy (a background save said so): the first photo downloads nothing. */
export const modelSaved = (): boolean => saved;

export function release(): void {
  worker?.terminate();
  worker = null;
  held = false;
  listen = undefined;
  fail(new Error('released'));
}
