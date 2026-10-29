// Builds src/food/photo/data/dish-embeddings.{json,bin}: one vector per phrase of each dish in the
// photo catalog (src/food/photo/dishes.ts), from the text half of the same SigLIP 2 model whose image
// half the app ships (src/food/photo/model.ts). The phone compares a photo's vector with these, so
// the text model (1.1 GB) never leaves the build machine.
//
// Each phrase is wrapped by `promptOf` ("a photo of pierogi."), lower-cased as SigLIP 2 expects, and
// padded to 64 tokens. Vectors are L2-normalised and stored as int8 with one scale per row (768 bytes
// a phrase instead of 3 KB; measured: no change in which dish wins). The JSON holds the row order,
// the scales and the model revision, so a model bump without a re-run fails the test.
//
// The text model is kept in ~/.cache/gym-tracker/hf/ (or HF_CACHE) and reused. Same catalog, same
// bytes out. Usage: npm run food:dish-embeddings
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AutoTokenizer, SiglipTextModel, env } from '@huggingface/transformers';
import { DISHES } from '../../src/food/photo/dishes';
import { PHOTO_MODEL, promptOf } from '../../src/food/photo/model';

const OUT = 'src/food/photo/data/dish-embeddings';

env.cacheDir = process.env.HF_CACHE ?? join(homedir(), '.cache/gym-tracker/hf');
env.allowLocalModels = false;

const rows = DISHES.flatMap((d) => d.prompts.map((phrase) => ({ id: d.id, text: promptOf(phrase).toLowerCase() })));
const options = { revision: PHOTO_MODEL.revision };
const tokenizer = await AutoTokenizer.from_pretrained(PHOTO_MODEL.repo, options);
const model = await SiglipTextModel.from_pretrained(PHOTO_MODEL.repo, { ...options, dtype: 'fp32' });

const dim = 768;
const data = new Int8Array(rows.length * dim);
const scales: number[] = [];
for (let i = 0; i < rows.length; i += 32) {
  const batch = rows.slice(i, i + 32);
  const inputs = tokenizer(
    batch.map((r) => r.text),
    { padding: 'max_length', truncation: true, max_length: 64 },
  );
  const { pooler_output: out } = await model(inputs);
  if (out.dims[1] !== dim) throw new Error(`expected ${dim} dims, got ${out.dims[1]}`);
  const values = out.data as Float32Array;
  batch.forEach((_, j) => {
    const v = values.subarray(j * dim, (j + 1) * dim);
    const norm = Math.hypot(...v);
    const max = Math.max(...Array.from(v, (x) => Math.abs(x / norm)));
    // The scale is rounded first, so the bytes are quantised against the value the JSON stores.
    const scale = Number((max / 127).toPrecision(6));
    scales.push(scale);
    for (let k = 0; k < dim; k++) data[(i + j) * dim + k] = Math.round(v[k]! / norm / scale);
  });
  process.stdout.write(`\r${Math.min(i + 32, rows.length)}/${rows.length}`);
}
process.stdout.write('\n');

await mkdir('src/food/photo/data', { recursive: true });
await writeFile(`${OUT}.bin`, data);
const generic = DISHES.filter((d) => d.generic).map((d) => d.id);
const meta = { repo: PHOTO_MODEL.repo, revision: PHOTO_MODEL.revision, prompt: promptOf('{}'), dim, rows: rows.map((r) => r.id), scales, generic };
await writeFile(`${OUT}.json`, `${JSON.stringify(meta)}\n`);
console.log(`${rows.length} phrases of ${DISHES.length} dishes → ${OUT}.bin (${data.length} B)`);
