import { describe, expect, it } from 'vitest';
import { addSet, answerEffort, extendRest, settleOpen, skipRest, startRest, undoSet } from './session';
import type { Session } from '../types';

/**
 * Sesja seria po serii: zapis do tego samego miejsca co widok listy, zamknięcie ćwiczenia
 * dopiero po ocenie zapasu i przerwa zapisana jako chwila końca.
 */

const fresh = (): Session => ({ workout: 'x', started: '2026-10-09T08:00:00Z', ready: 'ok', res: {}, done: {}, skip: {} });
const row = (reps: number) => ({ reps, w: 16 });

describe('serie po jednej', () => {
  it('serie się dopisują, a po ostatniej ćwiczenie czeka na ocenę zapasu', () => {
    const s = fresh();
    addSet(s, 'goblet', row(10), 3);
    addSet(s, 'goblet', row(10), 3);
    expect(s.res.goblet!.rows).toHaveLength(2);
    expect(s.ask ?? []).toEqual([]);
    addSet(s, 'goblet', row(8), 3);
    expect(s.ask).toEqual(['goblet']);
    expect(s.done.goblet).toBeUndefined();
    answerEffort(s, 'goblet', 'max');
    expect(s.done.goblet).toBe(true);
    expect(s.res.goblet!.effort).toBe('max');
    expect(s.ask).toEqual([]);
  });

  it('cofnięcie zdejmuje ostatnią serię i otwiera ćwiczenie z powrotem', () => {
    const s = fresh();
    addSet(s, 'goblet', row(10), 1);
    answerEffort(s, 'goblet', 'solid');
    undoSet(s, 'goblet');
    expect(s.res.goblet).toBeUndefined();
    expect(s.done.goblet).toBeUndefined();
    expect(s.ask).toEqual([]);
  });

  it('koniec w połowie ćwiczenia: zrobione serie idą do wyniku, pominięte zostają pominięte', () => {
    const s = fresh();
    addSet(s, 'goblet', row(10), 3);
    addSet(s, 'pushup', row(12), 1);
    s.skip.row = true;
    s.res.row = { rows: [row(5)], effort: 'solid' };
    expect(settleOpen(s).sort()).toEqual(['goblet', 'pushup']);
    expect(s.done).toEqual({ goblet: true, pushup: true });
    expect(s.ask).toBeUndefined();
  });
});

describe('przerwa', () => {
  const now = Date.parse('2026-10-09T08:10:00Z');

  it('koniec przerwy to chwila, a „+30 s” liczy od końca albo od teraz, gdy już minęła', () => {
    const s = fresh();
    startRest(s, { secs: 120, why: null, kind: 'set' }, now);
    expect(s.rest).toEqual({ until: now + 120_000, secs: 120, kind: 'set' });
    extendRest(s, 30, now + 10_000);
    expect(s.rest!.until).toBe(now + 150_000);
    extendRest(s, 30, now + 200_000);
    expect(s.rest!.until).toBe(now + 230_000);
    skipRest(s);
    expect(s.rest).toBeUndefined();
  });

  it('po ostatniej serii sesji przerwy nie ma; powód dłuższej przerwy idzie razem z nią', () => {
    const s = fresh();
    startRest(s, null, now);
    expect(s.rest).toBeUndefined();
    startRest(s, { secs: 150, why: 'O 30 s dłużej', kind: 'set' }, now);
    expect(s.rest!.why).toBe('O 30 s dłużej');
  });
});
