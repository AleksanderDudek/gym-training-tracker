import { LOCALE, text } from '../../i18n';
import type { DayTotals } from './day';
import type { MacroTargets } from './profiles';
import type { Remaining } from './suggest';
import { formatNumber } from '../lib/format';

/**
 * What every diet screen shares: calendar dates and their labels, the pace in words, the meals
 * still ahead and what is left of a day's targets. Dates are calendar dates (YYYY-MM-DD) handled
 * at noon UTC, so no time zone can move them a day.
 */

const at = (date: string) => new Date(`${date}T12:00:00Z`);

export function addDays(date: string, days: number): string {
  const d = at(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((at(to).getTime() - at(from).getTime()) / 86_400_000);
}

export function mondayOf(date: string): string {
  return addDays(date, -((at(date).getUTCDay() + 6) % 7));
}

const LONG = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'UTC' });

const T = text({
  pl: { today: 'Dziś', yesterday: 'Wczoraj', tomorrow: 'Jutro', perWeek: 'kg/tydz.' },
  en: { today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', perWeek: 'kg/wk' },
});

/** "Dziś", "Wczoraj", "Jutro", otherwise "poniedziałek, 12 października". */
export function dayLabel(date: string, today: string): string {
  const offset = daysBetween(today, date);
  if (offset === 0) return T.today;
  if (offset === -1) return T.yesterday;
  if (offset === 1) return T.tomorrow;
  return LONG.format(at(date));
}

export const shortDay = (date: string) => SHORT.format(at(date));

/**
 * Tempo as a change of weight: "−0,5 kg/tydz." is losing, "+0,25 kg/tydz." gaining (the energy
 * model's pace is positive when losing). Below 5 g a week there is no sign.
 */
export function paceText(pace: number): string {
  const sign = pace >= 0.005 ? '−' : pace <= -0.005 ? '+' : '';
  return `${sign}${formatNumber(Math.abs(pace), 2)} ${T.perWeek}`;
}
export const longDay = (date: string) => LONG.format(at(date));

/** Meals still ahead at this hour, the current one included: a day of four meals winds down. */
export function mealsLeftAt(hour: number): number {
  if (hour < 11) return 4;
  if (hour < 15) return 3;
  if (hour < 19) return 2;
  return 1;
}

/** What is left of the day's targets. Carbohydrates count down to the LIMIT when the profile has one. */
export function remainingOf(targets: MacroTargets, eaten: DayTotals): Remaining {
  return {
    kcal: targets.kcal - eaten.kcal,
    protein: targets.protein.target - eaten.protein,
    carbs: (targets.carbs.max ?? targets.carbs.target) - eaten.carbs,
    fat: targets.fat.target - eaten.fat,
  };
}
