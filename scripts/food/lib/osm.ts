// The app's own copy of the OpenStreetMap places in Poland (`data/osm/places-pl.tsv`): reading
// osmium's GeoJSON export of the Geofabrik extract into its rows (with the relations the export does
// not build, placed by their members as Overpass places them unless a member row already stands for
// them), the polygon the copy covers, and the checks a new copy must pass before it replaces the
// committed one — the export's completeness among them. Pure, so it is tested without osmium or the network (one test does run osmium, on a
// small file); `scripts/food/osm-places.ts` downloads, runs osmium and writes.
// With extensions: these two files import nothing, so this one loads under Node's own loader too.
import { compareIds, type OsmRow } from '../../../src/food/nearby/osmFormat.ts';
import {
  AMENITIES,
  OSM_COLUMNS,
  isWholesaleHall,
  labelOf,
  matchesPlacesQuery,
  matchesShopsQuery,
  osmiumFilterExpressions,
} from '../../../src/food/nearby/osmTags.ts';

export type OsmType = 'node' | 'way' | 'relation';
type Point = [number, number];

export const SOURCE_URL = 'https://download.geofabrik.de/europe/poland-latest.osm.pbf';
export const POLY_URL = 'https://download.geofabrik.de/europe/poland.poly';

/** Rows a first copy must have: the extract of October 2026 gave 99,147. */
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

/** An object's row: at the centre of its geometry's bounding box, in 1e-5 degrees — every row rounded alike. */
function rowAt(id: string, geometry: Geometry, tags: Record<string, string>): OsmRow {
  const centre = bboxCentre(geometry);
  return { id, latE5: Math.round(centre.lat * 1e5), lonE5: Math.round(centre.lon * 1e5), tags };
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

/** One more row in the counts: by type and by kind. */
function tally(stats: FeatureStats, type: OsmType, tags: Record<string, string>) {
  stats.types[type]++;
  const kind = kindOf(tags);
  stats.kinds[kind] = (stats.kinds[kind] ?? 0) + 1;
}

/** Why an object is not a row: neither view asks for it, or it has nothing a list could call it. */
export type Dropped = 'notMatching' | 'unnamed';

/**
 * The one rule for what becomes a row and with which tags, shared by the export (`readFeatures`) and
 * the completeness check (`completeness`): if they disagreed, the check would miss losses or report
 * false ones. The same rule as the Overpass answers (`osmTags.ts`): an object counts when either
 * view asks for it and it has a brand or a name, judged on all of its tags. The row keeps only the
 * tags the app reads, each on one line (a tab or a line break would break the TSV) and none empty
 * (an empty TSV field reads back as a missing tag).
 */
export function rowTags(all: Record<string, string>): Record<string, string> | Dropped {
  if (!matchesPlacesQuery(all) && !matchesShopsQuery(all)) return 'notMatching';
  if (!labelOf(all)) return 'unnamed';
  const tags: Record<string, string> = {};
  for (const column of OSM_COLUMNS) {
    const value = all[column];
    if (value) tags[column] = value.replace(/[\t\r\n]/g, ' ');
  }
  return tags;
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

/**
 * The geometry errors osmium reports with `-e` — context only, not a measure of what the copy lacks:
 * most carry no id, a closed way whose area cannot be built is still exported as its line (an error,
 * nothing missing), and some objects vanish without one. `completeness` is what finds the losses.
 */
export function geometryErrors(output: string): string[] {
  return output.split('\n').filter((line) => /geometry error/i.test(line));
}

/**
 * osmium's GeoJSON Text Sequence export → the rows of the copy, sorted by id, each by `rowTags`.
 *
 * A closed way comes twice, as its `w` line and its `a` area, with the same bounding box: the first
 * one counts. Throws, with the line number, on a line that is not a feature osmium writes — a cut-off
 * stream ends in half a line, and that must not pass as data.
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
      const tags = rowTags(all);
      if (typeof tags === 'string') {
        stats[tags]++;
        continue;
      }
      rows.push(rowAt(decoded.key, feature.geometry, tags));
      tally(stats, decoded.type, tags);
    } catch (error) {
      throw new Error(`osmium export, line ${lineNumber}: ${(error as Error).message}`);
    }
  }
  rows.sort((a, b) => compareIds(a.id, b.id));
  return { rows, stats };
}

/**
 * The osmium runs of a refresh, as arguments: the script runs them on Poland and a test on a small
 * extract — the same commands, so what the test finds out about osmium holds for the refresh.
 */
export const osmiumArgs = {
  /** Everything either view could ask for, with the nodes and members those objects need. */
  filter: (source: string, out: string) => ['tags-filter', '-O', '-o', out, source, ...osmiumFilterExpressions()],
  /** GeoJSON Text Sequence with `-u type_id` ids (`decodeId`); the geometry errors go to stderr. */
  export: (filtered: string, out: string) => ['export', filtered, '-f', 'geojsonseq', '-u', 'type_id', '-e', '-O', '-o', out],
  /** Only the objects that match the filter themselves (`-R`: not the nodes and members they pulled in), as OPL. */
  list: (filtered: string, out: string) =>
    ['tags-filter', '-R', '-f', 'opl,add_metadata=false', '-O', '-o', out, filtered, ...osmiumFilterExpressions()],
  /**
   * The given objects and everything they reference, recursively (members, the nodes of member ways),
   * as OPL. `-H` reads the extract as a history file, which changes nothing in one without history but
   * skips the check that every id was found: without it getid exits 1 — a failure's code — whenever a
   * member is not in the extract (cut off at the border), though it still writes everything else.
   */
  members: (filtered: string, ids: readonly string[], out: string) =>
    ['getid', '-r', '-H', '-f', 'opl,add_metadata=false', '-O', '-o', out, filtered, ...ids],
};

/** A position as GeoJSON writes it, `[lon, lat]`: what `bboxCentre` reads. */
type Position = [number, number];

/**
 * An object of an OPL listing: its id as the copy writes it (`n123`), all of its tags, and what
 * places it — a node's position (`null` when it has none), a way's nodes, a relation's members (both
 * by id as the copy writes it, roles left out).
 */
export type OplObject = { key: string; tags: Record<string, string> } & (
  | { type: 'node'; location: Position | null }
  | { type: 'way'; nodes: string[] }
  | { type: 'relation'; members: string[] }
);

/** An id as osmium writes it, `n123`, `w456` or `r789` → the same as the copy writes it; `null` for anything else. */
function oplKey(text: string): string | null {
  const match = text.match(/^([nwr])(\d+)$/);
  const id = Number(match?.[2]);
  return match && Number.isSafeInteger(id) && id >= 1 ? `${match[1]}${id}` : null;
}

const OPL_COORDINATE = /^-?\d+(?:\.\d+)?$/;

/** A node's `x` and `y` fields → its position; both empty is how osmium writes a node without one. */
function oplLocation(x: string, y: string): Position | null {
  if (x === '' && y === '') return null;
  if (!OPL_COORDINATE.test(x) || !OPL_COORDINATE.test(y)) throw new Error(`not a position: "x${x} y${y}"`);
  return [Number(x), Number(y)];
}

/** A way's `N` field (`n1,n2,…`) → its nodes. */
function oplNodes(text: string): string[] {
  return (text === '' ? [] : text.split(',')).map((ref) => {
    const key = oplKey(ref);
    if (!key?.startsWith('n')) throw new Error(`not a node of a way: "${ref}"`);
    return key;
  });
}

/** A relation's `M` field (`w1@outer,n2@`, the role escaped like a tag) → its members. */
function oplMembers(text: string): string[] {
  return (text === '' ? [] : text.split(',')).map((member) => {
    const at = member.indexOf('@');
    const key = at < 0 ? null : oplKey(member.slice(0, at));
    if (!key) throw new Error(`not a member: "${member}"`);
    return key;
  });
}

/**
 * OPL's escapes undone: osmium writes a space, `,`, `=`, `@`, `%`, control characters and most of
 * Unicode past U+05FF as `%<code point in hex>%` — `%20%`, `%0a%`, `%201e%` for „, `%1f355%` for 🍕.
 * Throws on a `%` that starts no escape: osmium never writes one.
 */
export function unescapeOpl(text: string): string {
  return text.replace(/%([0-9a-f]+)%|%/gi, (_, hex: string | undefined) => {
    if (hex === undefined) throw new Error(`a broken escape in "${text}"`);
    return String.fromCodePoint(Number.parseInt(hex, 16));
  });
}

/**
 * `osmium … -f opl` → its objects, one per line. Fields are separated by spaces (osmium escapes a
 * space inside a value), each named by its first letter: the first is the type and id, `T` holds the
 * tags as `key=value` pairs joined by commas, then a node has `x` and `y`, a way `N` (its nodes), a
 * relation `M` (its members). Throws, with the line number, on a line osmium would not write.
 */
export function readOpl(lines: Iterable<string>): OplObject[] {
  const objects: OplObject[] = [];
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    if (!line.trim()) continue;
    try {
      const fields = line.split(' ');
      const key = oplKey(fields[0]!);
      if (!key) throw new Error(`no object id in "${fields[0]}"`);
      /** The value of the field named by `letter` (the letter cut off). */
      const field = (letter: string, name: string) => {
        const found = fields.find((f) => f.startsWith(letter));
        if (found === undefined) throw new Error(`no ${name} field`);
        return found.slice(1);
      };
      const tagField = field('T', 'tags');
      const tags: Record<string, string> = {};
      for (const pair of tagField === '' ? [] : tagField.split(',')) {
        const parts = pair.split('=');
        if (parts.length !== 2) throw new Error(`not a tag: "${pair}"`);
        tags[unescapeOpl(parts[0]!)] = unescapeOpl(parts[1]!);
      }
      if (key.startsWith('n')) objects.push({ type: 'node', key, tags, location: oplLocation(field('x', 'x'), field('y', 'y')) });
      else if (key.startsWith('w')) objects.push({ type: 'way', key, tags, nodes: oplNodes(field('N', 'nodes')) });
      else objects.push({ type: 'relation', key, tags, members: oplMembers(field('M', 'members')) });
    } catch (error) {
      throw new Error(`osmium listing, line ${lineNumber}: ${(error as Error).message}`);
    }
  }
  return objects;
}

/**
 * The relations osmium export builds areas of (by the exact `type` value); it writes nothing at all
 * for any other relation — `type=site`, `type=building`, none — so `relationRows` places those.
 */
const AREA_RELATIONS = ['multipolygon', 'boundary'];

type OplRelation = Extract<OplObject, { type: 'relation' }>;

/** A relation osmium export writes nothing for, whatever its members. */
const neverBuilt = (object: OplObject): object is OplRelation => object.type === 'relation' && !AREA_RELATIONS.includes(object.tags.type ?? '');

/** A label as compared for "the same place": `labelOf`, trimmed, in any case. */
const sameLabelKey = (tags: Record<string, string>) => labelOf(tags)?.trim().toLowerCase();

/**
 * The member row that already stands for a relation osmium export never builds: the first member
 * that is a row of the same kind (`kindOf`) with the same label — the Makro hall's building inside
 * its `type=site`, or a hall whose building is a multipolygon (osmium builds that one, so it is a
 * row too). A row of the relation's own would put the place on the map twice: that site's centre is
 * 56 m from its building's, past the 30 m within which the shops view takes a chain's two points for
 * one. Member relations count here, unlike for the centre (`relationRows`: in Overpass they add
 * nothing to it) — this asks only whether the place already is a row. `tags` are the relation's by
 * `rowTags`; `null` when no member is such a row. A building's untagged outline and parts are no
 * rows, so such a relation is still placed.
 */
function memberRow(relation: OplRelation, tags: Record<string, string>, rows: ReadonlyMap<string, OsmRow>): string | null {
  const kind = kindOf(tags);
  const label = sameLabelKey(tags);
  for (const member of relation.members) {
    const row = rows.get(member);
    if (row && kindOf(row.tags) === kind && sameLabelKey(row.tags) === label) return member;
  }
  return null;
}

/** The relations osmium export never writes that should be rows, as `unbuiltRelations` splits them. */
export interface Unbuilt {
  /** For `relationRows` to place by their members, by id, sorted. */
  place: string[];
  /** Stood for by a member row (`memberRow`), so no row of their own; sorted by id. */
  represented: { id: string; by: string }[];
}

/**
 * The relations of the listing (the `list` run) that should be rows but that osmium export never
 * writes: those to place by their members, and those a member row already stands for. One already
 * among `rows` stays out of both — no object is two rows.
 */
export function unbuiltRelations(objects: Iterable<OplObject>, rows: readonly OsmRow[]): Unbuilt {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: Unbuilt = { place: [], represented: [] };
  for (const object of objects) {
    if (!neverBuilt(object) || byId.has(object.key)) continue;
    const tags = rowTags(object.tags);
    if (typeof tags === 'string') continue;
    const by = memberRow(object, tags, byId);
    if (by) result.represented.push({ id: object.key, by });
    else result.place.push(object.key);
  }
  result.place.sort(compareIds);
  result.represented.sort((a, b) => compareIds(a.id, b.id));
  return result;
}

/**
 * Rows for relations osmium export never writes (`place` of `unbuiltRelations`), placed as Overpass
 * places them with `out center`: at the centre of the bounding box of their member nodes and of every
 * node of their member ways. A member relation adds nothing, as in Overpass ("relations as members
 * have no effect": a relation of relations gets no centre there), so a cycle of relations is no matter.
 * `objects` lists the relations with all they reference (the `members` run); a member or a node it
 * lacks — cut off at the border — is skipped, and a relation with nothing left to place it by gets
 * no row: it stays the known gap. Tags by `rowTags`, positions rounded as every other row's.
 */
export function relationRows(objects: Iterable<OplObject>, keys: Iterable<string>): OsmRow[] {
  const byKey = new Map<string, OplObject>();
  for (const object of objects) byKey.set(object.key, object);
  const rows: OsmRow[] = [];
  for (const key of new Set(keys)) {
    const relation = byKey.get(key);
    if (relation?.type !== 'relation') continue;
    const tags = rowTags(relation.tags);
    if (typeof tags === 'string') continue;
    const positions: Position[] = [];
    const add = (nodeKey: string) => {
      const node = byKey.get(nodeKey);
      if (node?.type === 'node' && node.location) positions.push(node.location);
    };
    for (const member of relation.members) {
      const object = byKey.get(member);
      if (object?.type === 'node') add(member);
      else if (object?.type === 'way') for (const nodeKey of object.nodes) add(nodeKey);
    }
    if (positions.length) rows.push(rowAt(key, { type: 'MultiPoint', coordinates: positions }, tags));
  }
  return rows.sort((a, b) => compareIds(a.id, b.id));
}

/** The export's rows and counts with `more` put in (the placed relations): sorted again, counted as `readFeatures` counts. */
export function withRows(
  exported: { rows: readonly OsmRow[]; stats: FeatureStats },
  more: readonly OsmRow[],
): { rows: OsmRow[]; stats: FeatureStats } {
  const stats: FeatureStats = { ...exported.stats, types: { ...exported.stats.types }, kinds: { ...exported.stats.kinds } };
  for (const row of more) tally(stats, decodeId(row.id)!.type, row.tags);
  return { rows: [...exported.rows, ...more].sort((a, b) => compareIds(a.id, b.id)), stats };
}

export interface Completeness {
  /** Objects that should be rows: they match the filter themselves and pass `rowTags`, the known gap aside. */
  expected: number;
  /** Expected, yet not a row — osmium could not build them. Sorted by id; the label as the lists show it. */
  missing: { id: string; label: string }[];
  /**
   * Relations that pass `rowTags` but that osmium export never writes, that no member placed
   * (`relationRows`: the extract has none to place them by) and no member row stands for
   * (`memberRow`), by `type` (`''`: none; a control character or a line separator in it as a space).
   */
  knownGap: Record<string, number>;
}

/** What could end a line of the log: control characters (line breaks among them) and the Unicode line and paragraph separators. */
const ONE_LINE = /[\p{Cc}\u2028\u2029]/gu;

/**
 * What osmium's export lost. `objects` are the objects of the filtered extract that match the filter
 * themselves (the `list` run) — not the nodes and members it pulled in for them; each is judged by
 * the same `rowTags` as the export, and those that are not rows are missing. osmium leaves out what
 * it cannot build, often without an error: a broken multipolygon, one with a member the extract
 * lacks, a closed area way of three nodes. A relation it never builds is present as its own row
 * (placed by `relationRows`) or as the member row that stands for it (`memberRow`, the rule
 * `unbuiltRelations` splits by); one neither is the known gap, counted apart.
 */
export function completeness(objects: Iterable<OplObject>, rows: readonly OsmRow[]): Completeness {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: Completeness = { expected: 0, missing: [], knownGap: {} };
  for (const object of objects) {
    const tags = rowTags(object.tags);
    if (typeof tags === 'string') continue;
    const unbuilt = neverBuilt(object);
    const present = byId.has(object.key) || (unbuilt && memberRow(object, tags, byId) !== null);
    if (unbuilt && !present) {
      // On one line, whatever a mapper typed: the refresh prints these keys, and a line break in a
      // tag value would let it start a GitHub Actions workflow command of its own (`::stop-commands::`).
      const type = (object.tags.type ?? '').replace(ONE_LINE, ' ');
      result.knownGap[type] = (result.knownGap[type] ?? 0) + 1;
      continue;
    }
    result.expected++;
    // On one line too: the refresh prints each missing object's label.
    if (!present) result.missing.push({ id: object.key, label: (labelOf(tags) ?? '').replace(ONE_LINE, ' ') });
  }
  result.missing.sort((a, b) => compareIds(a.id, b.id));
  return result;
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
