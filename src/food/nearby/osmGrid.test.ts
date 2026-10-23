import { describe, expect, test } from 'vitest';
import gridSource from './osmGrid.ts?raw';
import { distanceMeters } from './geo';
import {
  CAP,
  LAT0,
  LON0,
  MAX_DEPTH,
  ROOT_DEPTH,
  buildTree,
  cellBox,
  cellOf,
  completeWithin,
  coverageOf,
  distanceToBox,
  distanceToEdges,
  haversine,
  latSpan,
  lonSpan,
  pointInPolygon,
  roundedCentre,
  roundingMargin,
  wantedLeaves,
  type Box,
  type CellKey,
  type Coverage,
  type Wanted,
} from './osmGrid';
import { queryCircle } from './query';
import { RADIUS_STEPS } from './radius';
import type { LatLon } from './types';

/** Seeded random numbers (mulberry32): the same "random" cases on every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const e5 = (deg: number) => Math.round(deg * 1e5);
const keyOf = ({ d, i, j }: CellKey) => `${d}/${i}/${j}`;
const byKey = (a: CellKey, b: CellKey) => a.d - b.d || a.i - b.i || a.j - b.j;

interface Row {
  id: number;
  latE5: number;
  lonE5: number;
}

const WARSAW = { lat: 52.2297, lon: 21.0122 };
/** A crowded square: more places on one spot than any cap. */
const SQUARE = { latE5: 5_223_180, lonE5: 2_100_600 };

/** Places the way they cluster: most in the city, a few on one square, the rest over the region. */
function randomRows(rand: () => number, count: number): Row[] {
  return Array.from({ length: count }, (_, id) => {
    if (rand() < 0.01) return { id, ...SQUARE };
    // Three in four in the city (≈ 13 × 13 km), the rest over the region around it (≈ 130 × 130 km).
    const spread = rand() < 0.75 ? 0.12 : 1.2;
    return { id, latE5: e5(WARSAW.lat + (rand() - 0.5) * spread), lonE5: e5(WARSAW.lon + (rand() - 0.5) * spread * 1.6) };
  });
}

/**
 * The distance to a box found the slow way, independent of the clamping in `distanceToBox`: the
 * nearest point of each edge by ternary search (along a meridian or a parallel the distance to a
 * point has a single minimum).
 */
function searchedDistance(p: LatLon, box: Box): number {
  const [south, west, north, east] = [box.south / 1e5, box.west / 1e5, box.north / 1e5, box.east / 1e5];
  if (south <= p.lat && p.lat <= north && west <= p.lon && p.lon <= east) return 0;
  const corners = [
    { lat: south, lon: west },
    { lat: north, lon: west },
    { lat: north, lon: east },
    { lat: south, lon: east },
  ];
  let nearest = Infinity;
  corners.forEach((from, k) => {
    const to = corners[(k + 1) % 4]!;
    const at = (t: number) => haversine(p, { lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t });
    let [lo, hi] = [0, 1];
    for (let step = 0; step < 50; step++) {
      const [m1, m2] = [lo + (hi - lo) / 3, hi - (hi - lo) / 3];
      if (at(m1) < at(m2)) hi = m2;
      else lo = m1;
    }
    // Both ends of what is left: a corner (t = 0 or 1) is then measured exactly.
    nearest = Math.min(nearest, at(lo), at(hi));
  });
  return nearest;
}

describe('cells', () => {
  test('the grid is fixed: the build and the device must cut the same cells', () => {
    expect([LAT0, LON0, ROOT_DEPTH, CAP, MAX_DEPTH]).toEqual([4_800_000, 1_300_000, 6, 500, 12]);
    expect([latSpan(0), lonSpan(0)]).toEqual([2 ** 21, 2 ** 22]);
    expect([latSpan(ROOT_DEPTH), lonSpan(ROOT_DEPTH), latSpan(MAX_DEPTH), lonSpan(MAX_DEPTH)]).toEqual([32_768, 65_536, 512, 1024]);
  });

  test('all of Poland is in the first cell of depth 0, and at 52° N the cells are nearly square', () => {
    const extremes = [
      { lat: 54.8357, lon: 18.3006 }, // north: Jastrzębia Góra
      { lat: 49.0021, lon: 22.8569 }, // south: Opołonek
      { lat: 52.8406, lon: 14.1228 }, // west: Osinów Dolny
      { lat: 50.8693, lon: 24.1458 }, // east: Zosin
    ];
    for (const p of extremes) expect(cellOf(e5(p.lat), e5(p.lon), 0)).toEqual({ d: 0, i: 0, j: 0 });
    // Height and width of a cell in metres, along its west and south edges.
    const size = (d: number) => {
      const box = cellBox(cellOf(e5(52), e5(21), d));
      const sw = { lat: box.south / 1e5, lon: box.west / 1e5 };
      return [haversine(sw, { lat: box.north / 1e5, lon: sw.lon }), haversine(sw, { lat: sw.lat, lon: box.east / 1e5 })].map(Math.round);
    };
    expect(size(ROOT_DEPTH)).toEqual([36_436, 44_933]);
    expect(size(MAX_DEPTH)).toEqual([569, 701]);
  });

  test('cells are half-open: a point on an edge belongs to the cell north or east of it', () => {
    for (let d = ROOT_DEPTH; d <= MAX_DEPTH; d++) {
      const key = cellOf(e5(WARSAW.lat), e5(WARSAW.lon), d);
      const { i, j } = key;
      const box = cellBox(key);
      expect(cellOf(box.south, box.west, d)).toEqual(key);
      expect(cellOf(box.north - 1, box.east - 1, d)).toEqual(key);
      expect(cellOf(box.north, box.west, d)).toEqual({ d, i: i + 1, j });
      expect(cellOf(box.south, box.east, d)).toEqual({ d, i, j: j + 1 });
      expect(cellOf(box.south - 1, box.west - 1, d)).toEqual({ d, i: i - 1, j: j - 1 });
    }
    // Rounded down, not towards zero: just south-west of the grid's corner is cell -1.
    expect(cellOf(LAT0, LON0, ROOT_DEPTH)).toEqual({ d: ROOT_DEPTH, i: 0, j: 0 });
    expect(cellOf(LAT0 - 1, LON0 - 1, ROOT_DEPTH)).toEqual({ d: ROOT_DEPTH, i: -1, j: -1 });
  });

  test('a cell holds exactly the points cellOf puts in it, and its four quarters tile it', () => {
    const rand = seeded(1);
    const wrong: unknown[] = [];
    for (let n = 0; n < 3000; n++) {
      const [lat, lon] = [e5(49 + rand() * 6), e5(14 + rand() * 10.3)];
      const d = ROOT_DEPTH + Math.floor(rand() * (MAX_DEPTH - ROOT_DEPTH + 1));
      const key = cellOf(lat, lon, d);
      const box = cellBox(key);
      const child = cellOf(lat, lon, d + 1);
      const inBox = box.south <= lat && lat < box.north && box.west <= lon && lon < box.east;
      const inParent = Math.floor(child.i / 2) === key.i && Math.floor(child.j / 2) === key.j;
      if (!inBox || !inParent) wrong.push({ lat, lon, d });
    }
    expect(wrong).toEqual([]);

    const parent = cellBox({ d: 8, i: 50, j: 30 });
    const [midLat, midLon] = [(parent.south + parent.north) / 2, (parent.west + parent.east) / 2];
    expect(cellBox({ d: 9, i: 100, j: 60 })).toEqual({ south: parent.south, west: parent.west, north: midLat, east: midLon });
    expect(cellBox({ d: 9, i: 100, j: 61 })).toEqual({ south: parent.south, west: midLon, north: midLat, east: parent.east });
    expect(cellBox({ d: 9, i: 101, j: 60 })).toEqual({ south: midLat, west: parent.west, north: parent.north, east: midLon });
    expect(cellBox({ d: 9, i: 101, j: 61 })).toEqual({ south: midLat, west: midLon, north: parent.north, east: parent.east });
  });
});

describe('buildTree', () => {
  const rows = randomRows(seeded(2), 5000);
  const cap = 25;
  const leaves = buildTree(rows, cap);

  test('every row lands in exactly one leaf: the one whose cell holds it', () => {
    const placed = new Set<Row>();
    const wrong: Row[] = [];
    for (const leaf of leaves) {
      for (const row of leaf.rows) {
        if (placed.has(row) || keyOf(cellOf(row.latE5, row.lonE5, leaf.d)) !== keyOf(leaf)) wrong.push(row);
        placed.add(row);
      }
    }
    expect(wrong).toEqual([]);
    expect(placed.size).toBe(rows.length);
  });

  test('a leaf holds at most cap rows, unless it is as deep as the tree goes', () => {
    expect(leaves.filter((leaf) => leaf.rows.length > cap && leaf.d !== MAX_DEPTH)).toEqual([]);
    expect(leaves.filter((leaf) => leaf.rows.length === 0)).toEqual([]);
    // The square is too crowded for any cell: it splits to the bottom, and its leaf keeps everyone.
    const square = leaves.find((leaf) => keyOf(leaf) === keyOf(cellOf(SQUARE.latE5, SQUARE.lonE5, MAX_DEPTH)));
    expect(square?.rows.length).toBeGreaterThan(cap);
    // The city splits deep, the countryside stays shallow.
    const depths = leaves.map((leaf) => leaf.d);
    expect(Math.min(...depths)).toBeLessThanOrEqual(ROOT_DEPTH + 1);
    expect(Math.max(...depths)).toBe(MAX_DEPTH);
  });

  test('leaves never overlap: none is an ancestor of another, no two cells share any area', () => {
    const keys = new Set(leaves.map(keyOf));
    expect(keys.size).toBe(leaves.length);
    const nested = leaves.filter((leaf) => {
      for (let d = ROOT_DEPTH; d < leaf.d; d++) {
        const up = 2 ** (leaf.d - d);
        if (keys.has(keyOf({ d, i: Math.floor(leaf.i / up), j: Math.floor(leaf.j / up) }))) return true;
      }
      return false;
    });
    expect(nested).toEqual([]);

    const boxes = leaves.map(cellBox);
    let overlaps = 0;
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const [p, q] = [boxes[a]!, boxes[b]!];
        if (p.south < q.north && q.south < p.north && p.west < q.east && q.west < p.east) overlaps++;
      }
    }
    expect(overlaps).toBe(0);
  });

  test('one order: leaves by (d, i, j), rows as they came in; the same rows make the same tree', () => {
    expect(leaves.filter((leaf, k) => k > 0 && byKey(leaves[k - 1]!, leaf) >= 0)).toEqual([]);
    expect(leaves.filter((leaf) => leaf.rows.some((row, k) => k > 0 && leaf.rows[k - 1]!.id > row.id))).toEqual([]);
    expect(buildTree(rows, cap)).toEqual(leaves);
    // The same rows in another order make the same cells, each with its rows in that order - which
    // is why callers sort the rows by id first.
    const reversed = buildTree([...rows].reverse(), cap);
    expect(reversed.map(keyOf)).toEqual(leaves.map(keyOf));
    expect(reversed.map((leaf) => leaf.rows.map((row) => row.id))).toEqual(leaves.map((leaf) => leaf.rows.map((row) => row.id).reverse()));
  });

  test('a cell with exactly cap rows stays whole; one more splits it', () => {
    const root = cellBox(cellOf(e5(WARSAW.lat), e5(WARSAW.lon), ROOT_DEPTH));
    const [midLat, midLon] = [(root.south + root.north) / 2, (root.west + root.east) / 2];
    // One row in each quarter of a root cell…
    const four = [
      { id: 0, latE5: midLat - 1000, lonE5: midLon - 1000 },
      { id: 1, latE5: midLat - 1000, lonE5: midLon + 1000 },
      { id: 2, latE5: midLat + 1000, lonE5: midLon - 1000 },
      { id: 3, latE5: midLat + 1000, lonE5: midLon + 1000 },
    ];
    expect(buildTree(four, 4).map((leaf) => [leaf.d, leaf.rows.length])).toEqual([[ROOT_DEPTH, 4]]);
    // …and a fifth in the north-east one: the quarters, south-west to north-east.
    const five = buildTree([...four, { id: 4, latE5: midLat + 2000, lonE5: midLon + 2000 }], 4);
    expect(five.map((leaf) => [leaf.d, leaf.rows.map((row) => row.id)])).toEqual([
      [ROOT_DEPTH + 1, [0]],
      [ROOT_DEPTH + 1, [1]],
      [ROOT_DEPTH + 1, [2]],
      [ROOT_DEPTH + 1, [3, 4]],
    ]);
  });

  test('a dense cluster splits down to maxDepth, and that leaf keeps all of it', () => {
    const cluster = Array.from({ length: 30 }, (_, id) => ({ id, ...SQUARE }));
    // A street of places 2 km west of the square, one every 2.2 km.
    const street = Array.from({ length: 30 }, (_, k) => ({ id: 30 + k, latE5: SQUARE.latE5 - 30_000 + 2000 * k, lonE5: SQUARE.lonE5 - 3000 }));
    const tree = buildTree([...cluster, ...street], 10);
    const home = tree.find((leaf) => leaf.rows.includes(cluster[0]!));
    expect(home?.d).toBe(MAX_DEPTH);
    expect(home?.rows).toEqual(cluster);
    expect(tree.filter((leaf) => leaf !== home && leaf.rows.length > 10)).toEqual([]);
    // A shallower tree stops sooner.
    expect(buildTree([...cluster, ...street], 10, 9).find((leaf) => leaf.rows.includes(cluster[0]!))?.d).toBe(9);
  });

  test('a deeper root starts the tree lower down', () => {
    const tree = buildTree(rows, cap, MAX_DEPTH, 8);
    expect(Math.min(...tree.map((leaf) => leaf.d))).toBe(8);
    expect(tree.flatMap((leaf) => leaf.rows.filter((row) => keyOf(cellOf(row.latE5, row.lonE5, leaf.d)) !== keyOf(leaf)))).toEqual([]);
    expect(tree.reduce((sum, leaf) => sum + leaf.rows.length, 0)).toBe(rows.length);
  });

  test('defaults: CAP rows a leaf, depths from ROOT_DEPTH to MAX_DEPTH; no rows, no leaves', () => {
    const many = randomRows(seeded(3), 4000);
    const crowd = Array.from({ length: CAP + 1 }, (_, k) => ({ id: 4000 + k, ...SQUARE }));
    const tree = buildTree([...many, ...crowd]);
    expect(tree.filter((leaf) => leaf.d < ROOT_DEPTH || leaf.d > MAX_DEPTH)).toEqual([]);
    expect(tree.filter((leaf) => leaf.rows.length > CAP && leaf.d !== MAX_DEPTH)).toEqual([]);
    expect(tree.some((leaf) => leaf.rows.length > CAP)).toBe(true);
    expect(tree.reduce((sum, leaf) => sum + leaf.rows.length, 0)).toBe(many.length + crowd.length);
    expect(buildTree([])).toEqual([]);
  });
});

describe('the leaves around a position', () => {
  // What the device holds: one entry per leaf file.
  type IndexLeaf = CellKey & { file: string };
  const index: IndexLeaf[] = buildTree(randomRows(seeded(4), 5000), 25).map(({ d, i, j }) => ({ d, i, j, file: `${d}-${i}-${j}` }));
  const nearWarsaw = (rand: () => number): LatLon => ({ lat: WARSAW.lat + (rand() - 0.5) * 0.4, lon: WARSAW.lon + (rand() - 0.5) * 0.64 });
  const inPoland = (rand: () => number): LatLon => ({ lat: 49 + rand() * 6, lon: 14 + rand() * 10 });

  test('haversine is distanceMeters from geo.ts, copied', () => {
    const rand = seeded(5);
    const pairs = Array.from({ length: 500 }, () => [inPoland(rand), inPoland(rand)] as const);
    expect(pairs.filter(([a, b]) => haversine(a, b) !== distanceMeters(a, b))).toEqual([]);
  });

  test('a position is rounded exactly as for the Overpass query', () => {
    expect(roundedCentre({ lat: 52.23184, lon: 21.00649 })).toEqual({ lat: 52.232, lon: 21.006 });
    const rand = seeded(6);
    const differ = Array.from({ length: 2000 }, () => inPoland(rand)).filter((p) => {
      const query = queryCircle(p, 1000);
      const centre = roundedCentre(p);
      return centre.lat !== query.lat || centre.lon !== query.lon;
    });
    expect(differ).toEqual([]);
  });

  test('the margin covers the way from any position to its rounded centre, with 20 m to spare', () => {
    expect(roundingMargin(52)).toBeCloseTo(85.36, 2);
    const rand = seeded(7);
    let spare = Infinity;
    for (let n = 0; n < 5000; n++) {
      const p = inPoland(rand);
      const centre = roundedCentre(p);
      spare = Math.min(spare, roundingMargin(centre.lat) - haversine(p, centre));
    }
    // The farthest a position gets: a corner of its rounding cell.
    for (const lat of [49, 50.5, 52, 54.8]) {
      for (const [dLat, dLon] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const corner = { lat: lat + dLat * 0.0005, lon: 19 + dLon * 0.0005 };
        spare = Math.min(spare, roundingMargin(lat) - haversine({ lat, lon: 19 }, corner));
      }
    }
    expect(spare).toBeGreaterThanOrEqual(20);
  });

  test('distanceToBox: 0 inside and on the edge, else the distance to the nearest point', () => {
    const box = cellBox(cellOf(e5(WARSAW.lat), e5(WARSAW.lon), 10));
    const [south, west, north, east] = [box.south / 1e5, box.west / 1e5, box.north / 1e5, box.east / 1e5];
    const middle = { lat: (south + north) / 2, lon: (west + east) / 2 };
    for (const p of [middle, { lat: south, lon: west }, { lat: north, lon: east }, { lat: north, lon: middle.lon }]) {
      expect(distanceToBox(p, box)).toBe(0);
    }
    // Due north the whole way is latitude.
    expect(distanceToBox({ lat: north + 0.01, lon: middle.lon }, box)).toBeCloseTo(((0.01 * Math.PI) / 180) * 6_371_008.8, 3);
    // All around (up to ≈ 11 km off), within a few millimetres of the slow search and never short of it.
    const rand = seeded(8);
    let [under, over] = [0, 0];
    for (let n = 0; n < 2000; n++) {
      const p = { lat: south - 0.1 + rand() * (north - south + 0.2), lon: west - 0.15 + rand() * (east - west + 0.3) };
      const gap = distanceToBox(p, box) - searchedDistance(p, box);
      [under, over] = [Math.min(under, gap), Math.max(over, gap)];
    }
    expect(under).toBeGreaterThan(-1e-6);
    expect(over).toBeLessThan(0.01);
  });

  test('wantedLeaves: every leaf within reach of the rounded centre, nearest first, as a brute force finds them', () => {
    const rand = seeded(9);
    const wrong: unknown[] = [];
    let most = 0;
    for (let n = 0; n < 40; n++) {
      const position = nearWarsaw(rand);
      const radius = RADIUS_STEPS[n % RADIUS_STEPS.length]!;
      const wanted = wantedLeaves(index, position, radius);
      const centre = roundedCentre(position);
      expect(wanted.centre).toEqual(centre);
      expect(wanted.reach).toBe(radius + roundingMargin(centre.lat));
      // Written out: all the leaves, measured, filtered and sorted.
      const expected = index
        .map((leaf) => ({ leaf, distance: distanceToBox(centre, cellBox(leaf)) }))
        .filter(({ distance }) => distance <= wanted.reach)
        .sort((a, b) => a.distance - b.distance || byKey(a.leaf, b.leaf))
        .map(({ leaf }) => leaf);
      expect(wanted.leaves).toEqual(expected);
      // Measured the slow way, without the clamping: in when nearer than reach, out when farther.
      // A great circle is never shorter than its difference in latitude: a leaf that far off is out
      // without the search.
      const chosen = new Set(wanted.leaves);
      for (const leaf of index) {
        const box = cellBox(leaf);
        const latitudeGap = Math.max(0, box.south / 1e5 - centre.lat, centre.lat - box.north / 1e5);
        const distance = ((latitudeGap * Math.PI) / 180) * 6_371_008.8 > wanted.reach ? Infinity : searchedDistance(centre, box);
        if (chosen.has(leaf) ? distance > wanted.reach + 1e-6 : distance <= wanted.reach - 0.01) wrong.push({ position, radius, leaf });
      }
      most = Math.max(most, wanted.leaves.length);
    }
    expect(wrong).toEqual([]);
    expect(most).toBeGreaterThan(50);
  });

  test('leaves at the same distance go by (d, i, j)', () => {
    // 52.096° N 20.68° E is a corner of the grid at depths 11 and 12 alike: four leaves touch it.
    const corner = { lat: 52.096, lon: 20.68 };
    expect(cellOf(e5(corner.lat), e5(corner.lon), 11)).toEqual({ d: 11, i: 400, j: 375 });
    const touching = [
      { d: 11, i: 399, j: 374 },
      { d: 11, i: 399, j: 375 },
      { d: 12, i: 800, j: 749 },
      { d: 12, i: 800, j: 750 },
    ];
    // Two more, both 569 m north of the corner.
    const north = [
      { d: 12, i: 801, j: 749 },
      { d: 12, i: 801, j: 750 },
    ];
    expect([...touching, ...north].map((leaf) => Math.round(distanceToBox(corner, cellBox(leaf))))).toEqual([0, 0, 0, 0, 569, 569]);
    const shuffled = [north[1]!, touching[3]!, touching[0]!, north[0]!, touching[2]!, touching[1]!];
    // A position that rounds to the corner.
    expect(wantedLeaves(shuffled, { lat: 52.0962, lon: 20.6797 }, 500).leaves).toEqual([...touching, ...north]);
  });

  test('a leaf exactly at the reach is wanted; a hair farther, it is not', () => {
    const corner = { lat: 52.096, lon: 20.68 };
    const leaf = { d: 12, i: 801, j: 749 };
    const distance = distanceToBox(corner, cellBox(leaf));
    const radius = distance - roundingMargin(corner.lat);
    const wanted = wantedLeaves([leaf], corner, radius);
    expect(wanted.reach).toBe(distance);
    expect(wanted.leaves).toEqual([leaf]);
    expect(wantedLeaves([leaf], corner, radius - 1e-6).leaves).toEqual([]);
  });

  test('privacy: every position in one rounding cell asks for the same leaves, in the same order', () => {
    const centre = { lat: 52.231, lon: 21.006 };
    const rand = seeded(10);
    // Anywhere in the cell, its corners too (± 0.000499°: a hair more and it rounds elsewhere).
    const positions = [
      ...([[-1, -1], [-1, 1], [1, -1], [1, 1]] as const).map(([a, b]) => ({ lat: centre.lat + a * 0.000499, lon: centre.lon + b * 0.000499 })),
      ...Array.from({ length: 100 }, () => ({ lat: centre.lat + (rand() - 0.5) * 0.000998, lon: centre.lon + (rand() - 0.5) * 0.000998 })),
    ];
    expect(positions.map(roundedCentre).filter((c) => c.lat !== centre.lat || c.lon !== centre.lon)).toEqual([]);
    const same = (a: Wanted<IndexLeaf>, b: Wanted<IndexLeaf>) =>
      a.centre.lat === b.centre.lat &&
      a.centre.lon === b.centre.lon &&
      a.reach === b.reach &&
      a.leaves.length === b.leaves.length &&
      a.leaves.every((leaf, k) => leaf === b.leaves[k]);
    for (const radius of RADIUS_STEPS) {
      const reference = wantedLeaves(index, centre, radius);
      expect(reference.leaves.length).toBeGreaterThan(0);
      expect(positions.filter((p) => !same(wantedLeaves(index, p, radius), reference))).toEqual([]);
    }
  });

  test('every leaf within the radius of the exact position is wanted: all loaded means complete', () => {
    const rand = seeded(11);
    const missed: unknown[] = [];
    for (let n = 0; n < 80; n++) {
      // A corner of the rounding cell: as far from the rounded centre as a position gets.
      const centre = roundedCentre(nearWarsaw(rand));
      const position = { lat: centre.lat + (rand() < 0.5 ? -1 : 1) * 0.000499, lon: centre.lon + (rand() < 0.5 ? -1 : 1) * 0.000499 };
      const radius = RADIUS_STEPS[n % RADIUS_STEPS.length]!;
      const wanted = new Set(wantedLeaves(index, position, radius).leaves);
      for (const leaf of index) {
        if (distanceToBox(position, cellBox(leaf)) <= radius && !wanted.has(leaf)) missed.push({ position, radius, leaf });
      }
    }
    expect(missed).toEqual([]);
  });

  test('completeWithin: the radius when every wanted leaf is loaded, else the distance to the nearest missing one', () => {
    const rand = seeded(12);
    for (let n = 0; n < 40; n++) {
      const position = nearWarsaw(rand);
      const radius = RADIUS_STEPS[n % RADIUS_STEPS.length]!;
      const { leaves } = wantedLeaves(index, position, radius);
      expect(completeWithin(position, radius, leaves, () => true)).toBe(radius);
      const missing = new Set(leaves.filter(() => rand() < 0.2));
      const nearest = Math.min(radius, ...[...missing].map((leaf) => distanceToBox(position, cellBox(leaf))));
      expect(completeWithin(position, radius, leaves, (leaf) => !missing.has(leaf))).toBe(nearest);
    }

    // By hand: the leaf under the position missing, nothing around is certain; the next one north
    // missing, everything short of it is.
    const here = { lat: 52.2318, lon: 21.006 };
    const under = cellOf(e5(here.lat), e5(here.lon), MAX_DEPTH);
    const north = { d: MAX_DEPTH, i: under.i + 1, j: under.j };
    const wanted = wantedLeaves([north, under], here, 1000).leaves;
    expect(wanted).toEqual([under, north]);
    expect(completeWithin(here, 1000, wanted, (leaf) => leaf !== under)).toBe(0);
    const toNorth = distanceToBox(here, cellBox(north));
    expect(Math.round(toNorth)).toBe(271);
    expect(completeWithin(here, 1000, wanted, (leaf) => leaf !== north)).toBe(toNorth);
    expect(completeWithin(here, 100, wanted, (leaf) => leaf !== north)).toBe(100);
  });
});

describe('coverage', () => {
  // A ring from its south-west corner clockwise: its south edge is the closing one (last vertex to first).
  const rectangle = (south: number, west: number, north: number, east: number) =>
    [south, west, north, west, north, east, south, east].map(e5);
  // Around Warsaw with a hole in it, and an island off the coast.
  const COVERAGE: Coverage = {
    eps: 100,
    rings: [rectangle(51.9, 20.6, 52.5, 21.4), rectangle(54.0, 18.5, 54.1, 18.7)],
    holes: [rectangle(52.1, 20.9, 52.2, 21.0)],
  };
  const FLAT = 111_320;
  const cos = (deg: number) => Math.cos((deg * Math.PI) / 180);

  test('inside, far from every edge: full while the circle fits, partial past that', () => {
    const p = { lat: 52.3, lon: 21.2 };
    const toEast = (21.4 - 21.2) * cos(52.3) * FLAT; // ≈ 13.6 km: the nearest edge
    expect(pointInPolygon(p, COVERAGE)).toBe(true);
    expect(distanceToEdges(p, COVERAGE)).toBeCloseTo(toEast, 6);
    expect(coverageOf(p, 10_000, COVERAGE)).toEqual({ kind: 'full', safeWithin: expect.closeTo(toEast - 100, 6) });
    expect(coverageOf(p, 15_000, COVERAGE)).toEqual({ kind: 'partial', safeWithin: expect.closeTo(toEast - 100, 6) });
    // A circle that just fits is full.
    const { safeWithin } = coverageOf(p, 0, COVERAGE);
    expect(coverageOf(p, safeWithin, COVERAGE).kind).toBe('full');
  });

  test('outside, or in a hole: none', () => {
    for (const p of [
      { lat: 52.6, lon: 21.0 }, // north of the ring
      { lat: 53.2, lon: 19.6 }, // between the ring and the island
      { lat: 52.15, lon: 20.95 }, // in the hole
    ]) {
      expect(pointInPolygon(p, COVERAGE)).toBe(false);
      expect(coverageOf(p, 1000, COVERAGE)).toEqual({ kind: 'none', safeWithin: 0 });
    }
    expect(coverageOf({ lat: 52.2, lon: 21 }, 1000, { eps: 0, rings: [], holes: [] })).toEqual({ kind: 'none', safeWithin: 0 });
  });

  test('near an edge: partial, safe up to the edge less the simplification', () => {
    // 0.005° north of the south edge - the ring's closing segment.
    const p = { lat: 51.905, lon: 21.0 };
    const toSouth = (51.905 - 51.9) * FLAT; // ≈ 557 m
    expect(distanceToEdges(p, COVERAGE)).toBeCloseTo(toSouth, 6);
    expect(coverageOf(p, 1000, COVERAGE)).toEqual({ kind: 'partial', safeWithin: expect.closeTo(toSouth - 100, 6) });
    expect(coverageOf(p, 400, COVERAGE).kind).toBe('full');
    // A hole's edge counts as much as the outer one.
    expect(coverageOf({ lat: 52.205, lon: 20.95 }, 1000, COVERAGE)).toEqual({
      kind: 'partial',
      safeWithin: expect.closeTo((52.205 - 52.2) * FLAT - 100, 6),
    });
    // Nearer the edge than its simplification: nothing is certain.
    expect(coverageOf({ lat: 51.9005, lon: 21.0 }, 1000, COVERAGE)).toEqual({ kind: 'partial', safeWithin: 0 });
  });

  test('every ring counts: an island is covered too', () => {
    const p = { lat: 54.05, lon: 18.6 };
    expect(pointInPolygon(p, COVERAGE)).toBe(true);
    expect(distanceToEdges(p, COVERAGE)).toBeCloseTo(0.05 * FLAT, 6); // its north and south edges
    expect(coverageOf(p, 5000, COVERAGE).kind).toBe('full');
    expect(coverageOf(p, 7500, COVERAGE).kind).toBe('partial');
  });

  test('a ring closes by itself, and off a corner the distance is to the corner', () => {
    // A triangle whose long side is the closing segment, from the south-east corner back to the north-west.
    const triangle: Coverage = { eps: 0, rings: [[53, 20, 52, 20, 52, 21].map(e5)], holes: [] };
    expect(pointInPolygon({ lat: 52.2, lon: 20.2 }, triangle)).toBe(true);
    expect(pointInPolygon({ lat: 52.5, lon: 20.49 }, triangle)).toBe(true);
    expect(pointInPolygon({ lat: 52.8, lon: 20.8 }, triangle)).toBe(false);
    expect(distanceToEdges({ lat: 51.8, lon: 21.0 }, COVERAGE)).toBeCloseTo((51.9 - 51.8) * FLAT, 6);
    expect(distanceToEdges({ lat: 52.6, lon: 21.5 }, COVERAGE)).toBeCloseTo(Math.hypot(0.1 * cos(52.6) * FLAT, 0.1 * FLAT), 6);
  });
});

test('the grid imports nothing, not even types: the Vite plugin runs it with Node’s own TypeScript loader', () => {
  expect(gridSource).toContain('export function buildTree');
  expect(gridSource).not.toMatch(/^\s*import\b/m);
  expect(gridSource).not.toMatch(/\bfrom\s*['"]|\bimport\s*\(|\brequire\s*\(/);
});
