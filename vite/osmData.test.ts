import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CAP, MAX_DEPTH, cellBox, wantedLeaves } from '../src/food/nearby/osmGrid';
import { compareIds, parseTsv } from '../src/food/nearby/osmFormat';
import { OSM_COLUMNS, isWholesaleHall, labelOf, matchesPlacesQuery, matchesShopsQuery } from '../src/food/nearby/osmTags';
import { OSM_DATA_FILE, OSM_META_FILE, buildOsmFiles } from './osmPlaces';

// The memory size, read as text: the module itself needs the browser (`document`, the virtual module).
const STATIC_SOURCE = readFileSync('src/food/nearby/staticData.ts', 'utf8');
const MEMORY_LEAVES = Number(STATIC_SOURCE.match(/export const MEMORY_LEAVES = (\d+);/)?.[1]);

/**
 * The committed copy of the OSM data, checked on every deploy (`npm test` runs before `npm run
 * build`) and in the "Dane OSM" workflow before a refresh is committed: a broken file stops here,
 * not in a user's browser.
 */
const meta = JSON.parse(readFileSync(OSM_META_FILE, 'utf8')) as {
  rows: number;
  dataAsOf: string;
  license: string;
  attribution: string;
  coverage: { eps: number; rings: number[][]; holes: number[][] };
};
const tsv = readFileSync(OSM_DATA_FILE, 'utf8');
const { columns, rows } = parseTsv(tsv);

describe('the committed OSM data', () => {
  test('the columns the app reads, one row per object, sorted, as many as meta.json says', () => {
    expect(columns).toEqual([...OSM_COLUMNS]);
    expect(rows.length).toBe(meta.rows);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (let k = 1; k < rows.length; k++) expect(compareIds(rows[k - 1]!.id, rows[k]!.id)).toBeLessThan(0);
  });

  test('every row is something the app shows: named, and a place or a shop by the one rule', () => {
    const wrong = rows.filter((r) => !labelOf(r.tags) || !(matchesPlacesQuery(r.tags) || matchesShopsQuery(r.tags)));
    expect(wrong.slice(0, 5)).toEqual([]);
  });

  test('Poland, with Warsaw and the cash & carry halls in it; the date is not in the future', () => {
    const outside = rows.filter((r) => r.latE5 < 4_890_000 || r.latE5 > 5_500_000 || r.lonE5 < 1_400_000 || r.lonE5 > 2_430_000);
    expect(outside.slice(0, 5)).toEqual([]);
    const warsaw = rows.filter((r) => r.latE5 >= 5_209_000 && r.latE5 <= 5_237_000 && r.lonE5 >= 2_085_000 && r.lonE5 <= 2_127_000);
    expect(warsaw.length).toBeGreaterThanOrEqual(7000);
    expect(rows.filter((r) => isWholesaleHall(r.tags)).length).toBeGreaterThanOrEqual(20);
    expect(Date.parse(meta.dataAsOf)).toBeLessThanOrEqual(Date.now());
    expect(meta.license).toBe('ODbL-1.0');
  });

  test('cut as the build cuts it: small leaves, at most 500 places each (except the finest cells)', () => {
    const { index, files } = buildOsmFiles(tsv, meta);
    // The busiest 10 km view needs far fewer leaves than the memory keeps (pinned ones never drop):
    // looked for around the centre of every leaf, so wherever the data is densest.
    const leaves = index.leaves.map(([d, i, j]) => ({ d, i, j }));
    let busiest = { leaves: 0, lat: 0, lon: 0 };
    for (const leaf of leaves) {
      const box = cellBox(leaf);
      const centre = { lat: (box.south + box.north) / 2e5, lon: (box.west + box.east) / 2e5 };
      const wanted = wantedLeaves(leaves, centre, 10_000).leaves.length;
      if (wanted > busiest.leaves) busiest = { leaves: wanted, ...centre };
    }
    expect(busiest.leaves, `10 km around ${busiest.lat}, ${busiest.lon}`).toBeLessThanOrEqual(MEMORY_LEAVES / 2);
    expect(index.count).toBe(rows.length);
    for (const [d, , , count] of index.leaves) if (d < MAX_DEPTH) expect(count).toBeLessThanOrEqual(CAP);
    const biggest = Math.max(...[...files].filter(([path]) => path.endsWith('.json.gz')).map(([, bytes]) => bytes.length));
    expect(biggest).toBeLessThan(32_000);
  });
});
