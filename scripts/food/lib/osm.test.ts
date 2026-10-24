import { describe, expect, test } from 'vitest';
import type { OsmRow } from '../../../src/food/nearby/osmFormat';
import {
  bboxCentre,
  buildMeta,
  completeness,
  decodeId,
  diffRows,
  gates,
  geometryErrors,
  kindOf,
  parsePoly,
  readFeatures,
  readOpl,
  relationRows,
  rowTags,
  simplify,
  simplifyCoverage,
  splitRecords,
  unbuiltRelations,
  unescapeOpl,
  withRows,
  type FeatureStats,
  type Meta,
} from './osm';

type Point = [number, number];

/** One line of `osmium export -f geojsonseq -u type_id`, record separator included. */
const line = (id: string, geometry: object, properties: Record<string, string>) =>
  `\x1e${JSON.stringify({ type: 'Feature', id, geometry, properties })}`;
const point = (lon: number, lat: number) => ({ type: 'Point', coordinates: [lon, lat] });
/** One line of `osmium tags-filter -f opl,add_metadata=false`: a space, `,`, `=`, `@` and `%` escaped as osmium does. */
const oplLine = (id: string, tags: Record<string, string>) => {
  const escape = (text: string) => text.replace(/[\s,=@%]/g, (c) => `%${c.codePointAt(0)!.toString(16).padStart(2, '0')}%`);
  return `${id} T${Object.entries(tags)
    .map(([key, value]) => `${escape(key)}=${escape(value)}`)
    .join(',')} ${id.startsWith('n') ? 'x21 y52' : id.startsWith('w') ? 'Nn1,n2,n3,n1' : 'Mw1@outer'}`;
};
/** A closed way: the same ring as a LineString (its `w` line) and as a MultiPolygon (its `a` area). */
const RING = [
  [21.0, 52.2],
  [21.002, 52.2],
  [21.002, 52.201],
  [21.0, 52.201],
  [21.0, 52.2],
];

describe('osmium ids', () => {
  test('nodes and ways as written; areas: an even number is a closed way, an odd one a relation', () => {
    expect(decodeId('n1')).toEqual({ type: 'node', id: 1, key: 'n1' });
    expect(decodeId('w2')).toEqual({ type: 'way', id: 2, key: 'w2' });
    expect(decodeId('a4')).toEqual({ type: 'way', id: 2, key: 'w2' });
    expect(decodeId('a5')).toEqual({ type: 'relation', id: 2, key: 'r2' });
    expect(decodeId('r789')).toEqual({ type: 'relation', id: 789, key: 'r789' });
    // Real ids: past 2^31, and twice that for an area.
    expect(decodeId('a25463972881')).toEqual({ type: 'relation', id: 12_731_986_440, key: 'r12731986440' });
    for (const odd of ['', 'x1', 'n', 'n-1', 'n0', 'a1', 'node/1', '42']) expect(decodeId(odd)).toBeNull();
  });
});

describe('positions', () => {
  test('a point is itself; anything else the centre of its bounding box, as Overpass `out center` gives', () => {
    expect(bboxCentre(point(21.01, 52.23))).toEqual({ lat: 52.23, lon: 21.01 });
    const line = bboxCentre({ type: 'LineString', coordinates: [[21, 52], [21.5, 52.1], [21.2, 53]] });
    expect(line.lat).toBeCloseTo(52.5, 12);
    expect(line.lon).toBeCloseTo(21.25, 12);
    // Two polygons, one with a hole: the box spans both.
    const multi = bboxCentre({
      type: 'MultiPolygon',
      coordinates: [
        [RING, [[21.0005, 52.2002], [21.001, 52.2002], [21.001, 52.2008], [21.0005, 52.2002]]],
        [[[21.01, 52.21], [21.02, 52.21], [21.02, 52.22], [21.01, 52.21]]],
      ],
    });
    expect(multi.lat).toBeCloseTo(52.21, 12);
    expect(multi.lon).toBeCloseTo(21.01, 12);
    expect(() => bboxCentre({ type: 'Polygon', coordinates: [] })).toThrow(/without coordinates/);
  });
});

describe('reading the export', () => {
  const restaurant = line('n10', point(21.01, 52.23), { amenity: 'restaurant', name: 'Dziupla', cuisine: 'polish' });

  test('a closed way comes as its line and its area: read once, as the way', () => {
    const tags = { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka' };
    const { rows, stats } = readFeatures([
      line('w2', { type: 'LineString', coordinates: RING }, tags),
      line('a4', { type: 'MultiPolygon', coordinates: [[RING]] }, tags),
    ]);
    expect(rows).toEqual([{ id: 'w2', latE5: 5_220_050, lonE5: 2_100_100, tags }]);
    expect(stats).toMatchObject({ features: 2, duplicates: 1, types: { node: 0, way: 1, relation: 0 }, kinds: { supermarket: 1 } });
    // The area of a multipolygon relation is the relation.
    expect(readFeatures([line('a5', { type: 'MultiPolygon', coordinates: [[RING]] }, tags)]).rows[0]?.id).toBe('r2');
  });

  test('with or without the record separator, and past blank lines', () => {
    const plain = restaurant.slice(1);
    expect(readFeatures([plain]).rows).toEqual(readFeatures([restaurant]).rows);
    expect(readFeatures(['', restaurant, '   ']).rows).toHaveLength(1);
  });

  test('what neither view asks for, and what has no brand or name, stays out', () => {
    const { rows, stats } = readFeatures([
      line('n1', point(21, 52), { amenity: 'bar', name: 'Pub' }),
      line('n2', point(21, 52), { shop: 'wholesale', name: 'Hurtownia Budowlana' }),
      line('n3', point(21, 52), { amenity: 'restaurant' }),
      line('n4', point(21, 52), { shop: 'convenience', 'name:en': 'Shop' }),
      line('n5', point(21, 52), { shop: 'wholesale', brand: 'Selgros', name: 'Selgros Cash & Carry' }),
      line('n6', point(21, 52), { shop: 'bakery', name: 'Putka' }),
      line('n7', point(21, 52), { amenity: 'fuel', shop: 'convenience', brand: 'Orlen' }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['n5', 'n6', 'n7']);
    expect(stats).toMatchObject({ features: 7, duplicates: 0, notMatching: 2, unnamed: 2, kinds: { wholesale: 1, bakery: 1, fuel: 1 } });
  });

  test('only the tags the app reads, each on one line, none empty', () => {
    const { rows } = readFeatures([
      line('n1', point(21, 52), {
        amenity: 'cafe',
        name: 'Kawa\tna\nwynos\r',
        'addr:street': 'Marszałkowska',
        'addr:housenumber': '10',
        'addr:city': 'Warszawa',
        website: 'https://example.pl',
        'fuel:diesel': 'yes',
        cuisine: '',
      }),
    ]);
    expect(rows[0]?.tags).toEqual({ amenity: 'cafe', name: 'Kawa na wynos ', 'addr:street': 'Marszałkowska', 'addr:housenumber': '10' });
  });

  test('rows come sorted: nodes, ways, relations, each by number', () => {
    const tags = { amenity: 'cafe', name: 'Café' };
    const { rows } = readFeatures([
      line('w10', point(21, 52), tags),
      line('a3', point(21, 52), tags),
      line('n10', point(21, 52), tags),
      line('n9', point(21, 52), tags),
      line('w2', point(21, 52), tags),
      line('n12345678901', point(21, 52), tags),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['n9', 'n10', 'n12345678901', 'w2', 'w10', 'r1']);
  });

  test('a line osmium would not write stops the run, with its number', () => {
    expect(() => readFeatures([restaurant, restaurant.slice(0, 40)])).toThrow(/line 2/);
    expect(() => readFeatures([JSON.stringify({ type: 'Feature', id: 7, geometry: point(21, 52), properties: {} })])).toThrow(/-u type_id/);
  });

  test('kind: the amenity when it is a place to eat, else the shop type', () => {
    expect(kindOf({ amenity: 'fuel', shop: 'convenience' })).toBe('fuel');
    expect(kindOf({ amenity: 'bar', shop: 'convenience' })).toBe('convenience');
    expect(kindOf({ shop: 'pastry' })).toBe('pastry');
  });
});

describe('the coverage polygon', () => {
  test('a Geofabrik .poly with a hole, in scientific notation', () => {
    const poly = [
      'poland',
      '1',
      '   1.400000E+01   4.900000E+01',
      '   2.400000E+01   4.900000E+01',
      '   2.400000E+01   5.500000E+01',
      '   1.400000E+01   4.900000E+01',
      'END',
      '!2',
      '   20.0   52.0',
      '   20.5   52.0',
      '   20.5   52.5',
      'END',
      'END',
      '',
    ].join('\n');
    expect(parsePoly(poly)).toEqual({
      rings: [
        [
          [49, 14],
          [49, 24],
          [55, 24],
          [49, 14],
        ],
      ],
      holes: [
        [
          [52, 20],
          [52, 20.5],
          [52.5, 20.5],
        ],
      ],
    });
    expect(parsePoly(poly.replace(/\n/g, '\r\n')).rings).toHaveLength(1);
    // Cut short: no final END, a section without END, a stray line.
    expect(() => parsePoly(poly.replace(/END\nEND\n$/, 'END\n'))).toThrow(/final END/);
    expect(() => parsePoly('poland\n1\n 14 49\n 24 49\n 24 55\n')).toThrow(/no END/);
    expect(() => parsePoly('poland\n1\n 14 49 0\n 24 49\n 24 55\nEND\nEND\n')).toThrow(/not a point/);
  });

  /** Great-circle distance, independent of the simplifier's flat projection. */
  const haversine = (a: Point, b: Point) => {
    const rad = Math.PI / 180;
    const h = Math.sin(((b[0] - a[0]) * rad) / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(((b[1] - a[1]) * rad) / 2) ** 2;
    return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
  };
  /** Distance to a segment drawn straight in latitude and longitude, sampled every few metres. */
  const toSegment = (p: Point, a: Point, b: Point) => {
    let best = Infinity;
    for (let s = 0; s <= 2000; s++) {
      const t = s / 2000;
      best = Math.min(best, haversine(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]));
    }
    return best;
  };
  /** A wobbly closed ring around Warsaw, ~10 km across; the closing point is a copy of the first. */
  const wobbly = (n: number): Point[] => {
    const ring: Point[] = [];
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k) / n;
      const metres = 5000 + 400 * Math.sin(7 * angle) + 120 * Math.sin(31 * angle);
      ring.push([52.23 + (metres * Math.sin(angle)) / 111_195, 21.01 + (metres * Math.cos(angle)) / (111_195 * Math.cos((52.23 * Math.PI) / 180))]);
    }
    const [lat, lon] = ring[0]!;
    return [...ring, [lat, lon]];
  };

  test('simplified: every point left out stays within eps of the segment that replaced it', () => {
    const ring = wobbly(1500);
    for (const eps of [50, 300]) {
      const simple = simplify(ring, eps);
      expect(simple.length).toBeLessThan(ring.length / 5);
      expect(simple[0]).toBe(ring[0]);
      expect(simple.at(-1)).toBe(ring.at(-1));
      const kept = simple.map((p) => ring.indexOf(p));
      expect(kept.every((index, k) => index >= 0 && (k === 0 || index > kept[k - 1]!))).toBe(true);
      let worst = 0;
      for (let k = 1; k < kept.length; k++) {
        const [from, to] = [kept[k - 1]!, kept[k]!];
        for (let m = from + 1; m < to; m++) worst = Math.max(worst, toSegment(ring[m]!, ring[from]!, ring[to]!));
      }
      expect(worst).toBeLessThanOrEqual(eps * 1.001);
      // And the bound is used, not wasted: the worst point is close to it.
      expect(worst).toBeGreaterThan(eps * 0.5);
    }
  });

  test('300 m, or 500 m when 300 m leaves over 800 points', () => {
    expect(simplifyCoverage({ rings: [wobbly(400)], holes: [] }).eps).toBe(300);
    // A zigzag of 400 m teeth along 100 km and back: each tooth survives 300 m, none survives 500 m.
    const teeth: Point[] = [];
    for (let k = 0; k <= 500; k++) teeth.push([52 + (k % 2 ? 0.0036 : 0), 18 + k * 0.003]);
    for (let k = 500; k >= 0; k--) teeth.push([52.5 + (k % 2 ? 0.0036 : 0), 18 + k * 0.003]);
    teeth.push(teeth[0]!);
    const coverage = simplifyCoverage({ rings: [teeth], holes: [] });
    expect(simplify(teeth, 300).length).toBeGreaterThan(800);
    expect(coverage.eps).toBe(500);
    expect(coverage.rings[0]!.length).toBeLessThan(20);
  });
});

describe('meta and the checks', () => {
  const stats: FeatureStats = {
    features: 10,
    duplicates: 3,
    notMatching: 2,
    unnamed: 1,
    types: { node: 3, way: 1, relation: 0 },
    kinds: { supermarket: 1, wholesale: 1, cafe: 1, fast_food: 1 },
  };
  const rows: OsmRow[] = [
    { id: 'n1', latE5: 5_223_000, lonE5: 2_101_000, tags: { amenity: 'fast_food', brand: "McDonald's" } },
    { id: 'n2', latE5: 5_209_000, lonE5: 2_085_000, tags: { amenity: 'cafe', name: 'Na rogu' } },
    { id: 'n3', latE5: 5_006_000, lonE5: 1_994_000, tags: { shop: 'supermarket', brand: 'Biedronka' } },
    { id: 'w4', latE5: 5_210_000, lonE5: 2_090_000, tags: { shop: 'wholesale', brand: 'Selgros' } },
  ];
  const coverage = {
    eps: 300,
    rings: [
      [
        [49, 14],
        [49, 24.15],
        [55, 24.15],
        [49, 14],
      ] as Point[],
    ],
    holes: [],
  };
  const built = buildMeta({ dataAsOf: '2026-10-22T20:21:33Z', sourceMd5: null, osmium: '1.19.1', rows, stats, coverage });

  test('counts, flat rings in 1e-5 degrees, kinds by name, and nothing that changes from run to run', () => {
    expect(built).toEqual({
      format: 1,
      dataAsOf: '2026-10-22T20:21:33Z',
      source: 'https://download.geofabrik.de/europe/poland-latest.osm.pbf',
      sourceMd5: null,
      osmium: '1.19.1',
      rows: 4,
      types: { node: 3, way: 1, relation: 0 },
      kinds: { cafe: 1, fast_food: 1, supermarket: 1, wholesale: 1 },
      dropped: { duplicates: 3, notMatching: 2, unnamed: 1 },
      warsaw: 3,
      halls: 1,
      coverage: {
        source: 'https://download.geofabrik.de/europe/poland.poly',
        eps: 300,
        rings: [[4_900_000, 1_400_000, 4_900_000, 2_415_000, 5_500_000, 2_415_000, 4_900_000, 1_400_000]],
        holes: [],
      },
      license: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
    });
    expect(Object.keys(built.kinds)).toEqual(['cafe', 'fast_food', 'supermarket', 'wholesale']);
    expect(JSON.stringify(buildMeta({ dataAsOf: '2026-10-22T20:21:33Z', sourceMd5: null, osmium: '1.19.1', rows, stats, coverage }))).toBe(
      JSON.stringify(built),
    );
  });

  /** A previous copy and a new one that passes every check; each test spoils one thing. */
  const previous: Meta = {
    ...built,
    rows: 100_000,
    kinds: { restaurant: 20_000, supermarket: 79_600, food_court: 400 },
    warsaw: 8_800,
    halls: 37,
  };
  const next = (change: Partial<Meta> = {}): Meta => ({ ...previous, dataAsOf: '2026-10-29T20:21:33Z', ...change });

  test('a copy like the last one passes', () => {
    expect(gates(previous, next(), rows)).toEqual([]);
  });

  test('total rows: −12 % fails, +5 % passes; a first copy needs 90,000', () => {
    expect(gates(previous, next({ rows: 88_000 }), rows)).toEqual(['rows: 100000 → 88000 (-12.0 %; at most ±10 %)']);
    expect(gates(previous, next({ rows: 105_000 }), rows)).toEqual([]);
    expect(gates(previous, next({ rows: 110_000 }), rows)).toEqual([]);
    expect(gates(null, next({ rows: 89_999 }), rows)).toEqual(['rows: 89999, a first copy needs at least 90000']);
    expect(gates(null, next({ rows: 90_000, kinds: { anything: 1 } }), rows)).toEqual([]);
  });

  test('each kind: ±20 %, or ±50 % under 500 rows (a handful of rows always passes); a kind that vanishes, or appears in dozens, fails', () => {
    const kinds = (change: Record<string, number>) => next({ kinds: { ...previous.kinds, ...change } });
    expect(gates(previous, kinds({ restaurant: 23_900 }), rows)).toEqual([]);
    expect(gates(previous, kinds({ restaurant: 24_100 }), rows)).toEqual(['kind restaurant: 20000 → 24100 (+20.5 %; at most ±20 %)']);
    expect(gates(previous, kinds({ food_court: 590 }), rows)).toEqual([]);
    expect(gates(previous, kinds({ food_court: 210 }), rows)).toEqual([]);
    expect(gates(previous, kinds({ food_court: 610 }), rows)).toEqual(['kind food_court: 400 → 610 (+52.5 %; at most ±50 %)']);
    // One newly mapped object of a kind the copy did not have (shop=discount) never blocks a refresh.
    expect(gates(previous, kinds({ ice_cream: 3 }), rows)).toEqual([]);
    expect(gates(previous, kinds({ ice_cream: 60 }), rows)).toEqual(['kind ice_cream: 60 rows, none in the previous copy']);
    // A small kind growing by a few rows passes even at +75 %.
    const small = { ...previous, kinds: { ...previous.kinds, coffee: 20 } };
    expect(gates(small, next({ kinds: { ...small.kinds, coffee: 35 } }), rows)).toEqual([]);
    const { food_court: _gone, ...withoutFoodCourt } = previous.kinds;
    expect(gates(previous, next({ kinds: withoutFoodCourt }), rows)).toEqual(['kind food_court: 400 → 0 (-100.0 %; at most ±50 %)']);
  });

  test('Warsaw, the wholesale halls, the data date and the bounding box', () => {
    expect(gates(previous, next({ warsaw: 6_999, halls: 19 }), rows)).toEqual([
      'Warsaw: 6999 rows, at least 7000 expected',
      'Selgros/Makro halls: 19, at least 20 expected',
    ]);
    expect(gates(previous, next({ dataAsOf: '2026-10-21T20:21:33Z' }), rows)).toEqual([
      "data as of 2026-10-21T20:21:33Z: older than the previous copy's 2026-10-22T20:21:33Z",
    ]);
    expect(gates(previous, next({ dataAsOf: previous.dataAsOf }), rows)).toEqual([]);
    // Within the simplification error of the box's edge passes; further out fails.
    const nearEdge: OsmRow = { id: 'n8', latE5: 5_500_200, lonE5: 2_415_400, tags: {} };
    const abroad: OsmRow = { id: 'n9', latE5: 5_252_000, lonE5: 1_340_000, tags: {} };
    expect(gates(previous, next(), [...rows, nearEdge])).toEqual([]);
    expect(gates(previous, next(), [...rows, abroad])).toEqual(["outside the coverage polygon's bounding box: 1 (n9 at 52.52, 13.4)"]);
    expect(gates(previous, next({ coverage: { ...previous.coverage, rings: [] } }), rows)).toEqual(['coverage: no polygon']);
  });

  test('the comparison with the previous copy counts added, removed and changed rows', () => {
    const moved = { ...rows[1]!, latE5: rows[1]!.latE5 + 1 };
    const retagged = { ...rows[2]!, tags: { ...rows[2]!.tags, opening_hours: '24/7' } };
    const added: OsmRow = { id: 'r5', latE5: 5_000_000, lonE5: 2_000_000, tags: { amenity: 'food_court', name: 'Hala' } };
    expect(diffRows(rows, [rows[0]!, moved, retagged, added])).toEqual({ added: 1, removed: 1, changed: 2 });
    expect(diffRows(rows, rows)).toEqual({ added: 0, removed: 0, changed: 0 });
  });
});

describe('osmium output', () => {
  test('records split at newlines only: U+2028 and U+2029 inside a tag stay inside their record', () => {
    const one = JSON.stringify({ type: 'Feature', id: 'n1', geometry: { type: 'Point', coordinates: [21, 52] }, properties: { amenity: 'cafe', name: 'Kawa\u2028i\u2029ciastko' } });
    const text = `\u001e${one}\n\u001e${one.replace('n1', 'n2')}\n`;
    const records = splitRecords(text);
    expect(records.filter(Boolean)).toHaveLength(2);
    expect(readFeatures(records).rows.map((r) => r.tags.name)).toEqual(['Kawa\u2028i\u2029ciastko', 'Kawa\u2028i\u2029ciastko']);
  });

  test('geometry errors are picked out of osmium’s messages', () => {
    const output = 'Geometry error: Could not build area geometry\nsomething else\nGeometry error: duplicate node\n';
    expect(geometryErrors(output)).toHaveLength(2);
    expect(geometryErrors('')).toEqual([]);
  });
});

describe('one rule for the rows, in the export and in the completeness check', () => {
  test('asked for by either view and named; only the tags the app reads, on one line, none empty; else why not', () => {
    expect(rowTags({ amenity: 'bar', name: 'Pub' })).toBe('notMatching');
    expect(rowTags({ shop: 'wholesale', name: 'Hurtownia Budowlana' })).toBe('notMatching');
    expect(rowTags({ amenity: 'restaurant' })).toBe('unnamed');
    expect(rowTags({ shop: 'convenience', 'name:en': 'Shop' })).toBe('unnamed');
    expect(rowTags({ amenity: 'fuel', shop: 'convenience', brand: 'Orlen', operator: 'PKN Orlen' })).toEqual({ amenity: 'fuel', shop: 'convenience', brand: 'Orlen' });
    expect(rowTags({ amenity: 'cafe', name: 'Kawa\tna\nwynos\r', cuisine: '' })).toEqual({ amenity: 'cafe', name: 'Kawa na wynos ' });
  });

  test('an object the export makes a row is expected by the listing, and one it drops is not', () => {
    const objects: [string, Record<string, string>][] = [
      ['n1', { amenity: 'bar', name: 'Pub' }],
      ['n2', { amenity: 'restaurant' }],
      ['n3', { shop: 'wholesale', brand: 'Selgros', name: 'Selgros Cash & Carry' }],
      ['n4', { shop: 'wholesale', brand: 'Bricomarché' }],
      ['n5', { amenity: 'cafe', name: 'Kawa\tna\nwynos', website: 'https://example.pl' }],
    ];
    const { rows } = readFeatures(objects.map(([id, tags]) => line(id, point(21, 52), tags)));
    const listing = readOpl(objects.map(([id, tags]) => oplLine(id, tags)));
    expect(rows.map((row) => row.id)).toEqual(['n3', 'n5']);
    expect(completeness(listing, rows)).toEqual({ expected: 2, missing: [], knownGap: {} });
    // The same tags from both: what the listing reads is what the export wrote.
    expect(listing.map((object) => rowTags(object.tags)).filter((tags) => typeof tags !== 'string')).toEqual(rows.map((row) => row.tags));
  });
});

describe('the listing of the objects that should be rows (OPL)', () => {
  test('nodes, ways and relations as osmium writes them, with metadata or without, no tags too', () => {
    expect(
      readOpl([
        'n14 Tshop=bakery,name=Corner%20%node x21.02 y52.231',
        'w1001 v3 dV c42 t2026-10-01T10:00:00Z i7 uJan%20%K. Tshop=bakery,name=Putka Nn11,n12,n13,n14,n11',
        'r2006 Ttype=multipolygon,shop=supermarket,name=Hala Mw1006@outer,w1007@inner',
        'n15 T x21 y52',
        '',
      ]),
    ).toEqual([
      { type: 'node', key: 'n14', tags: { shop: 'bakery', name: 'Corner node' }, location: [21.02, 52.231] },
      { type: 'way', key: 'w1001', tags: { shop: 'bakery', name: 'Putka' }, nodes: ['n11', 'n12', 'n13', 'n14', 'n11'] },
      { type: 'relation', key: 'r2006', tags: { type: 'multipolygon', shop: 'supermarket', name: 'Hala' }, members: ['w1006', 'w1007'] },
      { type: 'node', key: 'n15', tags: {}, location: [21, 52] },
    ]);
  });

  test('what places an object: a position (none when osmium writes `x y`), nodes, members of any type and role', () => {
    expect(
      readOpl([
        'n1 T x y',
        'n2 T x-0.5 y-12.0000001',
        'w3 T N',
        'r4 Ttype=site Mw3@a%20%role%2c%x,n1@,r4@entrance',
        'r5 T M',
      ]),
    ).toEqual([
      { type: 'node', key: 'n1', tags: {}, location: null },
      { type: 'node', key: 'n2', tags: {}, location: [-0.5, -12.0000001] },
      { type: 'way', key: 'w3', tags: {}, nodes: [] },
      { type: 'relation', key: 'r4', tags: { type: 'site' }, members: ['w3', 'n1', 'r4'] },
      { type: 'relation', key: 'r5', tags: {}, members: [] },
    ]);
  });

  test('escapes: a space, the separators, control characters, code points of any length; an empty value', () => {
    // As osmium 1.19.1 wrote it.
    const [cafe] = readOpl(['n105 Tamenity=cafe,name=%201e%Café%20%%3d%%20%Bar%2c%%20%100%25%%20%%40%home%201d%%20%%1f355%%2028%end,note= x21 y52']);
    expect(cafe?.tags).toEqual({ amenity: 'cafe', name: '„Café = Bar, 100% @home” 🍕\u2028end', note: '' });
    expect(unescapeOpl('Kawa%09%na%0a%wynos%0d%!')).toBe('Kawa\tna\nwynos\r!');
    expect(unescapeOpl('%20ac%%2713%%5496%%5561%')).toBe('€✓咖啡');
  });

  test('a line osmium would not write stops the run, with its number', () => {
    const cafe = 'n1 Tamenity=cafe,name=Kawa x21 y52';
    expect(() => readOpl([cafe, 'n2 Tamenity=cafe,name=50%off x21 y52'])).toThrow(/line 2: a broken escape/);
    expect(() => readOpl(['n3 Tname=%110000% x21 y52'])).toThrow(/line 1:/);
    for (const odd of ['x1 Tamenity=cafe x21 y52', 'n0 Tamenity=cafe x21 y52', 'n-1 Tamenity=cafe x21 y52']) {
      expect(() => readOpl([odd])).toThrow(/no object id/);
    }
    expect(() => readOpl(['n1 x21 y52'])).toThrow(/no tags field/);
    expect(() => readOpl(['n1 Tamenity x21 y52'])).toThrow(/not a tag/);
    expect(() => readOpl(['n1 Tname=a=b x21 y52'])).toThrow(/not a tag/);
    // Cut short, or not what osmium writes for a position, a way's nodes or a relation's members.
    expect(() => readOpl([cafe, 'n2 Tamenity=cafe,name=Kawa x21'])).toThrow(/line 2: no y field/);
    for (const odd of ['n1 T x21 y', 'n1 T x y52', 'n1 T x21,5 y52', 'n1 T x1e3 y52']) expect(() => readOpl([odd])).toThrow(/not a position/);
    expect(() => readOpl(['w1 Tshop=bakery'])).toThrow(/no nodes field/);
    for (const odd of ['w1 T Nn1,w2', 'w1 T Nn1,,n2', 'w1 T Nn0']) expect(() => readOpl([odd])).toThrow(/not a node of a way/);
    expect(() => readOpl(['r1 Ttype=site'])).toThrow(/no members field/);
    for (const odd of ['r1 T Mw1', 'r1 T Mx1@', 'r1 T M@outer', 'r1 T Mw1@,']) expect(() => readOpl([odd])).toThrow(/not a member/);
  });
});

describe('what the export lost', () => {
  const row = (id: string): OsmRow => ({ id, latE5: 5_223_000, lonE5: 2_101_000, tags: {} });
  const listing = readOpl([
    oplLine('n1', { amenity: 'cafe', name: 'Kawa' }),
    oplLine('w3', { shop: 'bakery', name: 'Bow-tie', area: 'yes' }),
    oplLine('w2', { shop: 'supermarket', brand: 'Biedronka', name: 'Biedronka Plac Bankowy' }),
    oplLine('n4', { amenity: 'bar', name: 'Pub' }),
    oplLine('n5', { amenity: 'restaurant' }),
    oplLine('r6', { type: 'multipolygon', shop: 'supermarket', name: 'Hala Mirowska' }),
    oplLine('r7', { type: 'boundary', amenity: 'food_court', name: 'Strefa' }),
    oplLine('r8', { type: 'site', shop: 'supermarket', name: 'Centrum' }),
    oplLine('r9', { type: 'building', amenity: 'restaurant', name: 'Dom' }),
    oplLine('r10', { amenity: 'cafe', name: 'Bez typu' }),
    oplLine('r11', { type: 'site', shop: 'bakery' }),
    oplLine('r12', { type: 'Multipolygon', shop: 'bakery', name: 'Wielka litera' }),
  ]);

  test('what the rule keeps but the rows lack, by id, labelled as the lists label it; other relations are the known gap', () => {
    expect(completeness(listing, [row('n1'), row('r7')])).toEqual({
      // n1, w2, w3, r6, r7: not the bar, the unnamed, nor the relations osmium never builds.
      expected: 5,
      missing: [
        { id: 'w2', label: 'Biedronka' },
        { id: 'w3', label: 'Bow-tie' },
        { id: 'r6', label: 'Hala Mirowska' },
      ],
      // osmium compares the type as it is: `Multipolygon` is no multipolygon to it.
      knownGap: { site: 1, building: 1, '': 1, Multipolygon: 1 },
    });
  });

  test('nothing lost, nothing missing; a row for something the rule drops changes nothing', () => {
    expect(completeness(listing, ['n1', 'w2', 'w3', 'r6', 'r7'].map(row)).missing).toEqual([]);
    // The bar, and a site without a name.
    expect(completeness(listing, ['n1', 'w2', 'w3', 'r6', 'r7', 'n4', 'r11'].map(row))).toEqual(completeness(listing, ['n1', 'w2', 'w3', 'r6', 'r7'].map(row)));
    expect(completeness([], [row('n1')])).toEqual({ expected: 0, missing: [], knownGap: {} });
  });

  test('a relation osmium never builds counts once its members placed it; the known gap is only what they could not', () => {
    expect(completeness(listing, ['n1', 'w2', 'w3', 'r6', 'r7', 'r8', 'r9'].map(row))).toEqual({
      expected: 7,
      missing: [],
      knownGap: { '': 1, Multipolygon: 1 },
    });
  });

  test('what is to be placed: the relations osmium never builds that should be rows and are not yet, sorted', () => {
    // Not the multipolygon and the boundary (osmium builds them), the unnamed site, nor r9, a row already.
    expect(unbuiltRelations(listing, [row('n1'), row('r9')])).toEqual({ place: ['r8', 'r10', 'r12'], represented: [] });
    expect(unbuiltRelations(listing, ['r8', 'r9', 'r10', 'r12'].map(row))).toEqual({ place: [], represented: [] });
  });

  test('a type in the known gap is one line: a line break typed into the map cannot start a workflow command in the log', () => {
    const typed = readOpl([
      oplLine('r20', { type: 'site\n::stop-commands::x', amenity: 'cafe', name: 'Kawa' }),
      oplLine('r21', { type: 'site\r\n::error title=Injected::from OSM 1', amenity: 'cafe', name: 'Kawa' }),
      oplLine('r22', { type: 'building\u2028x\u0085y\u0000z', amenity: 'cafe', name: 'Kawa' }),
    ]);
    // The refresh prints `type=<key>` for each: every control character and line separator a space.
    expect(completeness(typed, []).knownGap).toEqual({
      'site ::stop-commands::x': 1,
      'site  ::error title=Injected::from OSM 1': 1,
      'building x y z': 1,
    });
  });
});

describe('a relation a member row already stands for: one place, one row', () => {
  /** A row of the export, with the tags the app reads. */
  const at = (id: string, tags: Record<string, string>): OsmRow => ({ id, latE5: 5_031_000, lonE5: 1_918_000, tags });
  const rows = [
    // The Makro hall's building, a café, and a café osmium built from a multipolygon.
    at('n3', { amenity: 'cafe', name: 'Kawa' }),
    at('w2', { shop: 'wholesale', name: 'Makro', brand: 'Makro' }),
    at('r15', { amenity: 'cafe', name: 'Kawa' }),
  ];
  // The listing (the `list` run): the objects that match the filter themselves, members and all.
  const listing = readOpl([
    'n3 Tamenity=cafe,name=Kawa x21 y52',
    'w2 Tbrand=Makro,name=Makro,shop=wholesale Nn20,n21,n22,n20',
    // The hall's site: its building is a member, beside a fence and an entrance that are no rows.
    'r10 Tbrand=Makro,name=Makro,shop=wholesale,type=site Mw9@perimeter,w2@,n5@entrance',
    // The same label in any case and trimmed, the brand standing for a name: whichever the label is.
    'r11 Tbrand=MAKRO,shop=wholesale,type=site Mw2@',
    'r16 Tamenity=cafe,brand=%20%KAWA%20%,type=site Mw9@,n3@',
    // A different kind, a different label, a member relation: placed by their members.
    'r12 Tamenity=restaurant,name=Kawa,type=building Mn3@',
    'r13 Tamenity=cafe,name=Inna%20%kawa,type=building Mn3@',
    'r14 Tamenity=cafe,name=Kawa,type=site Mr15@,w9@',
    'r15 Tamenity=cafe,name=Kawa,type=multipolygon Mw9@outer',
  ]);

  test('a member node or way that is a row of the same kind and label stands for the relation; anything else is placed', () => {
    expect(unbuiltRelations(listing, rows)).toEqual({
      place: ['r12', 'r13', 'r14'],
      represented: [
        { id: 'r10', by: 'w2' },
        { id: 'r11', by: 'w2' },
        { id: 'r16', by: 'n3' },
      ],
    });
  });

  test('the completeness check counts a represented relation as present: not missing, not the known gap', () => {
    // n3, w2, r15 as rows; r10, r11, r16 through their member rows; the rest not placed yet.
    expect(completeness(listing, rows)).toEqual({ expected: 6, missing: [], knownGap: { building: 2, site: 1 } });
    expect(completeness(listing, [...rows, ...['r12', 'r13', 'r14'].map((id) => at(id, {}))])).toEqual({ expected: 9, missing: [], knownGap: {} });
    // Without its member row, the hall's site is no longer stood for: the known gap.
    expect(completeness(listing, rows.filter((r) => r.id !== 'w2')).knownGap).toEqual({ building: 2, site: 3 });
  });
});

describe('relations osmium export never builds, placed by their members as Overpass places them', () => {
  // As `osmium getid -r -f opl,add_metadata=false` lists them: the relations and all they reference.
  const objects = readOpl([
    // A site like the Makro hall: its fence, an entrance outside it, members cut off at the border.
    'n1 T x19.17 y50.3',
    'n2 T x19.19 y50.3',
    'n3 T x19.19 y50.32',
    'n4 T x19.17 y50.32',
    'n5 Tentrance=yes x19.165 y50.31',
    // A building's outline and a part that reaches past it; a multipolygon far away.
    'n11 T x21.95 y49.58',
    'n12 T x21.96 y49.58',
    'n13 T x21.96 y49.59',
    'n14 T x21.965 y49.59',
    'n21 T x16.5 y52.6',
    'n22 T x16.6 y52.6',
    'n23 T x16.6 y52.7',
    // A node without a position.
    'n31 T x y',
    'w10 Tbarrier=fence Nn1,n2,n3,n4,n1',
    'w12 Tbuilding=yes Nn11,n12,n13,n11',
    'w13 Tbuilding:part=yes Nn12,n14,n13,n12',
    'w14 Tbuilding=yes Nn21,n22,n23,n21',
    'w15 T Nn31,n9999',
    'r100 Tbrand=Makro,brand:wikidata=Q704606,name=Makro,shop=wholesale,type=site Mw10@perimeter,n5@entrance,w9999@,n9998@entrance',
    'r101 Tamenity=restaurant,name=Zajazd,type=building Mw12@outline,w13@part,r102@',
    'r102 Tbuilding=yes,type=multipolygon Mw14@outer',
    'r103 Tname=Tylko%20%relacje,shop=supermarket,type=site Mr102@',
    // Relations that list each other, and themselves.
    'r104 Tamenity=cafe,name=Cykl Mn11@,r105@,r104@',
    'r105 Tname=Druga,shop=bakery,type=site Mr104@,n13@',
    'r106 Tname=Gdzie%20%indziej,shop=convenience,type=building Mw9999@,n9998@,w15@,n31@',
    'r107 Tshop=bakery,type=site Mw10@',
  ]);
  const at = (rows: OsmRow[]) => rows.map(({ id, latE5, lonE5 }) => ({ id, latE5, lonE5 }));

  test('the centre of the bounding box of the member nodes and the nodes of member ways; what the listing lacks is skipped', () => {
    const rows = relationRows(objects, ['r100', 'r101']);
    expect(rows).toEqual([
      // The fence (19.17–19.19, 50.30–50.32) widened west by the entrance.
      { id: 'r100', latE5: 5_031_000, lonE5: 1_917_750, tags: { shop: 'wholesale', name: 'Makro', brand: 'Makro' } },
      // The outline and its part — not the multipolygon member: in Overpass a member relation adds nothing.
      { id: 'r101', latE5: 4_958_500, lonE5: 2_195_750, tags: { amenity: 'restaurant', name: 'Zajazd' } },
    ]);
  });

  test('a member relation adds nothing, so a cycle is no matter; a relation of relations gets no row, as it gets no centre in Overpass', () => {
    expect(at(relationRows(objects, ['r103', 'r104', 'r105']))).toEqual([
      { id: 'r104', latE5: 4_958_000, lonE5: 2_195_000 },
      { id: 'r105', latE5: 4_959_000, lonE5: 2_196_000 },
    ]);
  });

  test('no row with nothing to place it by, without a brand or a name, or unasked; each asked once', () => {
    // r106: its members are not in the listing, or are nodes without a position (also as a way's only nodes).
    expect(relationRows(objects, ['r106', 'r107', 'r9999', 'w10', 'n1'])).toEqual([]);
    expect(at(relationRows(objects, ['r104', 'r104']))).toEqual([{ id: 'r104', latE5: 4_958_000, lonE5: 2_195_000 }]);
    expect(relationRows(objects, [])).toEqual([]);
  });

  test('rounded as the export’s rows are: the Makro hall where Overpass’s out center puts it (50.3093774, 19.1809905)', () => {
    // The hall's southernmost, north-easternmost and westernmost nodes, as the extract has them.
    const corners: [number, number][] = [
      [19.1808784, 50.3076471],
      [19.1836535, 50.3111076],
      [19.1783276, 50.3087781],
    ];
    const nodes = corners.map(([x, y], k) => `n${k + 1} T x${x} y${y}`);
    const relation = relationRows(readOpl([...nodes, 'w4 T Nn1,n2', 'r5 Tshop=wholesale,brand=Makro Mw4@,n3@entrance']), ['r5']);
    // a11: the area of relation 5, the same positions in osmium's export.
    const ring = [...corners, corners[0]!];
    const exported = readFeatures([line('a11', { type: 'MultiPolygon', coordinates: [[ring]] }, { shop: 'wholesale', brand: 'Makro' })]).rows;
    expect(at(relation)).toEqual([{ id: 'r5', latE5: 5_030_938, lonE5: 1_918_099 }]);
    expect(relation).toEqual(exported);
  });

  test('put in with the export’s rows: sorted again and counted by type and kind, the export’s counts left as they were', () => {
    const exported = readFeatures([
      line('n10', point(21, 52), { amenity: 'cafe', name: 'Kawa' }),
      line('w20', point(21, 52), { shop: 'wholesale', brand: 'Makro' }),
      line('a61', point(21, 52), { shop: 'supermarket', name: 'Hala' }),
    ]);
    const placed = relationRows(objects, ['r100', 'r101']);
    const { rows, stats } = withRows(exported, placed);
    expect(rows.map((r) => r.id)).toEqual(['n10', 'w20', 'r30', 'r100', 'r101']);
    expect(stats).toEqual({
      ...exported.stats,
      types: { node: 1, way: 1, relation: 3 },
      kinds: { cafe: 1, wholesale: 2, supermarket: 1, restaurant: 1 },
    });
    expect(exported.stats.types.relation).toBe(1);
    expect(exported.stats.kinds).toEqual({ cafe: 1, wholesale: 1, supermarket: 1 });
    expect(withRows(exported, [])).toEqual({ rows: exported.rows, stats: exported.stats });
  });
});
