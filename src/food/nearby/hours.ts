/**
 * OpenStreetMap `opening_hours` -> "is it open now?", for the part of the syntax restaurants and
 * shops actually use (wiki.openstreetmap.org/wiki/Key:opening_hours/specification).
 * Anything outside that part gives `null`: on a "where to eat now" list no answer beats a wrong one.
 */

export interface OpenState {
  open: boolean;
  /**
   * Open: when it closes next, "HH:MM" (local; midnight is "24:00", as OpenStreetMap writes it);
   * null when it does not close within the next 24 h (24/7 or a range running on).
   */
  closesAt: string | null;
  /** Closed: when it opens next — weekday 0 (Sunday) … 6 and "HH:MM"; null when not within the next 7 days. */
  opensAt: { day: number; time: string } | null;
}

const DAY = 24 * 60;

/** Index = `Date#getDay()`. */
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const WD = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const SELECTOR_ITEM = `(?:${WD}(?:-${WD})?|PH)`;
/** An optional weekday selector, a space, the rest. A selector with nothing after it is not matched on purpose. */
const RULE = new RegExp(`^(?:(${SELECTOR_ITEM}(?:,${SELECTOR_ITEM})*) )?(.+)$`);
const TIME_RANGE = /^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2})|(\+))$/;

/** Minutes from the start of the day the range starts on; a range past midnight ends above 1440. */
type Range = [start: number, end: number];

interface Rule {
  /** Weekdays (0 = Sunday); null for a public-holiday-only rule, which is skipped. */
  days: number[] | null;
  /** Empty: `off` / `closed`. */
  ranges: Range[];
  /** After `,` (the spec's "additional rule"): adds to the days' hours instead of replacing them. */
  additive: boolean;
}

/** `PH` is dropped: the app does not know the holidays, and `Su,PH off` still says Sunday is off. */
function parseDays(selector: string): number[] | null {
  const days = new Set<number>();
  for (const item of selector.split(',')) {
    if (item === 'PH') continue;
    const [from, to = from] = item.split('-').map((wd) => WEEKDAYS.indexOf(wd));
    // `Fr-Mo` wraps through the weekend.
    for (let day = from!; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === to) break;
    }
  }
  return days.size ? [...days] : null;
}

function parseRange(source: string): Range | null {
  const match = source.match(TIME_RANGE);
  if (!match) return null;
  const [, sh, sm, eh, em, openEnd] = match;
  const start = Number(sh) * 60 + Number(sm);
  if (Number(sh) > 23 || Number(sm) > 59) return null;
  // `18:00+` has no closing time; until midnight is the answer that is never too generous.
  if (openEnd) return [start, DAY];
  // Extended hours (`22:00-26:00`) are valid OSM and mean the same as `22:00-02:00`.
  const end = Number(eh) * 60 + Number(em);
  if (Number(em) > 59 || end > 2 * DAY) return null;
  return [start, end <= start ? end + DAY : end];
}

function parseRule(source: string, additive: boolean): Rule | null {
  if (source === '24/7') return { days: EVERY_DAY, ranges: [[0, DAY]], additive };
  const [, selector, body = ''] = source.match(RULE) ?? [];
  const days = selector ? parseDays(selector) : EVERY_DAY;
  if (/^(?:off|closed)$/i.test(body)) return { days, ranges: [], additive };
  const ranges = body.split(',').map(parseRange);
  if (ranges.some((range) => !range)) return null;
  return { days, ranges: ranges as Range[], additive };
}

/**
 * A `,` separates rules only after a time or `off` and before a weekday (`Mo-Fr 08:00-20:00, Sa
 * 09:00-14:00`); elsewhere it lists days (`Mo,We`) or times (`08:00-12:00,13:00-18:00`).
 */
function splitAdditional(part: string): string[] {
  const rules: string[] = [];
  let start = 0;
  for (let i = part.indexOf(','); i !== -1; i = part.indexOf(',', i + 1)) {
    if (/(?:[\d+]|\boff|\bclosed)$/i.test(part.slice(start, i)) && /^[A-Z]/.test(part.slice(i + 1))) {
      rules.push(part.slice(start, i));
      start = i + 1;
    }
  }
  rules.push(part.slice(start));
  return rules;
}

function parseRules(spec: string): Rule[] | null {
  // Spaces around `-`, `,` and `;` are a common slip that changes nothing.
  const normalized = spec.replace(/\s+/g, ' ').replace(/ ?([-,;]) ?/g, '$1').trim();
  const rules: Rule[] = [];
  for (const part of normalized.split(';')) {
    if (!part) continue; // a trailing `;`
    for (const [i, source] of splitAdditional(part).entries()) {
      const rule = parseRule(source, i > 0);
      if (!rule) return null;
      rules.push(rule);
    }
  }
  return rules;
}

/**
 * Hours per weekday, in rule order: a `;` rule replaces the hours of the days it names, a `,` rule
 * adds to them, `off` clears them. A range past midnight stays with the day it starts on, so
 * `Fr-Sa 11:00-02:00; Su 12:00-22:00` is open on Sunday at 01:00. The spec would let the Sunday
 * rule cut those two hours off, which its own page calls "probably not intended": mappers write
 * it meaning Saturday night.
 */
function weekHours(rules: Rule[]): Range[][] | null {
  const week: Range[][] = EVERY_DAY.map(() => []);
  let understood = false;
  for (const rule of rules) {
    if (!rule.days) continue;
    understood = true;
    for (const day of rule.days) {
      week[day] = rule.additive && rule.ranges.length ? [...(week[day] ?? []), ...rule.ranges] : [...rule.ranges];
    }
  }
  // Only holiday rules: nothing is known about an ordinary day.
  return understood ? week : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const minuteOfDay = (minutes: number) => ((minutes % DAY) + DAY) % DAY;

/** `null`: no spec, or a spec this parser does not fully understand — the caller shows nothing rather than a wrong answer. */
export function openState(spec: string | null | undefined, at: Date): OpenState | null {
  if (!spec?.trim()) return null;
  const rules = parseRules(spec);
  const week = rules && weekHours(rules);
  if (!week) return null;

  // Wall-clock minutes from today's local midnight: the device is where the place is, and an
  // hour lost or gained to DST does not move "closes at 22:00".
  const today = at.getDay();
  const now = at.getHours() * 60 + at.getMinutes();

  // Two days back catches a range that started yesterday and runs on; eight ahead covers "opens
  // within 7 days". Back-to-back ranges merge, so `Mo-Su 00:00-24:00` is one open span.
  const spans: Range[] = [];
  for (let offset = -2; offset <= 8; offset++) {
    for (const [start, end] of week[(today + offset + 7) % 7] ?? []) spans.push([offset * DAY + start, offset * DAY + end]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push(span);
  }

  const current = merged.find(([start, end]) => start <= now && now < end);
  if (current) {
    const end = current[1];
    return { open: true, closesAt: end - now >= DAY ? null : clock(minuteOfDay(end) || DAY), opensAt: null };
  }
  const next = merged.find(([start]) => start > now && start - now <= 7 * DAY);
  return {
    open: false,
    closesAt: null,
    opensAt: next ? { day: (today + Math.floor(next[0] / DAY)) % 7, time: clock(minuteOfDay(next[0])) } : null,
  };
}
