/**
 * Which dish a photo shows, from vectors: the photo's (from the image model) against each dish
 * phrase's (precomputed, `scripts/food/dish-embeddings.ts`). Pure, so the worker and the tests share it.
 *
 * A dish has two or three phrases ("pierogi", "polish dumplings with fried onion"); its similarity is
 * the best of them, so a dish with more phrases is not favoured. Probabilities are a softmax over
 * dishes at the model's logit scale: on the 904 test photos a top probability ≥ 0.6 was right 93 %
 * of the time, below 0.4 only a third.
 */

export interface DishTable {
  /** Dish ids, each once, in the order of their first phrase. */
  ids: readonly string[];
  /** For each phrase row, the index of its dish in `ids`. */
  rowDish: Uint16Array;
  /** Rows × dim, L2-normalised. */
  vectors: Float32Array;
  dim: number;
}

export interface TableMeta {
  dim: number;
  rows: readonly string[];
  scales: readonly number[];
}

/** Rebuilds the float table from the stored int8 rows and their scales. */
export function loadTable(meta: TableMeta, bytes: Int8Array): DishTable {
  if (bytes.length !== meta.rows.length * meta.dim || meta.scales.length !== meta.rows.length) throw new Error('dish table does not match its rows');
  const ids: string[] = [];
  const index = new Map<string, number>();
  const rowDish = new Uint16Array(meta.rows.length);
  meta.rows.forEach((id, r) => {
    if (!index.has(id)) index.set(id, ids.push(id) - 1);
    rowDish[r] = index.get(id)!;
  });
  const vectors = new Float32Array(bytes.length);
  for (let r = 0; r < meta.rows.length; r++) for (let k = 0; k < meta.dim; k++) vectors[r * meta.dim + k] = bytes[r * meta.dim + k]! * meta.scales[r]!;
  return { ids, rowDish, vectors, dim: meta.dim };
}

export interface Ranked {
  id: string;
  /** Softmax probability over all dishes, 0–1. */
  score: number;
}

export function rank(table: DishTable, image: Float32Array, logitScale: number, top = 5): Ranked[] {
  if (image.length !== table.dim) throw new Error(`expected ${table.dim} values, got ${image.length}`);
  let norm = 0;
  for (const x of image) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  const best = new Float32Array(table.ids.length).fill(-Infinity);
  for (let r = 0; r < table.rowDish.length; r++) {
    let cos = 0;
    for (let k = 0; k < table.dim; k++) cos += table.vectors[r * table.dim + k]! * image[k]!;
    const d = table.rowDish[r]!;
    if (cos / norm > best[d]!) best[d] = cos / norm;
  }
  const max = Math.max(...best);
  let sum = 0;
  const weights = Array.from(best, (c) => {
    const w = Math.exp(logitScale * (c - max));
    sum += w;
    return w;
  });
  return weights
    .map((w, i) => ({ id: table.ids[i]!, score: w / sum }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}
