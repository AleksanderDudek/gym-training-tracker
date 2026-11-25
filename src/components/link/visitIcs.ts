import { PRODID, foldLine, icsEscape, icsUtc } from '../../engine/ics';
import { text } from '../../i18n';
import type { Booking } from '../../link/rpc';
import { localDay, videoLink } from '../../link/visits';

/**
 * Jedna wizyta jako plik .ics — „Dodaj do kalendarza” na stronie wizyt. Te same zasady co eksport
 * kalendarza (`engine/ics`: UTC, łamanie po 75 oktetach, ucieczki), plus to, czego tam nie ma:
 * `LOCATION` z adresem sali albo `URL` z linkiem do rozmowy. Stały `UID` z numeru rezerwacji —
 * ponowne dodanie nadpisuje, zamiast dublować.
 */

/** Przypomnienie godzinę przed wizytą. */
export const VISIT_ALARM_MIN = 60;

const T = text({
  pl: { video: 'Rozmowa wideo', with: (title: string, coach: string) => `${title} — ${coach}` },
  en: { video: 'Video call', with: (title: string, coach: string) => `${title} — ${coach}` },
});

const sequenceOf = (stamp: Date): number => Math.max(0, Math.floor((stamp.getTime() - Date.UTC(2026, 0, 1)) / 60_000));

export function visitIcs(b: Booking, coach: string, stamp: Date): string {
  const link = videoLink(b.place);
  const place = b.place?.trim() || null;
  const summary = T.with(b.title, coach);
  const description = [link ? `${T.video}: ${link}` : null, b.note?.trim() || null].filter((x): x is string => !!x).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:wizyta-${b.id}@gym-tracker`,
    `DTSTAMP:${icsUtc(stamp)}`,
    `SEQUENCE:${sequenceOf(stamp)}`,
    `DTSTART:${icsUtc(new Date(b.startsAt))}`,
    `DTEND:${icsUtc(new Date(b.endsAt))}`,
    `SUMMARY:${icsEscape(summary)}`,
    ...(place && !link ? [`LOCATION:${icsEscape(place)}`] : []),
    ...(link ? [`URL:${link}`] : []),
    ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
    `STATUS:${b.cancelledAt ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(summary)}`,
    `TRIGGER:-PT${VISIT_ALARM_MIN}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** `wizyta-2026-12-01.ics` — dzień wizyty w czasie telefonu. */
export const visitIcsName = (b: Booking): string => `wizyta-${localDay(Date.parse(b.startsAt))}.ics`;

/** Pobranie pliku — jak w kalendarzu: adres z chwilą zwłoki dla Safari. */
export function downloadIcs(name: string, ics: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
