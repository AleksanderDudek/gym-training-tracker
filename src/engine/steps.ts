import { blocksOf, tagOf } from './blocks';
import type { Block } from './blocks';
import { plan } from './plan';
import type { AppState, ExerciseId, Session, Workout } from '../types';

/**
 * Kolejka serii sesji: jedna seria na raz, w kolejności, w jakiej się je robi.
 *
 * Liczba serii każdego ćwiczenia przychodzi z jego progresji (`plan`), tak jak w widoku listy —
 * kolejka tylko ustawia je w czasie. Serie pod rząd idą jedna za drugą, para na zmianę,
 * a obwód runda po rundzie. Która seria jest teraz, wynika z tego, co już zapisano w sesji,
 * więc odświeżenie strony ani przejście do listy niczego nie gubi.
 */

export interface Step {
  ex: ExerciseId;
  /** Numer serii tego ćwiczenia, od jedynki. */
  set: number;
  /** Ile serii ma to ćwiczenie dziś. */
  of: number;
  /** Numer bloku i oznaczenie w nim: „3”, „2A”, „4C”. */
  block: number;
  tag: string;
  kind: Block['kind'];
  /** Obwód: runda i liczba rund — tyle, ile serii ma najdłuższa stacja. */
  round?: number;
  rounds?: number;
}

export function sessionSteps(state: AppState, w: Workout): Step[] {
  const out: Step[] = [];
  blocksOf(w.items).forEach((b) => {
    const sets = b.ids.map((id) => plan(state, id).length);
    const longest = Math.max(...sets);
    const step = (i: number, set: number): Step => ({
      ex: b.ids[i]!,
      set,
      of: sets[i]!,
      block: b.n,
      tag: tagOf(b, i),
      kind: b.kind,
      ...(b.kind === 'circuit' ? { round: set, rounds: longest } : {}),
    });
    if (b.kind === 'straight') {
      for (let s = 1; s <= sets[0]!; s++) out.push(step(0, s));
      return;
    }
    // Para i obwód: kolejne serie na zmianę; ćwiczenie z mniejszą liczbą serii wypada wcześniej.
    for (let s = 1; s <= longest; s++)
      b.ids.forEach((_, i) => {
        if (s <= sets[i]!) out.push(step(i, s));
      });
  });
  return out;
}

export const loggedSets = (s: Session, id: ExerciseId): number => s.res[id]?.rows.length ?? 0;

/**
 * Pierwsza seria, której jeszcze nie ma w zapisie, albo -1, gdy wszystko zrobione. Ćwiczenie
 * pominięte albo zamknięte w widoku listy (choćby z mniejszą liczbą serii) już nie czeka.
 */
export function cursorOf(steps: readonly Step[], s: Session): number {
  return steps.findIndex((st) => !s.skip[st.ex] && !s.done[st.ex] && loggedSets(s, st.ex) < st.set);
}
