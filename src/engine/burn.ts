import { EX } from '../data/exercises';
import type { AppState, Cardio, ExerciseId, LogEntry, Snack, Workout } from '../types';
import { heightOf, latestWeight, weightOn } from './body';
import { cardioEnergy, setsEnergy } from './energy';
import type { Burn } from './energy';
import { cardioOf, cardioOn, stepsOn } from './cardio';
import type { ExerciseRow } from './history';
import { P } from './plan';
import { snacksOn } from './snacks';
import { dayKey } from './schedule';
import { blocksOf } from './blocks';
import { CIRCUIT_MOVE, ROUND_REST, baseRest } from './rests';

/**
 * Kalorie z tego, co zapisane: ruch wpisany ręcznie, treningi, pojedyncze ćwiczenia
 * i przekąski. Każda liczba bierze wagę z dnia, w którym ruch się odbył. Bez żadnego ważenia
 * funkcje zwracają `null` — lepiej zapytać o wagę, niż podstawić przeciętną i pokazać
 * liczbę, która wygląda na zmierzoną.
 */

export function cardioBurn(state: AppState, c: Cardio): Burn | null {
  const kg = weightOn(state, c.day);
  return kg === null ? null : cardioEnergy(c, kg, heightOf(state));
}

export interface ItemBurn {
  id: ExerciseId;
  secs: number;
  active: number;
}

export interface WorkoutBurn {
  /** Szacowany czas serii razem z przerwami. */
  secs: number;
  active: number;
  /** Rozbicie na ćwiczenia, w kolejności treningu. */
  items: ItemBurn[];
}

const sum = (items: ItemBurn[]): WorkoutBurn => ({
  secs: items.reduce((s, i) => s + i.secs, 0),
  active: items.reduce((s, i) => s + i.active, 0),
  items,
});

/**
 * Trening z dziennika. Czas liczy się z serii, a nie z zegara sesji: zegar mierzy też telefon
 * odłożony na godzinę i sesję zamkniętą następnego dnia, a serie mierzą pracę.
 */
export function workoutBurn(state: AppState, e: LogEntry): WorkoutBurn | null {
  const kg = weightOn(state, dayKey(e.date));
  if (kg === null) return null;
  return sum(
    e.items
      .filter((i) => EX[i.id])
      .map((i) => {
        const b = setsEnergy(i.id, i.sets, kg);
        return { id: i.id, secs: b.secs, active: b.active };
      }),
  );
}

/** Jedno ćwiczenie z jednej sesji — wiersz historii ćwiczenia. */
export function rowBurn(state: AppState, id: ExerciseId, row: ExerciseRow): number | null {
  const kg = weightOn(state, dayKey(row.date));
  return kg === null ? null : setsEnergy(id, row.reps.map((reps) => ({ reps })), kg).active;
}

/** Przekąska to jedna seria bez przerwy po niej. */
export function snackBurn(state: AppState, s: Snack): number | null {
  const kg = weightOn(state, dayKey(s.at));
  return kg === null ? null : setsEnergy(s.ex, [{ reps: s.reps }], kg, false).active;
}

/**
 * Szacunek przed treningiem: tyle, ile dałaby sesja na obecnym poziomie — serie razy cel
 * z progresji — przy ostatniej wadze. Próby i przejścia ciężaru są pominięte, bo to wyjątek
 * jednej sesji, a szacunek ma powiedzieć, czego się spodziewać zwykle.
 */
export function plannedBurn(state: AppState, w: Workout): WorkoutBurn | null {
  const kg = latestWeight(state)?.kg;
  if (kg === undefined) return null;
  // Przerwa po serii: z treningu, gdy ją podaje; w obwodzie przejście między stacjami i część
  // przerwy po rundzie przypadająca na jedną stację. Para zostaje przy przerwie rodzaju pracy.
  const rest = new Map<ExerciseId, number>();
  blocksOf(w.items).forEach((b) => {
    if (b.kind === 'straight') rest.set(b.ids[0]!, baseRest(w, b.ids[0]!));
    if (b.kind === 'circuit')
      b.ids.forEach((id) => rest.set(id, CIRCUIT_MOVE + Math.round((w.roundRest ?? ROUND_REST) / b.ids.length)));
  });
  return sum(
    w.items
      .filter((i) => EX[i.ex] && state.prog[i.ex])
      .map((i) => {
        const p = P(state, i.ex);
        const b = setsEnergy(i.ex, Array.from({ length: p.sets }, () => ({ reps: p.target })), kg, true, rest.get(i.ex));
        return { id: i.ex, secs: b.secs, active: b.active };
      }),
  );
}

/** Szacunek jednego ćwiczenia na obecnym poziomie — do atlasu. */
export function exercisePlannedBurn(state: AppState, id: ExerciseId): ItemBurn | null {
  const kg = latestWeight(state)?.kg;
  const p = state.prog[id];
  if (kg === undefined || !p || !EX[id]) return null;
  const b = setsEnergy(id, Array.from({ length: p.sets }, () => ({ reps: p.target })), kg);
  return { id, secs: b.secs, active: b.active };
}

export interface DayBurn {
  cardio: number;
  workouts: number;
  snacks: number;
  total: number;
  steps: number;
}

/** Cały dzień ruchu: wpisy, treningi i przekąski. `null`, dopóki nie ma żadnego ważenia. */
export function dayBurn(state: AppState, day: string): DayBurn | null {
  if (weightOn(state, day) === null) return null;
  const cardio = cardioOn(state, day).reduce((s, c) => s + (cardioBurn(state, c)?.active ?? 0), 0);
  const workouts = state.log
    .filter((e) => dayKey(e.date) === day)
    .reduce((s, e) => s + (workoutBurn(state, e)?.active ?? 0), 0);
  const snacks = snacksOn(state, day).reduce((s, x) => s + (snackBurn(state, x) ?? 0), 0);
  return { cardio, workouts, snacks, total: cardio + workouts + snacks, steps: stepsOn(state, day) };
}

/** Dni z jakimkolwiek ruchem wpisanym ręcznie, od najnowszego. */
export const cardioDays = (state: AppState): string[] =>
  [...new Set(cardioOf(state).map((c) => c.day))].sort().reverse();
