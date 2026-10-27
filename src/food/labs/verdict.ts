import type { Sex } from '../diet/types';
import { MARKERS, refFor, type Marker, type Range } from './markers';
import type { LabReport, LabResult } from './types';

/**
 * What a result means against a range. The lab's own range wins: methods differ between labs, and
 * the range printed next to the number is the one it was measured against. Without one, the
 * catalog's adult range for the person's sex. A guideline target, where one exists, is judged on
 * top: vitamin D of 25 ng/ml is inside many labs' ranges and below the Polish guideline's 30.
 */

export type Level = 'low' | 'ok' | 'high' | 'unknown';

export interface Verdict {
  level: Level;
  /** Against the guideline target, when it differs from the range: below or above it. */
  target: 'below' | 'above' | null;
  /** The range used, and whose it was. */
  range: Range | null;
  from: 'lab' | 'app' | null;
  /** How far outside the range, as a multiple of its limit (2 = twice the upper limit). */
  times: number | null;
}

/** Urine sediment counts without a printed range: cells per field (wpw) or per µl on a strip. */
const SEDIMENT: Record<string, Range> = { uLeuko: [null, 5], uBlood: [null, 2] };

function against(range: Range, value: number, cmp: '<' | '>' | null): Level {
  const [lo, hi] = range;
  // A detection limit is judged by the side it is on: "<0,5" is below any lower limit above 0.5.
  if (lo !== null && value < lo && cmp !== '>') return 'low';
  if (hi !== null && value > hi && cmp !== '<') return 'high';
  if (lo !== null && value === lo && cmp === '<') return 'low';
  if (hi !== null && value === hi && cmp === '>') return 'high';
  return 'ok';
}

export function judge(marker: Marker, result: Pick<LabResult, 'value' | 'cmp' | 'qual' | 'ref'>, sex: Sex): Verdict {
  if (marker.qualitative && result.value === null) {
    if (result.qual === null) return { level: 'unknown', target: null, range: null, from: null, times: null };
    // A trace of ketones or protein is still "not none"; the flags decide how much it matters.
    return { level: result.qual === 'neg' ? 'ok' : 'high', target: null, range: null, from: null, times: null };
  }
  if (result.value === null) return { level: 'unknown', target: null, range: null, from: null, times: null };
  const range = result.ref ?? refFor(marker, sex) ?? SEDIMENT[marker.id] ?? null;
  const from = result.ref ? 'lab' : range ? 'app' : null;
  let level: Level = range ? against(range, result.value, result.cmp) : 'unknown';
  // A strip with a number: "ujemny <15 mg/dl" is negative whatever the number.
  if (marker.qualitative && result.qual === 'neg') level = 'ok';
  let target: Verdict['target'] = null;
  if (marker.target && level === 'ok') {
    const t = against(marker.target.range, result.value, result.cmp);
    if (t === 'low') target = 'below';
    if (t === 'high') target = 'above';
  }
  let times: number | null = null;
  if (range && level === 'high' && range[1]) times = result.value / range[1];
  if (range && level === 'low' && range[0]) times = result.value / range[0];
  return { level, target, range, from, times };
}

/** A marker's newest value with the report it came from. */
export interface Latest extends LabResult {
  date: string;
  reportId: number | null;
  /** Calculated by the app from other results (non-HDL, HOMA-IR, eGFR, TSAT). */
  derived?: true;
}

/** Newest first, then by id; a later report on the same day wins. */
const newestFirst = (a: LabReport, b: LabReport) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0);

/** The newest value of every marker across the reports, with calculated ones where the lab gave none. */
export function latestValues(reports: readonly LabReport[], person: { sex: Sex; age: number | null }): Map<string, Latest> {
  const out = new Map<string, Latest>();
  for (const report of [...reports].sort(newestFirst)) {
    for (const r of report.results) {
      if (!out.has(r.marker) && MARKERS[r.marker]) out.set(r.marker, { ...r, date: report.date, reportId: report.id ?? null });
    }
  }
  derive(out, person);
  return out;
}

/** History of one marker, oldest first. */
export function historyOf(reports: readonly LabReport[], marker: string): Latest[] {
  return [...reports]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    .flatMap((report) =>
      report.results.filter((r) => r.marker === marker).map((r) => ({ ...r, date: report.date, reportId: report.id ?? null })),
    );
}

function sameDay(a: Latest | undefined, b: Latest | undefined): a is Latest {
  return !!a && !!b && a.date === b.date && a.value !== null && b.value !== null && a.cmp === null && b.cmp === null;
}

function put(out: Map<string, Latest>, marker: string, value: number, date: string, digits: number) {
  const f = 10 ** digits;
  out.set(marker, {
    marker,
    value: Math.round(value * f) / f,
    cmp: null,
    qual: null,
    printed: '',
    ref: null,
    date,
    reportId: null,
    derived: true,
  });
}

/**
 * CKD-EPI 2021 (without race), the equation Polish labs print: eGFR from creatinine, age and sex.
 * KDIGO 2024 recommends it for adults.
 */
export function ckdEpi2021(creatinineMgDl: number, age: number, sex: Sex): number {
  const k = sex === 'K' ? 0.7 : 0.9;
  const a = sex === 'K' ? -0.241 : -0.302;
  const ratio = creatinineMgDl / k;
  return 142 * Math.min(ratio, 1) ** a * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (sex === 'K' ? 1.012 : 1);
}

function derive(out: Map<string, Latest>, person: { sex: Sex; age: number | null }) {
  const chol = out.get('chol');
  const hdl = out.get('hdl');
  if (!out.has('nonHdl') && sameDay(chol, hdl)) put(out, 'nonHdl', chol.value! - hdl!.value!, chol.date, 0);
  const glucose = out.get('glucose');
  const insulin = out.get('insulin');
  if (!out.has('homaIr') && sameDay(glucose, insulin)) put(out, 'homaIr', (glucose.value! * insulin!.value!) / 405, glucose.date, 2);
  const iron = out.get('iron');
  const tibc = out.get('tibc');
  if (!out.has('tsat') && sameDay(iron, tibc) && tibc!.value! > 0) put(out, 'tsat', (iron.value! / tibc!.value!) * 100, iron.date, 0);
  const creatinine = out.get('creatinine');
  if (!out.has('egfr') && creatinine?.value && creatinine.cmp === null && person.age !== null && person.age >= 18) {
    put(out, 'egfr', ckdEpi2021(creatinine.value, person.age, person.sex), creatinine.date, 0);
  }
}
