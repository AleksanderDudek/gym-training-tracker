import type { ScanItem } from './compare';

/**
 * The comparison: scanned products kept for a quick look side by side, on this device only. It is a
 * shopping-trip list, not a collection - it empties itself an hour after the last product was added
 * (each scan gives the trip another hour), and one tap empties it at once.
 */

export const COMPARE_KEY = 'produkty-pl:porownanie';
/** The list empties itself this long after the last addition. */
export const COMPARE_TTL_MS = 60 * 60 * 1000;
/** More than this does not compare on a phone screen; the oldest scan makes room. */
export const COMPARE_MAX = 10;

export type CompareStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** What is stored; also what „Cofnij” puts back after emptying. */
export interface SavedCompare {
  items: ScanItem[];
  /** The last addition: the hour is counted from it. */
  touchedAt: number;
}

export interface CompareState {
  /** Newest first. */
  items: ScanItem[];
  /** When the list empties itself; `null` when empty. */
  expiresAt: number | null;
}

export const EMPTY_COMPARE: CompareState = { items: [], expiresAt: null };

function load(storage: CompareStorage | null): SavedCompare | null {
  try {
    const raw = storage?.getItem(COMPARE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<SavedCompare>) : null;
    if (!saved || !Array.isArray(saved.items) || typeof saved.touchedAt !== 'number') return null;
    return { items: saved.items, touchedAt: saved.touchedAt };
  } catch {
    return null;
  }
}

function save(storage: CompareStorage | null, saved: SavedCompare | null): void {
  try {
    if (!saved || saved.items.length === 0) storage?.removeItem(COMPARE_KEY);
    else storage?.setItem(COMPARE_KEY, JSON.stringify(saved));
  } catch {
    // Full or forbidden: the comparison lives as long as the page.
  }
}

const stateOf = (saved: SavedCompare | null): CompareState =>
  saved && saved.items.length ? { items: saved.items, expiresAt: saved.touchedAt + COMPARE_TTL_MS } : EMPTY_COMPARE;

/** What is stored, unless its hour is up - then it is removed, and the list is empty. */
export function readSaved(storage: CompareStorage | null, now: number): SavedCompare | null {
  const saved = load(storage);
  if (saved && now - saved.touchedAt >= COMPARE_TTL_MS) {
    save(storage, null);
    return null;
  }
  return saved;
}

export function readCompare(storage: CompareStorage | null, now: number): CompareState {
  return stateOf(readSaved(storage, now));
}

/** Adds a scan in front; the same product scanned again moves to the front with the new numbers. */
export function addToCompare(storage: CompareStorage | null, item: ScanItem, now: number): CompareState {
  const others = (readSaved(storage, now)?.items ?? []).filter((i) => i.code !== item.code);
  const saved = { items: [{ ...item, addedAt: now }, ...others].slice(0, COMPARE_MAX), touchedAt: now };
  save(storage, saved);
  return stateOf(saved);
}

/** Takes one product out; the hour still counts from the last addition. */
export function removeFromCompare(storage: CompareStorage | null, code: string, now: number): CompareState {
  const saved = readSaved(storage, now);
  if (!saved) return EMPTY_COMPARE;
  const next = { ...saved, items: saved.items.filter((i) => i.code !== code) };
  save(storage, next);
  return stateOf(next);
}

/** Empties the list; returns what it held, for „Cofnij”. */
export function clearCompare(storage: CompareStorage | null, now: number): SavedCompare | null {
  const saved = readSaved(storage, now);
  save(storage, null);
  return saved;
}

/** Puts an emptied list back as it was - unless its hour ran out meanwhile. */
export function restoreCompare(storage: CompareStorage | null, saved: SavedCompare, now: number): CompareState {
  if (now - saved.touchedAt >= COMPARE_TTL_MS) return EMPTY_COMPARE;
  save(storage, saved);
  return stateOf(saved);
}
