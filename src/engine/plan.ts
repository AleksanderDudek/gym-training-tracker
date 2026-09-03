import { ALL, EX, STAGES, ex } from '../data/exercises';
import type { AppState, ExerciseId, PlannedSet, Progress } from '../types';

export const step = (id: ExerciseId): number => (ex(id).unit === 'secs' ? 5 : 1);

/**
 * Ile sesji próbnych wolno spalić, zanim ćwiczenie i tak przechodzi do normalnej pracy.
 * Bez tego drabina kalibracyjna mogłaby się kręcić w nieskończoność u kogoś, kto za każdym
 * razem raportuje inaczej.
 */
export const MAX_CALIB_RUNS = 5;

/** Co ile sesji ćwiczenie dostaje serię testową, żeby sprawdzić, czy poziom nie odjechał w górę. */
export const PROBE_EVERY = 6;

/** Tyle sesji z rzędu na „Łatwo” wywołuje test wcześniej — obciążenie jest wyraźnie za małe. */
export const EASY_RUN_PROBE = 2;

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
    // Maksimum bierze się dopiero z pierwszego realnego wyniku. Liczba z domyślnych
    // ustawień udawałaby wiedzę o kimś, kto jeszcze nic nie zrobił.
    e1rm: null,
    stalls: 0,
    maxHolds: 0,
    phase: 'calib',
    calibRuns: 0,
    probe: false,
    sinceProbe: 0,
    easyRun: 0,
    hist: [],
  };
}

export function freshState(): AppState {
  const weights = [4, 6, 8, 12, 16, 20, 24, 28, 32];
  const prog: Record<ExerciseId, Progress> = {};
  ALL.forEach((id) => {
    const p = freshProgress(id);
    // Próba startuje od połowy domyślnego obciążenia. Od dna listy nie ma sensu: przy 4 kg
    // ogranicznikiem przestaje być siła, a zaczyna cierpliwość, więc wynik nic nie mierzy.
    // Drabina i tak dojdzie w obie strony — od tej wersji także w dół, bo 4 i 6 kg dają
    // początkującemu dokąd zejść, gdy 8 kg okaże się za dużo.
    if (p.weight !== null) p.weight = nearestWeight(weights, p.weight * 0.5);
    prog[id] = p;
  });
  return {
    cfg: { weights },
    prog,
    workouts: [],
    session: null,
    log: [],
    plan: null,
    notice: null,
    events: [],
    award: { banked: 0, badges: {} },
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

/**
 * Ciężar przesunięty o kilka rozmiarów. Drabina kalibracyjna musi umieć przeskoczyć więcej
 * niż jeden rozmiar naraz — lista zaczyna się od 4 kg, a ktoś silny miałby inaczej za mało
 * prób, żeby w ogóle dojść do swojego poziomu.
 */
/** Najbliższy dostępny ciężar. Przy remisie wygrywa lżejszy. */
export const nearestWeight = (list: number[], target: number): number =>
  list.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), list[0]!);

export function shiftWeight(state: AppState, id: ExerciseId, steps: number): number | null {
  const p = P(state, id);
  if (p.weight === null) return null;
  const list = state.cfg.weights;
  const i = list.indexOf(p.weight);
  if (i < 0) return null;
  const j = Math.max(0, Math.min(list.length - 1, i + steps));
  return j === i ? null : list[j]!;
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
  const m = ex(id);
  // Gorszy dzień obniża dzisiejszy cel, ale nie rusza twoich poziomów.
  const adj = state.session?.ready === 'low' ? -1 : 0;
  const out: PlannedSet[] = [];

  // Kalibracja: jedna seria, żeby zobaczyć, na czym ktoś realnie stoi. Balistyka dostaje
  // sztywną liczbę powtórzeń — swing na maksa psuje technikę, a to ruch o prędkość, nie o zmęczenie.
  if (p.phase === 'calib') {
    return m.mode === 'ballistic'
      ? [{ w: p.weight, reps: m.def.target }]
      : [{ w: p.weight, reps: p.min, amrap: true }];
  }

  if (p.trans) {
    const heavyReps = Math.max(1, p.trans.reps + adj);
    for (let i = 0; i < p.trans.heavySets; i++) out.push({ w: p.trans.to, reps: heavyReps, heavy: true });
    for (let i = p.trans.heavySets; i < p.sets; i++)
      out.push({ w: p.weight, reps: Math.max(1, p.target + adj) });
  } else {
    for (let i = 0; i < p.sets; i++) out.push({ w: p.weight, reps: Math.max(1, p.target + adj) });
  }

  // Test kontrolny: ostatnia seria bez sufitu. Sprawdza, czy poziom nie odjechał w górę
  // szybciej, niż zdąży go dogonić progresja po jednym powtórzeniu na sesję.
  const last = out[out.length - 1];
  if (p.probe && last && m.mode !== 'ballistic') last.amrap = true;

  return out;
}

export function planLabel(state: AppState, id: ExerciseId): string {
  const rows = plan(state, id);
  const p = P(state, id);
  const m = ex(id);
  const u = m.unit === 'secs' ? ' s' : '';

  if (p.phase === 'calib') {
    const w = p.weight ? ` · ${p.weight} kg` : '';
    return m.mode === 'ballistic'
      ? `próba: 1 × ${m.def.target}${w}`
      : `próba: ile dasz radę${w}`;
  }

  const groups: { n: number; w: number | null; reps: number }[] = [];

  rows.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.w === r.w && last.reps === r.reps) last.n++;
    else groups.push({ n: 1, w: r.w, reps: r.reps });
  });

  return (
    groups.map((g) => `${g.n} × ${g.reps}${u}${g.w ? ` · ${g.w} kg` : ''}`).join('  +  ') +
    (p.probe ? '  + test' : '') +
    (m.side ? ' · na stronę' : '')
  );
}

/**
 * Ustawienie ciężarów startowych z planu. Dotyka wyłącznie ćwiczeń bez historii: gdzie
 * jest już zalogowany wynik, tam zmierzony poziom bije każdą tabelkę i plan go nie nadpisuje.
 */
export function seedFromPlan(state: AppState, loadFactor: number): number {
  let n = 0;
  ALL.forEach((id) => {
    const p = P(state, id);
    const d = ex(id).def;
    if (p.hist.length || d.w === undefined) return;
    p.weight = nearestWeight(state.cfg.weights, d.w * loadFactor);
    p.phase = 'calib';
    p.calibRuns = 0;
    p.trans = null;
    p.e1rm = null;
    n++;
  });
  return n;
}

export const exercisesByGroup = (): Record<string, ExerciseId[]> => {
  const groups: Record<string, ExerciseId[]> = {};
  ALL.forEach((id) => {
    const g = EX[id]!.group;
    (groups[g] ??= []).push(id);
  });
  return groups;
};
