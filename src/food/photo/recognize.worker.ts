/**
 * The photo model off the main thread: ONNX Runtime (WebAssembly, one thread — the app is not
 * cross-origin isolated, so there is no SharedArrayBuffer) runs SigLIP 2's image half, and
 * `rank` compares its vector with the dish table. Reading one photo takes about a second on a
 * laptop and a few on a phone; on the main thread that would freeze the screen.
 *
 * Everything comes from the app's own server: the runtime's .wasm (an asset with a hash), the
 * model (`models/<version>/vision.onnx`) and the dish table. The service worker keeps copies after
 * the first photo. The photo itself never leaves this worker.
 */
import * as ort from 'onnxruntime-web/wasm';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import tableUrl from './data/dish-embeddings.bin?url';
import meta from './data/dish-embeddings.json';
import { PHOTO_MODEL } from './model';
import { loadTable, rank, type DishTable } from './score';

export type Request = { type: 'warm'; base: string } | { type: 'read'; id: number; base: string; image: Blob };
export type Reply =
  | { type: 'progress'; step: 'load' | 'read'; share: number | null }
  | { type: 'result'; id: number; top: { id: string; score: number }[] }
  | { type: 'error'; id: number | null; message: string };

// The app's types are the page's (DOM); a worker's own global is only this much of it.
const scope = self as unknown as { postMessage(m: Reply): void; onmessage: ((e: MessageEvent<Request>) => void) | null };
const post = (m: Reply) => scope.postMessage(m);

ort.env.wasm.wasmPaths = { wasm: new URL(wasm, self.location.href).href };
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

/**
 * The model file with progress. Counted against its known size: a server that compresses it
 * reports the compressed length, while the stream yields the file's own bytes.
 */
async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = PHOTO_MODEL.bytes;
  const out = new Uint8Array(total);
  const reader = res.body.getReader();
  let got = 0;
  let last = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > total) throw new Error(`model is larger than ${total} bytes`);
    out.set(value, got);
    got += value.length;
    const share = got / total;
    if (share - last >= 0.01) {
      last = share;
      post({ type: 'progress', step: 'load', share });
    }
  }
  if (got !== total) throw new Error(`model is ${got} bytes, expected ${total}`);
  return out;
}

let ready: Promise<{ session: ort.InferenceSession; table: DishTable }> | null = null;

function load(base: string) {
  ready ??= (async () => {
    post({ type: 'progress', step: 'load', share: null });
    const [model, bytes] = await Promise.all([
      download(new URL(`${PHOTO_MODEL.dir}/vision.onnx`, base).href),
      fetch(new URL(tableUrl, self.location.href)).then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for the dish table`);
        return new Int8Array(await r.arrayBuffer());
      }),
    ]);
    post({ type: 'progress', step: 'load', share: null });
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
    if (req.type === 'warm') {
      await load(req.base);
      return;
    }
    const { session, table } = await load(req.base);
    post({ type: 'progress', step: 'read', share: null });
    const out = await session.run({ pixel_values: await pixels(req.image) });
    const pooled = out.pooler_output;
    if (!pooled) throw new Error('no pooler_output');
    post({ type: 'result', id: req.id, top: rank(table, pooled.data as Float32Array, PHOTO_MODEL.logitScale) });
  } catch (e) {
    post({ type: 'error', id: req.type === 'read' ? req.id : null, message: e instanceof Error ? e.message : String(e) });
  }
};
