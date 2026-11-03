import { db, type DietDb } from '../diet/db';
import type { ShopRhythm } from './rhythm';

/**
 * The shopping rhythm on the stored profile, and nothing else of it: like `saveFast`, so a list
 * open in one tab never writes back a profile another tab changed. A row not yet upgraded is left
 * alone (the diary upgrades it first).
 */
export async function saveShopping(shopping: ShopRhythm, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const row = await database.profile.get('me');
    if (!row || row.version !== 2) return;
    await database.profile.put({ ...row, shopping, id: 'me' });
  });
}

/**
 * Ticks of the list from the diary, for one shopping day: the next trip starts unticked. Kept on
 * the device (localStorage) — the list is worked out anew from the diary on every visit, so there
 * is no stored list to put them on. Storage that fails (private mode) just forgets.
 */
const TICKS_KEY = 'gt:zakupy-dziennik';

export function readTicks(shop: string): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(TICKS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return [];
    const { shop: day, keys } = raw as { shop?: unknown; keys?: unknown };
    return day === shop && Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** False when the device would not keep it. */
export function writeTicks(shop: string, keys: readonly string[]): boolean {
  try {
    if (keys.length) window.localStorage.setItem(TICKS_KEY, JSON.stringify({ shop, keys }));
    else window.localStorage.removeItem(TICKS_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Which list the shopping page showed last: the diary's or the plan's. */
export type ShopSource = 'dziennik' | 'plan';
const SOURCE_KEY = 'gt:zakupy-zrodlo';

export function readSource(): ShopSource | null {
  try {
    const v = window.localStorage.getItem(SOURCE_KEY);
    return v === 'dziennik' || v === 'plan' ? v : null;
  } catch {
    return null;
  }
}

export function writeSource(source: ShopSource): void {
  try {
    window.localStorage.setItem(SOURCE_KEY, source);
  } catch {
    // Without storage the choice lasts for the visit: the address carries it anyway.
  }
}
