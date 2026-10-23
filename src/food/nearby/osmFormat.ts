/**
 * The app's own copy of the OpenStreetMap places „W pobliżu” shows in Poland, in its two shapes: the
 * TSV committed to the repository (`data/osm/places-pl.tsv`, written by `npm run food:osm` from the
 * Geofabrik extract) and the small gzipped JSON leaves the build cuts it into, with their index, so
 * the app fetches only the part of the country around the (rounded) position instead of asking the
 * public Overpass servers.
 *
 * No runtime imports, on purpose: the Vite plugin loads this file with Node's own loader, which
 * resolves nothing the app's bundler would, and the data script must not pull in `src/i18n.ts`.
 */

/** One object of the copy: its position in 1e-5 degrees (about a metre) and the tags the app reads. */
export interface OsmRow {
  /** `n123`, `w456`, `r789`: the type's initial and the OpenStreetMap id. */
  id: string;
  latE5: number;
  lonE5: number;
  tags: Record<string, string>;
}

/** An object as the app reads it: the shape of an Overpass element with its centre filled in. */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

/** The leaves' index: which cells exist, where the copy ends, and what the data is and whose. */
export interface OsmIndex {
  f: 1;
  dataAsOf: string;
  count: number;
  license: string;
  attribution: string;
  notice: string;
  grid: { lat0: number; lon0: number; root: number; maxDepth: number; cap: number };
  coverage: { eps: number; rings: number[][]; holes: number[][] };
  /** `[depth, i, j, rows, sha10]`: a cell of the quadtree and the first 10 hex digits of its file's hash. */
  leaves: [number, number, number, number, string][];
}

const TYPE_RANK: Record<string, number> = { n: 0, w: 1, r: 2 };
const TYPE_NAME = { n: 'node', w: 'way', r: 'relation' } as const;
const ROW_ID = /^[nwr]\d+$/;
const COORDINATE = /^-?\d+(?:\.\d+)?$/;
const SHA10 = /^[0-9a-f]{10}$/;

/**
 * Nodes, then ways, then relations (the order osmium writes them in), each by number. The numbers
 * are compared as numbers: node ids are past 2^31 and of different lengths, so comparing text would
 * put n10 before n9; they still fit a double exactly. Anything odd falls back to plain text order,
 * so a sort stays a sort.
 */
export function compareIds(a: string, b: string): number {
  const rank = (TYPE_RANK[a.charAt(0)] ?? 3) - (TYPE_RANK[b.charAt(0)] ?? 3);
  return rank || Number(a.slice(1)) - Number(b.slice(1)) || (a < b ? -1 : a > b ? 1 : 0);
}

const degrees = (e5: number) => (e5 / 1e5).toFixed(5);
/** A tab or a line break inside a value would break the line it is written on. */
const oneLine = (value: string) => value.replace(/[\t\r\n]/g, ' ');

/**
 * The committed TSV: a header, then one object per line, in the order given (the data script sorts
 * them, so a new extract shows up in git as the objects that really changed). An empty field is a
 * tag the object does not have. LF line endings and a final newline, whatever the platform.
 */
export function formatTsv(rows: readonly OsmRow[], columns: readonly string[]): string {
  const lines = [['id', 'lat', 'lon', ...columns].join('\t')];
  for (const row of rows) {
    const values = columns.map((column) => oneLine(row.tags[column] ?? ''));
    lines.push([row.id, degrees(row.latE5), degrees(row.lonE5), ...values].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The TSV back into rows. Throws on a header that is not `id lat lon <columns>` and on a line that
 * does not fit it: the build must stop on a damaged copy, not cut it into leaves with holes.
 */
export function parseTsv(text: string): { columns: string[]; rows: OsmRow[] } {
  // `\r` tolerated at line ends: a checkout with CRLF conversion still reads the same.
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const header = (lines[0] ?? '').split('\t');
  const [id, lat, lon, ...columns] = header;
  if (id !== 'id' || lat !== 'lat' || lon !== 'lon' || columns.some((column) => !column) || new Set(columns).size !== columns.length) {
    throw new Error(`places TSV: malformed header "${(lines[0] ?? '').slice(0, 120)}"`);
  }
  const rows: OsmRow[] = [];
  for (const [n, line] of lines.entries()) {
    if (n === 0 || line === '') continue;
    const fields = line.split('\t');
    const [rowId = '', rowLat = '', rowLon = ''] = fields;
    if (fields.length !== header.length || !ROW_ID.test(rowId) || !COORDINATE.test(rowLat) || !COORDINATE.test(rowLon)) {
      throw new Error(`places TSV line ${n + 1}: does not fit the header (${fields.length} fields of ${header.length})`);
    }
    const tags: Record<string, string> = {};
    for (const [k, column] of columns.entries()) {
      const value = fields[k + 3];
      if (value) tags[column] = value;
    }
    rows.push({ id: rowId, latE5: Math.round(Number(rowLat) * 1e5), lonE5: Math.round(Number(rowLon) * 1e5), tags });
  }
  return { columns, rows };
}

/**
 * One leaf of the quadtree as compact JSON. Positions are offsets from the leaf's origin, in 1e-5
 * degrees: a few digits instead of seven, which is most of a leaf. A missing tag is `null`, so every
 * row has the same length and the column names are written once. Rows go by id, so the same rows
 * always give the same text — and the same hash in the file name, which lets the browser keep a leaf
 * until its content really changes.
 */
export function encodeLeaf(
  key: Readonly<{ d: number; i: number; j: number }>,
  rows: readonly OsmRow[],
  columns: readonly string[],
  origin: readonly [number, number],
): string {
  const [oLat, oLon] = origin;
  const sorted = [...rows].sort((a, b) => compareIds(a.id, b.id));
  return JSON.stringify({
    f: 1,
    k: [key.d, key.i, key.j],
    o: [oLat, oLon],
    c: [...columns],
    r: sorted.map((row) => [row.id, row.latE5 - oLat, row.lonE5 - oLon, ...columns.map((column) => row.tags[column] ?? null)]),
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isNumbers = (value: unknown, length: number): value is number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber);

/**
 * A leaf back into elements, as the Overpass parsers take them (`shopsOf`, `placesOf`). Throws on
 * anything that is not a leaf of this format: a leaf cached by an older app, or a broken download,
 * must fail loudly rather than read as "nothing here".
 */
export function decodeLeaf(json: unknown): OsmElement[] {
  if (!isRecord(json) || json.f !== 1) throw new Error('OSM leaf: not format 1');
  const { k, o, c, r } = json;
  if (!isNumbers(k, 3) || !k.every(Number.isSafeInteger)) throw new Error('OSM leaf: malformed key');
  if (!isNumbers(o, 2)) throw new Error('OSM leaf: malformed origin');
  if (!Array.isArray(c) || !c.every((column) => typeof column === 'string')) throw new Error('OSM leaf: malformed columns');
  if (!Array.isArray(r)) throw new Error('OSM leaf: malformed rows');
  const columns = c as string[];
  const [oLat, oLon] = o as [number, number];
  return r.map((row: unknown): OsmElement => {
    if (!Array.isArray(row) || row.length !== columns.length + 3) throw new Error('OSM leaf: malformed row');
    const [id, dLat, dLon] = row as unknown[];
    if (typeof id !== 'string' || !ROW_ID.test(id) || !isFiniteNumber(dLat) || !isFiniteNumber(dLon)) {
      throw new Error(`OSM leaf: malformed row ${String(id)}`);
    }
    const number = Number(id.slice(1));
    if (!Number.isSafeInteger(number)) throw new Error(`OSM leaf: malformed id ${id}`);
    const tags: Record<string, string> = {};
    for (const [n, column] of columns.entries()) {
      const value: unknown = row[n + 3];
      if (value === null) continue;
      if (typeof value !== 'string') throw new Error(`OSM leaf: malformed value in ${id}`);
      tags[column] = value;
    }
    return {
      type: TYPE_NAME[id.charAt(0) as keyof typeof TYPE_NAME],
      id: number,
      lat: Math.round(oLat + dLat) / 1e5,
      lon: Math.round(oLon + dLon) / 1e5,
      tags,
    };
  });
}

const isRingList = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.every((ring) => Array.isArray(ring) && ring.length % 2 === 0 && ring.every(isFiniteNumber));

const isLeaf = (value: unknown): value is [number, number, number, number, string] =>
  Array.isArray(value) &&
  value.length === 5 &&
  isCount(value[0]) &&
  Number.isSafeInteger(value[1]) &&
  Number.isSafeInteger(value[2]) &&
  isCount(value[3]) &&
  typeof value[4] === 'string' &&
  SHA10.test(value[4]);

/**
 * The index, or `null` when it is not one this app can read: another format (`f`), or any field
 * missing or of the wrong shape. The caller then asks Overpass, as abroad. The hash part of a leaf
 * must be 10 hex digits: it goes into a file name (`leafPath`).
 */
export function validateIndex(json: unknown): OsmIndex | null {
  if (!isRecord(json) || json.f !== 1) return null;
  const { dataAsOf, count, license, attribution, notice, grid, coverage, leaves } = json;
  if (typeof dataAsOf !== 'string' || !isCount(count)) return null;
  if (typeof license !== 'string' || typeof attribution !== 'string' || typeof notice !== 'string') return null;
  if (!isRecord(grid) || !isFiniteNumber(grid.lat0) || !isFiniteNumber(grid.lon0)) return null;
  if (!isFiniteNumber(grid.root) || grid.root <= 0 || !isCount(grid.maxDepth) || !isCount(grid.cap)) return null;
  if (!isRecord(coverage) || !isFiniteNumber(coverage.eps) || !isRingList(coverage.rings) || !isRingList(coverage.holes)) return null;
  if (!Array.isArray(leaves) || !leaves.every(isLeaf)) return null;
  return json as unknown as OsmIndex;
}

/** Where a leaf is served, next to the index: the hash in the name lets it be cached for good. */
export function leafPath(leaf: readonly [number, number, number, number, string]): string {
  const [d, i, j, , sha10] = leaf;
  return `t/${d}-${i}-${j}.${sha10}.json.gz`;
}
