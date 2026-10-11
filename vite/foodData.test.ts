import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import meta from 'virtual:food-data';
import { FOOD_DATA_FILE, readFoodData, readGeneratedAt } from './foodData';

const dir = mkdtempSync(join(tmpdir(), 'food-data-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const BIG = JSON.stringify({
  generatedAt: '2026-10-10T19:19:26.837Z',
  products: Array.from({ length: 5000 }, (_, i) => ({ code: String(i), name: `Produkt ${i}` })),
});

describe('foodData', () => {
  it('czyta datę przygotowania z początku spakowanego pliku', () => {
    expect(readGeneratedAt(gzipSync(BIG, { level: 9 }))).toBe('2026-10-10T19:19:26.837Z');
    expect(readGeneratedAt(gzipSync('{"products":[]}'))).toBeNull();
    expect(readGeneratedAt(new TextEncoder().encode('to nie gzip'))).toBeNull();
  });

  it('wersja to pierwsze 12 znaków sha256 pliku, a nazwa ją zawiera', () => {
    const file = join(dir, 'products.json.gz');
    const bytes = gzipSync(BIG, { level: 9 });
    writeFileSync(file, bytes);
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    expect(readFoodData(file)?.meta).toEqual({
      url: `data/products.${version}.json.gz`,
      version,
      generatedAt: '2026-10-10T19:19:26.837Z',
    });
  });

  it('bez pliku nie ma czego wydać', () => {
    expect(readFoodData(join(dir, 'nie-ma.json.gz'))).toBeNull();
  });

  it('Vitest dostaje `virtual:food-data` z tej samej wtyczki co build, dla bazy z repozytorium', () => {
    expect(meta).toEqual(readFoodData(resolve(import.meta.dirname, '..', FOOD_DATA_FILE))?.meta);
    expect(meta.url).toMatch(/^data\/products\.[0-9a-f]{12}\.json\.gz$/);
    expect(meta.generatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});
