import { LOCALE, pluralEn, text } from '../../../i18n';
import { plural } from '../../lib/format';
import { formatDistance } from '../../nearby/geo';
import type { OpenState } from '../../nearby/hours';
import type { PlaceKind } from '../../nearby/places';

/** Words shared by the „Zjedz teraz” map, list and place card. */
export const ET = text({
  pl: {
    walk: (min: number) => `${min} min pieszo`,
    openUntil: (time: string) => (time === '24:00' ? 'otwarte do północy' : `otwarte do ${time}`),
    openAllDay: 'otwarte całą dobę',
    closed: 'zamknięte',
    opensAt: (when: string) => `zamknięte · otwiera ${when}`,
    today: (time: string) => `o ${time}`,
    tomorrow: (time: string) => `jutro o ${time}`,
    onDay: (day: string, time: string) => `${day} o ${time}`,
    hoursUnknown: 'godziny otwarcia nieznane',
    kinds: {
      fast_food: 'Fast food',
      restaurant: 'Restauracja',
      cafe: 'Kawiarnia',
      fuel: 'Stacja paliw',
      food_court: 'Strefa gastronomiczna',
      ice_cream: 'Lodziarnia',
      bakery: 'Piekarnia i cukiernia',
      shop: 'Sklep',
    } as Record<PlaceKind, string>,
    options: (n: number) => `${n} ${plural(n, 'pozycja pasuje', 'pozycje pasują', 'pozycji pasuje')}`,
  },
  en: {
    walk: (min: number) => `${min} min walk`,
    openUntil: (time: string) => (time === '24:00' ? 'open until midnight' : `open until ${time}`),
    openAllDay: 'open 24 hours',
    closed: 'closed',
    opensAt: (when: string) => `closed · opens ${when}`,
    today: (time: string) => `at ${time}`,
    tomorrow: (time: string) => `tomorrow at ${time}`,
    onDay: (day: string, time: string) => `${day} at ${time}`,
    hoursUnknown: 'opening hours unknown',
    kinds: {
      fast_food: 'Fast food',
      restaurant: 'Restaurant',
      cafe: 'Café',
      fuel: 'Petrol station',
      food_court: 'Food court',
      ice_cream: 'Ice cream',
      bakery: 'Bakery',
      shop: 'Shop',
    } as Record<PlaceKind, string>,
    options: (n: number) => `${n} ${pluralEn(n, 'item fits', 'items fit')}`,
  },
});

const WEEKDAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
// 2026-10-18 was a Sunday: day 0 of the week, as `getDay` counts.
const weekday = (day: number) => WEEKDAY.format(new Date(2026, 9, 18 + day));

/** „8:00” rather than „08:00” — how a time reads in a sentence. */
const time = (hhmm: string) => hhmm.replace(/^0(\d)/, '$1');

/** „otwarte do 22:00”, „zamknięte · otwiera jutro o 7:00”; `null` hours say nothing. */
export function openText(open: OpenState | null, now: Date): string | null {
  if (!open) return null;
  if (open.open) return open.closesAt ? ET.openUntil(time(open.closesAt)) : ET.openAllDay;
  if (!open.opensAt) return ET.closed;
  const pad = (n: number) => String(n).padStart(2, '0');
  // The same weekday at an hour already past is next week's.
  const sameDay = (open.opensAt.day - now.getDay() + 7) % 7;
  const ahead = sameDay === 0 && open.opensAt.time <= `${pad(now.getHours())}:${pad(now.getMinutes())}` ? 7 : sameDay;
  const t = time(open.opensAt.time);
  return ET.opensAt(ahead === 0 ? ET.today(t) : ahead === 1 ? ET.tomorrow(t) : ET.onDay(weekday(open.opensAt.day), t));
}

/** „350 m · 4 min pieszo”. */
export const distanceText = (meters: number, walkMin: number) => `${formatDistance(meters)} · ${ET.walk(walkMin)}`;
