import type { AppState, Cardio, WatchActivity, WatchData, WatchDay, WatchHealth } from '../types';

/**
 * Dane z zegarka Garmin: co przyszło w paczce, jak to scalić z tym, co już jest, i jakie wpisy
 * ruchu z tego wynikają.
 *
 * Zegarek za każdym razem wysyła cały ostatni tydzień, więc nowsza paczka zastępuje starszą
 * dzień po dniu, a dni sprzed tygodnia zostają w zapisie — to historia, jak wpisy ręczne.
 * Z kroków i przejazdów rowerem powstają wpisy ruchu (`watchEntries`), ale tylko w locie:
 * w zapisie leżą liczby z zegarka, a kalorie, minuty i odznaki liczą się z nich przy każdym
 * otwarciu — tak jak z wpisów ręcznych.
 *
 * Biegi i marsze nie stają się osobnymi wpisami: ich kroki są już w krokach dnia, więc
 * policzyłyby się dwa razy. Tętno, stres, Body Battery i sen tylko się pokazuje — bez punktów.
 */

/** `Activity.SPORT_CYCLING` w Connect IQ — numeracja sportów z protokołu FIT. */
export const SPORT_CYCLING = 2;

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Wcześniejszy czas to nie dawna aktywność, tylko zegar liczony od innej epoki. */
const EPOCH_MIN = Date.parse('2015-01-01T00:00:00Z') / 1000;

/**
 * Zakresy liczb z zegarka. Poza nimi to błąd czujnika albo zepsuty zapis, a nie wynik:
 * sto tysięcy kroków to limit wpisu ręcznego, tętno spoza 25–250 nie jest ludzkie.
 */
export const WATCH_LIMITS = {
  steps: [0, 100_000],
  meters: [0, 300_000],
  floors: [0, 1_000],
  active: [0, 1_440],
  sport: [0, 255],
  sec: [60, 86_400],
  actMeters: [0, 1_000_000],
  hr: [25, 250],
  pct: [0, 100],
} as const;

const L = WATCH_LIMITS;

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null;

const lim = (v: unknown, [min, max]: readonly [number, number]): number | null => num(v, min, max);

export interface WatchPayload {
  t: number;
  days: WatchDay[];
  acts: WatchActivity[];
  health: WatchHealth[];
}

function dayRow(r: unknown): WatchDay | null {
  if (!Array.isArray(r) || typeof r[0] !== 'string' || !DAY.test(r[0])) return null;
  const steps = lim(r[1], L.steps);
  if (steps === null) return null;
  return { day: r[0], steps, m: lim(r[2], L.meters), floors: lim(r[3], L.floors), active: lim(r[4], L.active) };
}

function actRow(r: unknown, t: number): WatchActivity | null {
  if (!Array.isArray(r)) return null;
  const start = num(r[0], EPOCH_MIN, t + 86_400);
  const sport = lim(r[1], L.sport);
  const sec = lim(r[2], L.sec);
  if (start === null || sport === null || sec === null) return null;
  return { start, sport, sec, m: lim(r[3], L.actMeters) };
}

function healthRow(r: unknown): WatchHealth | null {
  if (!Array.isArray(r) || typeof r[0] !== 'string' || !DAY.test(r[0])) return null;
  const h: WatchHealth = {
    day: r[0],
    rhr: lim(r[1], L.hr),
    hrMin: lim(r[2], L.hr),
    hrAvg: lim(r[3], L.hr),
    hrMax: lim(r[4], L.hr),
    stress: lim(r[5], L.pct),
    bbMin: lim(r[6], L.pct),
    bbMax: lim(r[7], L.pct),
    sleep: lim(r[8], L.pct),
  };
  // Dzień bez jednej liczby nic nie mówi — zegarek bez czujnika albo zdjęty z ręki.
  return Object.entries(h).some(([k, v]) => k !== 'day' && v !== null) ? h : null;
}

const rows = <T>(v: unknown, max: number, f: (r: unknown) => T | null): T[] =>
  (Array.isArray(v) ? v.slice(0, max) : []).map(f).filter((x): x is T => x !== null);

/**
 * Paczka z zegarka po odszyfrowaniu. Każdy wiersz sprawdzany osobno: zepsuty dzień odpada,
 * reszta wchodzi. `null`, gdy to nie jest paczka w znanej wersji albo jej czas wypada w
 * przyszłości (zegar zegarka może się spieszyć najwyżej o dobę).
 */
export function parsePayload(v: unknown, nowMs: number = Date.now()): WatchPayload | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const t = num(p.t, EPOCH_MIN, nowMs / 1000 + 86_400);
  if (p.v !== 1 || t === null) return null;
  return {
    t,
    days: rows(p.d, 31, dayRow),
    acts: rows(p.a, 50, (r) => actRow(r, t)),
    health: rows(p.h, 31, healthRow),
  };
}

const merged = <T, K>(old: T[], fresh: T[], key: (x: T) => K, order: (a: T, b: T) => number): T[] => {
  const m = new Map<K, T>();
  [...old, ...fresh].forEach((x) => m.set(key(x), x));
  return [...m.values()].sort(order);
};

const byDay = (a: { day: string }, b: { day: string }) => a.day.localeCompare(b.day);

/**
 * Dokłada paczkę do zapisu i mówi, czy coś się zmieniło. Starsza albo ta sama paczka nic nie
 * zmienia — przychodzi, gdy zegarek nie wysłał niczego od ostatniego otwarcia. W nowszej
 * każdy dzień zastępuje swój odpowiednik: licznik kroków w ciągu dnia tylko rośnie, a jeśli
 * spadł, to zegarek wiedział lepiej (reset, poprawka po synchronizacji).
 */
export function mergeWatch(state: AppState, p: WatchPayload, got: Date = new Date()): boolean {
  const w = state.watch;
  if (w && p.t <= w.t) return false;
  state.watch = {
    t: p.t,
    got: got.toISOString(),
    days: merged(w?.days ?? [], p.days, (d) => d.day, byDay),
    acts: merged(w?.acts ?? [], p.acts, (a) => a.start, (a, b) => a.start - b.start),
    health: merged(w?.health ?? [], p.health, (h) => h.day, byDay),
  };
  return true;
}

/** Dzień lokalny, jak na zegarku: przejazd o 23:30 należy do dnia, w którym się zaczął. */
const localDayOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Wpisy ruchu z zegarka: kroki dnia i przejazdy rowerem z drogą. Zakresów wpisu tu nie
 * sprawdzamy — robi to `cardioOf`, który dokłada je do wpisów ręcznych.
 */
export function watchEntries(w: WatchData | undefined): Cardio[] {
  if (!w) return [];
  const steps = w.days
    .filter((d) => d.steps > 0)
    .map(
      (d): Cardio => ({
        kind: 'steps',
        steps: d.steps,
        key: `watch-steps-${d.day}`,
        day: d.day,
        at: `${d.day}T23:59:59.000Z`,
        src: 'watch',
      }),
    );
  const rides = w.acts
    .filter((a) => a.sport === SPORT_CYCLING && a.m !== null && a.m > 0)
    .map((a): Cardio => {
      const at = new Date(a.start * 1000);
      return {
        kind: 'bike',
        kmh: Math.round((a.m! / a.sec) * 36) / 10,
        min: Math.round(a.sec / 60),
        key: `watch-ride-${a.start}`,
        day: localDayOf(at),
        at: at.toISOString(),
        src: 'watch',
      };
    });
  return [...steps, ...rides];
}

/** Kroki dnia z zegarka albo `null`, gdy zegarek o tym dniu nic nie mówi. */
export const watchStepsOn = (state: AppState, day: string): number | null =>
  state.watch?.days.find((d) => d.day === day)?.steps ?? null;

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Dane z zegarka z zapisu albo importu — przesiane tymi samymi zakresami co paczka. */
export function restoreWatch(v: unknown): WatchData | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const w = v as Record<string, unknown>;
  const t = num(w.t, EPOCH_MIN, Number.MAX_SAFE_INTEGER);
  if (t === null || typeof w.got !== 'string' || Number.isNaN(Date.parse(w.got))) return undefined;
  const all = Number.MAX_SAFE_INTEGER;
  return {
    t,
    got: w.got,
    days: rows(w.days, all, (x) => {
      const d = obj(x);
      return dayRow([d.day, d.steps, d.m, d.floors, d.active]);
    }),
    acts: rows(w.acts, all, (x) => {
      const a = obj(x);
      return actRow([a.start, a.sport, a.sec, a.m], all);
    }),
    health: rows(w.health, all, (x) => {
      const h = obj(x);
      return healthRow([h.day, h.rhr, h.hrMin, h.hrAvg, h.hrMax, h.stress, h.bbMin, h.bbMax, h.sleep]);
    }),
  };
}
