import { profileOf } from './energy';
import type { Step } from './steps';
import type { AppState, ExerciseId, Workout } from '../types';

/**
 * Przerwy w sesji: ile trwają i kiedy się zmieniają.
 *
 * **Punkt wyjścia** to rodzaj pracy (`energy.ts`, za ACSM 2009): ciężkie wielostawowe 2 minuty,
 * izolacje i ciężar ciała krócej, balistyka najkrócej. Trening może to nadpisać — trener, który
 * pisze „2 minuty przerwy między seriami”, wie, co robi.
 *
 * **W treningu siłowym przerwa nie jest dźwignią progresji.** Postęp idzie z powtórzeń
 * i ciężaru, a dłuższa przerwa pozwala zrobić więcej pracy w kolejnych seriach (Schoenfeld i in.
 * 2016 — 3 min dały więcej siły i masy niż 1 min; przegląd Grgica i in. 2018 — w ćwiczeniach
 * wielostawowych ponad 2 minuty). Dlatego aplikacja nigdy sama jej nie skraca. Wydłuża ją za to
 * o 30 s (najwyżej o minutę), gdy w ostatnich sesjach ostatnia seria wyraźnie odstawała od
 * pierwszej — i wraca do punktu wyjścia, gdy serie pójdą równo.
 *
 * **W obwodzie jest odwrotnie.** Celem jest gęstość pracy i kondycja, więc ta sama praca
 * w krótszym czasie to postęp: każdy obwód zrobiony równo skraca przerwę po rundzie o 15 s
 * (do minuty), a rundy, które wyraźnie słabły, albo „Na maksa” wydłużają ją z powrotem.
 *
 * Wszystko wynika z historii, nic nie jest zapamiętywane osobno — jak reszta stanu aplikacji.
 */

/** Przerwa między ćwiczeniami pary w sekundach — środek zalecanych 60–90 s. */
export const PAIR_REST = 75;
/** Przejście między stacjami obwodu — tyle, ile trwa zmiana miejsca i sprzętu. */
export const CIRCUIT_MOVE = 20;
/** Przerwa po rundzie obwodu, gdy trening jej nie podaje — w zaleceniach 1–3 minuty. */
export const ROUND_REST = 120;
export const REST_STEP = 30;
export const REST_STEPS_MAX = 2;
export const ROUND_STEP = 15;
export const ROUND_FLOOR = 60;
/** O ile przerwa po rundzie może urosnąć ponad punkt wyjścia. */
export const ROUND_CAP = 60;
/** Ostatnia seria słabsza od pierwszej o tyle albo więcej to wyraźne słabnięcie. */
export const FADE = 0.2;

export const restSecs = (id: ExerciseId): number => profileOf(id).rest;

export const baseRest = (w: Workout, id: ExerciseId): number => w.rest ?? restSecs(id);

/** „45 s”, „75 s”, „1,5 min”, „2 min”, „2,5 min”. */
export function restLabel(secs: number): string {
  if (secs < 90) return `${secs} s`;
  const min = Math.round((secs / 60) * 2) / 2;
  return `${String(min).replace('.', ',')} min`;
}

/**
 * Czy serie wyraźnie słabły: ostatnia o co najmniej 20% poniżej pierwszej. Seria testowa
 * na końcu albo cięższe serie na początku dają ostatnią wyższą — to nie słabnięcie.
 */
export function faded(reps: readonly number[]): boolean {
  const done = reps.filter((r) => r > 0);
  if (done.length < 2) return false;
  const first = done[0]!;
  const last = done[done.length - 1]!;
  return first > 0 && (first - last) / first >= FADE;
}

/** Dokładka do przerwy po serii: 30 s za każdą ostatnią słabnącą sesję, najwyżej dwie. */
export function restBump(state: AppState, id: ExerciseId): number {
  const hist = state.prog[id]?.hist ?? [];
  let n = 0;
  for (let i = hist.length - 1; i >= 0 && n < REST_STEPS_MAX; i--) {
    if (!faded(hist[i]!.reps)) break;
    n++;
  }
  return n * REST_STEP;
}

/** Przerwa po rundzie obwodu tego treningu — z jego dotychczasowych sesji. */
export function roundRestOf(state: AppState, w: Workout): { secs: number; why: string | null } {
  const base = w.roundRest ?? ROUND_REST;
  const floor = Math.min(base, ROUND_FLOOR);
  const stations = new Set(w.items.filter((i) => i.circuit).map((i) => i.ex));
  let secs = base;
  state.log
    .filter((e) => (e.wid ? e.wid === w.id : e.workout === w.name))
    .forEach((e) => {
      const done = e.items.filter((it) => stations.has(it.id));
      if (!done.length) return;
      const clean = done.every((it) => it.effort !== 'max' && !faded(it.sets.map((r) => r.reps)));
      secs = clean ? Math.max(floor, secs - ROUND_STEP) : Math.min(base + ROUND_CAP, secs + ROUND_STEP);
    });
  const why =
    secs < base
      ? `O ${base - secs} s krócej niż na starcie: ostatnie obwody szły równo, a ta sama praca w krótszym czasie to lepsza kondycja.`
      : secs > base
        ? `O ${secs - base} s dłużej niż na starcie: w ostatnich obwodach późniejsze rundy wyraźnie słabły.`
        : null;
  return { secs, why };
}

export interface RestPlan {
  secs: number;
  /** Zdanie dla ćwiczącego, gdy przerwa odbiega od punktu wyjścia. */
  why: string | null;
  /** Po serii tego samego ćwiczenia, między partnerami pary, między stacjami, po rundzie, przed kolejnym blokiem. */
  kind: 'set' | 'pair' | 'move' | 'round' | 'next';
}

/** Przerwa po kroku `a`, zanim przyjdzie `b`. `null` — to był ostatni krok sesji. */
export function restBetween(state: AppState, w: Workout, a: Step, b: Step | null): RestPlan | null {
  if (!b) return null;
  const sameBlock = b.block === a.block;
  if (a.kind === 'circuit') {
    if (sameBlock && b.round === a.round) return { secs: CIRCUIT_MOVE, why: null, kind: 'move' };
    const r = roundRestOf(state, w);
    return { secs: r.secs, why: r.why, kind: sameBlock ? 'round' : 'next' };
  }
  if (a.kind === 'pair' && sameBlock && b.ex !== a.ex) return { secs: PAIR_REST, why: null, kind: 'pair' };
  const base = baseRest(w, a.ex);
  if (!sameBlock) return { secs: base, why: null, kind: 'next' };
  const bump = restBump(state, a.ex);
  return {
    secs: base + bump,
    why: bump
      ? `O ${bump} s dłużej niż zwykle: ostatnio ostatnia seria wyraźnie odstawała od pierwszej. Wróci do ${restLabel(base)}, gdy serie pójdą równo.`
      : null,
    kind: 'set',
  };
}
