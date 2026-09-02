import { describe, expect, it } from 'vitest';
import { freshState, P, plan, planLabel } from './plan';
import { applyLayoff, applyResult, judge } from './progression';
import { acwr, epley, repsAt } from './math';
import type { AppState, EffortKey, LogEntry, SetResult } from '../types';

const perfect = (s: AppState, id: string): SetResult[] =>
  plan(s, id).map((r) => ({ reps: r.reps, w: r.w }));

const runSession = (s: AppState, id: string, effort: EffortKey = 'solid') =>
  applyResult(s, id, perfect(s, id), effort, false);

describe('wzory obciążenia', () => {
  it('Epley liczy maksimum i odwrotność', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1);
    expect(repsAt(116.67, 100)).toBe(5);
  });
});

describe('podwójna progresja grindu', () => {
  it('podnosi powtórzenia do szczytu zakresu, potem zaczyna przejście ciężaru', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const p = P(s, 'goblet');
    expect(p.target).toBe(8);

    for (let i = 8; i < 12; i++) {
      runSession(s, 'goblet');
      expect(P(s, 'goblet').target).toBe(i + 1);
    }
    expect(P(s, 'goblet').trans).toBeNull();

    const change = runSession(s, 'goblet');
    expect(change?.type).toBe('level');
    expect(P(s, 'goblet').trans).not.toBeNull();
    expect(P(s, 'goblet').trans!.to).toBe(20);
    expect(P(s, 'goblet').trans!.heavySets).toBe(1);
  });

  it('cel zaliczony bez zapasu nie daje awansu', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const before = P(s, 'goblet').target;
    const c = runSession(s, 'goblet', 'max');
    expect(c?.type).toBe('hold');
    expect(P(s, 'goblet').target).toBe(before);
  });

  it('trzy sesje bez zapasu z rzędu obniżają cel', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    P(s, 'goblet').target = 11;
    runSession(s, 'goblet', 'max');
    runSession(s, 'goblet', 'max');
    const c = runSession(s, 'goblet', 'max');
    expect(c?.type).toBe('down');
    expect(P(s, 'goblet').target).toBe(10);
  });
});

describe('przejście na cięższy kettlebell', () => {
  it('dokłada ciężką serię co sesję i domyka się na ostatniej', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const p = P(s, 'goblet');
    p.target = 12;
    p.e1rm = 23;

    runSession(s, 'goblet');
    expect(p.trans!.heavySets).toBe(1);
    expect(planLabel(s, 'goblet')).toContain('20 kg');
    expect(planLabel(s, 'goblet')).toContain('16 kg');

    runSession(s, 'goblet');
    expect(p.trans!.heavySets).toBe(2);

    const c = runSession(s, 'goblet');
    expect(c?.type).toBe('level');
    expect(p.trans).toBeNull();
    expect(p.weight).toBe(20);
    expect(p.target).toBeLessThan(12);
    expect(p.target).toBeGreaterThanOrEqual(4);
  });

  it('mieszane obciążenie ma osobny ciężar w każdej serii', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    P(s, 'goblet').trans = { to: 20, heavySets: 1, reps: 4 };
    P(s, 'goblet').target = 12;
    const rows = plan(s, 'goblet');
    expect(rows[0]).toMatchObject({ w: 20, reps: 4, heavy: true });
    expect(rows[1]).toMatchObject({ w: 16, reps: 12 });
    expect(rows).toHaveLength(3);
  });
});

describe('balistyka', () => {
  it('rośnie seriami, nie powtórzeniami', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const p = P(s, 'swing2');
    expect(p.sets).toBe(4);
    runSession(s, 'swing2');
    expect(p.sets).toBe(5);
    expect(p.target).toBe(10);
  });

  it('po ośmiu seriach zaczyna przejście ciężaru', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const p = P(s, 'swing2');
    p.sets = 8;
    runSession(s, 'swing2');
    expect(p.trans?.to).toBe(24);
  });
});

describe('regres', () => {
  it('wymaga dwóch słabych sesji z rzędu', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    P(s, 'goblet').target = 11;
    const weak = (): SetResult[] => plan(s, 'goblet').map((r) => ({ reps: r.reps - 3, w: r.w }));

    expect(applyResult(s, 'goblet', weak(), 'max', false)).toBeNull();
    const c = applyResult(s, 'goblet', weak(), 'max', false);
    expect(c?.type).toBe('down');
    expect(P(s, 'goblet').target).toBe(10);
  });
});

describe('ocena sesji', () => {
  it('niepełna liczba serii nie daje awansu', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    expect(judge(s, 'goblet', [{ reps: 8, w: 16 }, { reps: 8, w: 16 }], 'solid')).toBe('hold');
  });
});

describe('gorszy dzień', () => {
  it('obniża dzisiejszy cel bez ruszania poziomu', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    expect(plan(s, 'goblet')[0]!.reps).toBe(8);
    s.session.ready = 'low';
    expect(plan(s, 'goblet')[0]!.reps).toBe(7);
    expect(P(s, 'goblet').target).toBe(8);
  });
});

describe('przerwa w treningach', () => {
  const setup = () => {
    const s = freshState();
    P(s, 'goblet').target = 12;
    P(s, 'goblet').e1rm = 23;
    return s;
  };

  it('do 10 dni nic nie zmienia', () => {
    expect(applyLayoff(setup(), 9)).toBeNull();
  });

  it('11–20 dni tylko ostrzega', () => {
    const s = setup();
    const n = applyLayoff(s, 14);
    expect(n).not.toBeNull();
    expect(P(s, 'goblet').target).toBe(12);
  });

  it('21–42 dni cofa cele, ale zostawia ciężar', () => {
    const s = setup();
    applyLayoff(s, 30);
    expect(P(s, 'goblet').target).toBe(8);
    expect(P(s, 'goblet').weight).toBe(16);
  });

  it('powyżej sześciu tygodni obniża szacowane maksimum', () => {
    const s = setup();
    applyLayoff(s, 70);
    expect(P(s, 'goblet').e1rm).toBeCloseTo(20.7, 1);
  });
});

describe('obciążenie w czasie', () => {
  it('wykrywa skok tygodniowego tonażu', () => {
    const s = freshState();
    const now = Date.now();
    const at = (days: number, tonnage: number): LogEntry => ({
      date: new Date(now - days * 86_400_000).toISOString(),
      workout: 'X',
      ready: 'ok',
      items: [{ id: 'goblet', sets: [{ reps: 10, w: tonnage / 10 }], effort: 'solid' }],
    });
    s.log = [26, 23, 19, 16, 12, 9, 5, 2].map((d) => at(d, 1000));
    expect(acwr(s, now)).toBeCloseTo(1, 1);

    s.log.push(at(1, 3000), at(0, 3000));
    expect(acwr(s, now)!).toBeGreaterThan(1.5);
  });

  it('nie liczy wskaźnika przy zbyt krótkiej historii', () => {
    const s = freshState();
    expect(acwr(s)).toBeNull();
  });
});
