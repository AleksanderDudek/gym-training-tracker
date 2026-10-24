import { LOCALE, text } from '../../../i18n';
import { dietPath } from '../../../routing';
import { r10 } from '../../diet/target';
import { formatNumber } from '../../lib/format';

/**
 * Number and date words shared by the diet screens (spec §4 conventions): targets as stored,
 * „ok.” amounts rounded to 10, paces with up to two decimals, Polish CLDR numbers („1950”,
 * „10 000”; English „1,950”). Dates are calendar dates (YYYY-MM-DD) read at noon UTC.
 */

const T = text({
  pl: {
    ok: (kcal: string) => `ok. ${kcal} kcal`,
    keep: 'utrzymanie',
    /** „31.10” — the month as two digits. */
    dayMonth: { day: 'numeric', month: '2-digit' } as Intl.DateTimeFormatOptions,
  },
  en: {
    ok: (kcal: string) => `about ${kcal} kcal`,
    keep: 'maintenance',
    /** "31 Oct". */
    dayMonth: { day: 'numeric', month: 'short' } as Intl.DateTimeFormatOptions,
  },
});

const noon = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`);
const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, { ...T.dayMonth, timeZone: 'UTC' });
const DAY_MONTH_LONG = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', timeZone: 'UTC' });
/** Without a day the month stands alone — in Polish the nominative („luty”, not „lutego”). */
const MONTH = new Intl.DateTimeFormat(LOCALE, { month: 'long', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** „1950 kcal” — whole kcal. */
export const kcalText = (kcal: number): string => `${formatNumber(Math.round(kcal), 0)} kcal`;

/** „ok. 650 kcal” — rounded to 10, for what is left or over. */
export const okKcal = (kcal: number): string => T.ok(formatNumber(r10(kcal), 0));

/** The plan's pace as a weight change a week: „−0,5 kg” (losing), „utrzymanie”, „+0,25 kg” (gaining). */
export function paceWord(pace: number): string {
  if (Math.abs(pace) < 0.005) return T.keep;
  return `${pace > 0 ? '−' : '+'}${formatNumber(Math.abs(pace), 2)} kg`;
}

/** „31.10” / "31 Oct". */
export const dayMonth = (date: string): string => DAY_MONTH.format(noon(date));

/** „7 listopada” / "7 November". */
export const dayMonthLong = (date: string): string => DAY_MONTH_LONG.format(noon(date));

/**
 * The months of a reach range: „marzec 2027” (one month, or no late end), „luty–kwiecień 2027”
 * (one year), „grudzień 2026 – luty 2027” (across a new year). Dates or YYYY-MM.
 */
export function monthRange(early: string, late: string | null): string {
  const from = early.slice(0, 7);
  const to = late?.slice(0, 7);
  const at = (month: string) => noon(`${month}-15`);
  if (!to || to === from) return MONTH_YEAR.format(at(from));
  if (to.slice(0, 4) === from.slice(0, 4)) return `${MONTH.format(at(from))}–${MONTH_YEAR.format(at(to))}`;
  return `${MONTH_YEAR.format(at(from))} – ${MONTH_YEAR.format(at(to))}`;
}

/** „Jak liczę cel” on the diet profile, opened and scrolled to. */
export const howHref = `${dietPath('profile')}?jak=1`;
