import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { decodeLeaf, formatTsv, validateIndex, type OsmRow } from '../src/food/nearby/osmFormat';
import { OSM_COLUMNS } from '../src/food/nearby/osmTags';
import { INDEX_PATH, buildOsmFiles, osmPlaces, readOsmFiles } from './osmPlaces';

const META = {
  dataAsOf: '2026-10-22T20:21:33Z',
  license: 'ODbL-1.0',
  attribution: '© OpenStreetMap contributors',
  coverage: { eps: 300, rings: [[5150000, 2000000, 5150000, 2200000, 5300000, 2200000, 5300000, 2000000]], holes: [] },
};

/** 1200 restaurants on a line through Warsaw: enough for the quadtree to split. */
const rows = (edit?: (row: OsmRow, k: number) => OsmRow): OsmRow[] =>
  Array.from({ length: 1200 }, (_, k) => {
    const row: OsmRow = { id: `n${k + 1}`, latE5: 5_222_970 + k * 3, lonE5: 2_101_220 + (k % 40) * 5, tags: { amenity: 'restaurant', name: `Lokal ${k + 1}` } };
    return edit ? edit(row, k) : row;
  });
const tsv = (list: OsmRow[]) => formatTsv(list, OSM_COLUMNS);

describe('the build cuts the OSM data into leaves', () => {
  test('an index at a fixed path listing every leaf, hashed leaf files, the licence notice', () => {
    const { index, files } = buildOsmFiles(tsv(rows()), META);
    expect(validateIndex(JSON.parse(files.get(INDEX_PATH)!.toString()))).toEqual(index);
    expect(index.count).toBe(1200);
    expect(index.leaves.length).toBeGreaterThan(2);
    expect(index.leaves.reduce((sum, leaf) => sum + leaf[3], 0)).toBe(1200);
    for (const [d, i, j, , sha10] of index.leaves) expect(files.has(`data/osm/v1/t/${d}-${i}-${j}.${sha10}.json.gz`)).toBe(true);
    expect(files.get('data/osm/v1/LICENSE.txt')!.toString()).toContain('Open Database License 1.0');
    // A leaf unpacks to the rows it was cut from.
    const [d, i, j, count, sha10] = index.leaves[0]!;
    const elements = decodeLeaf(JSON.parse(gunzipSync(files.get(`data/osm/v1/t/${d}-${i}-${j}.${sha10}.json.gz`)!).toString()));
    expect(elements).toHaveLength(count);
    expect(elements[0]).toMatchObject({ type: 'node', tags: { amenity: 'restaurant' } });
  });

  test('deterministic: the same data gives the same files; one edited row changes only its own leaf', () => {
    const a = buildOsmFiles(tsv(rows()), META);
    const b = buildOsmFiles(tsv(rows()), META);
    expect([...b.files.keys()]).toEqual([...a.files.keys()]);
    const c = buildOsmFiles(tsv(rows((row, k) => (k === 600 ? { ...row, tags: { ...row.tags, name: 'Nowa nazwa' } } : row))), META);
    const changed = [...c.files.keys()].filter((path) => !a.files.has(path));
    // The edited leaf, and the index (which lists its new hash).
    expect(changed).toHaveLength(1);
    expect(c.index.leaves.filter((leaf, k) => leaf[4] !== a.index.leaves[k]![4])).toHaveLength(1);
  });

  test('the app learns only a constant index path — new data changes no code (no update prompt) — and nothing under Vitest', () => {
    const plugin = osmPlaces() as unknown as {
      configResolved: (config: { root: string; base: string }) => void;
      resolveId: (id: string) => string | null;
      load: (id: string) => string | null;
    };
    plugin.configResolved({ root: process.cwd(), base: './' });
    const id = plugin.resolveId('virtual:osm-places')!;
    expect(plugin.load(id)).toBe('export default {"index":null};');
    const vitest = process.env.VITEST;
    delete process.env.VITEST;
    try {
      plugin.configResolved({ root: process.cwd(), base: './' });
      expect(plugin.load(id)).toBe(`export default {"index":"${INDEX_PATH}"};`);
      // Without the data the build still works and the page asks Overpass.
      plugin.configResolved({ root: mkdtempSync(join(tmpdir(), 'osm-')), base: './' });
      expect(plugin.load(id)).toBe('export default {"index":null};');
    } finally {
      process.env.VITEST = vitest;
    }
    expect(readOsmFiles(mkdtempSync(join(tmpdir(), 'osm-')))).toBeNull();
  });
});
