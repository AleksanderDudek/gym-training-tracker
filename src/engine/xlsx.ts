import { strToU8, zipSync } from 'fflate';

/**
 * Mały zapis pliku .xlsx (SpreadsheetML w zipie) — bez biblioteki arkuszy, która ważyłaby około
 * megabajta. Odpowiednik czytnika z `food/diet/xlsx.ts`: tylko to, czego potrzebuje raport,
 * czyli kilka arkuszy z nagłówkiem, typowane komórki i kilka formatów liczb.
 *
 * Komórki są typowane, bo lekarz w arkuszu sortuje i filtruje: data to data (liczba seryjna
 * Excela z formatem `yyyy-mm-dd`), godzina to ułamek doby (`hh:mm`), liczba to liczba. Pusta
 * komórka znaczy „nie wiadomo” — nigdy nie wpisujemy zera w miejsce braku.
 *
 * Teksty idą przez `sharedStrings` (każdy raz, odwołania numerem): komórka typu `s` nigdy nie jest
 * formułą, więc nazwa potrawy zaczynająca się od „=” niczego w arkuszu nie uruchomi.
 */

/** Liczba z ustaloną liczbą miejsc po przecinku w formacie komórki (wartość zostaje pełna). */
export interface NumCell {
  num: number;
  digits: 0 | 1 | 2;
}
/** Dzień `yyyy-mm-dd`. */
export interface DateCell {
  date: string;
}
/** Godzina `HH:MM` (albo `HH:MM:SS`). */
export interface TimeCell {
  time: string;
}
/** Chwila w czasie lokalnym telefonu — arkusz nie zna stref, więc zapisujemy to, co widać na zegarze. */
export interface StampCell {
  at: Date;
}

/**
 * Komórka: tekst, liczba bez formatu („Ogólny”), liczba z formatem, data, godzina, chwila
 * albo pusta (`null`/`undefined`, liczba nieskończona, zepsuta data — brak danych).
 */
export type XCell = string | number | NumCell | DateCell | TimeCell | StampCell | null | undefined;

export interface XColumn {
  header: string;
  /** Szerokość w znakach. Brak — z nagłówka i danych (8–60). */
  width?: number;
}

export interface XSheet {
  name: string;
  columns: XColumn[];
  rows: XCell[][];
  /** Autofiltr na nagłówku. Domyślnie tak. */
  filter?: boolean;
  /** Zawijanie tekstu w kolumnach (numery od 0) — długie objaśnienia. */
  wrap?: number[];
}

export interface XBook {
  title: string;
  /** Data utworzenia do właściwości pliku. */
  created: Date;
  sheets: XSheet[];
}

/* ---------------- Konstruktory komórek ---------------- */

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Liczba całkowita (format `0`); brak albo nie-liczba — pusta komórka. */
export const int = (n: number | null | undefined): XCell => (finite(n) ? { num: Math.round(n), digits: 0 } : null);
/** Liczba z jednym albo dwoma miejscami po przecinku w formacie. Wartość zaokrąglona do tylu miejsc. */
export const dec = (n: number | null | undefined, digits: 1 | 2): XCell =>
  finite(n) ? { num: Math.round(n * 10 ** digits) / 10 ** digits, digits } : null;
export const day = (s: string | null | undefined): XCell => (s && DAY.test(s) ? { date: s } : null);
export const clock = (s: string | null | undefined): XCell => (s && TIME.test(s) ? { time: s } : null);
export const stamp = (d: Date | null | undefined): XCell => (d && Number.isFinite(d.getTime()) ? { at: d } : null);

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

/* ---------------- Daty Excela ---------------- */

const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/**
 * Dzień jako liczba seryjna Excela: dni od 1899-12-30. Tak liczy system 1900 dla każdej daty od
 * marca 1900 — błąd z nieistniejącym 29 lutego 1900 (zgodność z Lotusem) dotyczy tylko dat
 * wcześniejszych, a takich w dzienniku nie ma.
 */
export function excelSerial(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y!, m! - 1, d!) - EPOCH) / DAY_MS);
}

/** Godzina jako ułamek doby: 12:00 → 0,5. */
export function excelTime(time: string): number {
  const [h, m, s] = time.split(':').map(Number);
  return ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) / 86_400;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Chwila według zegara telefonu: dzień seryjny plus ułamek doby. */
export function excelStamp(d: Date): number {
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return excelSerial(date) + excelTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
}

/* ---------------- XML ---------------- */

/** Znaki zakazane w XML 1.0 (sterujące poza tabulatorem i końcami linii, samotne surogaty, U+FFFE/FFFF). */
const ILLEGAL = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

/** Excel przyjmuje w komórce do 32 767 znaków. */
const MAX_CELL = 32_767;

export function xmlText(s: string): string {
  return s
    .replace(ILLEGAL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A, B, …, Z, AA, AB… dla kolumny o numerze od 0. */
export function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Nazwa arkusza, jaką Excel przyjmie: bez `[]:*?/\`, bez apostrofu na brzegach, najwyżej
 * 31 znaków i niepowtarzalna (bez względu na wielkość liter) — powtórka dostaje „ (2)”.
 */
export function sheetNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base =
      raw
        .replace(ILLEGAL, '')
        .replace(/[[\]:*?/\\]/g, ' ')
        .replace(/^'+|'+$/g, '')
        .trim()
        .slice(0, 31) || `Sheet${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      const suffix = ` (${n})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/* ---------------- Style ---------------- */

/**
 * Indeksy w `cellXfs`. Kolejność musi zgadzać się z `STYLES` niżej.
 * 164–167 to własne formaty (od 164 w górę), 1 i 2 to wbudowane `0` i `0.00`.
 */
const S = { plain: 0, head: 1, date: 2, time: 3, stamp: 4, int: 5, dec1: 6, dec2: 7, wrap: 8 } as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="yyyy\\-mm\\-dd hh:mm"/><numFmt numFmtId="167" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F0"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF7F8FA6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* ---------------- Arkusz ---------------- */

class Strings {
  readonly list: string[] = [];
  private readonly index = new Map<string, number>();
  count = 0;
  id(s: string): number {
    this.count++;
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(s);
      this.index.set(s, i);
    }
    return i;
  }
}

/** Jedna komórka jako `<c>`; pusta — nic (brak elementu to brak danych). */
function cellXml(ref: string, c: XCell, strings: Strings, wrap: boolean): string {
  if (c === null || c === undefined) return '';
  if (typeof c === 'string') {
    const s = c.replace(ILLEGAL, '').slice(0, MAX_CELL);
    if (!s) return '';
    return `<c r="${ref}" t="s"${wrap ? ` s="${S.wrap}"` : ''}><v>${strings.id(s)}</v></c>`;
  }
  let v: number;
  let s: number;
  if (typeof c === 'number') [v, s] = [c, S.plain];
  else if ('num' in c) [v, s] = [c.num, c.digits === 0 ? S.int : c.digits === 1 ? S.dec1 : S.dec2];
  else if ('date' in c) [v, s] = [DAY.test(c.date) ? excelSerial(c.date) : NaN, S.date];
  else if ('time' in c) [v, s] = [TIME.test(c.time) ? excelTime(c.time) : NaN, S.time];
  else [v, s] = [excelStamp(c.at), S.stamp];
  if (!Number.isFinite(v)) return '';
  return `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;
}

/** Szerokość, jaką widać w danych: najdłuższy tekst w kolumnie, w granicach 8–60 znaków. */
function widthOf(col: XColumn, i: number, rows: readonly XCell[][]): number {
  if (col.width) return col.width;
  let w = Math.min(col.header.length, 24) + 2;
  for (const r of rows.slice(0, 500)) {
    const c = r[i];
    const len =
      typeof c === 'string' ? c.length : typeof c === 'number' ? String(c).length : !c ? 0 : 'at' in c ? 16 : 'date' in c ? 10 : 'time' in c ? 5 : String(c.num).length + 1;
    w = Math.max(w, len + 2);
  }
  return Math.min(60, Math.max(8, w));
}

function sheetXml(sheet: XSheet, strings: Strings, first: boolean): string {
  const cols = sheet.columns;
  const last = columnName(Math.max(0, cols.length - 1));
  const rows = [cols.map((c) => c.header), ...sheet.rows];
  const wrap = new Set(sheet.wrap ?? []);
  const body = rows
    .map((r, ri) => {
      const n = ri + 1;
      const cells = cols
        .map((_, ci) => {
          const ref = `${columnName(ci)}${n}`;
          if (ri === 0) return `<c r="${ref}" t="s" s="${S.head}"><v>${strings.id(r[ci] as string)}</v></c>`;
          return cellXml(ref, r[ci], strings, wrap.has(ci));
        })
        .join('');
      return `<row r="${n}">${cells}</row>`;
    })
    .join('');
  const widths = cols
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${widthOf(c, i, sheet.rows)}" customWidth="1"/>`)
    .join('');
  const ref = `A1:${last}${rows.length}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="${ref}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${first ? ' tabSelected="1"' : ''}>` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    (widths ? `<cols>${widths}</cols>` : '') +
    `<sheetData>${body}</sheetData>` +
    (sheet.filter === false ? '' : `<autoFilter ref="${ref}"/>`) +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `</worksheet>`
  );
}

/* ---------------- Skoroszyt ---------------- */

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Cały plik .xlsx jako bajty. Arkusz bez kolumn dostaje jedną pustą, żeby plik się otwierał. */
export function writeXlsx(book: XBook): Uint8Array {
  const sheets = book.sheets.map((s) => (s.columns.length ? s : { ...s, columns: [{ header: '' }] }));
  const names = sheetNames(sheets.map((s) => s.name));
  const strings = new Strings();
  const files: Record<string, Uint8Array> = {};

  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s, strings, i === 0));
  });

  const quoted = (n: string) => `'${n.replace(/'/g, "''")}'`;
  const filters = sheets
    .map((s, i) =>
      s.filter === false
        ? ''
        : `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xmlText(quoted(names[i]!))}!$A$1:$${columnName(s.columns.length - 1)}$${s.rows.length + 1}</definedName>`,
    )
    .join('');

  files['xl/workbook.xml'] = strToU8(
    XML +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
      names.map((n, i) => `<sheet name="${xmlText(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      `</sheets>${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
  );
  files['xl/styles.xml'] = strToU8(STYLES);
  files['xl/sharedStrings.xml'] = strToU8(
    XML +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.count}" uniqueCount="${strings.list.length}">` +
      strings.list
        .map((s) => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ''}>${xmlText(s)}</t></si>`)
        .join('') +
      `</sst>`,
  );
  files['docProps/core.xml'] = strToU8(
    XML +
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlText(book.title)}</dc:title><dc:creator>GYM TRACKER</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${book.created.toISOString().replace(/\.\d{3}Z$/, 'Z')}</dcterms:created>` +
      `</cp:coreProperties>`,
  );
  files['docProps/app.xml'] = strToU8(
    XML +
      `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>GYM TRACKER</Application></Properties>`,
  );
  files['_rels/.rels'] = strToU8(
    XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
      `</Relationships>`,
  );
  files['[Content_Types].xml'] = strToU8(
    XML +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `</Types>`,
  );

  // `[Content_Types].xml` na początku archiwum — niektóre czytniki tego oczekują.
  const ordered: Record<string, Uint8Array> = { '[Content_Types].xml': files['[Content_Types].xml']! };
  for (const [k, v] of Object.entries(files)) if (k !== '[Content_Types].xml') ordered[k] = v;
  return zipSync(ordered, { level: 6, mtime: book.created });
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
