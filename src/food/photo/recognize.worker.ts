/**
 * The photo model off the main thread: ONNX Runtime (WebAssembly, one thread — the app is not
 * cross-origin isolated, so there is no SharedArrayBuffer) runs SigLIP 2's image half, and
 * `rank` compares its vector with the dish table. Reading one photo takes about a second on a
 * laptop and a few on a phone; on the main thread that would freeze the screen.
 *
 * Everything comes from the app's own server: the runtime's .wasm (an asset with a hash), the
 * model (`models/<version>/vision.onnx`) and the dish table. The service worker keeps copies after
 * the first photo — or before it, when the app saves them in the background (`save`, without
 * loading the model). The photo itself never leaves this worker.
 */
import * as ort from 'onnxruntime-web/wasm';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import tableUrl from './data/dish-embeddings.bin?url';
import meta from './data/dish-embeddings.json';
import { PHOTO_CACHE, PHOTO_MODEL } from './model';
import { loadTable, rank, type DishTable } from './score';

/** `controlled`: the page is under the service worker, which keeps the copy; otherwise this worker writes it. */
export type Request =
  | { type: 'warm'; id: number; base: string; controlled: boolean }
  | { type: 'save'; id: number; base: string; fetchMissing: boolean; controlled: boolean }
  | { type: 'read'; id: number; base: string; image: Blob; controlled: boolean };
export type Reply =
  /** `load`: the model file (`source` says from where); `start`: ONNX Runtime builds the session; `read`: the photo itself. */
  | { type: 'progress'; step: 'load' | 'start' | 'read'; share: number | null; source?: 'network' | 'copy' }
  | { type: 'result'; id: number; top: { id: string; score: number; cos: number }[] }
  | { type: 'saved'; id: number; saved: boolean }
  | { type: 'warmed'; id: number }
  | { type: 'error'; id: number; message: string };

// The app's types are the page's (DOM); a worker's own global is only this much of it.
const scope = self as unknown as { postMessage(m: Reply): void; onmessage: ((e: MessageEvent<Request>) => void) | null };
const post = (m: Reply) => scope.postMessage(m);

const wasmHref = new URL(wasm, self.location.href).href;
const tableHref = new URL(tableUrl, self.location.href).href;
const modelUrl = (base: string) => new URL(`${PHOTO_MODEL.dir}/vision.onnx`, base).href;

ort.env.wasm.wasmPaths = { wasm: wasmHref };
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

/**
 * The model file with progress. Counted against its known size: a server that compresses it
 * reports the compressed length, while the stream yields the file's own bytes. `keep: false` only
 * reads it through, for the copy, without holding 55 MB here. Without the service worker (the
 * first start, before it takes over) the copy is written here, from a second branch of the stream.
 */
async function download(url: string, keep: boolean, controlled: boolean): Promise<Uint8Array> {
  const source = typeof caches !== 'undefined' && (await has(url)) ? 'copy' : 'network';
  post({ type: 'progress', step: 'load', share: 0, source });
  const res = await fromCopyOrNet(url, controlled);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = PHOTO_MODEL.bytes;
  const out = new Uint8Array(keep ? total : 0);
  let body = res.body;
  let stored: Promise<void> | null = null;
  if (!controlled && source === 'network' && typeof caches !== 'undefined') {
    const [mine, copy] = body.tee();
    body = mine;
    stored = caches.open(PHOTO_CACHE).then((c) => c.put(url, new Response(copy, { headers: res.headers })));
  }
  const reader = body.getReader();
  let got = 0;
  let last = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (got + value.length > total) throw new Error(`model is larger than ${total} bytes`);
      if (keep) out.set(value, got);
      got += value.length;
      const share = got / total;
      if (share - last >= 0.01) {
        last = share;
        post({ type: 'progress', step: 'load', share, source });
      }
    }
    if (got !== total) throw new Error(`model is ${got} bytes, expected ${total}`);
    await stored;
  } catch (e) {
    // A cut or wrong answer (a captive portal's page, a dropped connection) must not stay in the copy
    // as if it were the model — whoever wrote it, this worker or the service worker. The next try
    // downloads it afresh.
    void reader.cancel().catch(ignore);
    await stored?.catch(ignore);
    if (typeof caches !== 'undefined') await caches.open(PHOTO_CACHE).then((c) => c.delete(url)).catch(ignore);
    throw e;
  }
  return out;
}

/** Under the service worker its `CacheFirst` reads the copy; without it, this worker does. */
async function fromCopyOrNet(url: string, controlled: boolean): Promise<Response> {
  if (!controlled && typeof caches !== 'undefined') {
    const hit = await caches.match(url);
    if (hit) return hit;
  }
  return fetch(url);
}

/** A small file into the copy: through the service worker, or written here when there is none yet. */
async function fetchInto(url: string, controlled: boolean): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (controlled) await res.arrayBuffer();
  else await (await caches.open(PHOTO_CACHE)).put(url, res);
}

/** The files of an older app version in the copy: the ones this worker wrote are not the expiration plugin's to remove. */
const PHOTO_FILE = /\/assets\/(?:recognize\.worker|ort-wasm-simd-threaded|dish-embeddings)-[\w-]+\.(?:js|wasm|bin)$|\/models\/[\w.-]+\/vision\.onnx$/;

async function prune(base: string): Promise<void> {
  const keep = new Set(files(base));
  const cache = await caches.open(PHOTO_CACHE);
  for (const req of await cache.keys()) if (PHOTO_FILE.test(new URL(req.url).pathname) && !keep.has(req.url)) await cache.delete(req);
}

let ready: Promise<{ session: ort.InferenceSession; table: DishTable }> | null = null;
let saving: Promise<boolean> | null = null;
const ignore = () => undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const has = async (url: string) => (await caches.match(url)) !== undefined;

/** The service worker writes its copy just after the response is read; this waits for it a little. */
async function landed(url: string, tries = 20): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await has(url)) return true;
    await sleep(250);
  }
  return false;
}

const files = (base: string) => [self.location.href, wasmHref, tableHref, modelUrl(base)];

/** Whether everything a photo needs is in the service worker's copy. */
async function inCopy(base: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  for (const url of files(base)) if (!(await has(url))) return false;
  return true;
}

/**
 * Fetches, through the service worker and into its copy, what reading a photo needs and the copy
 * lacks: this worker, the runtime, the dish table and the model. Nothing is loaded, so it costs
 * no memory. True when all of it is in the copy; false without one (no Cache API, a full disk).
 * `fetchMissing: false` only looks (offline, mobile data).
 */
function save(base: string, fetchMissing: boolean, controlled: boolean): Promise<boolean> {
  if (!fetchMissing) return (saving ?? Promise.resolve()).catch(ignore).then(() => inCopy(base));
  saving ??= (async () => {
    // A photo already loading the model fetches it now; the copy is checked once it has.
    await ready?.catch(ignore);
    if (typeof caches === 'undefined') return false;
    for (const url of files(base)) {
      if (await has(url)) continue;
      if (url === modelUrl(base)) await download(url, false, controlled);
      else await fetchInto(url, controlled);
    }
    // Writing 55 MB takes a slow phone a while: up to half a minute for the model, 5 s for the rest.
    for (const url of files(base)) if (!(await landed(url, url === modelUrl(base) ? 120 : 20))) return false;
    await prune(base).catch(ignore);
    return true;
  })().catch((e: unknown) => {
    saving = null;
    throw e;
  });
  return saving;
}

function load(base: string, controlled: boolean) {
  ready ??= (async () => {
    post({ type: 'progress', step: 'load', share: null });
    // The background save is on its way: its model is read from the copy once it is in, not
    // downloaded a second time alongside.
    await saving?.catch(ignore);
    const [model, bytes] = await Promise.all([
      download(modelUrl(base), true, controlled),
      fromCopyOrNet(tableHref, controlled).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for the dish table`);
        return new Int8Array(await r.arrayBuffer());
      }),
    ]);
    post({ type: 'progress', step: 'start', share: null });
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return { session, table: loadTable(meta, bytes) };
  })().catch((e: unknown) => {
    // The next photo tries again: a dropped connection should not need a reload.
    ready = null;
    throw e;
  });
  return ready;
}

/** SigLIP's input: the photo squashed to 224 × 224 (no crop), RGB in −1…1, channels first. */
async function pixels(image: Blob): Promise<ort.Tensor> {
  const size = PHOTO_MODEL.size;
  const bitmap = await createImageBitmap(image);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = data[i * 4]! / 127.5 - 1;
    out[plane + i] = data[i * 4 + 1]! / 127.5 - 1;
    out[2 * plane + i] = data[i * 4 + 2]! / 127.5 - 1;
  }
  return new ort.Tensor('float32', out, [1, 3, size, size]);
}

scope.onmessage = async ({ data: req }) => {
  try {
    if (req.type === 'save') {
      post({ type: 'saved', id: req.id, saved: await save(req.base, req.fetchMissing, req.controlled) });
      return;
    }
    if (req.type === 'warm') {
      await load(req.base, req.controlled);
      post({ type: 'warmed', id: req.id });
      return;
    }
    const { session, table } = await load(req.base, req.controlled);
    post({ type: 'progress', step: 'read', share: null });
    const out = await session.run({ pixel_values: await pixels(req.image) });
    const pooled = out.pooler_output;
    if (!pooled) throw new Error('no pooler_output');
    post({ type: 'result', id: req.id, top: rank(table, pooled.data as Float32Array, PHOTO_MODEL.logitScale) });
  } catch (e) {
    post({ type: 'error', id: req.id, message: e instanceof Error ? e.message : String(e) });
  }
};
