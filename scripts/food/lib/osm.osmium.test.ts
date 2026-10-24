import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { completeness, osmiumArgs, readFeatures, readOpl, relationRows, rowTags, splitRecords, unbuiltRelations, withRows } from './osm';

// The refresh's own osmium commands on a small extract. Only where osmium-tool is installed: the
// "Dane OSM" workflow installs it before its tests, the deploy workflow's `npm test` goes without.
const osmium = spawnSync('osmium', ['--version'], { encoding: 'utf8' });
const hasOsmium = !osmium.error && osmium.status === 0;

/** Tags as an OPL field; osmium reads anything but a space, `,`, `=`, `@` and `%` as it is. */
const t = (tags: Record<string, string>) => {
  const escape = (text: string) => text.replace(/[\s,=@%]/g, (c) => `%${c.codePointAt(0)!.toString(16).padStart(2, '0')}%`);
  return `T${Object.entries(tags)
    .map(([key, value]) => `${escape(key)}=${escape(value)}`)
    .join(',')}`;
};

/**
 * The extract before the filter: every way osmium's export can lose an object, with an error or
 * without one, beside objects it reports an error for and still exports. A square's corners run
 * round it (52.23, 52.24, 52.28, 21.04); a bow-tie's cross over (52.25, 52.26); 52.27 is not closed.
 */
const EXTRACT = [
  'n11 x21.02 y52.23',
  'n12 x21.021 y52.23',
  'n13 x21.021 y52.231',
  // A bakery that is also a corner of w1001: it matches the filter itself, so it is listed.
  `n14 ${t({ shop: 'bakery', name: 'Corner bakery' })} x21.02 y52.231`,
  'n21 x21.02 y52.24',
  'n22 x21.021 y52.24',
  'n23 x21.021 y52.241',
  'n24 x21.02 y52.241',
  'n31 x21.02 y52.25',
  'n32 x21.021 y52.251',
  'n33 x21.021 y52.25',
  'n34 x21.02 y52.251',
  'n41 x21.02 y52.26',
  'n42 x21.021 y52.261',
  'n43 x21.021 y52.26',
  'n44 x21.02 y52.261',
  'n51 x21.02 y52.27',
  'n52 x21.021 y52.27',
  'n53 x21.021 y52.271',
  'n54 x21.02 y52.271',
  'n61 x21.02 y52.28',
  'n62 x21.021 y52.28',
  'n63 x21.021 y52.281',
  'n64 x21.02 y52.281',
  // A building's outline (21.06–21.062, 52.24–52.242) and a part reaching past it to 52.243, 21.063.
  'n71 x21.06 y52.24',
  'n72 x21.062 y52.24',
  'n73 x21.062 y52.242',
  'n74 x21.06 y52.242',
  'n75 x21.063 y52.243',
  'n76 x21.062 y52.243',
  'n81 x21.03 y52.23',
  'n82 x21.031 y52.23',
  'n91 x21.04 y52.23',
  'n92 x21.041 y52.23',
  'n93 x21.041 y52.231',
  'n94 x21.04 y52.231',
  'n95 x21.05 y52.23',
  // A site's entrance, outside its perimeter w1012.
  `n96 ${t({ entrance: 'yes' })} x21.043 y52.229`,
  `n100 ${t({ shop: 'bakery' })} x21.009 y52.229`,
  `n101 ${t({ amenity: 'bar', name: 'Pub' })} x21.0091 y52.2291`,
  `n102 ${t({ shop: 'wholesale', name: 'Hurtownia budowlana' })} x21.0092 y52.2292`,
  `n103 ${t({ shop: 'wholesale', brand: 'Selgros', name: 'Selgros Cash & Carry' })} x21.0093 y52.2293`,
  // Every kind of OPL escape on the way back: „ ” and 🍕 (past U+05FF), a tab and a line break.
  `n104 ${t({ amenity: 'cafe', name: '„Kawa = 100% @dom, 🍕”\tna\nwynos' })} x21.0094 y52.2294`,
  // Closed, no area tag: exported as the line and as the area.
  `w1001 ${t({ shop: 'bakery', name: 'Square' })} Nn11,n12,n13,n14,n11`,
  // area=yes: the area only.
  `w1002 ${t({ shop: 'bakery', name: 'Square area', area: 'yes' })} Nn21,n22,n23,n24,n21`,
  // A bow-tie with area=yes: no area can be built, and there is no line — lost, with an error.
  `w1003 ${t({ shop: 'bakery', name: 'Bow-tie area', area: 'yes' })} Nn31,n32,n33,n34,n31`,
  // A bow-tie without an area tag: an error for the area, yet the line is exported — nothing lost.
  `w1004 ${t({ shop: 'bakery', name: 'Bow-tie' })} Nn41,n42,n43,n44,n41`,
  'w1005 Nn51,n52,n53,n54',
  'w1006 Nn61,n62,n63,n64,n61',
  `w1008 ${t({ shop: 'bakery', name: 'Square line', area: 'no' })} Nn21,n22,n23,n24,n21`,
  // A closed way of three nodes is no area to osmium: with area=yes lost without a word, without it a line.
  `w1010 ${t({ shop: 'bakery', name: 'Three-node area', area: 'yes' })} Nn81,n82,n81`,
  `w1011 ${t({ shop: 'bakery', name: 'Three-node line' })} Nn81,n82,n81`,
  'w1012 Nn91,n92,n93,n94,n91',
  `w1013 ${t({ building: 'yes' })} Nn71,n72,n73,n74,n71`,
  `w1014 ${t({ 'building:part': 'yes' })} Nn73,n75,n76,n73`,
  // One node: lost, with an error.
  `w1015 ${t({ amenity: 'cafe', name: 'One node' })} Nn95`,
  // A node the extract lacks: lost, with an error that names nothing.
  `w1016 ${t({ amenity: 'cafe', name: 'Node elsewhere' })} Nn95,n9999`,
  // Its outer way is not closed: lost, with an error.
  `r2005 ${t({ type: 'multipolygon', shop: 'supermarket', name: 'Open multipolygon' })} Mw1005@outer`,
  `r2006 ${t({ type: 'multipolygon', shop: 'supermarket', name: 'Multipolygon' })} Mw1006@outer`,
  // Its outer way is not in the extract (cut off at the border, say): lost without a word.
  `r2008 ${t({ type: 'multipolygon', shop: 'supermarket', name: 'Member elsewhere' })} Mw9999@outer`,
  // Its only member is a relation: lost without a word.
  `r2009 ${t({ type: 'multipolygon', shop: 'supermarket', name: 'Relation of a relation' })} Mr2006@`,
  // Relations osmium export never builds, placed by their members as Overpass places them: a site
  // like the Makro hall (its perimeter, an entrance outside it, a member cut off at the border), a
  // building with a part, one with no type.
  `r2011 ${t({ type: 'site', shop: 'supermarket', name: 'Site' })} Mw1012@perimeter,n96@entrance,w9998@`,
  `r2012 ${t({ type: 'building', amenity: 'restaurant', name: 'Building' })} Mw1013@outline,w1014@part`,
  `r2013 ${t({ amenity: 'cafe', name: 'No type' })} Mn11@`,
  `r2014 ${t({ type: 'boundary', shop: 'supermarket', name: 'Boundary' })} Mw1012@outer`,
  `r2015 ${t({ type: 'site', shop: 'supermarket' })} Mw1012@`,
  `r2016 ${t({ type: 'multipolygon', building: 'yes' })} Mw1012@outer`,
  // Nothing to place them by: the known gap. No member in the extract; only a relation as a member,
  // which gives no centre in Overpass either.
  `r2017 ${t({ type: 'site', shop: 'supermarket', name: 'Members elsewhere' })} Mw9997@,n9996@`,
  `r2018 ${t({ type: 'site', shop: 'supermarket', name: 'Relations only' })} Mr2006@`,
];

const dir = mkdtempSync(join(tmpdir(), 'osm-osmium-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[]) {
  const result = spawnSync('osmium', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(`osmium ${args.join(' ')}: ${result.error?.message ?? result.stderr}`);
}

describe.skipIf(!hasOsmium)('a refresh through osmium itself', () => {
  test('what the export loses is missing by id, error or not; what it reports yet exports is not; other relations are placed by their members or are the gap', () => {
    const [source, filtered, exportFile, listed, members] = ['extract.opl', 'filtered.osm.pbf', 'export.geojsonseq', 'listed.opl', 'members.opl'].map((name) =>
      join(dir, name),
    );
    writeFileSync(source!, `${EXTRACT.join('\n')}\n`);
    run(osmiumArgs.filter(source!, filtered!));
    run(osmiumArgs.export(filtered!, exportFile!));
    run(osmiumArgs.list(filtered!, listed!));
    const exported = readFeatures(splitRecords(readFileSync(exportFile!, 'utf8')));
    const objects = readOpl(splitRecords(readFileSync(listed!, 'utf8')));
    const unbuilt = unbuiltRelations(objects, exported.rows);
    // Members cut off at the border (w9998, w9997, n9996) do not fail the run.
    run(osmiumArgs.members(filtered!, unbuilt, members!));
    const placed = relationRows(readOpl(splitRecords(readFileSync(members!, 'utf8'))), unbuilt);
    const { rows } = withRows(exported, placed);

    // osmium export writes nothing for a relation other than a multipolygon or a boundary.
    expect(exported.rows.map((row) => row.id)).toEqual(['n14', 'n103', 'n104', 'w1001', 'w1002', 'w1004', 'w1008', 'w1011', 'r2006', 'r2014']);
    expect(unbuilt).toEqual(['r2011', 'r2012', 'r2013', 'r2017', 'r2018']);
    expect(placed).toEqual([
      // The perimeter (21.04–21.041, 52.23–52.231) widened by the entrance to 21.043 E, 52.229 N.
      { id: 'r2011', latE5: 5_223_000, lonE5: 2_104_150, tags: { shop: 'supermarket', name: 'Site' } },
      // The outline and its part.
      { id: 'r2012', latE5: 5_224_150, lonE5: 2_106_150, tags: { amenity: 'restaurant', name: 'Building' } },
      { id: 'r2013', latE5: 5_223_000, lonE5: 2_102_000, tags: { amenity: 'cafe', name: 'No type' } },
    ]);
    expect(rows.map((row) => row.id)).toEqual([
      ...['n14', 'n103', 'n104', 'w1001', 'w1002', 'w1004', 'w1008', 'w1011'],
      ...['r2006', 'r2011', 'r2012', 'r2013', 'r2014'],
    ]);
    expect(completeness(objects, rows)).toEqual({
      expected: 20,
      missing: [
        { id: 'w1003', label: 'Bow-tie area' },
        { id: 'w1010', label: 'Three-node area' },
        { id: 'w1015', label: 'One node' },
        { id: 'w1016', label: 'Node elsewhere' },
        { id: 'r2005', label: 'Open multipolygon' },
        { id: 'r2008', label: 'Member elsewhere' },
        { id: 'r2009', label: 'Relation of a relation' },
      ],
      knownGap: { site: 2 },
    });
    // Only the objects that match the filter themselves: not the corners, outlines and members it pulled in
    // (n14 is a corner, and a bakery too).
    expect(objects.map((object) => object.key)).toEqual([
      ...['n14', 'n100', 'n102', 'n103', 'n104'],
      ...['w1001', 'w1002', 'w1003', 'w1004', 'w1008', 'w1010', 'w1011', 'w1015', 'w1016'],
      ...['r2005', 'r2006', 'r2008', 'r2009', 'r2011', 'r2012', 'r2013', 'r2014', 'r2015', 'r2017', 'r2018'],
    ]);
    // The listing reads as the export wrote: by the same rule, the same tags, every escape undone.
    const listedTags = new Map(objects.map((object) => [object.key, rowTags(object.tags)]));
    for (const row of rows) expect(listedTags.get(row.id)).toEqual(row.tags);
    expect(rows.find((row) => row.id === 'n104')?.tags.name).toBe('„Kawa = 100% @dom, 🍕” na wynos');
  });
});
