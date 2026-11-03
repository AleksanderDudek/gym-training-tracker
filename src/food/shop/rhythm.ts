import { addDays, daysBetween } from '../diet/model';

/**
 * When the person shops: on fixed weekdays (Saturday; Tuesday and Friday) or every few days from a
 * day they name (every 10 days from 2026-11-07). The shopping list from the diary covers the days
 * from one shopping day up to the next; the calendar shows the days and exports them.
 *
 * Stored on the diet profile (`Profile.shopping`), so a backup carries it. Dates are calendar dates
 * (YYYY-MM-DD) on the phone's clock, like the rest of the diet.
 */
export type ShopRhythm =
  | {
      kind: 'weekdays';
      /** 1 = Monday … 7 = Sunday, ascending, at least one. */
      days: number[];
      /** HH:MM — when the trip usually is (the calendar event). */
      at: string;
    }
  | {
      kind: 'every';
      /** Days between trips, 1–28. */
      days: number;
      /** A shopping day the rhythm counts from. */
      from: string;
      at: string;
    };

/** Saturday morning: the most common big shop in Poland. */
export const DEFAULT_RHYTHM: ShopRhythm = { kind: 'weekdays', days: [6], at: '10:00' };

export const EVERY_MAX_DAYS = 28;

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Is `date` a shopping day of the rhythm. */
export function isShopDay(r: ShopRhythm, date: string): boolean {
  if (r.kind === 'weekdays') return r.days.includes(weekdayOf(date));
  const n = daysBetween(r.from, date);
  return ((n % r.days) + r.days) % r.days === 0;
}

/** The first shopping day on or after `from`. */
export function nextShopDay(r: ShopRhythm, from: string): string {
  // A rhythm repeats within four weeks at most, so the loop always ends.
  for (let i = 0; i <= EVERY_MAX_DAYS; i++) {
    const d = addDays(from, i);
    if (isShopDay(r, d)) return d;
  }
  return from;
}

/** Shopping days from `from` to `to`, both included. */
export function shopDays(r: ShopRhythm, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = nextShopDay(r, from); d <= to; d = nextShopDay(r, addDays(d, 1))) out.push(d);
  return out;
}

/**
 * What the next trip buys for: from the next shopping day (today, if it is one) up to the day
 * before the trip after it. `days` is how many days of eating the list covers.
 */
export function shopPeriod(r: ShopRhythm, today: string): { shop: string; until: string; days: number } {
  const shop = nextShopDay(r, today);
  const after = nextShopDay(r, addDays(shop, 1));
  return { shop, until: addDays(after, -1), days: daysBetween(shop, after) };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A rhythm from a backup or an old row; anything unreadable is no rhythm. */
export function cleanRhythm(raw: unknown): ShopRhythm | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const at = typeof r.at === 'string' && HHMM.test(r.at) ? r.at : DEFAULT_RHYTHM.at;
  if (r.kind === 'weekdays' && Array.isArray(r.days)) {
    const days = [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
    return days.length ? { kind: 'weekdays', days, at } : null;
  }
  if (r.kind === 'every' && Number.isInteger(r.days) && typeof r.from === 'string' && DATE.test(r.from)) {
    const days = r.days as number;
    if (days < 1 || days > EVERY_MAX_DAYS || Number.isNaN(Date.parse(`${r.from}T12:00:00Z`))) return null;
    return { kind: 'every', days, from: r.from, at };
  }
  return null;
}
