import type { Entry } from './db';
import type { Fast, FastPlan, Profile } from './types';

/**
 * The eating window („Okno jedzenia”, intermittent fasting): an option, off by default. It only
 * keeps the time — when the fast started and ended, as the person said. It never changes a target
 * (one target a day stays the only calorie rule) and suggests nothing to eat or skip.
 *
 * Times are local, `YYYY-MM-DDTHH:MM`, like the diary's own day and HH:MM.
 */

/** Fasting hours of each split; the eating window is the rest of the day. */
export const FAST_HOURS: Record<FastPlan, number> = { '12:12': 12, '14:10': 14, '16:8': 16, '18:6': 18 };

/** A fast still running after this long was most likely never ended: the card starts afresh. */
export const STALE_HOURS = 48;

/** The window closed this long ago: the card asks for the next fast instead of showing it. */
const WINDOW_SHOWN_HOURS = 24;

const HOUR = 3_600_000;
const MINUTE = 60_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** A local time as stored. */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A stored local time back as a date (local). */
export function parseStamp(stamp: string): Date {
  const [day = '', time = ''] = stamp.split('T');
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  const [h = 0, min = 0] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** The option is not offered in pregnancy or while breastfeeding (the profile's one flag). */
export const fastingAllowed = (p: Pick<Profile, 'sex' | 'pregnancy'>): boolean => !(p.sex === 'K' && p.pregnancy);

/** The card shows only with the option on and allowed. */
export const fastingOn = (p: Pick<Profile, 'sex' | 'pregnancy' | 'fastPlan'>): boolean =>
  p.fastPlan !== null && fastingAllowed(p);

export type FastState =
  /** No fast to show: „Zaczynam post”. */
  | { kind: 'idle' }
  /** Fasting since `start`; `left` minutes to the planned end at `until` (0 once reached), `over` past it. */
  | { kind: 'fasting'; start: string; until: string; left: number; over: number }
  /** The fast ended at `end`; the window lasts until `until` (`open` while it does). */
  | { kind: 'eating'; end: string; until: string; open: boolean };

const plus = (stamp: string, hours: number) => localStamp(new Date(parseStamp(stamp).getTime() + hours * HOUR));

/** Where the person is now, from the last fast and the split. */
export function fastState(fast: Fast | null, plan: FastPlan, now: Date): FastState {
  if (!fast) return { kind: 'idle' };
  const hours = FAST_HOURS[plan];
  const nowMs = now.getTime();
  if (fast.end === null) {
    const startMs = parseStamp(fast.start).getTime();
    if (nowMs - startMs > STALE_HOURS * HOUR || startMs > nowMs) return { kind: 'idle' };
    const goal = startMs + hours * HOUR;
    const left = Math.max(0, Math.ceil((goal - nowMs) / MINUTE));
    const over = Math.max(0, Math.floor((nowMs - goal) / MINUTE));
    return { kind: 'fasting', start: fast.start, until: plus(fast.start, hours), left, over };
  }
  const until = plus(fast.end, 24 - hours);
  const untilMs = parseStamp(until).getTime();
  if (nowMs - untilMs > WINDOW_SHOWN_HOURS * HOUR) return { kind: 'idle' };
  return { kind: 'eating', end: fast.end, until, open: nowMs < untilMs };
}

/**
 * The time „Zaczynam post” suggests: the last entry eaten today up to now (the fast starts when
 * eating stops), else now. Only a suggestion — the person saves it.
 */
export function suggestedStart(todayEntries: readonly Pick<Entry, 'time'>[], now: Date): string {
  const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const last = todayEntries
    .map((e) => e.time)
    .filter((t) => t <= current)
    .sort()
    .at(-1);
  return last ?? current;
}

/** A start typed as HH:MM: today, or yesterday when that time is still ahead today (20:15 typed at 00:30). */
export function startFrom(time: string, now: Date): string {
  const stamp = `${localStamp(now).slice(0, 10)}T${time}`;
  if (parseStamp(stamp).getTime() <= now.getTime()) return stamp;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${localStamp(yesterday).slice(0, 10)}T${time}`;
}

/** Minutes as hours and minutes: 220 → 3 h 40 min. */
export function hoursMinutes(minutes: number): { h: number; min: number } {
  return { h: Math.floor(minutes / 60), min: minutes % 60 };
}
