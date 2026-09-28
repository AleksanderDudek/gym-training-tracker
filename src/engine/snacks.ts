import { EX } from '../data/exercises';
import type { AppState, ExerciseId, Snack } from '../types';
import { dayKey, daysBetween, mondayOf } from './schedule';

/**
 * Przekąski ruchowe.
 *
 * Krótka seria poza treningiem — dziesięć przysiadów przy biurku, minuta deski w przerwie.
 * Badania nad takimi „przekąskami” (kilkadziesiąt sekund do kilku minut, kilka razy dziennie)
 * pokazują poprawę wydolności i przerwanie długiego siedzenia, więc liczy się tu rozłożenie
 * w ciągu dnia, a nie objętość jednej serii.
 *
 * Przekąski mieszkają osobno od dziennika treningów. Dziennik karmi silnik progresji
 * i kalendarz planu, a dziesięć pompek nie może ani podnieść celu serii, ani domknąć terminu
 * treningu. Wchodzą za to do odznak ćwiczeń i do punktów doświadczenia postaci.
 */

/**
 * Górna granica jednej przekąski. Przekąska trwa od kilkudziesięciu sekund do kilku minut;
 * pięćset powtórzeń albo pół godziny to już nie przekąska, tylko literówka w formularzu.
 */
export const SNACK_MAX = { reps: 500, secs: 1800 } as const;

export const snackMax = (ex: ExerciseId): number =>
  EX[ex]?.unit === 'secs' ? SNACK_MAX.secs : SNACK_MAX.reps;

/** Zapisy starsze niż ta funkcja nie mają listy przekąsek — traktujemy to jak pustą. */
export const snacksOf = (state: AppState): Snack[] => state.snacks ?? [];

/** Czy wpis nadaje się do zapisu: znane ćwiczenie i dodatnia liczba powtórzeń albo sekund. */
export const validSnack = (s: Partial<Snack> | null | undefined): s is Snack =>
  !!s &&
  typeof s.key === 'string' &&
  typeof s.at === 'string' &&
  !Number.isNaN(Date.parse(s.at)) &&
  typeof s.ex === 'string' &&
  !!EX[s.ex] &&
  typeof s.reps === 'number' &&
  s.reps > 0 &&
  (s.w === null || typeof s.w === 'number');

/**
 * Dopisuje przekąskę i ją zwraca. Klucz bierze się ze znacznika czasu i numeru kolejnego
 * w tej samej milisekundzie, więc jest powtarzalny w testach i unikalny w praktyce.
 */
export function addSnack(
  state: AppState,
  ex: ExerciseId,
  reps: number,
  w: number | null,
  now: number = Date.now(),
): Snack {
  if (!EX[ex]) throw new Error(`Nieznane ćwiczenie: ${ex}`);
  const n = Math.round(reps);
  if (!(n > 0)) throw new Error('Przekąska potrzebuje dodatniej liczby powtórzeń albo sekund.');
  if (n > snackMax(ex)) throw new Error(`Przekąska ma najwyżej ${snackMax(ex)} — to wygląda na literówkę.`);
  state.snacks ??= [];
  const same = state.snacks.filter((s) => s.key.startsWith(`${now}-`)).length;
  const snack: Snack = {
    key: `${now}-${same}`,
    at: new Date(now).toISOString(),
    ex,
    reps: n,
    w: w && w > 0 ? w : null,
  };
  state.snacks.push(snack);
  return snack;
}

export function removeSnack(state: AppState, key: string): boolean {
  const list = snacksOf(state);
  const i = list.findIndex((s) => s.key === key);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/** Przekąski z jednego dnia, od najwcześniejszej. */
export const snacksOn = (state: AppState, day: string): Snack[] =>
  snacksOf(state)
    .filter((s) => dayKey(s.at) === day)
    .sort((a, b) => a.at.localeCompare(b.at));

/**
 * Ćwiczenia na start, zanim ktoś zapisze pierwszą przekąskę: cztery ruchy bez sprzętu,
 * które da się zrobić przy biurku albo w kuchni.
 */
export const SNACK_SUGGESTED: readonly ExerciseId[] = ['squat_air', 'pushup', 'plank', 'burpee'];

/**
 * Skróty do ćwiczeń: ostatnio robione jako przekąska, od najnowszego, dopełnione propozycjami
 * na start. Same ćwiczenia, bez liczb — liczbę wpisuje się dopiero w widoku zapisu, bo nikt
 * nie robi dwa razy dokładnie tyle samo, a gotowa liczba na przycisku zachęcała do zapisania
 * nie tego, co było.
 */
export function recentExercises(
  state: AppState,
  n = 4,
  suggested: readonly ExerciseId[] = SNACK_SUGGESTED,
): ExerciseId[] {
  const out: ExerciseId[] = [];
  [...snacksOf(state)]
    .sort((a, b) => b.at.localeCompare(a.at))
    .forEach((s) => {
      if (!out.includes(s.ex)) out.push(s.ex);
    });
  suggested.forEach((id) => {
    if (EX[id] && !out.includes(id)) out.push(id);
  });
  return out.slice(0, n);
}

/**
 * Podpowiedź do pustego pola: ile było ostatnim razem i jakim ciężarem. Tylko podpowiedź —
 * pole zostaje puste, żeby wpisać to, co naprawdę było, a nie zatwierdzić cudzą liczbę.
 * Bez wcześniejszej przekąski tym ruchem nie ma czego podpowiadać, więc oba pola są puste.
 */
export function snackHint(state: AppState, ex: ExerciseId): { last: number | null; w: number | null } {
  const last = [...snacksOf(state)]
    .filter((s) => s.ex === ex)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return last ? { last: last.reps, w: last.w } : { last: null, w: null };
}

/** Dzisiejsze przekąski zsumowane po ćwiczeniu. */
export interface SnackDay {
  ex: ExerciseId;
  /** Suma powtórzeń albo sekund. */
  total: number;
  /** Ile przekąsek tym ćwiczeniem. */
  count: number;
  /** Pora ostatniej, ISO — do kolejności „najświeższe na górze”. */
  last: string;
}

export function snacksByExercise(state: AppState, day: string): SnackDay[] {
  const out = new Map<ExerciseId, SnackDay>();
  snacksOn(state, day).forEach((s) => {
    const d = out.get(s.ex) ?? { ex: s.ex, total: 0, count: 0, last: s.at };
    d.total += s.reps;
    d.count++;
    d.last = s.at;
    out.set(s.ex, d);
  });
  return [...out.values()].sort((a, b) => b.last.localeCompare(a.last));
}

export interface SnackStats {
  count: number;
  /** Najwięcej przekąsek w jednym dniu. */
  bestDay: number;
  /** Najdłuższy ciąg dni z rzędu z co najmniej jedną przekąską. */
  run: number;
  /** Pełne tygodnie, od poniedziałku do niedzieli, z przekąską każdego dnia. */
  fullWeeks: number;
  /** Ile różnych ćwiczeń poszło jako przekąska. */
  distinct: number;
  /** Liczba przekąsek na dzień `yyyy-mm-dd`. */
  byDay: Record<string, number>;
}

export function snackStats(snacks: Snack[]): SnackStats {
  const byDay: Record<string, number> = {};
  const kinds = new Set<string>();
  snacks.forEach((s) => {
    const d = dayKey(s.at);
    byDay[d] = (byDay[d] ?? 0) + 1;
    kinds.add(s.ex);
  });

  const days = Object.keys(byDay).sort();
  let run = 0;
  let best = 0;
  days.forEach((d, i) => {
    const prev = days[i - 1];
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });

  // Tydzień jest pełny, gdy ma siedem różnych dni z przekąską — dni w obrębie jednego
  // tygodnia kalendarzowego nie mogą się powtórzyć, więc wystarczy je policzyć.
  const perWeek = new Map<string, number>();
  days.forEach((d) => {
    const w = mondayOf(d);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  });

  return {
    count: snacks.length,
    bestDay: Math.max(0, ...Object.values(byDay)),
    run: best,
    fullWeeks: [...perWeek.values()].filter((n) => n === 7).length,
    distinct: kinds.size,
    byDay,
  };
}
