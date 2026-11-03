/**
 * Zapis kalendarza w formacie iCalendar (RFC 5545) i adres formularza wydarzenia Kalendarza
 * Google. Czysty moduł, bez wiedzy o treningach: dostaje gotowe wydarzenia z `calendar.ts`.
 *
 * Plik .ics trzyma się tego, co czytają Apple Calendar, Outlook i import w Google:
 * - wiersze kończą się CRLF i są łamane po 75 oktetach (bajtach UTF-8, nie znakach), a ciąg
 *   dalszy zaczyna się spacją — polska litera nie może się przy tym rozciąć na pół;
 * - tekst ma ucieczki `\\`, `\;`, `\,` i `\n`;
 * - czasy są w UTC (`…Z`), więc plik nie potrzebuje bloku VTIMEZONE: każde wydarzenie jest
 *   przeliczone osobno z czasu telefonu, zmiana czasu niczego nie przesuwa;
 * - stały `UID` każdego wydarzenia: ponowny import nadpisuje zamiast dublować, a rosnący
 *   `SEQUENCE` mówi kalendarzowi, że to nowsza wersja.
 */

export interface IcsEvent {
  /** Stały identyfikator, np. `trening-2026-11-05@gym-tracker`. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  /** Przypomnienie: tyle minut przed początkiem. */
  alarmMin?: number;
  categories?: string[];
}

export interface IcsOptions {
  /** Chwila utworzenia pliku — `DTSTAMP` i podstawa `SEQUENCE`. */
  stamp: Date;
  /** Nazwa kalendarza, którą pokazują Apple Calendar i Outlook (`X-WR-CALNAME`). */
  name: string;
}

export const PRODID = '-//GYM TRACKER//Kalendarz 1.0//PL'; // i18n-ignore: identyfikator formatu

const CRLF = '\r\n';
/** Najdłuższy wiersz w oktetach, bez CRLF (RFC 5545, 3.1). */
const LINE_OCTETS = 75;

const utf8 = new TextEncoder();
const octets = (s: string): number => utf8.encode(s).length;

/** Ucieczki w wartości typu TEXT (RFC 5545, 3.3.11). Nowa linia w każdej postaci to `\n`. */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Łamanie wiersza po 75 oktetach. Liczy bajty UTF-8 całych znaków (także par zastępczych),
 * więc ani „ł”, ani emoji nie rozpadają się między dwa wiersze. Ciąg dalszy zaczyna się spacją,
 * która też jest oktetem — stąd 74 na treść w każdym następnym wierszu.
 */
export function foldLine(line: string): string {
  if (octets(line) <= LINE_OCTETS) return line;
  const out: string[] = [];
  let cur = '';
  let size = 0;
  let limit = LINE_OCTETS;
  for (const ch of line) {
    const n = octets(ch);
    if (size + n > limit) {
      out.push(cur);
      cur = '';
      size = 0;
      limit = LINE_OCTETS - 1;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** Chwila w UTC: `20261105T170000Z`. */
export function icsUtc(d: Date): string {
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Czas trwania przed wydarzeniem: `-PT60M`, `-PT13H`. */
const trigger = (min: number): string => (min % 60 === 0 ? `-PT${min / 60}H` : `-PT${min}M`);

/** Numer wersji z chwili zapisu: minuty od początku 2026 roku, zawsze rosnąco i w zakresie liczby całkowitej. */
const sequenceOf = (stamp: Date): number => Math.max(0, Math.floor((stamp.getTime() - Date.UTC(2026, 0, 1)) / 60_000));

export function icsCalendar(events: readonly IcsEvent[], opts: IcsOptions): string {
  const stamp = icsUtc(opts.stamp);
  const seq = sequenceOf(opts.stamp);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.name)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${seq}`,
      `DTSTART:${icsUtc(e.start)}`,
      `DTEND:${icsUtc(e.end)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(icsEscape).join(',')}`);
    lines.push('TRANSP:OPAQUE');
    if (e.alarmMin !== undefined && e.alarmMin > 0) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(e.summary)}`,
        `TRIGGER:${trigger(e.alarmMin)}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/* ---------------- Kalendarz Google ---------------- */

/** Data i godzina w czasie telefonu, bez strefy: `2026-11-05` i `18:00`. */
export interface LocalTime {
  date: string;
  at: string;
}

/** Czas lokalny bez strefy: `20261105T180000` — Google czyta go w strefie z `ctz`. */
export function localStamp(t: LocalTime, plusMin = 0): string {
  const [y, m, d] = t.date.split('-').map(Number);
  const [hh, mm] = t.at.split(':').map(Number);
  // Rachunek na zegarze UTC tylko jako liczydło: dodanie minut przechodzi przez północ
  // bez udziału strefy maszyny.
  const x = new Date(Date.UTC(y!, m! - 1, d!, hh!, mm! + plusMin));
  return `${pad(x.getUTCFullYear(), 4)}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}00`;
}

export interface GoogleEvent {
  text: string;
  start: LocalTime;
  minutes: number;
  /** Strefa IANA telefonu, np. `Europe/Warsaw`. */
  ctz: string;
  /** Reguła powtarzania bez przedrostka `RRULE:`, np. `FREQ=WEEKLY;BYDAY=MO,TH`. */
  rrule?: string;
  details?: string;
}

export const GOOGLE_TEMPLATE = 'https://calendar.google.com/calendar/render';

/**
 * Adres formularza „nowe wydarzenie” w Kalendarzu Google. `recur` i `ctz` nie są w oficjalnej
 * dokumentacji (opisują je biblioteki `datebook`, `calendar-link`), ale Google je czyta: z `ctz`
 * godzina zostaje 18:00 także po zmianie czasu. Daty idą bez kodowania (cyfry, `T` i `/`),
 * reszta przez `encodeURIComponent`.
 */
export function googleTemplateUrl(e: GoogleEvent): string {
  const q: string[] = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(e.text)}`,
    `dates=${localStamp(e.start)}/${localStamp(e.start, e.minutes)}`,
    `ctz=${encodeURIComponent(e.ctz)}`,
  ];
  if (e.rrule) q.push(`recur=${encodeURIComponent(`RRULE:${e.rrule}`)}`);
  if (e.details) q.push(`details=${encodeURIComponent(e.details)}`);
  return `${GOOGLE_TEMPLATE}?${q.join('&')}`;
}

/** Dni tygodnia RFC 5545, 1 = poniedziałek … 7 = niedziela. */
export const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export const byDay = (weekdays: readonly number[]): string =>
  [...new Set(weekdays)]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .map((d) => BYDAY[d - 1])
    .join(',');
