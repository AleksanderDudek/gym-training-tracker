import { useSyncExternalStore } from 'react';
import { PHOTO_MODEL } from './model';

/**
 * Where the photo model stands on this device, for the photo screen: in the service worker's copy,
 * downloading, not there yet (and why), or failed. Written by the background download
 * (`background.ts`), by the downloads in `recognize.ts` and by a quick look in the cache when the
 * photo screen opens (`checkModel`). Small on purpose: it does not pull in the dish catalog.
 */
export type ModelState =
  | { kind: 'unknown' }
  | { kind: 'ready' }
  | { kind: 'downloading'; share: number | null }
  /** `wait`: why the background download has not run — mobile data or no network; `null` when it simply has not yet. */
  | { kind: 'missing'; wait: 'mobile' | 'offline' | null }
  | { kind: 'failed'; reason: 'offline' | 'storage' | 'error' }
  /** No service worker or Cache API (plain http, a private window in some browsers): every photo downloads it. */
  | { kind: 'unsupported' };

let state: ModelState = { kind: 'unknown' };
const listeners = new Set<() => void>();

export const modelState = (): ModelState => state;

export function setModelState(next: ModelState): void {
  if (next.kind === state.kind && JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useModelState = (): ModelState => useSyncExternalStore(subscribe, modelState, modelState);

/** Where the app serves the model; the service worker's copy is keyed by this address. */
export const modelHref = (base: string = document.baseURI) => new URL(`${PHOTO_MODEL.dir}/vision.onnx`, base).href;

/** The page itself looks in the copy — no worker, no download. Only while nothing better is known. */
export async function checkModel(): Promise<void> {
  if (state.kind !== 'unknown') return;
  let sw: ServiceWorkerContainer | undefined;
  try {
    sw = navigator.serviceWorker ?? undefined;
  } catch {
    // A sandboxed frame throws on the getter.
  }
  if (!sw || typeof caches === 'undefined') return setModelState({ kind: 'unsupported' });
  // The first visit: the service worker takes over in a moment, and the background download follows.
  if (!sw.controller) return setModelState({ kind: 'missing', wait: null });
  try {
    const hit = await caches.match(modelHref());
    // A download may have started while the cache answered; its state wins.
    if (state.kind === 'unknown') setModelState(hit ? { kind: 'ready' } : { kind: 'missing', wait: null });
  } catch {
    if (state.kind === 'unknown') setModelState({ kind: 'missing', wait: null });
  }
}

/**
 * A photo that downloaded the model itself has ended: the page looks in the copy (the service
 * worker writes it just after the last byte, so it waits a little) — no worker, which the photo
 * screen may be ending right now. Not there: `otherwise`. Only while the card still says
 * "downloading": a save on its way reports for itself.
 */
export async function settleModel(otherwise: ModelState): Promise<void> {
  for (let i = 0; i < 20 && typeof caches !== 'undefined'; i++) {
    if (state.kind !== 'downloading') return;
    try {
      if (await caches.match(modelHref())) return setModelState({ kind: 'ready' });
    } catch {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (state.kind === 'downloading') setModelState(otherwise);
}

/** Test hook: back to "not looked yet". */
export function resetModelState(): void {
  state = { kind: 'unknown' };
  listeners.forEach((l) => l());
}
