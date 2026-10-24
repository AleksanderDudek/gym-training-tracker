import { buildTree, cellBox, CAP, LAT0, LON0, MAX_DEPTH, ROOT_DEPTH } from '../nearby/osmGrid';
import { encodeLeaf, leafPath, type OsmIndex, type OsmRow } from '../nearby/osmFormat';
import { OSM_COLUMNS } from '../nearby/osmTags';

/**
 * A small copy of the app's OSM data for tests, cut by the real quadtree and encoded by the real
 * format — so the client reads exactly what the build would give it, only uncompressed (`inflate`
 * takes plain text too).
 */

/** A row of the data: an OSM id ('n10', 'w7'), a position in degrees, tags. */
export function osmRow(id: string, lat: number, lon: number, tags: Record<string, string>): OsmRow {
  return { id, latE5: Math.round(lat * 1e5), lonE5: Math.round(lon * 1e5), tags };
}

/** A 10-hex-digit stand-in for the content hash (the build uses sha256; the client only passes it on). */
function hash10(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let k = 0; k < text.length; k++) {
    a = Math.imul(a ^ text.charCodeAt(k), 16777619) >>> 0;
    b = Math.imul(b + text.charCodeAt(k), 2246822519) >>> 0;
  }
  return (a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')).slice(0, 10);
}

/** A rectangular coverage polygon (south, west, north, east in degrees) as the index stores it. */
export function boxCoverage(south: number, west: number, north: number, east: number, eps = 300): OsmIndex['coverage'] {
  const e5 = (n: number) => Math.round(n * 1e5);
  return { eps, rings: [[e5(south), e5(west), e5(south), e5(east), e5(north), e5(east), e5(north), e5(west)]], holes: [] };
}

export interface OsmTestData {
  index: OsmIndex;
  /** Path under `data/osm/v1/` → leaf JSON. */
  files: Map<string, string>;
}

export function osmTestData(rows: OsmRow[], coverage: OsmIndex['coverage'], cap = CAP, dataAsOf = '2026-10-22T20:21:33Z'): OsmTestData {
  const sorted = [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const files = new Map<string, string>();
  const leaves: OsmIndex['leaves'] = [];
  for (const leaf of buildTree(sorted, cap, MAX_DEPTH, ROOT_DEPTH)) {
    const box = cellBox(leaf);
    const json = encodeLeaf(leaf, leaf.rows, OSM_COLUMNS, [box.south, box.west]);
    const entry: OsmIndex['leaves'][number] = [leaf.d, leaf.i, leaf.j, leaf.rows.length, hash10(json)];
    files.set(leafPath(entry), json);
    leaves.push(entry);
  }
  const index: OsmIndex = {
    f: 1,
    dataAsOf,
    count: rows.length,
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
    notice: 'LICENSE.txt',
    grid: { lat0: LAT0, lon0: LON0, root: ROOT_DEPTH, maxDepth: MAX_DEPTH, cap },
    coverage,
    leaves,
  };
  return { index, files };
}

/** The response the app's server gives for a URL of this data; `null` for anything else. */
export function osmResponse(data: OsmTestData, url: string): Response | null {
  const path = new URL(url, 'http://localhost/').pathname;
  if (path.endsWith('/data/osm/v1/index.json')) return new Response(JSON.stringify(data.index), { headers: { 'content-type': 'application/json' } });
  const at = path.indexOf('/data/osm/v1/');
  if (at < 0) return null;
  const leaf = data.files.get(path.slice(at + '/data/osm/v1/'.length));
  return leaf === undefined ? new Response('not found', { status: 404 }) : new Response(leaf, { headers: { 'content-type': 'application/gzip' } });
}
