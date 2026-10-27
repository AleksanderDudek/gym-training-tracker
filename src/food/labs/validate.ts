import { isCalendarDate } from '../diet/validate';
import { MARKERS, type Range } from './markers';
import type { Qual } from './read/parse';
import type { Eats, LabPlan, LabPrefs, LabReport, LabResult, LabSource } from './types';

/**
 * Lab rows from a backup file are outside input. A result is kept only when its marker is one the
 * app knows and its numbers are numbers; a report without a single readable result is dropped.
 */

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (finite(v) ? v : null);

const SOURCES: readonly LabSource[] = ['pdf', 'photo', 'text', 'manual'];
const QUALS: readonly Qual[] = ['neg', 'trace', 'pos'];
const EATS: readonly Eats[] = ['all', 'vege', 'vegan'];

function cleanRange(raw: unknown): Range | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const [lo, hi] = [numOrNull(raw[0]), numOrNull(raw[1])];
  if (lo === null && hi === null) return null;
  return lo !== null && hi !== null && lo > hi ? null : [lo, hi];
}

export function cleanLabResult(raw: unknown): LabResult | null {
  if (!isObject(raw) || typeof raw.marker !== 'string' || !Object.hasOwn(MARKERS, raw.marker)) return null;
  const value = numOrNull(raw.value);
  const qual = QUALS.includes(raw.qual as Qual) ? (raw.qual as Qual) : null;
  if (value === null && qual === null) return null;
  return {
    marker: raw.marker,
    value,
    cmp: raw.cmp === '<' || raw.cmp === '>' ? raw.cmp : null,
    qual,
    printed: typeof raw.printed === 'string' ? raw.printed.slice(0, 60) : '',
    ref: cleanRange(raw.ref),
  };
}

export function cleanLabReport(raw: unknown): LabReport | null {
  if (!isObject(raw) || !isCalendarDate(raw.date) || !Array.isArray(raw.results)) return null;
  const results = raw.results.map(cleanLabResult).filter((r): r is LabResult => r !== null);
  if (!results.length) return null;
  return {
    ...(finite(raw.id) && Number.isInteger(raw.id) && raw.id > 0 && { id: raw.id }),
    date: raw.date,
    lab: typeof raw.lab === 'string' ? raw.lab.slice(0, 60) : null,
    source: SOURCES.includes(raw.source as LabSource) ? (raw.source as LabSource) : 'manual',
    results: results.slice(0, 120),
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date(0).toISOString(),
  };
}

function cleanPlan(raw: unknown): LabPlan | null {
  if (!isObject(raw) || !isCalendarDate(raw.start) || !isCalendarDate(raw.basedOn) || !Array.isArray(raw.focus)) return null;
  const focus = raw.focus.filter((f): f is string => typeof f === 'string').slice(0, 6);
  return { start: raw.start, focus, basedOn: raw.basedOn };
}

export function cleanLabPrefs(raw: unknown): LabPrefs | null {
  if (!isObject(raw) || raw.id !== 'me') return null;
  return {
    id: 'me',
    eats: EATS.includes(raw.eats as Eats) ? (raw.eats as Eats) : 'all',
    sex: raw.sex === 'M' || raw.sex === 'K' ? raw.sex : null,
    age: finite(raw.age) && raw.age >= 18 && raw.age <= 110 ? Math.round(raw.age) : null,
    plan: cleanPlan(raw.plan),
  };
}
