import { normalizeForSearch } from '../lib/text';

/**
 * Text as lab printouts write it, folded for matching: lower case, no Polish diacritics, one
 * space, dashes as "-", and the micro sign in every spelling (µ, μ, "u") as "u". OCR and PDF fonts
 * disagree on which of them they produce.
 */
export function fold(text: string): string {
  return normalizeForSearch(text.replace(/[µμ]/g, 'u').replace(/[‐‑‒–—−]/g, '-'));
}

/** A unit as written, folded and without spaces: "x10^3/µl", "10³/µl" and "tys./µl" become one key. */
export function foldUnit(unit: string): string {
  return fold(unit)
    .replace(/\s+/g, '')
    .replace(/³/g, '3')
    .replace(/⁶/g, '6')
    .replace(/²/g, '2')
    .replace(/\*\*|\*/g, '^')
    .replace(/^x(?=10)/, '')
    .replace(/^10\^?3\//, 'tys/')
    .replace(/^10\^?6\//, 'mln/')
    .replace(/^tys\.\//, 'tys/')
    .replace(/^mln\.\//, 'mln/');
}

/** A number as printed: decimal comma or dot, optional comparison ("<0,5", "> 90"). */
export interface Printed {
  value: number;
  /** "<" or ">": the value is a detection limit, not a measurement. */
  cmp: '<' | '>' | null;
}

const NUMBER = /^(<=|>=|[<>≤≥])?(\d+(?:[.,]\d+)?)$/;

export function parsePrinted(token: string): Printed | null {
  const m = token.trim().replace(/\s+/g, '').match(NUMBER);
  if (!m) return null;
  const value = Number(m[2]!.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  const sign = m[1];
  const cmp = sign === undefined ? null : sign.startsWith('<') || sign === '≤' ? '<' : '>';
  return { value, cmp };
}

/** "1,23" → 1.23; null for anything else, a comparison included. */
export function toNumber(text: string): number | null {
  const p = parsePrinted(text);
  return p && p.cmp === null ? p.value : null;
}

/** Rounded for display and storage: enough digits to keep what the lab printed. */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
