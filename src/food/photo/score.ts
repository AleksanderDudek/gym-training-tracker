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
  /** The raw cosine of the photo and the dish's best phrase: how well it fits at all (`NOT_FOOD_COS`). */
  cos: number;
}

/**
 * How well the best dish fits, as the raw cosine (SigLIP 2's own calibrated match is
 * sigmoid(112.67 · cos − 16.77)). Measured on the shipped weights: plated food 0.128–0.190; food in
 * pans and woks on the stove 0.106–0.181; screens, rooms, streets 0.051–0.092, a cat on a sofa
 * 0.115–0.121 (`2026-10-29-zdjecie-szacunek-design.md`, `2026-10-30-zdjecie-pamiec-design.md`).
 *
 * Below `NOT_FOOD_COS` the photo shows no food. Between it and `WEAK_FOOD_COS` food and other
 * things overlap: calling real food "no food" there costs the person more than a guess they can
 * remove, so the screen guesses and says it is unsure.
 */
export const NOT_FOOD_COS = 0.085;
export const WEAK_FOOD_COS = 0.12;

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
    .map((w, i) => ({ id: table.ids[i]!, score: w / sum, cos: best[i]! }))
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}
