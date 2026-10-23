import { useSyncExternalStore } from 'react';
import type { ScanItem } from '../scan/compare';
import {
  COMPARE_KEY,
  addToCompare,
  clearCompare,
  readCompare,
  removeFromCompare,
  restoreCompare,
  type CompareState,
  type CompareStorage,
  type SavedCompare,
} from '../scan/compareStore';

function storage(): CompareStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/*
 * One comparison for the whole page: the scanner, the product card's „Porównaj” and the bar under
 * the search see the same list. It lives in localStorage; this module keeps the last read, tells
 * the subscribers about changes (also from another tab), and empties the list when its hour is up -
 * by a timer while the page is open, and on the next look after the phone slept.
 */

let snapshot: CompareState | null = null;
const listeners = new Set<() => void>();
let expiry: ReturnType<typeof setTimeout> | undefined;

function current(): CompareState {
  snapshot ??= readCompare(storage(), Date.now());
  return snapshot;
}

function changed(next?: CompareState): void {
  snapshot = next ?? null;
  clearTimeout(expiry);
  const { expiresAt } = current();
  // A browser caps timers at about 24 days; an hour is far below.
  if (expiresAt !== null && listeners.size > 0) expiry = setTimeout(() => changed(), Math.max(0, expiresAt - Date.now()) + 50);
  listeners.forEach((listener) => listener());
}

const onStorage = (event: StorageEvent) => {
  if (event.key === COMPARE_KEY || event.key === null) changed();
};
const onVisible = () => {
  if (document.visibilityState === 'visible') changed();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    changed();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(expiry);
    }
  };
}

export const compare = {
  add: (item: ScanItem) => changed(addToCompare(storage(), item, Date.now())),
  remove: (code: string) => changed(removeFromCompare(storage(), code, Date.now())),
  /** Empties the list; what it held comes back with `restore` („Cofnij”). */
  clear: (): SavedCompare | null => {
    const saved = clearCompare(storage(), Date.now());
    changed();
    return saved;
  },
  restore: (saved: SavedCompare) => changed(restoreCompare(storage(), saved, Date.now())),
};

/** The comparison, kept up to date: scans, removals, another tab, the hour running out. */
export function useCompare(): CompareState {
  return useSyncExternalStore(subscribe, current, current);
}
