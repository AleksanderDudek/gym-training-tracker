import { paceText } from '../diet/model';
import { formatNumber, plural } from '../lib/format';
import { LOCALE, pluralEn, text } from '../../i18n';

const T = text({
  pl: {
    portion: (n: number) => `${n} ${plural(n, 'porcja', 'porcje', 'porcji')}`,
    part: (mixed: string, _n: number) => `${mixed} porcji`,
    one: '1 porcji',
    losing: (pace: string) => `Redukcja · ${pace}`,
    gaining: (pace: string) => `Budowanie masy · ${pace}`,
    keeping: 'Utrzymanie wagi',
  },
  en: {
    portion: (n: number) => `${n} ${pluralEn(n, 'serving', 'servings')}`,
    part: (mixed: string, n: number) => `${mixed} ${n < 1 ? 'serving' : 'servings'}`,
    one: '1 serving',
    losing: (pace: string) => `Losing weight · ${pace}`,
    gaining: (pace: string) => `Building mass · ${pace}`,
    keeping: 'Keeping weight',
  },
});

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** 1.25 → "1¼", 0.5 → "½", 3 → "3"; anything else with a decimal comma. */
export function mixed(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const rest = Math.round((n - whole) * 100) / 100;
  const fraction = FRACTIONS[rest];
  if (rest === 0) return String(whole);
  if (fraction) return whole ? `${whole}${fraction}` : fraction;
  return formatNumber(n, 2);
}

/**
 * "1 porcja", "2 porcje", "5 porcji" — and with a fraction always "porcji" ("1½ porcji"), as
 * Polish counts a part of something.
 */
export function portionLabel(n: number): string {
  const whole = Number.isInteger(Math.round(n * 100) / 100);
  if (!whole) return T.part(mixed(n), n);
  return T.portion(n);
}

/** After „po” („4 pudełka po …”): one is „1 porcji”, the rest as `portionLabel` („po ¾ porcji”, „po 2 porcje”). */
export const portionAfterPo = (n: number): string => (n === 1 ? T.one : portionLabel(n));

const DAY_MONTH = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });
const WEEKDAY_LONG = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

const at = (date: string) => new Date(`${date}T12:00:00Z`);

/** "20–26 paź", or "28 paź – 3 lis" across a month. */
export function rangeLabel(start: string, end: string): string {
  const [a, b] = [DAY_MONTH.format(at(start)), DAY_MONTH.format(at(end))];
  const [dayA, monthA] = a.split(' ');
  const [dayB, monthB] = b.split(' ');
  return monthA === monthB ? `${dayA}–${dayB} ${monthB}` : `${a} – ${b}`;
}

/** "wt.", "niedz.": a day in a list of days. */
export const weekday = (date: string): string => WEEKDAY.format(at(date));

/** "wt., 20 paź". */
export const shortDate = (date: string): string => `${weekday(date)}, ${DAY_MONTH.format(at(date))}`;

/** "wtorek, 20 października". */
export const longDate = (date: string): string => WEEKDAY_LONG.format(at(date));

/** "wt.–pt." for the days a batch is eaten; one day is just that day. */
export function weekdaySpan(dates: readonly string[]): string {
  if (!dates.length) return '';
  const first = weekday(dates[0]!);
  const last = weekday(dates[dates.length - 1]!);
  return dates.length === 1 ? first : `${first}–${last}`;
}

/** Grams for a shopping or cooking line: "850 g", "1,25 kg" from a kilogram up. */
export function gramsLabel(grams: number): string {
  if (grams >= 1000) return `${formatNumber(grams / 1000, 2)} kg`;
  return `${formatNumber(roundGrams(grams), 0)} g`;
}

/** Kitchen precision: whole grams under 10 g (a pinch of cinnamon), 5 g under 100 g, 10 g above. */
export function roundGrams(grams: number): number {
  if (grams < 10) return Math.max(1, Math.round(grams));
  const step = grams < 100 ? 5 : 10;
  return Math.round(grams / step) * step;
}

/** Losing, keeping or gaining, by what the goal does at this weight (the model's pace, + is losing). */
export function goalName(pace: number): string {
  if (pace > 0.05) return T.losing(paceText(pace));
  if (pace < -0.05) return T.gaining(paceText(pace));
  return T.keeping;
}
