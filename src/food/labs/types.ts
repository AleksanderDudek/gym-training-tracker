import type { Sex } from '../diet/types';
import type { Range } from './markers';
import type { Qual } from './read/parse';

/** One confirmed result: what the person saw on the review screen and saved. */
export interface LabResult {
  /** Marker id (`MARKERS`). */
  marker: string;
  /** In the marker's canonical unit; null for a strip result without a number. */
  value: number | null;
  /** "<" or ">": a detection limit, not a measurement. */
  cmp: '<' | '>' | null;
  qual: Qual | null;
  /** As printed, unit included („18,4 ng/ml”), so the original stays readable. */
  printed: string;
  /** The lab's range in the canonical unit, when it printed one. */
  ref: Range | null;
}

export type LabSource = 'pdf' | 'photo' | 'text' | 'manual';

/** One visit to the lab: everything collected on one day. The file itself is never kept. */
export interface LabReport {
  id?: number;
  /** YYYY-MM-DD, the day of collection. */
  date: string;
  lab: string | null;
  source: LabSource;
  results: LabResult[];
  /** ISO time it was saved. */
  addedAt: string;
}

/** What the person eats: foods outside it are never proposed. */
export type Eats = 'all' | 'vege' | 'vegan';

/** A started plan: from when, aimed at what, and on which results. */
export interface LabPlan {
  /** YYYY-MM-DD */
  start: string;
  focus: string[];
  /** Date of the newest report the plan was made from. */
  basedOn: string;
}

export interface LabPrefs {
  id: 'me';
  eats: Eats;
  /** Only when there is no diet profile to take it from. */
  sex: Sex | null;
  /** Only when there is no diet profile to take it from (eGFR from creatinine needs it). */
  age: number | null;
  plan: LabPlan | null;
}

export const DEFAULT_PREFS: LabPrefs = { id: 'me', eats: 'all', sex: null, age: null, plan: null };
