import { BUILTIN } from '../data/exercises';
import type { AppState, ReminderPrefs } from '../types';
import { REMINDER_EVENING, REMINDER_MORNING, pick } from './quips';
import { addDays, daysBetween } from './schedule';
import { snapshot } from './snapshot';

/**
 * Przypomnienia: o 7:30 w dni, w które plan ma trening, i o 19:30 codziennie — o krokach,
 * rowerze, bieżni i tańcu z całego dnia.
 *
 * Telefon sam układa listę gotowych wiadomości na trzy tygodnie i wysyła ją serwerowi, który
 * tylko pilnuje zegara (`server/api`). Plan, historia i nazwy treningów nie wychodzą
 * z telefonu w innej postaci niż tytuł przypomnienia. Lista odświeża się przy każdym otwarciu
 * aplikacji; gdy ktoś przestanie ją otwierać, przypomnienia skończą się po trzech tygodniach.
 */

export const MORNING_AT = '07:30';
export const EVENING_AT = '19:30';

/** Na ile dni naprzód idzie lista. */
export const HORIZON_DAYS = 21;

export const DEFAULT_REMINDERS: ReminderPrefs = { morning: true, evening: true };

export const remindersOf = (state: AppState): ReminderPrefs => state.cfg.reminders ?? DEFAULT_REMINDERS;

/** Kształt, który przyjmuje serwer (`server/api/schedule.ts`). */
export interface ReminderItem {
  tag: 'trening' | 'ruch';
  date: string;
  time: string;
  title: string;
  body: string;
  url: string;
}

/** Limit tytułu po stronie serwera. */
const TITLE_MAX = 80;

const clip = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Dzień w czasie lokalnym telefonu. Reszta aplikacji liczy dni w UTC (`dayKey`), ale
 * przypomnienie o 7:30 dotyczy dnia, który widać na zegarku.
 */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Lista przypomnień od dziś na `HORIZON_DAYS` dni. `nowMin` to minuta doby teraz — dzisiejsze
 * przypomnienie, którego godzina już minęła, nie trafia na listę.
 */
export function reminderItems(state: AppState, prefs: ReminderPrefs, today: string, nowMin: number): ReminderItem[] {
  const last = addDays(today, HORIZON_DAYS - 1);
  const ahead = (date: string, at: string): boolean => date > today || nowMin < minutesOf(at);
  // Ten sam dzień — ten sam tekst; kolejne dni — kolejne teksty z listy.
  const seed = (date: string): number => daysBetween('2026-01-01', date);
  const out: ReminderItem[] = [];

  const snap = prefs.morning ? snapshot(state, today) : null;
  if (snap) {
    const names = new Map([...BUILTIN, ...state.workouts].map((w) => [w.id, w.name]));
    snap.schedule.days
      .filter((d) => (d.status === 'today' || d.status === 'future') && d.date <= last && ahead(d.date, MORNING_AT))
      .forEach((d) =>
        out.push({
          tag: 'trening',
          date: d.date,
          time: MORNING_AT,
          title: clip(`Dziś trening: ${names.get(d.workout) ?? 'z planu'}`, TITLE_MAX),
          body: pick(REMINDER_MORNING, seed(d.date)),
          url: '#/sesja',
        }),
      );
  }

  if (prefs.evening) {
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const date = addDays(today, i);
      if (!ahead(date, EVENING_AT)) continue;
      out.push({
        tag: 'ruch',
        date,
        time: EVENING_AT,
        title: 'Kroki i ruch z dziś',
        body: pick(REMINDER_EVENING, seed(date)),
        url: '#/cardio',
      });
    }
  }

  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
