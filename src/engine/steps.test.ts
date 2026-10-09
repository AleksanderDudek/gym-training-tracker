import { describe, expect, it } from 'vitest';
import { freshState, P } from './plan';
import { cursorOf, sessionSteps } from './steps';
import type { AppState, ExerciseId, Session, Workout } from '../types';

/**
 * Kolejka serii: co robić teraz i co potem. Serie pod rząd idą jedna za drugą, para na
 * zmianę, a obwód runda po rundzie — stacja z mniejszą liczbą serii odpada z późniejszych rund.
 */

/** Stan po kalibracji: ćwiczenie ma `sets` serii po 10 powtórzeń. */
const ready = (sets: Record<ExerciseId, number>): AppState => {
  const s = freshState();
  Object.entries(sets).forEach(([id, n]) => {
    const p = P(s, id);
    p.phase = 'work';
    p.sets = n;
    p.target = 10;
  });
  return s;
};

const session = (over: Partial<Session> = {}): Session => ({
  workout: 'x',
  started: '2026-10-09T08:00:00Z',
  ready: 'ok',
  res: {},
  done: {},
  skip: {},
  ...over,
});

const short = (steps: ReturnType<typeof sessionSteps>) => steps.map((s) => `${s.ex}${s.set}`);

describe('kolejka serii', () => {
  it('serie pod rząd: wszystkie serie jednego ćwiczenia, potem następne', () => {
    const w: Workout = { id: 'x', name: 'X', items: [{ ex: 'goblet' }, { ex: 'pushup' }] };
    const steps = sessionSteps(ready({ goblet: 3, pushup: 2 }), w);
    expect(short(steps)).toEqual(['goblet1', 'goblet2', 'goblet3', 'pushup1', 'pushup2']);
    expect(steps[1]).toMatchObject({ set: 2, of: 3, tag: '1', kind: 'straight' });
  });

  it('para na zmianę, a dłuższe ćwiczenie kończy samo', () => {
    const w: Workout = { id: 'x', name: 'X', items: [{ ex: 'goblet' }, { ex: 'row', pair: true }] };
    const steps = sessionSteps(ready({ goblet: 3, row: 4 }), w);
    expect(short(steps)).toEqual(['goblet1', 'row1', 'goblet2', 'row2', 'goblet3', 'row3', 'row4']);
    expect(steps.map((s) => s.tag)).toEqual(['1A', '1B', '1A', '1B', '1A', '1B', '1B']);
  });

  it('obwód runda po rundzie; stacja z dwiema seriami nie wchodzi do trzeciej rundy', () => {
    const w: Workout = {
      id: 'x',
      name: 'X',
      items: [{ ex: 'pushup', circuit: true }, { ex: 'goblet', circuit: true }, { ex: 'crunch_cable', circuit: true }],
    };
    const steps = sessionSteps(ready({ pushup: 3, goblet: 3, crunch_cable: 2 }), w);
    expect(short(steps)).toEqual([
      'pushup1', 'goblet1', 'crunch_cable1',
      'pushup2', 'goblet2', 'crunch_cable2',
      'pushup3', 'goblet3',
    ]);
    expect(steps[3]).toMatchObject({ round: 2, rounds: 3, kind: 'circuit', tag: '1A' });
  });

  it('kursor: pierwsza seria jeszcze niezapisana, z pominięciem pominiętych i zamkniętych', () => {
    const w: Workout = { id: 'x', name: 'X', items: [{ ex: 'goblet' }, { ex: 'row', pair: true }, { ex: 'pushup' }] };
    const steps = sessionSteps(ready({ goblet: 2, row: 2, pushup: 2 }), w);
    const row = { reps: 10, w: null };
    expect(cursorOf(steps, session())).toBe(0);
    expect(cursorOf(steps, session({ res: { goblet: { rows: [row], effort: 'solid' } } }))).toBe(1);
    expect(
      steps[cursorOf(steps, session({ res: { goblet: { rows: [row, row], effort: 'solid' }, row: { rows: [row], effort: 'solid' } } }))],
    ).toMatchObject({ ex: 'row', set: 2 });
    // Pominięte ćwiczenie i zamknięte w widoku listy (mniej serii) nie zatrzymują kolejki.
    expect(steps[cursorOf(steps, session({ skip: { goblet: true }, done: { row: true } }))]).toMatchObject({ ex: 'pushup', set: 1 });
    expect(cursorOf(steps, session({ done: { goblet: true, row: true, pushup: true } }))).toBe(-1);
  });
});
