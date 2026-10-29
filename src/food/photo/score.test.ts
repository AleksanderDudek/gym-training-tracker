import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import photos from '../test/photo-vectors.json';
import meta from './data/dish-embeddings.json';
import { DISHES } from './dishes';
import { PHOTO_MODEL, promptOf } from './model';
import { NOT_FOOD_COS, loadTable, rank } from './score';

const bytes = new Int8Array(readFileSync(new URL('./data/dish-embeddings.bin', import.meta.url)));
const table = loadTable(meta, bytes);

describe('dish table', () => {
  it('has a row for every phrase of every dish, in catalog order, from the shipped model', () => {
    // A catalog change without `npm run food:dish-embeddings` fails here.
    expect(meta.rows).toEqual(DISHES.flatMap((d) => d.prompts.map(() => d.id)));
    expect(meta).toMatchObject({ repo: PHOTO_MODEL.repo, revision: PHOTO_MODEL.revision, prompt: promptOf('{}'), dim: 768 });
    expect(table.ids).toEqual(DISHES.map((d) => d.id));
  });

  it('refuses bytes that do not fit the rows', () => {
    expect(() => loadTable(meta, bytes.subarray(1))).toThrow();
  });
});

describe('rank', () => {
  it('a dish scores by its best phrase, and the scores are a distribution', () => {
    const small = loadTable({ dim: 2, rows: ['a', 'a', 'b'], scales: [1 / 127, 1 / 127, 1 / 127] }, new Int8Array([127, 0, 0, 127, 90, 90]));
    const top = rank(small, new Float32Array([0, 3]), 10);
    expect(top.map((t) => t.id)).toEqual(['a', 'b']);
    expect(top[0]!.score + top[1]!.score).toBeCloseTo(1);
    expect(() => rank(small, new Float32Array(3), 10)).toThrow();
  });

  it('real photo vectors from the model land on their dish', () => {
    const top1 = (v: number[]) => rank(table, Float32Array.from(v), PHOTO_MODEL.logitScale)[0]!;
    expect(top1(photos.pizza).id).toMatch(/^pizza/);
    expect(top1(photos.ramen).id).toBe('ramen');
    expect(top1(photos.sushi).id).toMatch(/sushi|nigiri|maki|roll/i);
    expect(top1(photos.pierogi).id).toMatch(/^pierogi/);
    expect(rank(table, Float32Array.from(photos.pizza), PHOTO_MODEL.logitScale)).toHaveLength(5);
  });

  it('a real food photo fits its dish well above the "not food" line; a vector pointing nowhere does not', () => {
    for (const v of [photos.pizza, photos.ramen, photos.sushi, photos.pierogi]) expect(rank(table, Float32Array.from(v), PHOTO_MODEL.logitScale)[0]!.cos).toBeGreaterThan(NOT_FOOD_COS);
    // Orthogonal to every phrase as far as it goes: a photo of nothing the catalog knows.
    const nowhere = new Float32Array(table.dim).map((_, i) => (i % 2 ? 1 : -1));
    expect(rank(table, nowhere, PHOTO_MODEL.logitScale)[0]!.cos).toBeLessThan(NOT_FOOD_COS);
  });
});
