import type { AppState, Cardio, PhoneData, PhoneDay, WatchActivity } from '../types';
import { bodyOf, validWeight } from './body';
import { addDays } from './schedule';
import { DAY, EPOCH_MIN, SPORT_CYCLING, WATCH_LIMITS, actRow, byDay, localDayOf, merged, num, rows } from './watch';

/**
 * Dane z telefonu: Apple Zdrowie na iPhonie, Health Connect na Androidzie. Strona nie ma do nich
 * dostępu, więc czyta je mała aplikacja GYM TRACKER Zdrowie (`health/`), pieczętuje tą samą
 * kopertą co zegarek i odkłada w skrzynce na serwerze.
 *
 * Wszystko jak przy zegarku: nowsza paczka zastępuje dzień po dniu, starsze dni zostają jako
 * historia, a kroki i przejazdy stają się wpisami ruchu dopiero w locie, w `cardioOf`. Tętno,
 * sen i waga tylko się pokazują — wagę do dziennika wpisuje człowiek, jednym przyciskiem.
 *
 * Telefon zbiera też kroki i treningi z zegarków innych firm (Garmin Connect, Fitbit, Samsung
 * Health piszą do Apple Zdrowie i Health Connect), więc jego liczby często dublują zegarek.
 * Dlatego kroki biorą wyższą liczbę, a nie sumę, a przejazd z telefonu ustępuje przejazdowi
 * z zegarka, który zaczął się w tych samych minutach.
 */

/**
 * Zakresy liczb z telefonu. Poza nimi to błąd czujnika albo zepsuty zapis: zakresy zegarka,
 * a do tego sen (minuty doby) i waga (zakres dziennika wagi).
 */
export const PHONE_LIMITS = {
  ...WATCH_LIMITS,
  sleep: [0, 1_440],
} as const;

const L = PHONE_LIMITS;

const lim = (v: unknown, [min, max]: readonly [number, number]): number | null => num(v, min, max);

const kgOf = (v: unknown): number | null => (validWeight(v) ? Math.round(v * 10) / 10 : null);

/** Najwięcej dni i przejazdów w paczce — telefon wysyła dwa tygodnie. */
const MAX_DAYS = 31;
const MAX_ACTS = 50;

export interface PhonePayload {
  t: number;
  os: PhoneData['os'];
  days: PhoneDay[];
  acts: WatchActivity[];
}

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Dzień z paczki albo zapisu. Każda liczba sprawdzana osobno; dzień bez żadnej odpada. */
function dayOf(x: unknown): PhoneDay | null {
  const r = obj(x);
  if (typeof r.day !== 'string' || !DAY.test(r.day)) return null;
  const d: PhoneDay = {
    day: r.day,
    steps: lim(r.steps, L.steps),
    m: lim(r.m, L.meters),
    floors: lim(r.floors, L.floors),
    active: lim(r.active, L.active),
    rhr: lim(r.rhr, L.hr),
    hrMin: lim(r.hrMin, L.hr),
    hrAvg: lim(r.hrAvg, L.hr),
    hrMax: lim(r.hrMax, L.hr),
    sleep: lim(r.sleep, L.sleep),
    kg: kgOf(r.kg),
  };
  return Object.entries(d).some(([k, v]) => k !== 'day' && v !== null) ? d : null;
}

const actOf = (x: unknown, t: number): WatchActivity | null => {
  const a = obj(x);
  return actRow([a.start, a.sport, a.sec, a.m], t);
};

const OS = new Set<unknown>(['ios', 'android']);

/**
 * Paczka z telefonu po odszyfrowaniu. `null`, gdy to nie paczka telefonu w znanej wersji
 * (paczka zegarka nie ma `k`) albo jej czas wypada w przyszłości — zegar telefonu może się
 * spieszyć najwyżej o dobę.
 */
export function parsePhonePayload(v: unknown, nowMs: number = Date.now()): PhonePayload | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const t = num(p.t, EPOCH_MIN, nowMs / 1000 + 86_400);
  if (p.v !== 1 || p.k !== 'phone' || !OS.has(p.os) || t === null) return null;
  return {
    t,
    os: p.os as PhoneData['os'],
    days: merged([], rows(p.d, MAX_DAYS, dayOf), (d) => d.day, byDay),
    acts: merged([], rows(p.a, MAX_ACTS, (x) => actOf(x, t)), (a) => a.start, (a, b) => a.start - b.start),
  };
}

/** Dokłada paczkę do zapisu i mówi, czy coś się zmieniło — dokładnie jak `mergeWatch`. */
export function mergePhone(state: AppState, p: PhonePayload, got: Date = new Date()): boolean {
  const old = state.phone;
  if (old && p.t <= old.t) return false;
  state.phone = {
    t: p.t,
    got: got.toISOString(),
    os: p.os,
    days: merged(old?.days ?? [], p.days, (d) => d.day, byDay),
    acts: merged(old?.acts ?? [], p.acts, (a) => a.start, (a, b) => a.start - b.start),
  };
  return true;
}

/**
 * Wpisy ruchu z telefonu: kroki dnia i przejazdy rowerem z drogą. Zakresów wpisu tu nie
 * sprawdzamy, a przejazdów nie porównujemy z zegarkiem — robi to `cardioOf`.
 */
export function phoneEntries(p: PhoneData | undefined): Cardio[] {
  if (!p) return [];
  const steps = p.days
    .filter((d): d is PhoneDay & { steps: number } => d.steps !== null && d.steps > 0)
    .map(
      (d): Cardio => ({
        kind: 'steps',
        steps: d.steps,
        key: `phone-steps-${d.day}`,
        day: d.day,
        at: `${d.day}T23:59:59.000Z`,
        src: 'phone',
      }),
    );
  const rides = p.acts
    .filter((a) => a.sport === SPORT_CYCLING && a.m !== null && a.m > 0)
    .map((a): Cardio => {
      const at = new Date(a.start * 1000);
      return {
        kind: 'bike',
        kmh: Math.round((a.m! / a.sec) * 36) / 10,
        min: Math.round(a.sec / 60),
        key: `phone-ride-${a.start}`,
        day: localDayOf(at),
        at: at.toISOString(),
        src: 'phone',
      };
    });
  return [...steps, ...rides];
}

/** Dane z telefonu z zapisu albo importu — przesiane tymi samymi zakresami co paczka, czas też (jak `restoreWatch`). */
export function restorePhone(v: unknown, nowMs: number = Date.now()): PhoneData | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  const t = num(p.t, EPOCH_MIN, nowMs / 1000 + 86_400);
  if (t === null || typeof p.got !== 'string' || Number.isNaN(Date.parse(p.got)) || !OS.has(p.os)) return undefined;
  const all = Number.MAX_SAFE_INTEGER;
  return {
    t,
    got: p.got,
    os: p.os as PhoneData['os'],
    days: merged([], rows(p.days, all, dayOf), (d) => d.day, byDay),
    acts: merged([], rows(p.acts, all, (x) => actOf(x, t)), (a) => a.start, (a, b) => a.start - b.start),
  };
}

/** Ważenie sprzed tylu dni jeszcze się proponuje — starsze to już nie „nowe ważenie”. */
export const WEIGHT_OFFER_DAYS = 14;

/**
 * Dni telefonu od najnowszego, nie dalej niż `days` wstecz. Telefon liczy dzień lokalnie, a
 * `today` aplikacji to dzień UTC (`dayKey`) — po polskiej północy telefon jest już dzień dalej,
 * więc jego „jutro” według UTC to zwykle poranne ważenie, a nie błąd.
 */
export function recentPhoneDays(state: AppState, today: string, days: number): PhoneDay[] {
  const to = addDays(today, 1);
  const from = addDays(today, -days);
  return [...(state.phone?.days ?? [])].reverse().filter((d) => d.day <= to && d.day > from);
}

/**
 * Najnowsze ważenie z telefonu, jeśli jest nowsze niż ostatni wpis w dzienniku wagi i nie
 * starsze niż dwa tygodnie. Waga sama do dziennika nie wchodzi: kalorie liczą się z wagi
 * z dnia ruchu, a ciche nadpisanie mogłoby przykryć ważenie wpisane świadomie.
 */
export function phoneWeightOffer(state: AppState, today: string): { day: string; kg: number } | null {
  const last = bodyOf(state).at(-1)?.day ?? '';
  const d = recentPhoneDays(state, today, WEIGHT_OFFER_DAYS + 1).find((x) => x.kg !== null);
  return d && d.day > last ? { day: d.day, kg: d.kg! } : null;
}
