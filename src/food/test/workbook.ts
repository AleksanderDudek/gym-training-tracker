import { strToU8, zipSync } from 'fflate';

/**
 * Najmniejszy arkusz z planem, jaki czyta import: panel (waga startowa, kalorie), jeden dzień
 * wzorcowy z jednym wariantem i dwa dni planu — drugi z wagą i dodatkowymi kaloriami.
 */
export function minimalWorkbook(): Uint8Array {
  const sheet = (cells: string) => strToU8(`<worksheet><sheetData><row>${cells}</row></sheetData></worksheet>`);
  const s = (ref: string, text: string) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
  const v = (ref: string, n: number) => `<c r="${ref}"><v>${n}</v></c>`;
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook><sheets><sheet name="PANEL" r:id="r1"/><sheet name="WARIANTY" r:id="r2"/><sheet name="PLAN 91 DNI" r:id="r3"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="r1" Target="worksheets/a.xml"/><Relationship Id="r2" Target="worksheets/b.xml"/><Relationship Id="r3" Target="worksheets/c.xml"/></Relationships>',
    ),
    'xl/worksheets/a.xml': sheet(
      `${s('B7', 'Waga startowa (kg)')}${v('D7', 95)}${s('B18', 'kcal planowane dziennie')}${v('D18', 1800)}`,
    ),
    'xl/worksheets/b.xml': sheet(`${s('B2', '1A')}${v('C2', 1)}${s('D2', 'Coś')}${v('E2', 1800)}`),
    'xl/worksheets/c.xml': sheet(
      `${v('B2', 46083)}${s('D2', '1A')}${v('E2', 1)}${v('B3', 46084)}${s('D3', '1A')}${v('E3', 1)}${v('Z3', 106.2)}${v('V3', 250)}`,
    ),
  });
}
