import { BUILTIN } from '../data/exercises';
import { text } from '../i18n';
import type { AppState, ReminderPrefs } from '../types';
import { latestWeight } from './body';
import { REMINDER_EVENING, REMINDER_FOOD, REMINDER_MORNING, REMINDER_STEPS_FOOD, REMINDER_WEIGH, pick } from './quips';
import { addDays, daysBetween } from './schedule';
import { snapshot } from './snapshot';

/**
 * Przypomnienia: o 7:30 w dni, w które plan ma trening, i o 19:30 codziennie — o krokach,
 * rowerze, bieżni i tańcu z całego dnia. Na życzenie także o 7:00 — o porannym ważeniu,
 * pół godziny przed treningiem, żeby nie przyszły razem. Przy profilu diety także „Jedzenie
 * z dziś” (domyślnie 20:00); gdy włączone są i kroki, i jedzenie, wychodzi jedno wspólne
 * powiadomienie o godzinie jedzenia — trzecie dziennie to za dużo.
 *
 * Telefon sam układa listę gotowych wiadomości na trzy tygodnie i wysyła ją serwerowi, który
 * tylko pilnuje zegara (`server/api`). Plan, historia i nazwy treningów nie wychodzą
 * z telefonu w innej postaci niż tytuł przypomnienia. Lista odświeża się przy każdym otwarciu
 * aplikacji; gdy ktoś przestanie ją otwierać, przypomnienia skończą się po trzech tygodniach.
 */

/** Tytuły powiadomień — w języku wizyty, w której telefon ułożył listę. */
const T = text({
  pl: {
    workout: (name: string) => `Dziś trening: ${name}`,
    fromPlan: 'z planu',
    weigh: 'Poranne ważenie',
    evening: 'Kroki i ruch z dziś',
    food: 'Jedzenie z dziś',
    both: 'Wpisz kroki i jedzenie z dziś',
  },
  en: {
    workout: (name: string) => `Workout today: ${name}`,
    fromPlan: 'from your plan',
    weigh: 'Morning weigh-in',
    evening: 'Today’s steps and movement',
    food: 'Today’s food',
    both: 'Log today’s steps and food',
  },
});

export const WEIGH_AT = '07:00';
export const MORNING_AT = '07:30';
export const EVENING_AT = '19:30';
export const FOOD_AT = '20:00';

/** Godziny do wyboru przy jedzeniu: co pół godziny od 16:00 do 23:30 — wieczór, nie środek dnia. */
export const FOOD_TIMES: readonly string[] = Array.from(
  { length: 16 },
  (_, i) => `${String(16 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Godzina przypomnienia o jedzeniu; zepsuta albo brak (stary zapis, import) — 20:00. */
export const foodTimeOf = (prefs: ReminderPrefs): string =>
  typeof prefs.foodAt === 'string' && HHMM.test(prefs.foodAt) ? prefs.foodAt : FOOD_AT;

/** Na ile dni naprzód idzie lista. */
export const HORIZON_DAYS = 21;

/**
 * Ważenie domyślnie wyłączone: kto już ma przypomnienia, nie dostanie nagle trzeciego
 * powiadomienia dziennie. Karta ważenia na ekranie Dziś pyta i bez niego.
 */
export const DEFAULT_REMINDERS: ReminderPrefs = { morning: true, evening: true, weigh: false };

/** Czy wieczorne kroki i jedzenie idą jednym powiadomieniem. `diet` — czy jest profil diety. */
export const eveningMerged = (prefs: ReminderPrefs, diet: boolean): boolean => !!(diet && prefs.food && prefs.evening);

export const remindersOf = (state: AppState): ReminderPrefs => state.cfg.reminders ?? DEFAULT_REMINDERS;

/** Kształt, który przyjmuje serwer (`server/api/schedule.ts`). */
export interface ReminderItem {
  tag: 'trening' | 'ruch' | 'waga' | 'jedzenie';
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
 * przypomnienie, którego godzina już minęła, nie trafia na listę. `diet` mówi, czy jest profil
 * diety (znacznik `food/dietFlag`): bez niego przypomnienia o jedzeniu nie ma, nawet gdy zostało
 * włączone, a kroki wracają na swoją godzinę.
 */
export function reminderItems(
  state: AppState,
  prefs: ReminderPrefs,
  today: string,
  nowMin: number,
  diet = false,
): ReminderItem[] {
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
          title: clip(T.workout(names.get(d.workout) ?? T.fromPlan), TITLE_MAX),
          body: pick(REMINDER_MORNING, seed(d.date)),
          url: '#/sesja',
        }),
      );
  }

  if (prefs.weigh) {
    // Dzisiejsze ważenie już w zapisie — dziś przypomnienie niepotrzebne.
    const weighedToday = latestWeight(state)?.day === today;
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const date = addDays(today, i);
      if (!ahead(date, WEIGH_AT) || (i === 0 && weighedToday)) continue;
      out.push({
        tag: 'waga',
        date,
        time: WEIGH_AT,
        title: T.weigh,
        body: pick(REMINDER_WEIGH, seed(date)),
        url: '#/sesja',
      });
    }
  }

  const food = diet && !!prefs.food;
  const foodAt = foodTimeOf(prefs);
  if (food) {
    // Oba wieczorne razem — jedno powiadomienie o godzinie jedzenia, na ekran Dziś, gdzie są
    // i kroki, i karta jedzenia. Samo jedzenie otwiera dziennik.
    const both = !!prefs.evening;
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const date = addDays(today, i);
      if (!ahead(date, foodAt)) continue;
      out.push({
        tag: 'jedzenie',
        date,
        time: foodAt,
        title: both ? T.both : T.food,
        body: pick(both ? REMINDER_STEPS_FOOD : REMINDER_FOOD, seed(date)),
        url: both ? '#/sesja' : '#/jedzenie',
      });
    }
  }

  if (prefs.evening && !food) {
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const date = addDays(today, i);
      if (!ahead(date, EVENING_AT)) continue;
      out.push({
        tag: 'ruch',
        date,
        time: EVENING_AT,
        title: T.evening,
        body: pick(REMINDER_EVENING, seed(date)),
        url: '#/cardio',
      });
    }
  }

  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
