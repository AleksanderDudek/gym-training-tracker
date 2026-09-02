import { ALL, EX, STAGES, ex } from '../data/exercises';
import { epley, round1 } from './math';
import type { AppState, ExerciseId, PlannedSet, Progress } from '../types';

export const step = (id: ExerciseId): number => (ex(id).unit === 'secs' ? 5 : 1);

export function freshProgress(id: ExerciseId): Progress {
  const d = ex(id).def;
  return {
    sets: d.sets,
    target: d.target,
    min: d.min,
    max: d.max,
    minSets: d.minSets ?? d.sets,
    maxSets: d.maxSets ?? d.sets,
    weight: d.w ?? null,
    stage: ex(id).mode === 'stage' ? (id === 'pushup' ? 1 : 0) : null,
    trans: null,
    e1rm: d.w ? round1(epley(d.w, d.target)) : null,
    stalls: 0,
    maxHolds: 0,
    hist: [],
  };
}

export function freshState(): AppState {
  const prog: Record<ExerciseId, Progress> = {};
  ALL.forEach((id) => {
    prog[id] = freshProgress(id);
  });
  return {
    cfg: { weights: [8, 12, 16, 20, 24, 28, 32] },
    prog,
    workouts: [],
    session: null,
    log: [],
    notice: null,
  };
}

export const P = (state: AppState, id: ExerciseId): Progress => {
  const p = state.prog[id];
  if (!p) throw new Error(`Brak stanu progresji dla: ${id}`);
  return p;
};

/**
 * Po skoku ciężaru cel bywa niższy niż docelowy zakres — to normalne.
 * Podłogą jest więc połowa dolnej granicy, a nie sama dolna granica.
 */
export function floorReps(state: AppState, id: ExerciseId): number {
  const p = P(state, id);
  const s = step(id);
  return Math.max(ex(id).unit === 'secs' ? 10 : 1, Math.ceil(p.min / 2 / s) * s);
}

export function nextWeight(state: AppState, id: ExerciseId): number | null {
  const p = P(state, id);
  if (p.weight === null) return null;
  const i = state.cfg.weights.indexOf(p.weight);
  return i > -1 && i < state.cfg.weights.length - 1 ? state.cfg.weights[i + 1]! : null;
}

export function prevWeight(state: AppState, id: ExerciseId): number | null {
  const p = P(state, id);
  if (p.weight === null) return null;
  const i = state.cfg.weights.indexOf(p.weight);
  return i > 0 ? state.cfg.weights[i - 1]! : null;
}

export function levelLabel(state: AppState, id: ExerciseId): string {
  const p = P(state, id);
  const m = ex(id);
  if (m.mode === 'stage' && m.stages) return STAGES[m.stages][p.stage ?? 0] ?? '';
  if (p.weight === null) return `${p.sets} serie`;
  return p.trans ? `${p.weight} → ${p.trans.to} kg` : `${p.weight} kg`;
}

/**
 * Recepta na dziś: lista serii z konkretnym ciężarem i celem.
 * W trakcie przejścia na cięższy kettlebell zwraca obciążenie mieszane.
 */
export function plan(state: AppState, id: ExerciseId): PlannedSet[] {
  const p = P(state, id);
  // Gorszy dzień obniża dzisiejszy cel, ale nie rusza twoich poziomów.
  const adj = state.session?.ready === 'low' ? -1 : 0;
  const out: PlannedSet[] = [];

  if (p.trans) {
    const heavyReps = Math.max(1, p.trans.reps + adj);
    for (let i = 0; i < p.trans.heavySets; i++) out.push({ w: p.trans.to, reps: heavyReps, heavy: true });
    for (let i = p.trans.heavySets; i < p.sets; i++)
      out.push({ w: p.weight, reps: Math.max(1, p.target + adj) });
  } else {
    for (let i = 0; i < p.sets; i++) out.push({ w: p.weight, reps: Math.max(1, p.target + adj) });
  }
  return out;
}

export function planLabel(state: AppState, id: ExerciseId): string {
  const rows = plan(state, id);
  const m = ex(id);
  const u = m.unit === 'secs' ? ' s' : '';
  const groups: { n: number; w: number | null; reps: number }[] = [];

  rows.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.w === r.w && last.reps === r.reps) last.n++;
    else groups.push({ n: 1, w: r.w, reps: r.reps });
  });

  return (
    groups.map((g) => `${g.n} × ${g.reps}${u}${g.w ? ` · ${g.w} kg` : ''}`).join('  +  ') +
    (m.side ? ' · na stronę' : '')
  );
}

export const exercisesByGroup = (): Record<string, ExerciseId[]> => {
  const groups: Record<string, ExerciseId[]> = {};
  ALL.forEach((id) => {
    const g = EX[id]!.group;
    (groups[g] ??= []).push(id);
  });
  return groups;
};
