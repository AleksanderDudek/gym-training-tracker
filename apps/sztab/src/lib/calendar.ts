import { foldLine, icsEscape, icsUtc } from '@gt/engine/ics';
import { text } from '@gt/i18n';
import type { BookingRow, SlotRow } from './data';

/**
 * Kalendarz wizyt bez Reacta i bez sieci: tydzień od poniedziałku, termin powtarzany co tydzień,
 * sprawdzenie formularza „Nowy termin” i plik .ics.
 *
 * Wszystko w czasie przeglądarki prowadzącego. Dni liczymy kalendarzowo (`new Date(r, m, d + n)`),
 * nie dodając 24 godzin, więc zmiana czasu nie przesuwa ani północy, ani godziny terminu: wizyta
 * „we wtorek o 18:00” po przestawieniu zegarów dalej jest o 18:00. Czas trwania to prawdziwe
 * minuty (koniec = początek + minuty), tak jak sprawdza go baza (najwyżej 12 godzin).
 */

export const MINUTE = 60_000;
/** Szybkie wybory długości w formularzu. */
export const DURATIONS = [30, 45, 60, 90] as const;
/** Najwięcej tygodni powtarzania naraz. */
export const MAX_WEEKS = 12;
/** Limity z bazy (`slots`): miejsca 1–50, do 12 godzin, tytuł do 80 znaków, miejsce do 300, notatka do 500. */
export const MAX_CAPACITY = 50;
export const MAX_MINUTES = 12 * 60;
export const MIN_MINUTES = 5;
export const MAX_TITLE = 80;
export const MAX_PLACE = 300;
export const MAX_NOTE = 500;
/** Plik .ics obejmuje tyle dni naprzód — najdłuższe powtarzanie (12 tygodni) z zapasem. */
export const EXPORT_DAYS = 91;

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** Dzień w czasie lokalnym: `2026-11-25`. */
export const dayKey = (d: Date): string => `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Godzina w czasie lokalnym: `18:05`. */
export const timeKey = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** `RRRR-MM-DD` → północ tego dnia w czasie lokalnym; `null`, gdy to nie jest prawdziwa data. */
export function parseDay(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dayKey(d) === s ? d : null;
}

/** `GG:MM` → minuty od północy; `null`, gdy to nie godzina. */
export function parseTime(s: string): number | null {
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Tyle dni kalendarzowych dalej, o północy. */
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Poniedziałek tygodnia, w którym leży `d`, o północy. */
export const startOfWeek = (d: Date): Date => addDays(d, -((d.getDay() + 6) % 7));

export interface WeekDay<T> {
  key: string;
  date: Date;
  today: boolean;
  past: boolean;
  slots: T[];
}

/**
 * Siedem dni od poniedziałku, w każdym terminy, które się w nim zaczynają (od najwcześniejszego).
 * Termin przez północ zostaje w dniu początku; spoza tygodnia — odpada.
 */
export function weekGrid<T extends { startsAt: string }>(weekStart: Date, slots: readonly T[], now: Date = new Date()): WeekDay<T>[] {
  const today = dayKey(now);
  const days: WeekDay<T>[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = dayKey(date);
    return { key, date, today: key === today, past: key < today, slots: [] };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const s of [...slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    byKey.get(dayKey(new Date(s.startsAt)))?.slots.push(s);
  }
  return days;
}

/**
 * Początki terminu powtarzanego co tydzień: ten sam dzień tygodnia i ta sama godzina na zegarze,
 * także po zmianie czasu (w UTC odstęp bywa wtedy 167 albo 169 godzin). `weeks` = ile terminów.
 */
export function weeklyStarts(date: string, time: string, weeks: number): Date[] {
  const day = parseDay(date);
  const min = parseTime(time);
  if (!day || min === null || !Number.isFinite(weeks)) return [];
  const n = Math.max(1, Math.min(MAX_WEEKS, Math.floor(weeks)));
  return Array.from({ length: n }, (_, i) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + 7 * i, Math.floor(min / 60), min % 60));
}

/** Link do rozmowy wideo — tylko pełny adres `https://` bez spacji; inaczej `null` (miejsce to adres sali). */
export function videoLink(place: string | null | undefined): string | null {
  const p = place?.trim();
  if (!p || !/^https:\/\/\S+$/i.test(p)) return null;
  try {
    const u = new URL(p);
    return u.protocol === 'https:' && u.hostname.includes('.') ? p : null;
  } catch {
    return null;
  }
}

/** Wygląda na link (ktoś wkleił adres), ale nie jest poprawnym `https://` — wtedy prosimy o poprawkę. */
const looksLikeLink = (p: string): boolean => /^(https?:|www\.)/i.test(p) || p.includes('://');

/* ── Formularz „Nowy termin” ─────────────────────────────────────────────────────────── */

export interface SlotDraft {
  /** `RRRR-MM-DD`. */
  date: string;
  /** `GG:MM`. */
  time: string;
  minutes: number;
  title: string;
  capacity: number;
  /** Adres sali albo link `https://` do rozmowy. */
  place: string;
  note: string;
  repeat: boolean;
  /** Ile terminów, gdy `repeat` (2–12). */
  weeks: number;
}

export type DraftProblem = 'date' | 'time' | 'past' | 'minutes' | 'title' | 'capacity' | 'place' | 'link' | 'note' | 'weeks';

const intIn = (n: number, lo: number, hi: number): boolean => Number.isInteger(n) && n >= lo && n <= hi;

/** Co w formularzu nie przejdzie — w kolejności pól. Pusta lista: można zapisać. */
export function draftProblems(d: SlotDraft, now: Date): DraftProblem[] {
  const out: DraftProblem[] = [];
  const day = parseDay(d.date);
  const min = parseTime(d.time);
  if (!day) out.push('date');
  if (min === null) out.push('time');
  if (day && min !== null && (weeklyStarts(d.date, d.time, 1)[0]?.getTime() ?? 0) <= now.getTime()) out.push('past');
  if (!intIn(d.minutes, MIN_MINUTES, MAX_MINUTES)) out.push('minutes');
  const title = d.title.trim();
  if (!title || title.length > MAX_TITLE) out.push('title');
  if (!intIn(d.capacity, 1, MAX_CAPACITY)) out.push('capacity');
  const place = d.place.trim();
  if (place.length > MAX_PLACE) out.push('place');
  else if (place && looksLikeLink(place) && !videoLink(place)) out.push('link');
  if (d.note.trim().length > MAX_NOTE) out.push('note');
  if (d.repeat && !intIn(d.weeks, 2, MAX_WEEKS)) out.push('weeks');
  return out;
}

export interface SlotInput {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  title: string;
  place: string;
  note: string;
}

/** Wiersze do `createSlots`: jeden termin albo tyle, ile tygodni powtarzania. */
export function draftRows(d: SlotDraft): SlotInput[] {
  return weeklyStarts(d.date, d.time, d.repeat ? d.weeks : 1).map((startsAt) => ({
    startsAt,
    endsAt: new Date(startsAt.getTime() + d.minutes * MINUTE),
    capacity: d.capacity,
    title: d.title.trim(),
    place: d.place.trim(),
    note: d.note.trim(),
  }));
}

/**
 * Domyślny początek nowego terminu: wybrany dzień (albo dziś) o 18:00; dziś po 17:00 — najbliższa
 * pełna godzina, a od 22:00 — jutro o 18:00. Dzień, który minął, zamienia się na dziś.
 */
export function defaultStart(day: string | null, now: Date): { date: string; time: string } {
  const today = dayKey(now);
  const date = day && day > today ? day : today;
  if (date !== today || now.getHours() < 17) return { date, time: '18:00' };
  if (now.getHours() >= 22) return { date: dayKey(addDays(now, 1)), time: '18:00' };
  return { date, time: `${pad(now.getHours() + 1)}:00` };
}

/* ── Rezerwacje ──────────────────────────────────────────────────────────────────────── */

/** Rezerwacje, które trwają (nieodwołane), na jeden termin. */
export const activeBookings = (slotId: string, bookings: readonly BookingRow[]): BookingRow[] =>
  bookings.filter((b) => b.slotId === slotId && !b.cancelledAt);

/* ── Plik .ics ───────────────────────────────────────────────────────────────────────── */

const T = text({
  pl: {
    booked: (n: number, cap: number) => `Zapisani (${n} z ${cap})`,
    nobody: (cap: number) => `Nikt się jeszcze nie zapisał (miejsc: ${cap}).`,
    video: 'Rozmowa wideo',
  },
  en: {
    booked: (n: number, cap: number) => `Booked (${n} of ${cap})`,
    nobody: (cap: number) => `Nobody has booked yet (${cap} ${cap === 1 ? 'seat' : 'seats'}).`,
    video: 'Video call',
  },
});

export const SZTAB_PRODID = '-//GYM TRACKER Sztab//Kalendarz wizyt 1.0//PL'; // i18n-ignore: identyfikator formatu

/** Numer wersji z chwili zapisu: minuty od początku 2026 roku — ponowny import nadpisuje starszą wersję. */
const sequenceOf = (stamp: Date): number => Math.max(0, Math.floor((stamp.getTime() - Date.UTC(2026, 0, 1)) / MINUTE));

export interface IcsOptions {
  /** Chwila zapisu — `DTSTAMP` i `SEQUENCE`. */
  stamp: Date;
  /** Nazwa kalendarza (`X-WR-CALNAME`). */
  name: string;
}

/**
 * Plik .ics z terminami prowadzącego (RFC 5545): czasy w UTC, wiersze łamane po 75 oktetach,
 * ucieczki w tekście — te same zasady co eksport kalendarza w GYM TRACKERze (`engine/ics`).
 * Stały `UID` terminu: ponowny import aktualizuje, a odwołany termin dostaje `STATUS:CANCELLED`.
 * Kto jest zapisany, mówi `who` (numer podopiecznego, czasem z prywatnym skrótem prowadzącego).
 */
export function slotsIcs(slots: readonly SlotRow[], bookings: readonly BookingRow[], who: (connectionId: string) => string, opts: IcsOptions): string {
  const stamp = icsUtc(opts.stamp);
  const seq = sequenceOf(opts.stamp);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${SZTAB_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.name)}`,
  ];
  for (const s of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const people = activeBookings(s.id, bookings);
    const link = videoLink(s.place);
    const place = s.place?.trim() || null;
    const description = [
      people.length ? `${T.booked(people.length, s.capacity)}: ${people.map((b) => who(b.connectionId)).join(', ')}` : T.nobody(s.capacity),
      link ? `${T.video}: ${link}` : null,
      s.note?.trim() || null,
    ].filter((x): x is string => !!x);
    lines.push(
      'BEGIN:VEVENT',
      `UID:termin-${s.id}@gym-tracker-sztab`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${seq}`,
      `DTSTART:${icsUtc(new Date(s.startsAt))}`,
      `DTEND:${icsUtc(new Date(s.endsAt))}`,
      `SUMMARY:${icsEscape(`${s.title} · ${people.length}/${s.capacity}`)}`,
    );
    if (place && !link) lines.push(`LOCATION:${icsEscape(place)}`);
    if (link) lines.push(`URL:${link}`);
    lines.push(`DESCRIPTION:${icsEscape(description.join('\n'))}`, `STATUS:${s.cancelledAt ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Nazwa pliku z datą pobrania: `sztab-wizyty-2026-11-25.ics`. */
export const icsFileName = (now: Date): string => `sztab-wizyty-${dayKey(now)}.ics`;
