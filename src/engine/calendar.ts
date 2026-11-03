import { BUILTIN } from '../data/exercises';
import { LANG, text } from '../i18n';
import { nextShopDay, shopDays, type ShopRhythm } from '../food/shop/rhythm';
import type { AppState } from '../types';
import { byDay, googleTemplateUrl, icsCalendar, type IcsEvent } from './ics';
import { addDays, dayKey, logDays, planWeekdays } from './schedule';
import { snapshot } from './snapshot';

/**
 * Kalendarz: co i kiedy — trening z planu, zakupy z rytmu, badanie kontrolne i dni pobrania
 * wyników. Jedno wyliczenie dla strony `#/kalendarz`, karty na ekranie Dziś, pliku .ics
 * i odnośników do Kalendarza Google.
 *
 * Daty to dni kalendarza (`yyyy-mm-dd`). Plan liczy dni w UTC (`schedule.ts`), dieta w czasie
 * telefonu; terminy planu to i tak „wtorek”, a nie chwila, więc kalendarz pokazuje je jako dzień
 * na zegarku telefonu. Dzień zrobionego treningu idzie z `dayKey` dziennika — między 0:00 a 2:00
 * polskiego czasu bywa to dzień wcześniej (znane ograniczenie całej aplikacji).
 *
 * Dane diety (rytm zakupów, plan pod wyniki badań) leżą w IndexedDB i przychodzą osobno
 * (`food/calendar.ts`), już przeliczone na `DietCalendar` — ten moduł nie wczytuje bazy.
 */

const T = text({
  pl: {
    train: (name: string) => `Trening: ${name}`,
    fromPlan: 'Trening z planu',
    extra: 'poza planem',
    madeUp: (date: string) => `termin z ${date}`,
    shop: 'Zakupy',
    retest: 'Badanie kontrolne',
    collected: 'Badanie — wyniki zapisane',
    calName: 'GYM TRACKER',
    trainDesc: (plan: string) => `Trening z planu „${plan}” w GYM TRACKER.`,
    shopDesc: 'Zakupy według rytmu z listy zakupów w GYM TRACKER (Jedzenie → Lista zakupów).',
    labDesc: (markers: string) =>
      `Badanie kontrolne po planie pod wyniki${markers ? `: ${markers}` : ''}. Zapytaj w laboratorium o przygotowanie. Przypomnienie z GYM TRACKER, nie zlecenie lekarskie.`,
    googleTrain: (plan: string) => `Trening: ${plan}`,
    googleTrainDesc: (plan: string, until: string) =>
      `Dni treningowe planu „${plan}” do ${until}. Który trening wypada danego dnia, pokazuje GYM TRACKER (ekran Dziś). Po zmianie planu dodaj wydarzenia jeszcze raz.`,
    googleShopDesc: 'Zakupy według rytmu z GYM TRACKER. Lista zakupów: Jedzenie → Lista zakupów. Po zmianie rytmu dodaj wydarzenie jeszcze raz.',
  },
  en: {
    train: (name: string) => `Workout: ${name}`,
    fromPlan: 'Workout from your plan',
    extra: 'outside the plan',
    madeUp: (date: string) => `deadline of ${date}`,
    shop: 'Shopping',
    retest: 'Follow-up lab test',
    collected: 'Lab test — results saved',
    calName: 'GYM TRACKER',
    trainDesc: (plan: string) => `Workout from the plan “${plan}” in GYM TRACKER.`,
    shopDesc: 'Shopping on your rhythm from the shopping list in GYM TRACKER (Food → Shopping list).',
    labDesc: (markers: string) =>
      `Follow-up test after the plan for your results${markers ? `: ${markers}` : ''}. Ask the lab how to prepare. A reminder from GYM TRACKER, not a doctor’s order.`,
    googleTrain: (plan: string) => `Workout: ${plan}`,
    googleTrainDesc: (plan: string, until: string) =>
      `Training days of the plan “${plan}” until ${until}. GYM TRACKER shows which workout falls on each day (Today screen). Add the events again after you change the plan.`,
    googleShopDesc: 'Shopping on your rhythm from GYM TRACKER. Shopping list: Food → Shopping list. Add the event again after you change the rhythm.',
  },
});

export type CalKind = 'train' | 'shop' | 'lab';

/**
 * Stan wydarzenia. Trening: `planned` (dziś albo później), `open` (po terminie, do nadrobienia),
 * `done`, `missed`. Zakupy: zawsze `planned`. Badanie: `planned` (kontrolne) albo `done` (wyniki
 * z tego dnia zapisane w aplikacji).
 */
export type CalStatus = 'planned' | 'open' | 'done' | 'missed';

export interface CalEvent {
  /** Stała część identyfikatora: `trening-2026-11-05`. Z niej `UID` w pliku .ics. */
  id: string;
  kind: CalKind;
  status: CalStatus;
  date: string;
  /** Godzina `HH:MM`; brak przy tym, co już się odbyło. */
  at: string | null;
  minutes: number;
  title: string;
  /** Druga linijka: „poza planem”, „termin z 03.11”, badane markery. */
  note: string | null;
  /** Przypomnienie w pliku .ics: tyle minut przed. */
  alarmMin: number;
}

/** Część diety, już odczytana z bazy. Bez profilu diety nie ma rytmu zakupów. */
export interface DietCalendar {
  shop: ShopRhythm | null;
  /** Badanie kontrolne z planu pod wyniki: dzień i nazwy markerów. */
  retest: { date: string; markers: string[] } | null;
  /** Dni pobrania zapisanych wyników. */
  labDays: string[];
}

export const NO_DIET: DietCalendar = { shop: null, retest: null, labDays: [] };

/* ---------------- Godziny ---------------- */

export const TRAIN_AT = '18:00';
export const TRAIN_MIN = 60;
export const SHOP_MIN = 60;
/** Laboratoria pobierają rano; pół godziny na samo pobranie. */
export const LAB_AT = '08:00';
export const LAB_MIN = 30;

/** Przypomnienia w pliku .ics: trening godzinę przed, zakupy pół godziny przed, badanie wieczorem przed (19:00). */
export const ALARM_MIN: Record<CalKind, number> = { train: 60, shop: 30, lab: 13 * 60 };

/** Na ile naprzód idzie plik .ics. */
export const EXPORT_WEEKS = 12;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const validTime = (s: unknown): s is string => typeof s === 'string' && HHMM.test(s);

/** Godziny treningu do wyboru: co pół godziny od 5:00 do 22:00. */
export const TRAIN_TIMES: readonly string[] = Array.from(
  { length: 35 },
  (_, i) => `${String(5 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

/** Godzina treningu z ustawień; brak albo zepsuta (stary zapis, import) — 18:00. */
export const trainTimeOf = (state: AppState): string => {
  const at = state.cfg.calendar?.trainAt;
  return validTime(at) ? at : TRAIN_AT;
};

/** Ustawienia kalendarza z zapisu albo importu: tylko poprawna godzina, inaczej nic. */
export function cleanCalendarCfg(raw: unknown): { trainAt: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const at = (raw as { trainAt?: unknown }).trainAt;
  return validTime(at) ? { trainAt: at } : undefined;
}

/* ---------------- Wydarzenia ---------------- */

const KIND_ORDER: Record<CalKind, number> = { train: 0, shop: 1, lab: 2 };

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return LANG === 'pl' ? `${dd}.${mm}` : `${dd}/${mm}`;
};

export const longDate = (key: string): string => {
  const [yy, mm, dd] = key.split('-');
  return LANG === 'pl' ? `${dd}.${mm}.${yy}` : `${dd}/${mm}/${yy}`;
};

/** „Trening: Push” — chyba że nazwa już mówi, że to trening („Trening A”), wtedy bez powtórzenia. */
export const trainTitle = (name: string): string => (/^(trening|workout)\b/i.test(name.trim()) ? name.trim() : T.train(name));

const workoutNames = (state: AppState): Map<string, string> =>
  new Map([...BUILTIN, ...state.workouts].map((w) => [w.id, w.name]));

/** Nazwy treningów zapisanych danego dnia — w kolejności zapisu, bez powtórzeń. */
function loggedOn(state: AppState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of [...state.log].sort((a, b) => a.date.localeCompare(b.date))) {
    const day = dayKey(e.date);
    const list = out.get(day) ?? [];
    if (!list.includes(e.workout)) list.push(e.workout);
    out.set(day, list);
  }
  return out;
}

function trainEvents(state: AppState, today: string, from: string, to: string): CalEvent[] {
  const at = trainTimeOf(state);
  const logged = loggedOn(state);
  const out: CalEvent[] = [];
  const done = (date: string, title: string, note: string | null): CalEvent => ({
    id: `trening-${date}`,
    kind: 'train',
    status: 'done',
    date,
    at: null,
    minutes: TRAIN_MIN,
    title,
    note,
    alarmMin: ALARM_MIN.train,
  });
  const loggedTitle = (day: string): string | null => {
    const names = logged.get(day);
    return names?.length ? (names.length === 1 ? trainTitle(names[0]!) : T.train(names.join(' + '))) : null;
  };

  const snap = snapshot(state, today);
  const covered = new Set<string>();
  if (snap) {
    const names = workoutNames(state);
    for (const d of snap.schedule.days) {
      const name = names.get(d.workout);
      const planned = name ? trainTitle(name) : T.fromPlan;
      if (d.status === 'done') {
        // Zrobiony trening stoi w dniu, w którym się odbył; przesunięty termin mówi, skąd przyszedł.
        const day = d.filled ?? d.date;
        covered.add(day);
        out.push(done(day, loggedTitle(day) ?? planned, day === d.date ? null : T.madeUp(shortDate(d.date))));
        continue;
      }
      out.push({
        id: `trening-${d.date}`,
        kind: 'train',
        status: d.status === 'today' || d.status === 'future' ? 'planned' : d.status,
        date: d.date,
        at: d.status === 'today' || d.status === 'future' ? at : null,
        minutes: TRAIN_MIN,
        title: planned,
        note: null,
        alarmMin: ALARM_MIN.train,
      });
    }
    // Sesje bez terminu: sprzed startu planu to po prostu historia, po starcie — „poza planem”.
    for (const day of snap.schedule.extras) {
      if (covered.has(day)) continue;
      covered.add(day);
      out.push(done(day, loggedTitle(day) ?? T.fromPlan, day < snap.plan.start ? null : T.extra));
    }
  } else {
    // Bez planu: każdy dzień z zapisanym treningiem.
    for (const day of logDays(state)) out.push(done(day, loggedTitle(day)!, null));
  }
  return out.filter((e) => e.date >= from && e.date <= to);
}

function dietEvents(diet: DietCalendar, from: string, to: string, today: string): CalEvent[] {
  const out: CalEvent[] = [];
  if (diet.shop) {
    // Zakupy tylko od dziś: rytm to zamiar, nie zapis — wstecz nie wiadomo, czy się odbyły.
    for (const date of shopDays(diet.shop, from > today ? from : today, to)) {
      out.push({
        id: `zakupy-${date}`,
        kind: 'shop',
        status: 'planned',
        date,
        at: diet.shop.at,
        minutes: SHOP_MIN,
        title: T.shop,
        note: null,
        alarmMin: ALARM_MIN.shop,
      });
    }
  }
  const labDays = new Set(diet.labDays);
  for (const date of labDays) {
    if (date < from || date > to) continue;
    out.push({
      id: `badanie-${date}`,
      kind: 'lab',
      status: 'done',
      date,
      at: null,
      minutes: LAB_MIN,
      title: T.collected,
      note: null,
      alarmMin: ALARM_MIN.lab,
    });
  }
  const r = diet.retest;
  // Badanie kontrolne, chyba że tego dnia wyniki już są zapisane.
  if (r && r.date >= from && r.date <= to && !labDays.has(r.date)) {
    out.push({
      id: `badanie-${r.date}`,
      kind: 'lab',
      status: 'planned',
      date: r.date,
      at: LAB_AT,
      minutes: LAB_MIN,
      title: T.retest,
      note: r.markers.length ? r.markers.join(', ') : null,
      alarmMin: ALARM_MIN.lab,
    });
  }
  return out;
}

const byTime = (a: CalEvent, b: CalEvent): number =>
  a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.at ?? '').localeCompare(b.at ?? '');

/** Wszystkie wydarzenia od `from` do `to` (obie daty włącznie), po dniu i rodzaju. */
export function calendarEvents(
  state: AppState,
  diet: DietCalendar | null,
  from: string,
  to: string,
  today: string,
): CalEvent[] {
  return [...trainEvents(state, today, from, to), ...dietEvents(diet ?? NO_DIET, from, to, today)].sort(byTime);
}

/**
 * To, co przed nami: od dziś na `days` dni. Trening po terminie, ale wciąż do nadrobienia,
 * też tu jest — to coś do zrobienia, nie historia.
 */
export function upcoming(state: AppState, diet: DietCalendar | null, today: string, days = 14): CalEvent[] {
  const to = addDays(today, days - 1);
  const ahead = calendarEvents(state, diet, today, to, today).filter((e) => e.status === 'planned');
  const open = calendarEvents(state, diet, addDays(today, -7), addDays(today, -1), today).filter((e) => e.status === 'open');
  return [...open, ...ahead].sort(byTime);
}

/** Jakie rodzaje mają cokolwiek przed sobą — od nich zależą przyciski „Dodaj do Kalendarza Google”. */
export function kindsAhead(state: AppState, diet: DietCalendar | null, today: string): Record<CalKind, boolean> {
  return {
    train: !!snapshot(state, today)?.stats.next,
    shop: !!diet?.shop,
    lab: !!diet?.retest && diet.retest.date >= today && !diet.labDays.includes(diet.retest.date),
  };
}

/* ---------------- Plik .ics ---------------- */

/** Chwila z dnia i godziny w strefie telefonu. Test podstawia własną strefę. */
export type ToInstant = (date: string, at: string) => Date;

export const localInstant: ToInstant = (date, at) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = at.split(':').map(Number);
  return new Date(y!, m! - 1, d!, hh!, mm!);
};

const UID_HOST = 'gym-tracker';

export function icsEvents(events: readonly CalEvent[], toInstant: ToInstant = localInstant, plan?: string): IcsEvent[] {
  return events
    .filter((e) => e.status === 'planned' && e.at)
    .map((e) => {
      const start = toInstant(e.date, e.at!);
      const description =
        e.kind === 'shop' ? T.shopDesc : e.kind === 'lab' ? T.labDesc(e.note ?? '') : plan ? T.trainDesc(plan) : undefined;
      return {
        uid: `${e.id}@${UID_HOST}`,
        start,
        end: new Date(start.getTime() + e.minutes * 60_000),
        summary: e.title,
        ...(description ? { description } : {}),
        alarmMin: e.alarmMin,
      };
    });
}

/**
 * Plik .ics na `EXPORT_WEEKS` tygodni od dziś: każdy termin jako osobne wydarzenie w UTC,
 * z nazwą treningu i przypomnieniem. Badanie kontrolne wchodzi nawet wtedy, gdy wypada dalej.
 */
export function calendarIcs(
  state: AppState,
  diet: DietCalendar | null,
  today: string,
  stamp: Date,
  toInstant: ToInstant = localInstant,
): { text: string; count: number } {
  const to = addDays(today, EXPORT_WEEKS * 7 - 1);
  const events = calendarEvents(state, diet, today, to, today);
  const r = diet?.retest;
  if (r && r.date > to) events.push(...dietEvents({ ...NO_DIET, retest: r, labDays: diet.labDays }, r.date, r.date, today));
  const list = icsEvents(events, toInstant, snapshot(state, today)?.template.name);
  return { text: icsCalendar(list, { stamp, name: T.calName }), count: list.length };
}

/** Nazwa pliku: `gym-tracker-kalendarz-2026-11-03.ics`. */
export const icsName = (today: string): string => `gym-tracker-${LANG === 'pl' ? 'kalendarz' : 'calendar'}-${today}.ics`; // i18n-ignore: nazwa pliku

/* ---------------- Kalendarz Google ---------------- */

/** Koniec dnia `date` w strefie telefonu jako UNTIL w UTC: `20270131T225900Z`. */
const untilOf = (date: string, toInstant: ToInstant): string =>
  toInstant(date, '23:59').toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Reguła powtarzania zakupów: stałe dni tygodnia albo co N dni. */
export const shopRrule = (r: ShopRhythm): string =>
  r.kind === 'weekdays' ? `FREQ=WEEKLY;BYDAY=${byDay(r.days)}` : r.days === 1 ? 'FREQ=DAILY' : `FREQ=DAILY;INTERVAL=${r.days}`;

/**
 * Odnośniki „Dodaj do Kalendarza Google”, tylko dla rodzajów, które mają coś przed sobą.
 * Treningi: jedno wydarzenie powtarzane co tydzień w dni planu do jego ostatniego terminu,
 * od najbliższego terminu. Zakupy: według rytmu, bez końca. Badanie: jedno wydarzenie.
 */
export function googleLinks(
  state: AppState,
  diet: DietCalendar | null,
  today: string,
  ctz: string,
  toInstant: ToInstant = localInstant,
): Partial<Record<CalKind, string>> {
  const out: Partial<Record<CalKind, string>> = {};
  const snap = snapshot(state, today);
  const next = snap?.stats.next;
  if (snap && next) {
    const last = snap.schedule.days[snap.schedule.days.length - 1]!.date;
    const weekdays = planWeekdays(snap.template, snap.plan);
    out.train = googleTemplateUrl({
      text: T.googleTrain(snap.template.name),
      start: { date: next.date, at: trainTimeOf(state) },
      minutes: TRAIN_MIN,
      ctz,
      rrule: `FREQ=WEEKLY;BYDAY=${byDay(weekdays)};UNTIL=${untilOf(last, toInstant)}`,
      details: T.googleTrainDesc(snap.template.name, longDate(last)),
    });
  }
  const r = diet?.shop;
  if (r) {
    out.shop = googleTemplateUrl({
      text: T.shop,
      start: { date: nextShopDay(r, today), at: r.at },
      minutes: SHOP_MIN,
      ctz,
      rrule: shopRrule(r),
      details: T.googleShopDesc,
    });
  }
  const lab = diet?.retest;
  if (lab && kindsAhead(state, diet, today).lab) {
    out.lab = googleTemplateUrl({
      text: T.retest,
      start: { date: lab.date, at: LAB_AT },
      minutes: LAB_MIN,
      ctz,
      details: T.labDesc(lab.markers.join(', ')),
    });
  }
  return out;
}
