// The app's own copy of the OpenStreetMap places in Poland (`data/osm/places-pl.tsv`): reading
// osmium's GeoJSON export of the Geofabrik extract into its rows, the polygon the copy covers, and
// the checks a new copy must pass before it replaces the committed one. Pure, so it is tested
// without osmium or the network; `scripts/food/osm-places.ts` downloads, runs osmium and writes.
// With extensions: these two files import nothing, so this one loads under Node's own loader too.
import { compareIds, type OsmRow } from '../../../src/food/nearby/osmFormat.ts';
import { AMENITIES, OSM_COLUMNS, isWholesaleHall, labelOf, matchesPlacesQuery, matchesShopsQuery } from '../../../src/food/nearby/osmTags.ts';

export type OsmType = 'node' | 'way' | 'relation';
type Point = [number, number];

export const SOURCE_URL = 'https://download.geofabrik.de/europe/poland-latest.osm.pbf';
export const POLY_URL = 'https://download.geofabrik.de/europe/poland.poly';

/** Rows a first copy must have: the extract of October 2026 gave 99,144. */
const FIRST_RUN_MIN_ROWS = 90_000;
/** A small kind (under 500 rows) may move this many rows either way whatever the percentage. */
const SMALL_KIND_ROWS = 25;
/** A kind absent from the previous copy may appear with this many rows before it counts as a rule change. */
const NEW_KIND_ROWS = 50;
/**
 * Warsaw's bounding box (52.09–52.37 N, 20.85–21.27 E, in 1e-5 degrees) and the rows a copy must
 * have inside it (8,785 in October 2026): a city without its shops is a broken extract.
 */
const WARSAW = { south: 5_209_000, north: 5_237_000, west: 2_085_000, east: 2_127_000 };
const WARSAW_MIN_ROWS = 7_000;
/** Selgros and Makro halls a copy must have (37 in October 2026): the shops view depends on them. */
const MIN_HALLS = 20;
/** The coverage polygon is simplified this much, more when that still leaves too many points. */
const COVERAGE_EPS_M = 300;
const COVERAGE_EPS_COARSE_M = 500;
const COVERAGE_MAX_POINTS = 800;
const METRES_PER_DEGREE = (6_371_008.8 * Math.PI) / 180;
const RECORD_SEPARATOR = '\u001e';

/**
 * osmium's `-u type_id` id → the OpenStreetMap object. Areas get ids of their own, `a<N>`: an even N
 * is the area of the closed way N/2 (the same object as that way's `w` line), an odd N the
 * multipolygon relation (N-1)/2. The key is the id the app's copy uses: `n123`, `w456`, `r789`.
 */
export function decodeId(osmiumId: string): { type: OsmType; id: number; key: string } | null {
  const match = osmiumId.match(/^([nwra])(\d+)$/);
  const n = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(n)) return null;
  const letter = match[1] === 'a' ? (n % 2 === 0 ? 'w' : 'r') : match[1]!;
  const id = match[1] === 'a' ? Math.floor(n / 2) : n;
  if (id < 1) return null;
  const type: OsmType = letter === 'n' ? 'node' : letter === 'w' ? 'way' : 'relation';
  return { type, id, key: `${letter}${id}` };
}

/** GeoJSON geometry as osmium writes it: positions are `[lon, lat]`, nested by geometry type. */
export interface Geometry {
  type: string;
  coordinates?: unknown;
}

/**
 * The centre of the bounding box of every position in a geometry — what Overpass answers for a way
 * or a relation with `out center`, so a building is placed the same in Poland (this copy) as abroad.
 */
export function bboxCentre(geometry: Geometry): { lat: number; lon: number } {
  const box = { south: Infinity, north: -Infinity, west: Infinity, east: -Infinity };
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    const [lon, lat] = value as unknown[];
    if (typeof lon === 'number' && typeof lat === 'number') {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      box.south = Math.min(box.south, lat);
      box.north = Math.max(box.north, lat);
      box.west = Math.min(box.west, lon);
      box.east = Math.max(box.east, lon);
      return;
    }
    for (const item of value) visit(item);
  };
  visit(geometry.coordinates);
  if (box.south > box.north) throw new Error(`a ${geometry.type} without coordinates`);
  return { lat: (box.south + box.north) / 2, lon: (box.west + box.east) / 2 };
}

export interface FeatureStats {
  /** Lines read: every object osmium wrote, the areas of closed ways (duplicates) included. */
  features: number;
  /** The `a` area of a closed way, already read as its `w` line. */
  duplicates: number;
  /** Neither view asks for it: a bar, a builders' wholesaler (the extract keeps every `shop=wholesale`). */
  notMatching: number;
  /** Neither a brand nor a name: no list could show it. */
  unnamed: number;
  types: Record<OsmType, number>;
  /** Rows by kind (`kindOf`). */
  kinds: Record<string, number>;
}

/** The amenity when it is a place to eat, else the shop type: what the gates count rows by. */
export function kindOf(tags: Record<string, string>): string {
  const amenity = tags.amenity;
  return amenity !== undefined && (AMENITIES as readonly string[]).includes(amenity) ? amenity : (tags.shop ?? 'other');
}

interface Feature {
  id?: unknown;
  geometry?: Geometry | null;
  properties?: Record<string, unknown> | null;
}

/**
 * osmium's GeoJSON export split into records at "\n" only. Not with `readline`: Node 24's ends a
 * line at U+2028 and U+2029 too, and osmium writes those unescaped inside JSON strings — one such
 * character in any tag would cut a record in two and stop the refresh.
 */
export function splitRecords(text: string): string[] {
  return text.split('\n');
}

/** The geometry errors osmium reports with `-e`: objects it could not build, missing from the copy. */
export function geometryErrors(output: string): string[] {
  return output.split('\n').filter((line) => /geometry error/i.test(line));
}

/**
 * osmium's GeoJSON Text Sequence export → the rows of the copy, sorted by id.
 *
 * The same rule as the Overpass answers (`osmTags.ts`): an object counts when either view asks for
 * it and it has a brand or a name, judged on all of its tags; only the tags the app reads are kept,
 * each on one line (a tab or a line break would break the TSV) and none empty (an empty TSV field
 * reads back as a missing tag). A closed way comes twice, as its `w` line and its `a` area, with the
 * same bounding box: the first one counts. Throws, with the line number, on a line that is not a
 * feature osmium writes — a cut-off stream ends in half a line, and that must not pass as data.
 */
export function readFeatures(lines: Iterable<string>): { rows: OsmRow[]; stats: FeatureStats } {
  const stats: FeatureStats = { features: 0, duplicates: 0, notMatching: 0, unnamed: 0, types: { node: 0, way: 0, relation: 0 }, kinds: {} };
  const seen = new Set<string>();
  const rows: OsmRow[] = [];
  let lineNumber = 0;
  for (const raw of lines) {
    lineNumber++;
    // RFC 8142 starts each record with the record separator; osmium can be told to leave it out.
    const line = (raw.startsWith(RECORD_SEPARATOR) ? raw.slice(1) : raw).trim();
    if (!line) continue;
    try {
      const feature = JSON.parse(line) as Feature;
      const decoded = typeof feature.id === 'string' ? decodeId(feature.id) : null;
      if (!decoded) throw new Error(`unexpected id ${JSON.stringify(feature.id)} (export with -u type_id)`);
      if (!feature.geometry) throw new Error('no geometry');
      stats.features++;
      if (seen.has(decoded.key)) {
        stats.duplicates++;
        continue;
      }
      seen.add(decoded.key);
      const all: Record<string, string> = {};
      for (const [key, value] of Object.entries(feature.properties ?? {})) if (typeof value === 'string') all[key] = value;
      if (!matchesPlacesQuery(all) && !matchesShopsQuery(all)) {
        stats.notMatching++;
        continue;
      }
      if (!labelOf(all)) {
        stats.unnamed++;
        continue;
      }
      const tags: Record<string, string> = {};
      for (const column of OSM_COLUMNS) {
        const value = all[column];
        if (value) tags[column] = value.replace(/[\t\r\n]/g, ' ');
      }
      const centre = bboxCentre(feature.geometry);
      rows.push({ id: decoded.key, latE5: Math.round(centre.lat * 1e5), lonE5: Math.round(centre.lon * 1e5), tags });
      stats.types[decoded.type]++;
      const kind = kindOf(tags);
      stats.kinds[kind] = (stats.kinds[kind] ?? 0) + 1;
    } catch (error) {
      throw new Error(`osmium export, line ${lineNumber}: ${(error as Error).message}`);
    }
  }
  rows.sort((a, b) => compareIds(a.id, b.id));
  return { rows, stats };
}

/**
 * A Geofabrik `.poly` file: a name line, then sections — a name line (`!` in front for a hole),
 * one `lon lat` line per point (often in scientific notation), `END` — and a final `END`. Points come
 * out as `[lat, lon]`. Throws on anything else, a file cut short included.
 */
export function parsePoly(text: string): { rings: Point[][]; holes: Point[][] } {
  const lines = text.split('\n').map((line) => line.trim());
  const rings: Point[][] = [];
  const holes: Point[][] = [];
  let i = 1; // the first line only names the polygon
  for (;;) {
    while (i < lines.length && lines[i] === '') i++;
    if (i >= lines.length) throw new Error('poly: no final END (a file cut short?)');
    const name = lines[i++]!;
    if (name === 'END') break;
    const points: Point[] = [];
    for (;;) {
      if (i >= lines.length) throw new Error(`poly: section ${name} has no END`);
      const line = lines[i++]!;
      if (line === 'END') break;
      if (line === '') continue;
      const parts = line.split(/\s+/);
      const [lon, lat] = parts.map(Number);
      if (parts.length !== 2 || !Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error(`poly: not a point: "${line}"`);
      points.push([lat!, lon!]);
    }
    if (points.length < 3) throw new Error(`poly: section ${name} has ${points.length} points`);
    (name.startsWith('!') ? holes : rings).push(points);
  }
  if (rings.length === 0) throw new Error('poly: no polygon');
  return { rings, holes };
}

/**
 * Distance in metres from `p` to the segment a–b (points `[lat, lon]`), in a flat projection centred
 * on `p`. Centred on each point, not once for the whole polygon: a degree of longitude is 13 % longer
 * at Poland's southern border than at the Baltic, and the error bound must hold at both. The
 * projection is linear in latitude and longitude, so a segment stays the straight line a
 * point-in-polygon test on coordinates draws.
 */
function offsetMetres(p: Point, a: Point, b: Point): number {
  const kx = Math.cos((p[0] * Math.PI) / 180) * METRES_PER_DEGREE;
  const ax = (a[1] - p[1]) * kx;
  const ay = (a[0] - p[0]) * METRES_PER_DEGREE;
  const dx = (b[1] - a[1]) * kx;
  const dy = (b[0] - a[0]) * METRES_PER_DEGREE;
  const length2 = dx * dx + dy * dy;
  // The foot of the perpendicular from p (the origin here), kept within the segment.
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / length2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Douglas–Peucker: the fewest of the ring's own points such that every point left out lies within
 * `epsMetres` of the segment that replaced it — so the simplified border is never further than that
 * from the real one, and the app can treat a position that close to it as "at the border". The
 * first and the last point stay (a closed ring keeps its closing point).
 */
export function simplify(ring: readonly Point[], epsMetres: number): Point[] {
  if (ring.length < 3) return [...ring];
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  // A stack, not recursion: the depth would follow the number of points kept.
  const stack: [number, number][] = [[0, ring.length - 1]];
  for (let span = stack.pop(); span; span = stack.pop()) {
    const [first, last] = span;
    let worst = -1;
    let index = -1;
    for (let k = first + 1; k < last; k++) {
      const offset = offsetMetres(ring[k]!, ring[first]!, ring[last]!);
      if (offset > worst) {
        worst = offset;
        index = k;
      }
    }
    if (worst > epsMetres) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, k) => keep[k] === 1);
}

export interface Coverage {
  eps: number;
  rings: Point[][];
  holes: Point[][];
}

const pointCount = (coverage: Omit<Coverage, 'eps'>) => [...coverage.rings, ...coverage.holes].reduce((sum, ring) => sum + ring.length, 0);

/** The polygon simplified by 300 m, or by 500 m (from the original) when 300 m leaves over 800 points. */
export function simplifyCoverage(poly: { rings: readonly Point[][]; holes: readonly Point[][] }): Coverage {
  const at = (eps: number): Coverage => ({
    eps,
    rings: poly.rings.map((ring) => simplify(ring, eps)),
    holes: poly.holes.map((ring) => simplify(ring, eps)),
  });
  const fine = at(COVERAGE_EPS_M);
  return pointCount(fine) > COVERAGE_MAX_POINTS ? at(COVERAGE_EPS_COARSE_M) : fine;
}

/** `data/osm/meta.json`: what the copy is, where it came from, and the counts the next run is checked against. */
export interface Meta {
  format: 1;
  /** The extract's replication timestamp: the OpenStreetMap data as of this moment. */
  dataAsOf: string;
  source: string;
  /** MD5 of the source extract; `null` for a run from an already filtered file (`--filtered`). */
  sourceMd5: string | null;
  osmium: string;
  rows: number;
  types: Record<OsmType, number>;
  kinds: Record<string, number>;
  dropped: { duplicates: number; notMatching: number; unnamed: number };
  warsaw: number;
  halls: number;
  /** Rings as flat `[latE5, lonE5, latE5, lonE5, …]` lists. */
  coverage: { source: string; eps: number; rings: number[][]; holes: number[][] };
  license: 'ODbL-1.0';
  attribution: string;
}

const inWarsaw = (row: OsmRow) =>
  row.latE5 >= WARSAW.south && row.latE5 <= WARSAW.north && row.lonE5 >= WARSAW.west && row.lonE5 <= WARSAW.east;

const flatE5 = (ring: readonly Point[]) => ring.flatMap(([lat, lon]) => [Math.round(lat * 1e5), Math.round(lon * 1e5)]);

/**
 * The meta file's content. Nothing in it depends on when or where the script ran — no "generated
 * at" — so a second run on the same extract writes the same bytes and git shows no change.
 */
export function buildMeta(input: {
  dataAsOf: string;
  sourceMd5: string | null;
  osmium: string;
  rows: readonly OsmRow[];
  stats: FeatureStats;
  coverage: Coverage;
}): Meta {
  const { rows, stats, coverage } = input;
  // Sorted by name, not by first appearance: the file's order must not follow the extract's.
  const kinds = Object.fromEntries(Object.entries(stats.kinds).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    format: 1,
    dataAsOf: input.dataAsOf,
    source: SOURCE_URL,
    sourceMd5: input.sourceMd5,
    osmium: input.osmium,
    rows: rows.length,
    types: { node: stats.types.node, way: stats.types.way, relation: stats.types.relation },
    kinds,
    dropped: { duplicates: stats.duplicates, notMatching: stats.notMatching, unnamed: stats.unnamed },
    warsaw: rows.filter(inWarsaw).length,
    halls: rows.filter((row) => isWholesaleHall(row.tags)).length,
    coverage: { source: POLY_URL, eps: coverage.eps, rings: coverage.rings.map(flatE5), holes: coverage.holes.map(flatE5) },
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
  };
}

const percent = (change: number) => `${change > 0 ? '+' : ''}${(change * 100).toFixed(1)} %`;

/**
 * Why a new copy must not replace the committed one; empty when it may. A broken extract, an osmium
 * that exports differently or a mistake in the tag rules shows as counts far from the last run's, a
 * Warsaw without its shops, no wholesale halls, older data, or objects outside Poland — and the app
 * would quietly show it to everyone. `rows` are checked against the coverage polygon's bounding box,
 * widened by its simplification error (a simplified ring can cut a corner by that much).
 */
export function gates(previous: Meta | null, meta: Meta, rows: readonly OsmRow[]): string[] {
  const failures: string[] = [];
  if (previous) {
    const change = (meta.rows - previous.rows) / previous.rows;
    if (!(Math.abs(change) <= 0.1)) failures.push(`rows: ${previous.rows} → ${meta.rows} (${percent(change)}; at most ±10 %)`);
    for (const kind of [...new Set([...Object.keys(previous.kinds), ...Object.keys(meta.kinds)])].sort()) {
      const before = previous.kinds[kind] ?? 0;
      const now = meta.kinds[kind] ?? 0;
      // A small kind moves more with a few mappers' work: half its size either way, and never for a
      // handful of rows (one new `shop=discount` must not block a refresh). A kind that appears with
      // dozens of rows at once means the rule changed, not the map.
      const tolerance = before < 500 ? 0.5 : 0.2;
      const small = before < 500 && Math.abs(now - before) <= SMALL_KIND_ROWS;
      if (before === 0) {
        if (now > NEW_KIND_ROWS) failures.push(`kind ${kind}: ${now} rows, none in the previous copy`);
      } else if (!small && Math.abs(now - before) / before > tolerance) {
        failures.push(`kind ${kind}: ${before} → ${now} (${percent((now - before) / before)}; at most ±${tolerance * 100} %)`);
      }
    }
    if (!(Date.parse(meta.dataAsOf) >= Date.parse(previous.dataAsOf))) {
      failures.push(`data as of ${meta.dataAsOf}: older than the previous copy's ${previous.dataAsOf}`);
    }
  } else if (meta.rows < FIRST_RUN_MIN_ROWS) {
    failures.push(`rows: ${meta.rows}, a first copy needs at least ${FIRST_RUN_MIN_ROWS}`);
  }
  if (meta.warsaw < WARSAW_MIN_ROWS) failures.push(`Warsaw: ${meta.warsaw} rows, at least ${WARSAW_MIN_ROWS} expected`);
  if (meta.halls < MIN_HALLS) failures.push(`Selgros/Makro halls: ${meta.halls}, at least ${MIN_HALLS} expected`);
  const box = coverageBox(meta.coverage);
  if (!box) failures.push('coverage: no polygon');
  else {
    const outside = rows.filter((row) => row.latE5 < box.south || row.latE5 > box.north || row.lonE5 < box.west || row.lonE5 > box.east);
    if (outside.length) {
      const examples = outside.slice(0, 5).map((row) => `${row.id} at ${row.latE5 / 1e5}, ${row.lonE5 / 1e5}`);
      failures.push(`outside the coverage polygon's bounding box: ${outside.length} (${examples.join('; ')})`);
    }
  }
  return failures;
}

/** The bounding box of the coverage rings in 1e-5 degrees, widened by `eps`; `null` without a ring. */
function coverageBox(coverage: Meta['coverage']): { south: number; north: number; west: number; east: number } | null {
  let [south, north, west, east] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const ring of coverage.rings) {
    for (let k = 0; k + 1 < ring.length; k += 2) {
      south = Math.min(south, ring[k]!);
      north = Math.max(north, ring[k]!);
      west = Math.min(west, ring[k + 1]!);
      east = Math.max(east, ring[k + 1]!);
    }
  }
  if (south > north) return null;
  const latMargin = Math.ceil((coverage.eps / METRES_PER_DEGREE) * 1e5);
  // A degree of longitude is shortest at the box's edge furthest from the equator.
  const cos = Math.cos((Math.max(Math.abs(south), Math.abs(north)) / 1e5) * (Math.PI / 180));
  const lonMargin = Math.ceil((coverage.eps / (METRES_PER_DEGREE * Math.max(cos, 0.01))) * 1e5);
  return { south: south - latMargin, north: north + latMargin, west: west - lonMargin, east: east + lonMargin };
}

/** What changed between two copies, by id: new objects, gone ones, and moved or retagged ones. */
export function diffRows(previous: readonly OsmRow[], next: readonly OsmRow[]): { added: number; removed: number; changed: number } {
  const before = new Map(previous.map((row) => [row.id, row]));
  let added = 0;
  let changed = 0;
  for (const row of next) {
    const old = before.get(row.id);
    if (!old) added++;
    else if (old.latE5 !== row.latE5 || old.lonE5 !== row.lonE5 || !sameTags(old.tags, row.tags)) changed++;
    before.delete(row.id);
  }
  return { added, removed: before.size, changed };
}

function sameTags(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}
