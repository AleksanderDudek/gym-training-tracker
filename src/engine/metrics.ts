import { EX } from '../data/exercises';
import type { AppState, LogEntry } from '../types';
import { dayKey, daysBetween, mondayOf } from './schedule';

/**
 * Warstwa liczb. Wszystko, co da się policzyć z historii treningów, liczy się tutaj raz,
 * a odznaki tylko porównują wynik z progiem. Dzięki temu warunek odznaki mieści się w jednej
 * linijce i nie da się go po cichu rozjechać z tym, co pokazuje ekran.
 */

/** Dobowa zbiorcza. Dwa treningi tego samego dnia to jeden dzień i dwie sesje. */
export interface DayTotals {
  day: string;
  workouts: number;
  /** Powtórzenia z ćwiczeń liczonych na powtórzenia. Strona liczy się osobno. */
  reps: number;
  /** Sekundy z ćwiczeń liczonych na czas — nie mieszają się z powtórzeniami. */
  secs: number;
  sets: number;
  /** Wpisy ćwiczeń: jedno ćwiczenie w jednej sesji to jedna sztuka. */
  exercises: number;
  /**
   * Ciężar razy powtórzenia. Świadomie inny niż `sessionTonnage` z `math.ts`: tam sekundy
   * spaceru farmera wchodzą do wzoru jako obciążenie i tak ma zostać, bo na tej liczbie
   * skalibrowany jest wskaźnik przeciążenia. Tutaj liczy się dorobek, a czterdzieści sekund
   * marszu z dwudziestką to nie jest osiemset kilogramów podniesionych.
   */
  tonnage: number;
}

/** Ćwiczenie na stronę robi się dwa razy, więc liczy się dwa razy. */
const sideFactor = (id: string): number => (EX[id]?.side ? 2 : 1);

const isTime = (id: string): boolean => EX[id]?.unit === 'secs';

export function dailyTotals(log: LogEntry[]): DayTotals[] {
  const byDay = new Map<string, DayTotals>();

  log.forEach((e) => {
    const day = dayKey(e.date);
    const t =
      byDay.get(day) ??
      { day, workouts: 0, reps: 0, secs: 0, sets: 0, exercises: 0, tonnage: 0 };

    t.workouts++;

    e.items.forEach((it) => {
      const rows = it.sets.filter((r) => r.reps > 0);
      if (!rows.length) return;
      t.exercises++;
      t.sets += rows.length;
      const f = sideFactor(it.id);
      const sum = rows.reduce((a, r) => a + r.reps * f, 0);
      if (isTime(it.id)) {
        t.secs += sum;
        return;
      }
      t.reps += sum;
      t.tonnage += rows.reduce((a, r) => a + (r.w ?? 0) * r.reps * f, 0);
    });

    byDay.set(day, t);
  });

  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/**
 * Najlepsze okno o zadanej długości. Liczone przesuwanym oknem po dniach z treningiem,
 * więc „najlepszy miesiąc” znaczy dowolne trzydzieści dni z rzędu, a nie miesiąc z kalendarza.
 */
export function windowMax(
  days: DayTotals[],
  span: number,
  pick: (d: DayTotals) => number,
): number {
  let best = 0;
  let sum = 0;
  let left = 0;

  days.forEach((d) => {
    sum += pick(d);
    while (daysBetween(days[left]!.day, d.day) > span - 1) {
      sum -= pick(days[left]!);
      left++;
    }
    best = Math.max(best, sum);
  });

  return best;
}

/**
 * Najdłuższy ciąg kolejnych tygodni kalendarzowych, w których padło co najmniej `min` treningów.
 * Tygodnie muszą po sobie następować — miesiąc przerwy przerywa ciąg, choćby po obu stronach
 * było gęsto.
 */
export function steadyWeeks(days: DayTotals[], min = 2): number {
  const weeks = new Map<string, number>();
  days.forEach((d) => {
    const w = mondayOf(d.day);
    weeks.set(w, (weeks.get(w) ?? 0) + d.workouts);
  });

  const keys = [...weeks.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;

  keys.forEach((k) => {
    if ((weeks.get(k) ?? 0) < min) {
      run = 0;
      prev = k;
      return;
    }
    run = prev !== null && daysBetween(prev, k) === 7 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  });

  return best;
}

/** Dzień ostatniego zejścia z ciężaru w dowolnym ćwiczeniu. */
export function lastDropDay(state: AppState): string | null {
  let last: string | null = null;
  Object.values(state.prog).forEach((p) => {
    p.hist.forEach((h, i) => {
      const prev = p.hist[i - 1];
      if (!prev || prev.w === null || h.w === null || h.w >= prev.w) return;
      const day = dayKey(h.d);
      if (last === null || day > last) last = day;
    });
  });
  return last;
}

/**
 * Ile dni utrzymuje się poziom bez ani jednego zejścia z ciężaru. Liczone do dnia ostatniego
 * treningu, a nie do dzisiaj — inaczej najdłuższą passę „bez cofnięcia” miałby ktoś, kto
 * przestał trenować.
 */
export function noDropDays(state: AppState, days: DayTotals[]): number {
  const first = days[0]?.day;
  const last = days[days.length - 1]?.day;
  if (!first || !last) return 0;
  const drop = lastDropDay(state);
  const from = drop && drop > first ? drop : first;
  return Math.max(0, daysBetween(from, last));
}

/**
 * Ile ćwiczeń stoi blisko własnego szczytu. To miara utrzymania, nie wzrostu: liczy się, że
 * poziom nie odjechał w dół, choćby od miesięcy nie było żadnego rekordu.
 */
export function heldForm(state: AppState, minPoints = 6, share = 0.95): number {
  return Object.values(state.prog).filter((p) => {
    const points = p.hist.filter((h) => h.e1rm !== null);
    if (points.length < minPoints) return false;
    const peak = Math.max(...points.map((h) => h.e1rm!));
    const now = p.e1rm ?? points[points.length - 1]!.e1rm!;
    return peak > 0 && now >= peak * share;
  }).length;
}

/** Ile ćwiczeń stoi dziś na cięższym kettlebellu niż na starcie swojej historii. */
export function wentHeavier(state: AppState): number {
  return Object.values(state.prog).filter((p) => {
    const weighted = p.hist.filter((h) => h.w !== null);
    const first = weighted[0]?.w;
    const last = weighted[weighted.length - 1]?.w;
    return first != null && last != null && last > first;
  }).length;
}

const maxWeight = (e: LogEntry): number =>
  e.items.reduce((m, it) => Math.max(m, ...it.sets.map((s) => s.w ?? 0)), 0);

/**
 * Ile razy powrót po przerwie skończył się odzyskaniem poziomu: po co najmniej czternastu
 * dniach bez treningu ciężar w ciągu kolejnych trzydziestu dni wrócił tam, gdzie był przed
 * przerwą. Nagradza wracanie, nie samo nieznikanie.
 */
export function comebacksHeld(log: LogEntry[], gap = 14, span = 30): number {
  const sorted = [...log].sort((a, b) => (a.date < b.date ? -1 : 1));
  let n = 0;

  sorted.forEach((entry, i) => {
    const prev = sorted[i - 1];
    if (!prev) return;
    const before = dayKey(prev.date);
    const after = dayKey(entry.date);
    if (daysBetween(before, after) < gap) return;

    const peakBefore = sorted
      .filter((e) => {
        const d = dayKey(e.date);
        return d <= before && daysBetween(d, before) <= span;
      })
      .reduce((m, e) => Math.max(m, maxWeight(e)), 0);

    const peakAfter = sorted
      .filter((e) => {
        const d = dayKey(e.date);
        return d >= after && daysBetween(after, d) <= span;
      })
      .reduce((m, e) => Math.max(m, maxWeight(e)), 0);

    if (peakBefore > 0 && peakAfter >= peakBefore) n++;
  });

  return n;
}

/** Czy w historii jest trening zamknięty przed ósmą rano. Godzina lokalna, nie UTC. */
export const trainedEarly = (log: LogEntry[]): boolean =>
  log.some((e) => new Date(e.date).getHours() < 8);

export interface Metrics {
  workouts: number;
  sets: number;
  exercises: number;
  /** Ile różnych ćwiczeń w ogóle się pojawiło. */
  distinct: number;
  reps: number;
  secs: number;
  tonnage: number;
  /** Rekordy z przesuwanego okna. */
  best: {
    dayReps: number;
    daySets: number;
    weekReps: number;
    weekWorkouts: number;
    twoWeekWorkouts: number;
    threeWeekWorkouts: number;
    monthWorkouts: number;
    monthTonnage: number;
    quarterWorkouts: number;
    quarterReps: number;
  };
  steadyWeeks: number;
  noDropDays: number;
  heldForm: number;
  heavier: number;
  comebacks: number;
  early: boolean;
  days: DayTotals[];
}

export function metrics(state: AppState): Metrics {
  const days = dailyTotals(state.log);
  const sum = (pick: (d: DayTotals) => number): number => days.reduce((a, d) => a + pick(d), 0);
  const distinct = new Set<string>();
  state.log.forEach((e) => e.items.forEach((it) => distinct.add(it.id)));

  return {
    workouts: state.log.length,
    sets: sum((d) => d.sets),
    exercises: sum((d) => d.exercises),
    distinct: distinct.size,
    reps: sum((d) => d.reps),
    secs: sum((d) => d.secs),
    tonnage: Math.round(sum((d) => d.tonnage)),
    best: {
      dayReps: windowMax(days, 1, (d) => d.reps),
      daySets: windowMax(days, 1, (d) => d.sets),
      weekReps: windowMax(days, 7, (d) => d.reps),
      weekWorkouts: windowMax(days, 7, (d) => d.workouts),
      twoWeekWorkouts: windowMax(days, 14, (d) => d.workouts),
      threeWeekWorkouts: windowMax(days, 21, (d) => d.workouts),
      monthWorkouts: windowMax(days, 30, (d) => d.workouts),
      monthTonnage: Math.round(windowMax(days, 30, (d) => d.tonnage)),
      quarterWorkouts: windowMax(days, 90, (d) => d.workouts),
      quarterReps: windowMax(days, 90, (d) => d.reps),
    },
    steadyWeeks: steadyWeeks(days),
    noDropDays: noDropDays(state, days),
    heldForm: heldForm(state),
    heavier: wentHeavier(state),
    comebacks: comebacksHeld(state.log),
    early: trainedEarly(state.log),
    days,
  };
}
