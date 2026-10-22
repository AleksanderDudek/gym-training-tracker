import { LOCALE } from '../../i18n';

const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, maxDigits = 1): string {
  let format = numberFormats.get(maxDigits);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxDigits });
    numberFormats.set(maxDigits, format);
  }
  return format.format(value);
}

export const UNKNOWN = '–';

export function formatGrams(value: number | null): string {
  return value === null ? UNKNOWN : `${formatNumber(value)} g`;
}

export function formatKcal(value: number | null): string {
  return value === null ? UNKNOWN : `${formatNumber(value, 0)} kcal`;
}

const priceFormat = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PLN' });

export function formatPrice(value: number): string {
  return priceFormat.format(value);
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-10-08` -> `8 paź 2026`. Read as UTC so the day never shifts. */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/**
 * Polish noun forms after a number: 1 sklep, 2-4 sklepy (but 12-14 sklepów),
 * everything else sklepów - including 0, 5-21 and 25.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}
