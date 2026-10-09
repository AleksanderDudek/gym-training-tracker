import { describe, expect, it } from 'vitest';
import { profileOf } from './energy';
import { PAIR_REST } from './design';
import { freshState, P } from './plan';
import {
  CIRCUIT_MOVE,
  ROUND_REST,
  baseRest,
  faded,
  restBetween,
  restBump,
  restLabel,
  roundRestOf,
} from './rests';
import { sessionSteps } from './steps';
import type { AppState, EffortKey, ExerciseId, LogEntry, Workout } from '../types';

/**
 * Przerwy: z rodzaju ćwiczenia albo z treningu, dłuższe po sesjach, w których serie wyraźnie
 * słabły, i nigdy krótsze w treningu siłowym. Obwód skraca przerwę po rundzie, gdy rundy idą
 * równo — tak rośnie kondycja przy tej samej pracy.
 */

const hist = (s: AppState, id: ExerciseId, sessions: number[][]) => {
  const p = P(s, id);
  p.phase = 'work';
  p.hist = sessions.map((reps, i) => ({ d: `2026-09-${String(i + 1).padStart(2, '0')}`, w: 16, reps, eff: 'solid' as EffortKey, e1rm: null }));
};

describe('przerwa z rodzaju ćwiczenia i z treningu', () => {
  it('trening nadpisuje przerwę po serii, bez niego zostaje rodzaj pracy', () => {
    const w: Workout = { id: 'x', name: 'X', items: [{ ex: 'swing2' }] };
    expect(baseRest(w, 'swing2')).toBe(profileOf('swing2').rest);
    expect(baseRest({ ...w, rest: 120 }, 'swing2')).toBe(120);
  });

  it('czytelnie: sekundy do półtorej minuty, potem minuty z połówkami', () => {
    expect([45, 75, 90, 120, 150, 180].map(restLabel)).toEqual(['45 s', '75 s', '1,5 min', '2 min', '2,5 min', '3 min']);
  });
});

describe('słabnięcie serii i dłuższa przerwa', () => {
  it('słabnie, gdy ostatnia seria ma o co najmniej 20% mniej powtórzeń niż pierwsza', () => {
    expect(faded([10, 10, 8])).toBe(true);
    expect(faded([10, 10, 9])).toBe(false);
    expect(faded([10])).toBe(false);
    // Seria testowa na końcu albo przejście na cięższy ciężar — to nie słabnięcie.
    expect(faded([8, 8, 12])).toBe(false);
  });

  it('+30 s za każdą ostatnią słabnącą sesję, najwyżej +60 s, i z powrotem po równej sesji', () => {
    const s = freshState();
    hist(s, 'goblet', []);
    expect(restBump(s, 'goblet')).toBe(0);
    hist(s, 'goblet', [[10, 10, 10], [10, 9, 7]]);
    expect(restBump(s, 'goblet')).toBe(30);
    hist(s, 'goblet', [[10, 8, 7], [10, 9, 7], [10, 9, 7]]);
    expect(restBump(s, 'goblet')).toBe(60);
    hist(s, 'goblet', [[10, 8, 7], [10, 9, 7], [10, 10, 10]]);
    expect(restBump(s, 'goblet')).toBe(0);
  });
});

describe('przerwa między krokami sesji', () => {
  const ready = (ids: ExerciseId[], sets = 3) => {
    const s = freshState();
    ids.forEach((id) => {
      const p = P(s, id);
      p.phase = 'work';
      p.sets = sets;
      p.target = 10;
    });
    return s;
  };

  it('pod rząd: przerwa treningu, dłuższa po słabnących seriach — z powodem; po ostatniej serii nic', () => {
    const w: Workout = { id: 'x', name: 'X', rest: 120, items: [{ ex: 'goblet' }, { ex: 'pushup' }] };
    const s = ready(['goblet', 'pushup']);
    const steps = sessionSteps(s, w);
    expect(restBetween(s, w, steps[0]!, steps[1]!)).toEqual({ secs: 120, why: null, kind: 'set' });
    // Przejście do następnego ćwiczenia: przerwa kończonego ćwiczenia, bez dokładki.
    expect(restBetween(s, w, steps[2]!, steps[3]!)).toMatchObject({ secs: 120, kind: 'next' });
    expect(restBetween(s, w, steps[5]!, null)).toBeNull();
    hist(s, 'goblet', [[10, 10, 7]]);
    const r = restBetween(s, w, steps[0]!, steps[1]!)!;
    expect(r.secs).toBe(150);
    expect(r.why).toMatch(/30 s/);
    expect(restBetween(s, w, steps[2]!, steps[3]!)!.secs).toBe(120);
  });

  it('para: krótka przerwa między partnerami, dłuższe ćwiczenie dalej samo z własną przerwą', () => {
    const w: Workout = { id: 'x', name: 'X', items: [{ ex: 'goblet' }, { ex: 'row', pair: true }] };
    const s = ready(['goblet', 'row']);
    P(s, 'row').sets = 4;
    const steps = sessionSteps(s, w);
    expect(restBetween(s, w, steps[0]!, steps[1]!)).toMatchObject({ secs: PAIR_REST, kind: 'pair' });
    // row3 → row4: goblet już skończył, więc zwykła przerwa po serii.
    expect(restBetween(s, w, steps[5]!, steps[6]!)).toMatchObject({ secs: baseRest(w, 'row'), kind: 'set' });
  });

  it('obwód: przejście między stacjami, pełna przerwa po rundzie i po całym obwodzie', () => {
    const w: Workout = {
      id: 'x',
      name: 'X',
      items: [{ ex: 'pushup', circuit: true }, { ex: 'goblet', circuit: true }, { ex: 'plank' }],
    };
    const s = ready(['pushup', 'goblet', 'plank']);
    const steps = sessionSteps(s, w);
    expect(restBetween(s, w, steps[0]!, steps[1]!)).toMatchObject({ secs: CIRCUIT_MOVE, kind: 'move' });
    expect(restBetween(s, w, steps[1]!, steps[2]!)).toMatchObject({ secs: ROUND_REST, kind: 'round' });
    expect(restBetween(s, w, steps[5]!, steps[6]!)).toMatchObject({ secs: ROUND_REST, kind: 'next' });
  });
});

describe('przerwa po rundzie obwodu w kolejnych sesjach', () => {
  const w: Workout = {
    id: 'obw',
    name: 'Obwód',
    roundRest: 120,
    items: [{ ex: 'pushup', circuit: true }, { ex: 'goblet', circuit: true }],
  };
  const entry = (reps: number[], effort: EffortKey = 'solid', wid: string | undefined = 'obw'): LogEntry => ({
    date: '2026-09-01T08:00:00Z',
    workout: 'Obwód',
    ...(wid ? { wid } : {}),
    ready: 'ok',
    items: [
      { id: 'pushup', sets: reps.map((r) => ({ reps: r, w: null })), effort },
      { id: 'goblet', sets: [10, 10, 10].map((r) => ({ reps: r, w: 16 })), effort: 'solid' },
    ],
  });

  it('bez historii przerwa z treningu, a każda równa sesja skraca ją o 15 s do 60 s', () => {
    const s = freshState();
    expect(roundRestOf(s, w)).toEqual({ secs: 120, why: null });
    s.log = [entry([10, 10, 10]), entry([10, 10, 10])];
    const r = roundRestOf(s, w);
    expect(r.secs).toBe(90);
    expect(r.why).toMatch(/30 s/);
    s.log = Array.from({ length: 8 }, () => entry([10, 10, 10]));
    expect(roundRestOf(s, w).secs).toBe(60);
  });

  it('słabnące rundy albo „Na maksa” wydłużają o 15 s, najwyżej o minutę ponad start', () => {
    const s = freshState();
    s.log = [entry([10, 10, 10]), entry([10, 9, 7])];
    expect(roundRestOf(s, w).secs).toBe(120);
    s.log = Array.from({ length: 6 }, () => entry([10, 10, 10], 'max'));
    expect(roundRestOf(s, w).secs).toBe(180);
  });

  it('starsze wpisy bez identyfikatora treningu rozpoznaje po nazwie; obce treningi się nie liczą', () => {
    const s = freshState();
    s.log = [entry([10, 10, 10], 'solid', undefined), { ...entry([10, 10, 10]), wid: 'inny', workout: 'Inny' }];
    expect(roundRestOf(s, w).secs).toBe(105);
  });
});
