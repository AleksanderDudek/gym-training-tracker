import { describe, expect, test } from 'vitest';
import osmFormatSource from './osmFormat.ts?raw';
import { compareIds, decodeLeaf, encodeLeaf, formatTsv, leafPath, parseTsv, validateIndex, type OsmIndex, type OsmRow } from './osmFormat';
import type { Element } from './overpass';

const COLUMNS = ['amenity', 'shop', 'name', 'brand', 'opening_hours'];

const MCDONALDS: OsmRow = {
  id: 'n9876543210',
  latE5: 5_223_180,
  lonE5: 2_101_200,
  tags: { amenity: 'fast_food', name: "McDonald's", brand: "McDonald's", opening_hours: '24/7' },
};
const ZABKA: OsmRow = { id: 'w22', latE5: 5_000_001, lonE5: 1_999_999, tags: { shop: 'convenience', name: 'Żabka\tNano' } };
const NAMELESS: OsmRow = { id: 'r7', latE5: -100, lonE5: 5, tags: {} };

describe('the committed TSV', () => {
  test('header, 5 decimals, empty fields for missing tags, LF and a final newline', () => {
    expect(formatTsv([MCDONALDS, ZABKA, NAMELESS], COLUMNS)).toBe(
      'id\tlat\tlon\tamenity\tshop\tname\tbrand\topening_hours\n' +
        "n9876543210\t52.23180\t21.01200\tfast_food\t\tMcDonald's\tMcDonald's\t24/7\n" +
        'w22\t50.00001\t19.99999\t\tconvenience\tŻabka Nano\t\t\n' +
        'r7\t-0.00100\t0.00005\t\t\t\t\t\n',
    );
  });

  test('reads back what it wrote; a tab or a line break inside a value becomes a space', () => {
    const odd: OsmRow = { id: 'n1', latE5: 5_400_000, lonE5: 1_800_000, tags: { name: 'Bar\r\nMleczny', opening_hours: 'Mo-Fr\t08:00-18:00' } };
    const { columns, rows } = parseTsv(formatTsv([MCDONALDS, ZABKA, NAMELESS, odd], COLUMNS));
    expect(columns).toEqual(COLUMNS);
    expect(rows).toEqual([
      MCDONALDS,
      { ...ZABKA, tags: { shop: 'convenience', name: 'Żabka Nano' } },
      NAMELESS,
      { ...odd, tags: { name: 'Bar  Mleczny', opening_hours: 'Mo-Fr 08:00-18:00' } },
    ]);
    // Rows go out in the order given: the data script sorts them.
    expect(parseTsv(formatTsv([ZABKA, MCDONALDS], COLUMNS)).rows.map((row) => row.id)).toEqual(['w22', 'n9876543210']);
  });

  test('a copy checked out with CRLF line endings reads the same', () => {
    const text = formatTsv([MCDONALDS, ZABKA], COLUMNS);
    expect(parseTsv(text.replace(/\n/g, '\r\n'))).toEqual(parseTsv(text));
  });

  test('a damaged copy throws instead of reading as fewer places', () => {
    expect(() => parseTsv('')).toThrow(/header/);
    expect(() => parseTsv('lat\tlon\tid\tname\n')).toThrow(/header/);
    expect(() => parseTsv('id\tlat\tlon\tname\tname\n')).toThrow(/header/);
    expect(() => parseTsv('id\tlat\tlon\tname\nn1\t52.1\t21.0\n')).toThrow(/line 2/);
    expect(() => parseTsv('id\tlat\tlon\tname\nx1\t52.1\t21.0\tBar\n')).toThrow(/line 2/);
    expect(() => parseTsv('id\tlat\tlon\tname\nn1\t\t21.0\tBar\n')).toThrow(/line 2/);
    expect(parseTsv('id\tlat\tlon\tname\n')).toEqual({ columns: ['name'], rows: [] });
  });
});

describe('ids', () => {
  test('nodes, then ways, then relations, each by number (past 2^31, of different lengths)', () => {
    const ids = ['r1', 'w10', 'n10', 'n9', 'w9', 'n12345678901', 'n2147483648'];
    expect(ids.sort(compareIds)).toEqual(['n9', 'n10', 'n2147483648', 'n12345678901', 'w9', 'w10', 'r1']);
    expect(compareIds('n5', 'n5')).toBe(0);
  });
});

describe('leaves', () => {
  const key = { d: 3, i: 5, j: 7 };
  const origin: [number, number] = [5_220_000, 2_100_000];

  test('compact JSON in a fixed key order, positions as offsets from the origin, missing tags as null', () => {
    const json = encodeLeaf(key, [ZABKA, MCDONALDS], COLUMNS, origin);
    expect(json.startsWith('{"f":1,"k":[3,5,7],"o":[5220000,2100000],"c":["amenity","shop","name","brand","opening_hours"],"r":[')).toBe(true);
    expect(JSON.parse(json).r).toEqual([
      ['n9876543210', 3180, 1200, 'fast_food', null, "McDonald's", "McDonald's", '24/7'],
      ['w22', -219_999, -100_001, null, 'convenience', 'Żabka\tNano', null, null],
    ]);
  });

  test('the same rows give the same text, whatever their order (the hash in the file name stays)', () => {
    expect(encodeLeaf(key, [ZABKA, NAMELESS, MCDONALDS], COLUMNS, origin)).toBe(encodeLeaf(key, [MCDONALDS, ZABKA, NAMELESS], COLUMNS, origin));
  });

  test('decode gives Overpass-shaped elements, 5 decimals, without the missing tags', () => {
    const elements = decodeLeaf(JSON.parse(encodeLeaf(key, [ZABKA, NAMELESS, MCDONALDS], COLUMNS, origin)));
    expect(elements).toEqual([
      { type: 'node', id: 9_876_543_210, lat: 52.2318, lon: 21.012, tags: MCDONALDS.tags },
      { type: 'way', id: 22, lat: 50.00001, lon: 19.99999, tags: ZABKA.tags },
      { type: 'relation', id: 7, lat: -0.001, lon: 0.00005, tags: {} },
    ]);
    // What the Overpass parsers (`shopsOf`, `placesOf`) take.
    const asOverpass: readonly Element[] = elements;
    expect(asOverpass).toHaveLength(3);
  });

  test('anything that is not a leaf of this format throws', () => {
    const good = JSON.parse(encodeLeaf(key, [MCDONALDS], COLUMNS, origin));
    expect(() => decodeLeaf(null)).toThrow();
    expect(() => decodeLeaf([])).toThrow();
    expect(() => decodeLeaf({ ...good, f: 2 })).toThrow(/format/);
    expect(() => decodeLeaf({ ...good, k: [3, 5] })).toThrow();
    expect(() => decodeLeaf({ ...good, o: ['52', 21] })).toThrow();
    expect(() => decodeLeaf({ ...good, c: [1] })).toThrow();
    expect(() => decodeLeaf({ ...good, r: [['n1', 0, 0]] })).toThrow(/row/);
    expect(() => decodeLeaf({ ...good, r: [['x1', 0, 0, null, null, null, null, null]] })).toThrow(/row/);
    expect(() => decodeLeaf({ ...good, r: [['n1', 0, '0', null, null, null, null, null]] })).toThrow(/row/);
    expect(() => decodeLeaf({ ...good, r: [['n1', 0, 0, 5, null, null, null, null]] })).toThrow(/value/);
    expect(decodeLeaf({ ...good, r: [] })).toEqual([]);
  });
});

describe('the index', () => {
  const INDEX: OsmIndex = {
    f: 1,
    dataAsOf: '2026-10-22T20:21:33Z',
    count: 120,
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
    notice: 'Dane © autorzy OpenStreetMap, licencja ODbL',
    grid: { lat0: 48.9, lon0: 14, root: 1.28, maxDepth: 8, cap: 400 },
    coverage: { eps: 300, rings: [[4_906_214, 2_288_824, 4_900_343, 2_290_651, 4_898_642, 2_284_886]], holes: [] },
    leaves: [
      [3, 5, 7, 100, '0123456789'],
      [4, 10, 15, 20, 'abcdef0123'],
    ],
  };

  test('a valid index comes back as it is', () => {
    expect(validateIndex(JSON.parse(JSON.stringify(INDEX)))).toEqual(INDEX);
  });

  test('another format or a malformed field gives null (the app then asks Overpass)', () => {
    const variants: unknown[] = [
      null,
      { ...INDEX, f: 2 },
      { ...INDEX, count: -1 },
      { ...INDEX, notice: undefined },
      { ...INDEX, grid: { ...INDEX.grid, root: 0 } },
      { ...INDEX, coverage: { eps: 300, rings: [[1, 2, 3]], holes: [] } },
      { ...INDEX, coverage: { eps: 300, rings: [] } },
      { ...INDEX, leaves: [[3, 5, 7, 100]] },
      { ...INDEX, leaves: [[3, 5, 7, 1.5, '0123456789']] },
      { ...INDEX, leaves: [[-1, 5, 7, 100, '0123456789']] },
      { ...INDEX, leaves: [[3, 5, 7, 100, '../../evil']] },
      { ...INDEX, leaves: [[3, 5, 7, 100, '0123456789abcdef']] },
      { ...INDEX, leaves: {} },
    ];
    for (const variant of variants) expect(validateIndex(variant)).toBeNull();
  });

  test('a leaf is served by its cell and hash', () => {
    expect(leafPath([3, 5, 7, 100, '0123456789'])).toBe('t/3-5-7.0123456789.json.gz');
    expect(INDEX.leaves.map(leafPath)).toEqual(['t/3-5-7.0123456789.json.gz', 't/4-10-15.abcdef0123.json.gz']);
  });
});

test('the format imports nothing at run time: the Vite plugin loads it with Node’s own loader', () => {
  expect(osmFormatSource).not.toMatch(/^\s*import\s(?!type\b)/m);
  expect(osmFormatSource).not.toMatch(/^\s*export\s+(\*|\{[^}]*\})\s+from\s/m);
  expect(osmFormatSource).not.toMatch(/\brequire\(|\bimport\(/);
});
