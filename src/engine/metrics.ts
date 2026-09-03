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

/** Partie ruchu w kolejności, w jakiej stoją w bibliotece ćwiczeń. */
export const GROUPS_OF_EX: string[] = [...new Set(Object.values(EX).map((e) => e.group))];

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

/** Czy w historii jest trening zamknięty po dwudziestej pierwszej. */
export const trainedLate = (log: LogEntry[]): boolean =>
  log.some((e) => new Date(e.date).getHours() >= 21);

/** Najdłuższy ciąg dni kalendarzowych z rzędu, w których padł jakikolwiek trening. */
export function dayStreak(days: DayTotals[]): number {
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    const prev = days[i - 1];
    run = prev && daysBetween(prev.day, d.day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Powtórzenia w rozbiciu na partie ruchu. Ćwiczenia liczone na czas nie wchodzą. */
export function repsByGroup(log: LogEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  GROUPS_OF_EX.forEach((g) => (out[g] = 0));

  log.forEach((e) =>
    e.items.forEach((it) => {
      const m = EX[it.id];
      if (!m || m.unit === 'secs') return;
      const f = sideFactor(it.id);
      out[m.group] = (out[m.group] ?? 0) + it.sets.reduce((a, r) => a + Math.max(0, r.reps) * f, 0);
    }),
  );

  return out;
}

/** Najdłuższa pojedyncza seria — osobno powtórzenia i osobno czas. */
export function bestSingleSet(log: LogEntry[]): { reps: number; secs: number } {
  let reps = 0;
  let secs = 0;

  log.forEach((e) =>
    e.items.forEach((it) => {
      const f = sideFactor(it.id);
      it.sets.forEach((r) => {
        const v = r.reps * f;
        if (isTime(it.id)) secs = Math.max(secs, v);
        else reps = Math.max(reps, v);
      });
    }),
  );

  return { reps, secs };
}

/** Najcięższy kettlebell, jaki w ogóle pojawił się w zapisanej serii. */
export const heaviestBell = (log: LogEntry[]): number =>
  log.reduce(
    (m, e) => Math.max(m, ...e.items.map((it) => Math.max(0, ...it.sets.map((s) => s.w ?? 0)))),
    0,
  );

/** Najwyższe szacowane maksimum na jedno powtórzenie w całej historii. */
export function bestE1rm(state: AppState): number {
  return Object.values(state.prog).reduce(
    (m, p) => Math.max(m, p.e1rm ?? 0, ...p.hist.map((h) => h.e1rm ?? 0)),
    0,
  );
}

/**
 * Suma etapów w ćwiczeniach z masą ciała. Podciąganie, pompki i core mają po pięć etapów,
 * więc komplet to dwanaście kroków ponad start — jedyna miara postępu, w której ciężar
 * kettlebella nie gra żadnej roli.
 */
export function stageSum(state: AppState): number {
  return Object.entries(state.prog).reduce(
    (n, [id, p]) => (EX[id]?.stages ? n + (p.stage ?? 0) : n),
    0,
  );
}

export interface Metrics {
  workouts: number;
  sets: number;
  exercises: number;
  /** Ile różnych ćwiczeń w ogóle się pojawiło. */
  distinct: number;
  reps: number;
  secs: number;
  tonnage: number;
  /** Rekordy z przesuwanego okna. Nazwy mówią o długości okna, nie o kartce z kalendarza. */
  best: {
    dayReps: number;
    daySets: number;
    dayTonnage: number;
    weekReps: number;
    weekSets: number;
    weekWorkouts: number;
    twoWeekReps: number;
    twoWeekWorkouts: number;
    threeWeekReps: number;
    threeWeekWorkouts: number;
    monthReps: number;
    monthSets: number;
    monthExercises: number;
    monthWorkouts: number;
    monthTonnage: number;
    quarterWorkouts: number;
    quarterReps: number;
    halfYearWorkouts: number;
    halfYearReps: number;
    yearWorkouts: number;
    yearReps: number;
    /** Najdłuższa pojedyncza seria i najdłuższy pojedynczy podchód na czas. */
    set: number;
    hold: number;
    /** Najcięższa pojedyncza sesja. */
    sessionTonnage: number;
  };
  steadyWeeks: number;
  /** Najdłuższy ciąg dni z rzędu z treningiem. */
  dayStreak: number;
  noDropDays: number;
  heldForm: number;
  heavier: number;
  comebacks: number;
  /** Najcięższy użyty kettlebell i najwyższe szacowane maksimum. */
  heaviest: number;
  e1rm: number;
  /** Suma etapów w ćwiczeniach z masą ciała. */
  stages: number;
  /** Powtórzenia w rozbiciu na partie ruchu. */
  byGroup: Record<string, number>;
  early: boolean;
  late: boolean;
  days: DayTotals[];
}

export function metrics(state: AppState): Metrics {
  const days = dailyTotals(state.log);
  const sum = (pick: (d: DayTotals) => number): number => days.reduce((a, d) => a + pick(d), 0);
  const distinct = new Set<string>();
  state.log.forEach((e) => e.items.forEach((it) => distinct.add(it.id)));
  const single = bestSingleSet(state.log);

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
      dayTonnage: Math.round(windowMax(days, 1, (d) => d.tonnage)),
      weekReps: windowMax(days, 7, (d) => d.reps),
      weekSets: windowMax(days, 7, (d) => d.sets),
      weekWorkouts: windowMax(days, 7, (d) => d.workouts),
      twoWeekReps: windowMax(days, 14, (d) => d.reps),
      twoWeekWorkouts: windowMax(days, 14, (d) => d.workouts),
      threeWeekReps: windowMax(days, 21, (d) => d.reps),
      threeWeekWorkouts: windowMax(days, 21, (d) => d.workouts),
      monthReps: windowMax(days, 30, (d) => d.reps),
      monthSets: windowMax(days, 30, (d) => d.sets),
      monthExercises: windowMax(days, 30, (d) => d.exercises),
      monthWorkouts: windowMax(days, 30, (d) => d.workouts),
      monthTonnage: Math.round(windowMax(days, 30, (d) => d.tonnage)),
      quarterWorkouts: windowMax(days, 90, (d) => d.workouts),
      quarterReps: windowMax(days, 90, (d) => d.reps),
      halfYearWorkouts: windowMax(days, 180, (d) => d.workouts),
      halfYearReps: windowMax(days, 180, (d) => d.reps),
      yearWorkouts: windowMax(days, 365, (d) => d.workouts),
      yearReps: windowMax(days, 365, (d) => d.reps),
      set: single.reps,
      hold: single.secs,
      sessionTonnage: Math.round(
        state.log.reduce(
          (m, e) =>
            Math.max(
              m,
              e.items.reduce(
                (a, it) =>
                  a +
                  it.sets.reduce(
                    (b, r) =>
                      b + (EX[it.id]?.unit === 'secs' ? 0 : (r.w ?? 0) * r.reps * sideFactor(it.id)),
                    0,
                  ),
                0,
              ),
            ),
          0,
        ),
      ),
    },
    steadyWeeks: steadyWeeks(days),
    dayStreak: dayStreak(days),
    noDropDays: noDropDays(state, days),
    heldForm: heldForm(state),
    heavier: wentHeavier(state),
    comebacks: comebacksHeld(state.log),
    heaviest: heaviestBell(state.log),
    e1rm: Math.round(bestE1rm(state) * 10) / 10,
    stages: stageSum(state),
    byGroup: repsByGroup(state.log),
    early: trainedEarly(state.log),
    late: trainedLate(state.log),
    days,
  };
}
