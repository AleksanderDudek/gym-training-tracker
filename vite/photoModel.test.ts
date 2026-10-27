import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PHOTO_MODEL } from '../src/food/photo/model';
import { cachePath, ensureModel } from './photoModel';

const dir = mkdtempSync(join(tmpdir(), 'photo-model-'));
process.env.PHOTO_MODEL_CACHE = dir;
afterAll(() => {
  delete process.env.PHOTO_MODEL_CACHE;
  rmSync(dir, { recursive: true, force: true });
});

describe('photoModel', () => {
  it('downloads the pinned revision and refuses a file whose hash is wrong, leaving nothing behind', async () => {
    // A stale copy of the right size but other bytes is not trusted either.
    writeFileSync(cachePath(), new Uint8Array(1));
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    await expect(ensureModel(fetchImpl)).rejects.toThrow(/zły plik/);
    expect(fetchImpl).toHaveBeenCalledWith(`https://huggingface.co/${PHOTO_MODEL.repo}/resolve/${PHOTO_MODEL.revision}/${PHOTO_MODEL.file}`);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('a failed download is retried on the next call', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 503 }));
    await expect(ensureModel(fetchImpl)).rejects.toThrow(/HTTP 503/);
    await expect(ensureModel(fetchImpl)).rejects.toThrow(/HTTP 503/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(existsSync(cachePath())).toBe(false);
  });
});
