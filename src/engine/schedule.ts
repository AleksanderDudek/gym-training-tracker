import type { ActivePlan, AppState, PlanTemplate, PlannedDay } from '../types';

/**
 * Daty planu liczone są na `yyyy-mm-dd` w UTC — tak samo, jak historia ćwiczeń zapisuje
 * dzień (`toISOString().slice(0, 10)`). Mieszanie z czasem lokalnym przesuwałoby treningi
 * o jeden dzień u każdego, kto trenuje wieczorem na wschód od Greenwich.
 */
const MS_DAY = 86_400_000;

export const dayKey = (d: Date | string | number): string =>
  new Date(d).toISOString().slice(0, 10);

const parse = (key: string): number => Date.parse(`${key}T00:00:00Z`);

export const addDays = (key: string, n: number): string => dayKey(parse(key) + n * MS_DAY);

export const daysBetween = (a: string, b: string): number =>
  Math.round((parse(b) - parse(a)) / MS_DAY);

/** Poniedziałek tygodnia, w którym leży podana data. 1 = poniedziałek, 7 = niedziela. */
export const weekdayOf = (key: string): number => {
  const d = new Date(parse(key)).getUTCDay();
  return d === 0 ? 7 : d;
};

export const mondayOf = (key: string): string => addDays(key, 1 - weekdayOf(key));

/**
 * Rozpisanie planu na konkretne daty. Sesje idą po kolei przez cały plan, więc rotacja
 * treningów przesuwa się między tygodniami zamiast zamrażać ten sam trening na ten sam
 * dzień tygodnia przez trzy miesiące.
 */
export function buildSchedule(
  template: PlanTemplate,
  plan: ActivePlan,
  doneDates: Set<string>,
  today: string = dayKey(Date.now()),
): PlannedDay[] {
  const monday = mondayOf(plan.start);
  const out: PlannedDay[] = [];

  for (let w = 0; w < template.weeks; w++) {
    for (const wd of template.weekdays) {
      const date = addDays(monday, w * 7 + (wd - 1));
      // Tydzień startowy bywa napoczęty — dni sprzed startu nie są zaległościami.
      if (date < plan.start) continue;
      out.push({
        index: 0,
        date,
        weekday: wd,
        week: w + 1,
        workout: '',
        gap: 0,
        status: 'future',
      });
    }
  }

  out.sort((a, b) => (a.date < b.date ? -1 : 1));

  let prev: string | null = null;
  out.forEach((d, i) => {
    d.index = i;
    d.workout = template.cycle[i % template.cycle.length]!;
    d.gap = prev ? daysBetween(prev, d.date) - 1 : 0;
    prev = d.date;

    const done = doneDates.has(d.date) || plan.ticked[i] === true;
    d.status = done ? 'done' : d.date === today ? 'today' : d.date < today ? 'missed' : 'future';
  });

  return out;
}

/** Dni, w które cokolwiek zalogowano — stąd bierze się odhaczenie sesji planu. */
export const loggedDays = (state: AppState): Set<string> =>
  new Set(state.log.map((e) => dayKey(e.date)));

export interface PlanStats {
  total: number;
  done: number;
  missed: number;
  /** Sesje, których termin już minął (zrobione i opuszczone razem). */
  elapsed: number;
  /** Udział zrobionych w tych, których termin minął. */
  adherence: number | null;
  week: number;
  /** Najdłuższa zaplanowana przerwa między treningami. */
  maxGap: number;
  next: PlannedDay | null;
}

export function planStats(days: PlannedDay[], today: string = dayKey(Date.now())): PlanStats {
  const done = days.filter((d) => d.status === 'done').length;
  const missed = days.filter((d) => d.status === 'missed').length;
  const elapsed = done + missed;
  const next = days.find((d) => d.status === 'today' || d.status === 'future') ?? null;
  const current = days.find((d) => d.date >= today)?.week ?? days[days.length - 1]?.week ?? 1;

  return {
    total: days.length,
    done,
    missed,
    elapsed,
    adherence: elapsed ? Math.round((done / elapsed) * 100) : null,
    week: current,
    maxGap: days.reduce((m, d) => Math.max(m, d.gap), 0),
    next,
  };
}
