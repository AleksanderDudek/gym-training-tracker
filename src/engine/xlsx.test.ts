import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { excelDate, readWorkbook } from '../food/diet/xlsx';
import {
  clock,
  columnName,
  day,
  dec,
  excelSerial,
  excelStamp,
  excelTime,
  int,
  sheetNames,
  stamp,
  writeXlsx,
  xmlText,
} from './xlsx';

/**
 * Zapis .xlsx: pełny obieg przez czytnik z planów (`readWorkbook`), daty jako liczby seryjne,
 * znaki, których XML nie przyjmie, i nazwy arkuszy, które Excel odrzuca.
 */

const created = new Date(Date.UTC(2026, 10, 3, 9, 30));

const parts = (bytes: Uint8Array): Record<string, string> =>
  Object.fromEntries(Object.entries(unzipSync(bytes)).map(([k, v]) => [k, strFromU8(v)]));

describe('liczby seryjne Excela', () => {
  it('dni od 1899-12-30 — jak system 1900 dla współczesnych dat', () => {
    expect(excelSerial('1900-03-01')).toBe(61);
    expect(excelSerial('2026-11-03')).toBe(46329);
    expect(excelSerial('2024-02-29')).toBe(45351);
    // Czytnik planów liczy w drugą stronę tak samo.
    expect(excelDate(excelSerial('2026-11-03'))).toBe('2026-11-03');
  });

  it('godzina to ułamek doby, chwila to dzień plus ułamek w czasie lokalnym', () => {
    expect(excelTime('12:00')).toBe(0.5);
    expect(excelTime('06:30')).toBeCloseTo(6.5 / 24, 12);
    const at = new Date(2026, 10, 3, 18, 45);
    expect(excelStamp(at)).toBeCloseTo(46329 + 18.75 / 24, 9);
  });
});

describe('komórki', () => {
  it('brak to pusta komórka, nigdy zero', () => {
    expect(int(null)).toBeNull();
    expect(int(Number.NaN)).toBeNull();
    expect(dec(undefined, 1)).toBeNull();
    expect(day('2026-13')).toBeNull();
    expect(clock('7:5')).toBeNull();
    expect(stamp(new Date(Number.NaN))).toBeNull();
    expect(int(0)).toEqual({ num: 0, digits: 0 });
    expect(dec(1.256, 2)).toEqual({ num: 1.26, digits: 2 });
  });

  it('kolumny A…Z, AA…', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });
});

describe('XML i nazwy arkuszy', () => {
  it('ucieka &, <, >, " i wycina znaki zakazane w XML 1.0', () => {
    expect(xmlText('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
    expect(xmlText('x\u0000\u0001\u000by\u001f￾z\uD800')).toBe('xyz');
    expect(xmlText('tab\tlf\ncr\r 😀')).toBe('tab\tlf\ncr\r 😀');
  });

  it('nazwy: bez []:*?/\\, do 31 znaków, bez powtórek', () => {
    expect(sheetNames(['Dni [1/2]: *?', 'x'.repeat(40), 'Dni', 'dni', "'Ruch'", ''])).toEqual([
      'Dni  1 2',
      'x'.repeat(31),
      'Dni',
      'dni (2)',
      'Ruch',
      'Sheet6',
    ]);
  });
});

describe('writeXlsx', () => {
  const book = () =>
    writeXlsx({
      title: 'Raport',
      created,
      sheets: [
        {
          name: 'Dni',
          columns: [{ header: 'Data' }, { header: 'Godzina' }, { header: 'kcal' }, { header: 'Waga (kg)' }, { header: 'Nazwa' }],
          rows: [
            [day('2026-11-03'), clock('07:30'), int(1830), dec(82.4, 2), 'Owsianka & <jagody>'],
            [day('2026-11-04'), null, null, dec(82.1, 2), '=SUM(A1:A2)'],
            [day('2026-11-05'), clock('19:05'), 2100.5, undefined, ' spacja '],
          ],
        },
        {
          name: 'Ruch / dzień',
          columns: [{ header: 'Kiedy' }, { header: 'Kroki' }],
          rows: [[stamp(new Date(2026, 10, 3, 18, 45)), int(9500)]],
          filter: false,
        },
      ],
    });

  it('pełny obieg przez czytnik: teksty, liczby, daty i godziny, puste komórki puste', () => {
    const wb = readWorkbook(book());
    expect([...wb.keys()]).toEqual(['Dni', 'Ruch   dzień']);
    const dni = wb.get('Dni')!;
    expect(dni.get('A1')).toBe('Data');
    expect(dni.get('E1')).toBe('Nazwa');
    expect(excelDate(dni.get('A2') as number)).toBe('2026-11-03');
    expect(dni.get('B2')).toBeCloseTo(7.5 / 24, 12);
    expect(dni.get('C2')).toBe(1830);
    expect(dni.get('D2')).toBe(82.4);
    expect(dni.get('E2')).toBe('Owsianka & <jagody>');
    // Brak to brak komórki, nie zero.
    expect(dni.has('B3')).toBe(false);
    expect(dni.has('C3')).toBe(false);
    expect(dni.has('D4')).toBe(false);
    // Tekst jak formuła zostaje tekstem.
    expect(dni.get('E3')).toBe('=SUM(A1:A2)');
    expect(dni.get('E4')).toBe(' spacja ');
    expect(dni.get('C4')).toBe(2100.5);
    const ruch = wb.get('Ruch   dzień')!;
    expect(ruch.get('A2')).toBeCloseTo(46329 + 18.75 / 24, 9);
  });

  it('części pakietu, formaty liczb, zamrożony nagłówek, autofiltr, szerokości, właściwości', () => {
    const p = parts(book());
    expect(Object.keys(p)[0]).toBe('[Content_Types].xml');
    for (const f of ['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'])
      expect(p[f], f).toBeTruthy();
    expect(p['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
    expect(p['xl/styles.xml']).toContain('formatCode="yyyy\\-mm\\-dd"');
    expect(p['xl/styles.xml']).toContain('formatCode="hh:mm"');
    expect(p['xl/styles.xml']).toContain('formatCode="0.0"');
    expect(p['xl/styles.xml']).toContain('<b/>');
    const s1 = p['xl/worksheets/sheet1.xml']!;
    expect(s1).toContain('state="frozen"');
    expect(s1).toContain('<autoFilter ref="A1:E4"/>');
    expect(s1).toContain('<dimension ref="A1:E4"/>');
    expect(s1).toMatch(/<col min="5" max="5" width="\d+" customWidth="1"\/>/);
    expect(s1).toContain('tabSelected="1"');
    // Data z formatem daty (styl 2), godzina z formatem godziny (3), kcal całkowite (5), waga z dwoma miejscami (7).
    expect(s1).toContain('<c r="A2" s="2"><v>46329</v></c>');
    expect(s1).toContain('<c r="C2" s="5"><v>1830</v></c>');
    expect(s1).toContain('<c r="D2" s="7"><v>82.4</v></c>');
    expect(p['xl/worksheets/sheet2.xml']).not.toContain('autoFilter');
    expect(p['xl/workbook.xml']).toContain(`<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Dni'!$A$1:$E$4</definedName>`);
    expect(p['xl/workbook.xml']).not.toContain('localSheetId="1"');
    expect(p['docProps/core.xml']).toContain('<dc:title>Raport</dc:title>');
    expect(p['docProps/core.xml']).toContain('2026-11-03T09:30:00Z');
    expect(p['xl/sharedStrings.xml']).toContain('<t xml:space="preserve"> spacja </t>');
    expect(p['xl/sharedStrings.xml']).toContain('Owsianka &amp; &lt;jagody&gt;');
  });

  it('ten sam tekst raz w sharedStrings', () => {
    const bytes = writeXlsx({
      title: 't',
      created,
      sheets: [{ name: 'A', columns: [{ header: 'x' }], rows: [['tak'], ['tak'], ['nie']] }],
    });
    const sst = parts(bytes)['xl/sharedStrings.xml']!;
    expect(sst).toContain('count="4" uniqueCount="3"');
  });
});
