import { LOCALE, num, text } from '../../../i18n';
import { MARKERS, type Marker, type Range } from '../../labs/markers';
import type { Qual } from '../../labs/read/parse';
import type { LabResult } from '../../labs/types';
import type { Verdict } from '../../labs/verdict';

const T = text({
  pl: {
    qual: { neg: 'ujemny', trace: 'ślad', pos: 'dodatni' } as Record<Qual, string>,
    level: { low: 'Za nisko', high: 'Za wysoko', ok: 'W normie', unknown: 'Bez zakresu' },
    below: 'Poniżej celu',
    above: 'Powyżej celu',
    neg: 'Prawidłowy',
    pos: 'Nieprawidłowy',
    range: (lo: string | null, hi: string | null) => (lo && hi ? `${lo}–${hi}` : lo ? `od ${lo}` : `do ${hi}`),
  },
  en: {
    qual: { neg: 'negative', trace: 'trace', pos: 'positive' } as Record<Qual, string>,
    level: { low: 'Low', high: 'High', ok: 'In range', unknown: 'No range' },
    below: 'Below target',
    above: 'Above target',
    neg: 'Normal',
    pos: 'Abnormal',
    range: (lo: string | null, hi: string | null) => (lo && hi ? `${lo}–${hi}` : lo ? `from ${lo}` : `up to ${hi}`),
  },
});

/** Units as folded keys ("ug/dl") → as printed ("µg/dl"). */
export function prettyUnit(key: string): string {
  const special: Record<string, string> = {
    'u/l': 'U/l',
    'iu/l': 'IU/l',
    'iu/ml': 'IU/ml',
    'kiu/l': 'kIU/l',
    'uiu/ml': 'µIU/ml',
    'miu/l': 'mIU/l',
    'mu/l': 'mU/l',
    'uu/ml': 'µU/ml',
    'meq/l': 'mEq/l',
    'ukat/l': 'µkat/l',
    't/l': 'T/l',
    'g/l': 'g/l',
    'ml/min/1,73m2': 'ml/min/1,73 m²',
    'ml/min/1.73m2': 'ml/min/1.73 m²',
  };
  if (special[key]) return special[key];
  return key.replace(/(^|\/)u(?=[a-z])/g, '$1µ');
}

/** The number in this language, with as many decimals as the marker keeps. */
export function formatValue(marker: Marker, value: number): string {
  return num(value, marker.digits);
}

/**
 * The number for an input field: never grouped ("1,250" would read back as 1.25 in English), with
 * up to two more decimals than shown, so a converted value (HbA1c 47 mmol/mol = 6.45 %) is not
 * rounded across a threshold.
 */
export function inputValue(marker: Marker, value: number): string {
  return value.toLocaleString(LOCALE, { useGrouping: false, minimumFractionDigits: marker.digits, maximumFractionDigits: marker.digits + 2 });
}

/** „<0,5 mg/l”, „18,4 ng/ml”, „ujemny”. */
export function resultText(marker: Marker, r: Pick<LabResult, 'value' | 'cmp' | 'qual'>): string {
  if (r.value === null) return r.qual ? T.qual[r.qual] : '—';
  const value = `${r.cmp ?? ''}${formatValue(marker, r.value)}`;
  return marker.unit ? `${value} ${marker.unit}` : value;
}

export function rangeText(marker: Marker, range: Range | null): string | null {
  if (!range) return null;
  const f = (v: number | null) => (v === null ? null : formatValue(marker, v));
  const r = T.range(f(range[0]), f(range[1]));
  return marker.unit ? `${r} ${marker.unit}` : r;
}

export type Tone = 'low' | 'high' | 'ok' | 'target' | 'none';

/** The verdict as a word and a tone for its badge. */
export function verdictWord(marker: Marker, verdict: Verdict, qual: Qual | null): { word: string; tone: Tone } {
  if (marker.qualitative && qual !== null && verdict.range === null) {
    return qual === 'neg' ? { word: T.neg, tone: 'ok' } : { word: T.pos, tone: 'high' };
  }
  if (verdict.level === 'ok' && verdict.target) return { word: verdict.target === 'below' ? T.below : T.above, tone: 'target' };
  const tone: Tone = verdict.level === 'unknown' ? 'none' : verdict.level;
  return { word: T.level[verdict.level], tone };
}

export const markerOf = (id: string): Marker => MARKERS[id]!;

/** A nutrient amount: small ones with a decimal, large ones whole. */
export function amountText(amount: number, unit: string): string {
  if (unit === 'g' && amount < 1) return `${num(Math.round(amount * 1000))} mg`;
  const digits = amount >= 100 ? 0 : amount >= 10 ? 0 : amount >= 1 ? 1 : 2;
  return `${num(amount, digits)} ${unit}`;
}

export const QUAL_WORDS = T.qual;
