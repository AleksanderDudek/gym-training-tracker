/**
 * The geometry of the app's own copy of the Polish OpenStreetMap data. The copy is cut into an
 * adaptive quadtree of small "leaf" files: the Vite plugin cuts them at build time (`buildTree`) and
 * the device fetches only the leaves around it (`wantedLeaves`), chosen from its position rounded to
 * 0.001° - the files it asks for say no more about where it is than the Overpass query did. Both
 * sides take every cell edge from here: if they disagreed, the device would ask for files that do
 * not exist, or skip the one holding the shop next door.
 *
 * Coordinates are E5 integers: degrees × 100 000, rounded (about a metre). The cell edges are
 * integers too, so which cell a point falls in is exact arithmetic, the same in the build and on a
 * phone.
 *
 * No imports, not even of types (one rule, and a test checks it): the Vite plugin loads this file
 * with Node's own TypeScript loader, which strips the types and cannot resolve the app's imports
 * (they leave out the `.ts`).
 */

/** A position in degrees: the shape of `LatLon` in `types.ts`, declared here because nothing is imported. */
interface LatLon {
  lat: number;
  lon: number;
}

/**
 * The grid's south-west corner, 48° N 13° E: south and west of all of Poland (49.0–54.9° N,
 * 14.1–24.2° E), so no cell index in Poland is negative.
 */
export const LAT0 = 4_800_000;
export const LON0 = 1_300_000;
/** The biggest cells (≈ 36 × 45 km): every leaf lies inside one of them. */
export const ROOT_DEPTH = 6;
/** A cell with more rows than this splits into its four quarters… */
export const CAP = 500;
/** …down to cells of ≈ 0.6 × 0.7 km. A cell that small keeps all its rows, however many. */
export const MAX_DEPTH = 12;

/**
 * A cell's height and width at depth `d`, in E5: powers of two, so each level halves both exactly.
 * The width is twice the height because a degree of longitude is about 0.6 of one of latitude at
 * 52° N: the cells come out nearly square (at 52° N, depth 6 is ≈ 36.4 × 44.9 km, depth 12 ≈ 0.57 ×
 * 0.70 km).
 */
export function latSpan(d: number): number {
  return 2 ** (21 - d);
}

export function lonSpan(d: number): number {
  return 2 ** (22 - d);
}

/** A cell: depth `d`, row `i` counted north from `LAT0`, column `j` counted east from `LON0`. */
export interface CellKey {
  d: number;
  i: number;
  j: number;
}

/** A rectangle in E5. */
export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * The cell of depth `d` holding a point. Cells are half-open: a point exactly on an edge belongs to
 * the cell north or east of it, so every point is in exactly one cell of each depth.
 */
export function cellOf(latE5: number, lonE5: number, d: number): CellKey {
  return { d, i: Math.floor((latE5 - LAT0) / latSpan(d)), j: Math.floor((lonE5 - LON0) / lonSpan(d)) };
}

/** A cell's edges in E5 (half-open: its north and east edges belong to the next cells). */
export function cellBox({ d, i, j }: CellKey): Box {
  const south = LAT0 + i * latSpan(d);
  const west = LON0 + j * lonSpan(d);
  return { south, west, north: south + latSpan(d), east: west + lonSpan(d) };
}

/** A leaf of the tree, one file of the copy: a cell and the rows in it. */
export interface Leaf<T> extends CellKey {
  rows: T[];
}

/** The one order of cells everywhere: by depth, then row, then column. */
const byKey = (a: CellKey, b: CellKey) => a.d - b.d || a.i - b.i || a.j - b.j;

/**
 * Cuts rows into leaves. Rows are grouped by their cell at `rootDepth`; a cell with more than `cap`
 * rows splits into its four quarters, and they in turn, until each holds at most `cap` rows or is at
 * `maxDepth` (where it keeps them all). A city ends up in small cells and the countryside in big
 * ones: a file holds at most `cap` rows wherever it is, bar the few crowded cells at `maxDepth`.
 *
 * Every row lands in exactly one leaf and no two leaves overlap. Only non-empty leaves come back,
 * sorted by (d, i, j), each with its rows in input order: rows sorted by id first make the same
 * leaves from the same data, build after build.
 */
export function buildTree<T extends { latE5: number; lonE5: number }>(
  rows: readonly T[],
  cap = CAP,
  maxDepth = MAX_DEPTH,
  rootDepth = ROOT_DEPTH,
): Leaf<T>[] {
  const roots = new Map<string, Leaf<T>>();
  for (const row of rows) {
    const { i, j } = cellOf(row.latE5, row.lonE5, rootDepth);
    const key = `${i}/${j}`;
    let root = roots.get(key);
    if (!root) {
      root = { d: rootDepth, i, j, rows: [] };
      roots.set(key, root);
    }
    root.rows.push(row);
  }

  const leaves: Leaf<T>[] = [];
  const split = (cell: Leaf<T>): void => {
    if (cell.rows.length <= cap || cell.d >= maxDepth) {
      leaves.push(cell);
      return;
    }
    const d = cell.d + 1;
    // The quarters (2i, 2j), (2i, 2j+1), (2i+1, 2j), (2i+1, 2j+1).
    const quarters = [0, 1, 2, 3].map((q): Leaf<T> => ({ d, i: 2 * cell.i + (q >> 1), j: 2 * cell.j + (q & 1), rows: [] }));
    for (const row of cell.rows) {
      // A row's cell one level down is always one of the four: the spans halve exactly, so the
      // quarters split the parent with no gap and no row on two sides of an edge.
      const { i, j } = cellOf(row.latE5, row.lonE5, d);
      quarters[2 * (i - 2 * cell.i) + (j - 2 * cell.j)]!.rows.push(row);
    }
    for (const quarter of quarters) if (quarter.rows.length > 0) split(quarter);
  };
  for (const root of roots.values()) split(root);
  return leaves.sort(byKey);
}

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres: `distanceMeters` from `geo.ts`, copied (a test keeps the two equal). */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Metres from `p` (degrees) to the nearest point of a box: 0 inside it or on its edge. The nearest
 * point is taken as `p` clamped into the box - exact north or south of it; east or west, the true
 * one lies a hair towards the pole, a few millimetres closer at 10 km (the rounding margin's spare
 * 20 m covers that).
 */
export function distanceToBox(p: LatLon, box: Box): number {
  const lat = Math.min(Math.max(p.lat, box.south / 1e5), box.north / 1e5);
  const lon = Math.min(Math.max(p.lon, box.west / 1e5), box.east / 1e5);
  return haversine(p, { lat, lon });
}

/**
 * The position as it may leave the device: rounded to 0.001° (≈ 111 × 68 m in Poland), exactly as
 * the Overpass query rounds it (`queryCircle`).
 */
export function roundedCentre(p: LatLon): LatLon {
  return { lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000 };
}

/**
 * How far the rounded centre can lie from the exact position, in metres: half the diagonal of a
 * 0.001° rounding cell - 55.66 m of latitude (111,320 m to the degree, a little more than the true
 * 111,195) by 55.66·cos(lat) of longitude - plus 20 m to spare. ≈ 85 m in Poland.
 */
export function roundingMargin(lat: number): number {
  return Math.hypot(55.66, 55.66 * Math.cos(rad(lat))) + 20;
}

/** The leaves the device fetches for a circle, and what they were chosen from. */
export interface Wanted<K extends CellKey> {
  /** The rounded position: the only position the choice depends on. */
  centre: LatLon;
  /** The radius grown by the rounding margin: how far from `centre` the leaves reach. */
  reach: number;
  /** Nearest first, ties by (d, i, j). */
  leaves: K[];
}

/**
 * The leaves to fetch for a circle of `radius` metres around `position`: every leaf whose cell comes
 * within `reach` of the ROUNDED centre, nearest first, ties by (d, i, j).
 *
 * Privacy: past the rounding nothing reads the exact position, so every position in one 0.001°
 * rounding cell asks for the same files in the same order, and the requests tell a server no more
 * than the Overpass query did. The margin pays for it: the circle around the exact position lies
 * inside the circle of `reach` around the rounded one, so the wanted leaves cover it.
 */
export function wantedLeaves<K extends CellKey>(leaves: readonly K[], position: LatLon, radius: number): Wanted<K> {
  const centre = roundedCentre(position);
  const reach = radius + roundingMargin(centre.lat);
  const near = leaves
    .map((leaf) => ({ leaf, distance: distanceToBox(centre, cellBox(leaf)) }))
    .filter(({ distance }) => distance <= reach)
    .sort((a, b) => a.distance - b.distance || byKey(a.leaf, b.leaf));
  return { centre, reach, leaves: near.map(({ leaf }) => leaf) };
}

/**
 * How far around the EXACT position the loaded leaves tell the whole story, in metres: `radius` when
 * every wanted leaf is loaded, else the distance to the nearest one still missing (a place could be
 * in it). Runs on the device, where the exact position stays.
 *
 * All loaded means the whole circle: a cell within `radius` of the exact position is within `reach`
 * of the rounded centre, so it is among the wanted.
 */
export function completeWithin<K extends CellKey>(
  position: LatLon,
  radius: number,
  wanted: readonly K[],
  isLoaded: (leaf: K) => boolean,
): number {
  let within = radius;
  for (const leaf of wanted) if (!isLoaded(leaf)) within = Math.min(within, distanceToBox(position, cellBox(leaf)));
  return within;
}

/**
 * Where the copy has the data, as polygons simplified by up to `eps` metres. Each ring and hole is a
 * flat list [latE5, lonE5, latE5, lonE5, …] of vertices, closed implicitly: the last one joins the
 * first. Inside, the copy answers; outside and across the edge, Overpass does.
 */
export interface Coverage {
  /** How far the simplified edge may stray from the true one, in metres. */
  eps: number;
  rings: number[][];
  holes: number[][];
}

/** Ray casting: does a ray going east from the point cross the ring's edges an odd number of times? */
function inRing(latE5: number, lonE5: number, ring: readonly number[]): boolean {
  let inside = false;
  const n = ring.length >> 1;
  for (let a = 0, b = n - 1; a < n; b = a++) {
    const latA = ring[2 * a]!;
    const lonA = ring[2 * a + 1]!;
    const latB = ring[2 * b]!;
    const lonB = ring[2 * b + 1]!;
    // The edge spans the point's latitude (so latA ≠ latB) and meets it east of the point.
    if (latA > latE5 !== latB > latE5 && lonE5 < lonA + ((lonB - lonA) * (latE5 - latA)) / (latB - latA)) inside = !inside;
  }
  return inside;
}

/** Inside some ring and in none of the holes; the edges are straight lines in degrees. */
export function pointInPolygon(p: LatLon, coverage: Coverage): boolean {
  const latE5 = p.lat * 1e5;
  const lonE5 = p.lon * 1e5;
  return coverage.rings.some((ring) => inRing(latE5, lonE5, ring)) && !coverage.holes.some((hole) => inRing(latE5, lonE5, hole));
}

/** Metres to a degree of latitude in the flat projection of `distanceToEdges`. */
const FLAT_M_PER_DEGREE = 111_320;

/** Distance from the origin to the segment a–b. */
function toSegment(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  // Where the origin's foot falls along the segment, held to its ends.
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / length2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Metres from `p` to the nearest segment of any ring or hole, measured on a flat map around `p`
 * (x = Δlon·cos(lat)·111,320, y = Δlat·111,320): off by a fraction of a percent at these distances.
 */
export function distanceToEdges(p: LatLon, coverage: Coverage): number {
  const xPerDegree = Math.cos(rad(p.lat)) * FLAT_M_PER_DEGREE;
  let nearest = Infinity;
  for (const ring of [...coverage.rings, ...coverage.holes]) {
    // Vertex k on the flat map, with `p` at the origin.
    const x = (k: number) => (ring[2 * k + 1]! / 1e5 - p.lon) * xPerDegree;
    const y = (k: number) => (ring[2 * k]! / 1e5 - p.lat) * FLAT_M_PER_DEGREE;
    const n = ring.length >> 1;
    for (let a = 0, b = n - 1; a < n; b = a++) nearest = Math.min(nearest, toSegment(x(b), y(b), x(a), y(a)));
  }
  return nearest;
}

/**
 * What the copy can answer for a circle around `p`. Outside its area: 'none' (ask Overpass). Inside:
 * `safeWithin`, how far around `p` the copy is surely complete (the distance to its edge less the
 * simplification), and 'full' when that covers the circle, 'partial' when the circle crosses the edge.
 */
export function coverageOf(
  p: LatLon,
  radius: number,
  coverage: Coverage,
): { kind: 'full' | 'partial' | 'none'; safeWithin: number } {
  if (!pointInPolygon(p, coverage)) return { kind: 'none', safeWithin: 0 };
  const safeWithin = Math.max(0, distanceToEdges(p, coverage) - coverage.eps);
  return { kind: safeWithin >= radius ? 'full' : 'partial', safeWithin };
}
