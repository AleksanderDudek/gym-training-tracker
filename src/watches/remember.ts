// The watch model a person chose in the check (spec 2026-10-24 §4.11): on this device only, never
// exported, forgotten by „Usuń wszystkie dane”. Shown as the person's own choice („Wybrany model”).
// Small on purpose: the Garmin card in the main bundle reads it without loading the watch list.
import type { Cap, Short } from './types';

export interface RememberedWatch {
  /** The answer's target key (a supported product id, an extra's key). */
  key: string;
  /** The name as shown: „Forerunner® 265”. */
  name: string;
  /** The short answer, for „Wybrany model: … — …”. */
  v: Short;
  /** What this model does not share with apps. */
  lacks?: Cap[];
  /** What arrives only with its newest software (an update step before connecting). */
  newest?: Cap[];
  /** Background memory, kB: 32 gets the „not tested on a real watch” note. */
  bg?: 32 | 64;
}

const KEY = 'gt-garmin-model';
const SHORTS: readonly Short[] = ['ok', 'part', 'no', 'notYet', 'other'];
const CAPS: readonly Cap[] = ['stress', 'bodyBattery', 'rides'];

const caps = (v: unknown): Cap[] | null =>
  Array.isArray(v) && v.every((c) => CAPS.includes(c as Cap)) ? (v as Cap[]) : null;

/** The stored choice, or null — also when storage is blocked or the value is not one. */
export function rememberedWatch(): RememberedWatch | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.key !== 'string' || !r.key || typeof r.name !== 'string') return null;
    if (!SHORTS.includes(r.v as Short)) return null;
    const lacks = caps(r.lacks);
    const newest = caps(r.newest);
    return {
      key: r.key,
      name: r.name,
      v: r.v as Short,
      ...(lacks?.length && { lacks }),
      ...(newest?.length && { newest }),
      ...((r.bg === 32 || r.bg === 64) && { bg: r.bg }),
    };
  } catch {
    return null;
  }
}

/** Remembers the choice; without storage it is simply not remembered. */
export function rememberWatch(watch: RememberedWatch): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(watch));
  } catch {
    // Private mode or blocked storage: the check still works, it just won't be remembered.
  }
}

/** Forgets the choice („Zmień model”, „Usuń wszystkie dane”). */
export function forgetWatchModel(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored that could be read either.
  }
}
