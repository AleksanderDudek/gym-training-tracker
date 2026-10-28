import { dishById, type Dish } from './dishes';
import { PHOTO_MODEL } from './model';
import { modelState, setModelState, settleModel } from './modelState';
import type { Reply, Request } from './recognize.worker';

/**
 * Recognises the dish on a meal photo, on the device (`recognize.worker.ts`). The first call
 * downloads the model; `prepare()` starts that download (into the service worker's copy, without
 * loading the model) as soon as the person reaches for the camera, so it runs while they frame the
 * shot. The model itself (≈ 0.2 GB while loaded: a 160 MB WebAssembly heap and the 55 MB file) is loaded only once the photo is here: a phone
 * closes a background tab that holds that much while the camera app is in front. `release()` ends
 * the worker and frees that memory when the photo screen closes; the next photo loads it again from
 * the copy. `saveModel()` fetches the files into the copy ahead of the first photo (`background.ts`
 * calls it after start). Every download and check updates `modelState.ts` for the screen.
 */

/**
 * The photo's step: the model file (`source`: downloading it or reading it from the phone; share
 * 0–1, or null when unknown), starting the model, then reading the photo.
 */
export interface Progress {
  step: 'load' | 'start' | 'read';
  share: number | null;
  source?: 'network' | 'copy';
}

/** Why a photo could not be read, in the terms the screen explains. */
export type Failure = 'offline' | 'memory' | 'error';

export function failureOf(e: unknown): Failure {
  const message = e instanceof Error ? e.message : String(e);
  if (/memory|allocat|out of bounds|RangeError/i.test(message)) return 'memory';
  if (!navigator.onLine && modelState().kind !== 'ready') return 'offline';
  return 'error';
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
/** The photo screen holds the worker (from `recognize` to `release`): a finished save leaves it running. */
let held = false;
/** A download into the copy is on its way (`saveModel(true)`). */
let saving = 0;
/** The model has been loaded into this worker (a photo, not only a save). */
let loaded = false;
const waiting = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

function fail(e: Error) {
  for (const w of waiting.values()) w.reject(e);
  waiting.clear();
}

function start(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./recognize.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = ({ data }: MessageEvent<Reply>) => {
    if (data.type === 'progress') {
      if (data.step === 'load' && data.source === 'network' && modelState().kind !== 'unsupported') setModelState({ kind: 'downloading', share: data.share });
      return listen?.({ step: data.step, share: data.share, source: data.source });
    }
    const job = waiting.get(data.id);
    waiting.delete(data.id);
    if (data.type === 'error') job?.reject(new Error(data.message));
    else job?.resolve(data);
  };
  // A worker that cannot start (old browser, a failed chunk) fails what waits and is made anew next time.
  w.onerror = (e) => {
    e.preventDefault();
    worker = null;
    loaded = false;
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

/**
 * The person reaches for the camera: if the copy lacks the model, its download starts now. Nothing
 * is loaded — the browser may be in the background with the camera in front.
 */
export function prepare(): void {
  const kind = modelState().kind;
  if (kind === 'ready' || kind === 'downloading' || kind === 'unsupported') return;
  // A failed download shows up on the status card; the photo then tries again by itself.
  saveModel(true).catch(() => undefined);
}

/** „Pobierz teraz”: the download by hand, also on mobile data. */
export const downloadModel = (): Promise<boolean> => saveModel(true);

export function recognize(image: Blob, onProgress?: (p: Progress) => void): Promise<Suggestion[]> {
  held = true;
  loaded = true;
  listen = onProgress;
  const done = () => {
    if (listen === onProgress) listen = undefined;
  };
  return ask((id) => ({ type: 'read', id, base: document.baseURI, image }))
    .then(
      (r) => {
        // The photo downloaded the model itself: the service worker kept a copy on the way.
        if (saving === 0) void settleModel({ kind: 'missing', wait: null });
        return (r.type === 'result' ? r.top : []).flatMap(({ id, score }) => (dishById(id) ? [{ dish: dishById(id)!, score }] : []));
      },
      (e: unknown) => {
        // The download may have finished and the model failed later (memory): the copy decides.
        // A closed screen (`released`) is no failure of the download.
        const released = e instanceof Error && e.message === 'released';
        if (saving === 0)
          void settleModel(released ? { kind: 'missing', wait: null } : { kind: 'failed', reason: navigator.onLine ? 'error' : 'offline' });
        throw e;
      },
    )
    .finally(done);
}

/**
 * Fetches what a photo needs into the service worker's copy, without loading the model; true when
 * all of it is there. `fetchMissing: false` only looks. The worker ends afterwards unless the photo
 * screen has taken it meanwhile. Rejects when the download fails or the photo screen releases the
 * worker first.
 */
export function saveModel(fetchMissing = true): Promise<boolean> {
  if (fetchMissing) {
    saving++;
    // From "not there" straight to "downloading", before the first byte; a model already in the copy
    // shows no download at all (the worker reports one only when it fetches from the network).
    const kind = modelState().kind;
    if (kind === 'missing' || kind === 'failed') setModelState({ kind: 'downloading', share: null });
  }
  return ask((id) => ({ type: 'save', id, base: document.baseURI, fetchMissing }))
    .then(
      (r) => {
        const saved = r.type === 'saved' && r.saved;
        // Not saved although it fetched: no Cache API, or the disk is full.
        if (saved) setModelState({ kind: 'ready' });
        else if (fetchMissing) setModelState(typeof caches === 'undefined' ? { kind: 'unsupported' } : { kind: 'failed', reason: 'storage' });
        else if (modelState().kind !== 'downloading') setModelState({ kind: 'missing', wait: null });
        return saved;
      },
      (e: unknown) => {
        if (e instanceof Error && e.message === 'released') {
          if (modelState().kind === 'downloading') setModelState({ kind: 'missing', wait: null });
        } else if (fetchMissing) setModelState({ kind: 'failed', reason: navigator.onLine ? 'error' : 'offline' });
        throw e;
      },
    )
    .finally(() => {
      if (fetchMissing) saving--;
      // Another request still waits on this worker (a second save, a look): it ends after that one.
      if (held || !worker || waiting.size > 0) return;
      worker.terminate();
      worker = null;
      loaded = false;
    });
}

export function release(): void {
  // Only a download, no model in memory: let it finish (it ends the worker itself) — closing the
  // sheet should not throw away 40 MB already fetched.
  if (saving > 0 && !loaded) {
    held = false;
    listen = undefined;
    return;
  }
  loaded = false;
  worker?.terminate();
  worker = null;
  held = false;
  listen = undefined;
  fail(new Error('released'));
}
