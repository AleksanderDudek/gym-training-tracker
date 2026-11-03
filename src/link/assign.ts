import type { AssignmentV1 } from '@gymtracker/link';
import { BUILTIN, EX } from '../data/exercises';
import type { AppState, PlanTemplate, Workout } from '../types';

/**
 * Plan i trening od prowadzącego stają się planem i treningiem **własnym** — z numerami w osobnej
 * przestrzeni (`coach-<8 znaków zalecenia>-<numer>`), żeby nie nadpisały niczego, co podopieczny
 * ułożył sam, i żeby drugie „Uruchom” tego samego zalecenia podmieniło poprzednią kopię zamiast
 * dokładać drugą. Potem zwykła droga: podgląd planu albo treningu i start jak każdy inny.
 *
 * Ćwiczenia spoza atlasu (`EX`) odpadają — prowadzący mógł pisać pod nowszą wersję aplikacji.
 * Ekran mówi, które. Trening, któremu nie zostało żadne ćwiczenie, odpada razem z miejscem
 * w rotacji planu; plan bez rotacji się nie da uruchomić (`null`).
 */

type PlanBody = Extract<AssignmentV1['body'], { kind: 'plan' }>;
type WorkoutBody = Extract<AssignmentV1['body'], { kind: 'workout' }>;

export const coachPrefix = (assignmentId: string): string => `coach-${assignmentId.replace(/-/g, '').slice(0, 8).toLowerCase()}-`;

export const coachId = (assignmentId: string, id: string): string => `${coachPrefix(assignmentId)}${id}`;

/** Czy trening albo plan przyszedł od prowadzącego. */
export const isFromCoach = (id: string): boolean => /^coach-[0-9a-f]{8}-/.test(id);

function cleanItems(w: Workout, skipped: Set<string>): Workout['items'] {
  return w.items.filter((i) => {
    if (EX[i.ex]) return true;
    skipped.add(i.ex);
    return false;
  });
}

const upsert = <T extends { id: string }>(list: readonly T[], item: T): T[] => {
  const at = list.findIndex((x) => x.id === item.id);
  return at < 0 ? [...list, item] : list.map((x, i) => (i === at ? item : x));
};

export interface Imported {
  next: AppState;
  /** Ćwiczenia, których nie ma w atlasie tej wersji — pominięte. */
  skipped: string[];
}

export function importWorkout(state: AppState, assignmentId: string, body: WorkoutBody, from: string): (Imported & { workoutId: string }) | null {
  const skipped = new Set<string>();
  const items = cleanItems(body.workout, skipped);
  if (!items.length) return null;
  const workoutId = coachId(assignmentId, body.workout.id);
  const w: Workout = { ...body.workout, id: workoutId, items, desc: [body.workout.desc, from].filter(Boolean).join(' · ') };
  delete w.base;
  const next = { ...state, workouts: upsert(state.workouts, w) };
  return { next, skipped: [...skipped], workoutId };
}

export function importPlan(state: AppState, assignmentId: string, body: PlanBody, from: string): (Imported & { planId: string }) | null {
  const skipped = new Set<string>();
  const ids = new Map<string, string>();
  let workouts = state.workouts;
  for (const w of body.workouts) {
    const items = cleanItems(w, skipped);
    if (!items.length) continue;
    const id = coachId(assignmentId, w.id);
    ids.set(w.id, id);
    const copy: Workout = { ...w, id, items };
    delete copy.base;
    workouts = upsert(workouts, copy);
  }
  // Rotacja może wskazywać trening z paczki albo gotowy z biblioteki aplikacji.
  const cycle = body.plan.cycle.flatMap((c) => {
    const mapped = ids.get(c);
    if (mapped) return [mapped];
    return BUILTIN.some((w) => w.id === c) ? [c] : [];
  });
  if (!cycle.length) return null;
  const planId = coachId(assignmentId, body.plan.id);
  const plan: PlanTemplate = {
    ...body.plan,
    id: planId,
    cycle,
    kind: 'own',
    daysPerWeek: body.plan.weekdays.length,
    desc: [body.plan.desc, from].filter(Boolean).join(' · '),
  };
  const next = { ...state, workouts, plans: upsert(state.plans ?? [], plan) };
  return { next, skipped: [...skipped], planId };
}
