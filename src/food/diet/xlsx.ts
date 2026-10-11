import { strFromU8, unzipSync } from 'fflate';

/**
 * A minimal .xlsx reader: a workbook is a zip of XML parts, and the parts a
 * plan needs (workbook, relationships, shared strings, sheets) have a regular
 * shape. Reading them with patterns instead of a DOM parser keeps this
 * working in the browser, in a worker and in Node alike, and costs a few
 * kilobytes instead of a megabyte-sized spreadsheet library.
 */

export type Cell = string | number;
/** Cell reference (A1, D18, ...) -> value. Formulas are read as their cached result. */
export type Sheet = Map<string, Cell>;
export type Workbook = Map<string, Sheet>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      // fromCodePoint throws past U+10FFFF: an entity like &#99999999; stays as written.
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** All `<t>` text inside a fragment, concatenated (rich text has several runs). */
function texts(fragment: string): string {
  let out = '';
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += decode(m[1] ?? '');
  return out;
}

function attr(attributes: string, name: string): string | null {
  const value = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
  return value === undefined ? null : decode(value);
}

function sharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1] ?? ''));
}

function readSheet(xml: string, shared: string[]): Sheet {
  const sheet: Sheet = new Map();
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = m[1] ?? '';
    const inner = m[2] ?? '';
    const ref = attr(attributes, 'r');
    if (!ref) continue;
    const type = attr(attributes, 't');
    if (type === 'inlineStr') {
      sheet.set(ref, texts(inner));
      continue;
    }
    const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    if (v === undefined) continue;
    if (type === 's') sheet.set(ref, shared[Number(v)] ?? '');
    else if (type === 'str' || type === 'e') sheet.set(ref, decode(v));
    else {
      const n = Number(v);
      sheet.set(ref, Number.isFinite(n) ? n : decode(v));
    }
  }
  return sheet;
}

/** A plan workbook is tens of kilobytes; a file this big is not one. */
export const MAX_WORKBOOK_BYTES = 10_000_000;
/** What one part may claim to inflate to: bounds a zip bomb before it is inflated. */
const MAX_PART_BYTES = 30_000_000;
/** The only parts read: everything else (styles, images, macros) is never inflated. */
const WANTED = /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/;

export function readWorkbook(bytes: Uint8Array): Workbook {
  if (bytes.length > MAX_WORKBOOK_BYTES) throw new Error('Plik jest za duży jak na arkusz z planem (ponad 10 MB).');
  const files = unzipSync(bytes, { filter: (file) => WANTED.test(file.name) && file.originalSize <= MAX_PART_BYTES });
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : undefined);
  const workbook = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error('To nie jest plik Excela (.xlsx).');

  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attr(m[1] ?? '', 'Id');
    const target = attr(m[1] ?? '', 'Target');
    if (id && target) targets.set(id, target.replace(/^\/?(xl\/)?/, 'xl/'));
  }

  const shared = sharedStrings(read('xl/sharedStrings.xml'));
  const book: Workbook = new Map();
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = attr(m[1] ?? '', 'name');
    const rid = attr(m[1] ?? '', 'r:id');
    const xml = rid ? read(targets.get(rid) ?? '') : undefined;
    if (name && xml) book.set(name, readSheet(xml, shared));
  }
  return book;
}

/** Column letters + row number, e.g. cell('D', 7) -> 'D7'. */
export const cell = (column: string, row: number) => `${column}${row}`;

/** The highest row number used in a sheet. */
export function lastRow(sheet: Sheet): number {
  let max = 0;
  for (const ref of sheet.keys()) max = Math.max(max, Number(ref.replace(/^[A-Z]+/, '')));
  return max;
}

/** Excel serial date (days since 1899-12-30) -> YYYY-MM-DD. */
export function excelDate(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000).toISOString().slice(0, 10);
}
