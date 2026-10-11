import { describe, expect, it } from 'vitest';
import type { Block } from './blocks';
import {
  durationText,
  settlePart,
  startClock,
  startPart,
  summary,
  timed,
  timeOf,
  transitions,
  waitingPart,
} from './clock';
import type { Step } from './steps';
import type { LogTime, Session } from '../types';

/**
 * Zegar sesji: start treningu, części z początkiem i końcem, przejścia między nimi i czas
 * zapisany w dzienniku. Część to blok — ćwiczenie seriami pod rząd, para albo obwód.
 */

const fresh = (over: Partial<Session> = {}): Session => ({
  workout: 'x',
  started: '2026-10-11T08:00:00Z',
  ready: 'ok',
  res: {},
  done: {},
  skip: {},
  ...over,
});

const row = { reps: 10, w: 16 };
const rows = (n: number) => ({ rows: Array.from({ length: n }, () => row), effort: 'solid' as const });

/** Blok 1: goblet 2 serie. Blok 2: para row + pushup po 2. Blok 3: swing 1 seria. */
const steps: Step[] = [
  { ex: 'goblet', set: 1, of: 2, block: 1, tag: '1', kind: 'straight' },
  { ex: 'goblet', set: 2, of: 2, block: 1, tag: '1', kind: 'straight' },
  { ex: 'row', set: 1, of: 2, block: 2, tag: '2A', kind: 'pair' },
  { ex: 'pushup', set: 1, of: 2, block: 2, tag: '2B', kind: 'pair' },
  { ex: 'row', set: 2, of: 2, block: 2, tag: '2A', kind: 'pair' },
  { ex: 'pushup', set: 2, of: 2, block: 2, tag: '2B', kind: 'pair' },
  { ex: 'swing', set: 1, of: 1, block: 3, tag: '3', kind: 'straight' },
];

const blocks: Block[] = [
  { n: 1, kind: 'straight', ids: ['goblet'] },
  { n: 2, kind: 'pair', ids: ['row', 'pushup'] },
  { n: 3, kind: 'straight', ids: ['swing'] },
];

describe('start zegara i części', () => {
  it('„Zaczynam” startuje zegar i pierwszą część; drugi raz nic nie zmienia', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    expect(s.clock).toEqual({ begin: 1000, parts: { 1: { start: 1000 } } });
    startClock(s, 9000, 2);
    expect(s.clock).toEqual({ begin: 1000, parts: { 1: { start: 1000 } } });
  });

  it('widok listy startuje zegar bez części', () => {
    const s = fresh();
    startClock(s, 1000, null);
    expect(s.clock).toEqual({ begin: 1000, parts: {} });
  });

  it('start części zapisuje chwilę, a wcześniejszego startu nie przesuwa', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    startPart(s, 2, 5000);
    expect(s.clock!.parts[2]).toEqual({ start: 5000 });
    startPart(s, 2, 8000);
    expect(s.clock!.parts[2]).toEqual({ start: 5000 });
  });

  it('start części bez zegara zakłada zegar od tej chwili', () => {
    const s = fresh();
    startPart(s, 2, 5000);
    expect(s.clock).toEqual({ begin: 5000, parts: { 2: { start: 5000 } } });
  });

  it('start części zostawia jej koniec', () => {
    const s = fresh();
    startClock(s, 1000, null);
    s.clock!.parts[1] = { end: 4000 };
    startPart(s, 1, 5000);
    expect(s.clock!.parts[1]).toEqual({ start: 5000, end: 4000 });
  });
});

describe('koniec części', () => {
  it('kończy się z ostatnią serią bloku, nie wcześniej', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    s.res.goblet = rows(1);
    settlePart(s, steps, 1, 2000);
    expect(s.clock!.parts[1]).toEqual({ start: 1000 });
    s.res.goblet = rows(2);
    settlePart(s, steps, 1, 3000);
    expect(s.clock!.parts[1]).toEqual({ start: 1000, end: 3000 });
  });

  it('kolejne zapisy nie przesuwają końca', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    s.res.goblet = rows(2);
    settlePart(s, steps, 1, 3000);
    settlePart(s, steps, 1, 9000);
    expect(s.clock!.parts[1]!.end).toBe(3000);
  });

  it('para kończy się, gdy oba ćwiczenia mają serie; pominięte i zamknięte też się liczą', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    startPart(s, 2, 2000);
    s.res.row = rows(2);
    settlePart(s, steps, 2, 3000);
    expect(s.clock!.parts[2]!.end).toBeUndefined();
    s.skip.pushup = true;
    settlePart(s, steps, 2, 4000);
    expect(s.clock!.parts[2]!.end).toBe(4000);

    const t = fresh({ done: { row: true }, res: { pushup: rows(2) } });
    startClock(t, 1000, 2);
    settlePart(t, steps, 2, 5000);
    expect(t.clock!.parts[2]!.end).toBe(5000);
  });

  it('cofnięcie ostatniej serii otwiera część z powrotem', () => {
    const s = fresh();
    startClock(s, 1000, 1);
    s.res.goblet = rows(2);
    settlePart(s, steps, 1, 3000);
    s.res.goblet = rows(1);
    settlePart(s, steps, 1, 4000);
    expect(s.clock!.parts[1]).toEqual({ start: 1000 });
  });

  it('bez zegara nic nie zapisuje', () => {
    const s = fresh({ res: { goblet: rows(2) } });
    settlePart(s, steps, 1, 3000);
    expect(s.clock).toBeUndefined();
  });

  it('część z widoku listy dostaje koniec bez startu', () => {
    const s = fresh({ res: { swing: rows(1) } });
    startClock(s, 1000, null);
    settlePart(s, steps, 3, 7000);
    expect(s.clock!.parts[3]).toEqual({ end: 7000 });
  });
});

describe('część czekająca na start', () => {
  it('blok kursora bez startu czeka na „Start”', () => {
    const s = fresh({ res: { goblet: rows(2) } });
    startClock(s, 1000, 1);
    expect(waitingPart(s, steps, 2)).toBe(2);
    startPart(s, 2, 5000);
    expect(waitingPart(s, steps, 2)).toBeNull();
  });

  it('bez zegara, po starcie albo po końcu sesji nic nie czeka', () => {
    const s = fresh();
    expect(waitingPart(s, steps, 0)).toBeNull();
    startClock(s, 1000, 1);
    expect(waitingPart(s, steps, 0)).toBeNull();
    expect(waitingPart(s, steps, -1)).toBeNull();
  });
});

describe('czas zapisany w dzienniku', () => {
  const base = 1_000_000;

  it('sekundy od startu, części po kolei, niedokończona kończy się teraz', () => {
    const s = fresh();
    startClock(s, base, 1);
    s.clock!.parts[1]!.end = base + 600_400;
    s.clock!.parts[2] = { start: base + 700_000 };
    const t = timeOf(s, blocks, base + 1_000_000)!;
    expect(t.secs).toBe(1000);
    expect(t.parts).toEqual([
      { block: 1, ex: ['goblet'], at: 0, end: 600 },
      { block: 2, ex: ['row', 'pushup'], at: 700, end: 1000 },
    ]);
  });

  it('część nieruszona wypada; część z listy nie ma startu i staje według końca', () => {
    const s = fresh();
    startClock(s, base, null);
    s.clock!.parts[3] = { end: base + 300_000 };
    s.clock!.parts[1] = { start: base + 400_000, end: base + 900_000 };
    const t = timeOf(s, blocks, base + 1_000_000)!;
    expect(t.parts.map((p) => p.block)).toEqual([3, 1]);
    expect(t.parts[0]).toEqual({ block: 3, ex: ['swing'], end: 300 });
  });

  it('kolejność po starcie, a przy równym starcie po końcu', () => {
    const s = fresh();
    startClock(s, base, null);
    s.clock!.parts[2] = { start: base + 100_000, end: base + 500_000 };
    s.clock!.parts[1] = { start: base + 100_000, end: base + 200_000 };
    expect(timeOf(s, blocks, base + 600_000)!.parts.map((p) => p.block)).toEqual([1, 2]);
  });

  it('koniec przed startem — część odpada', () => {
    const s = fresh();
    startClock(s, base, null);
    s.clock!.parts[1] = { start: base + 500_000, end: base + 200_000 };
    expect(timeOf(s, blocks, base + 600_000)!.parts).toEqual([]);
  });

  it('bez zegara — brak czasu', () => {
    expect(timeOf(fresh(), blocks, base)).toBeNull();
  });
});

describe('przejścia i podsumowanie', () => {
  const t: LogTime = {
    secs: 3000,
    parts: [
      { block: 3, ex: ['swing'], end: 100 },
      { block: 1, ex: ['goblet'], at: 0, end: 600 },
      { block: 2, ex: ['row', 'pushup'], at: 700, end: 1500 },
      { block: 4, ex: ['plank'], at: 1720, end: 2400 },
    ],
  };

  it('przejście to start następnej części minus koniec poprzedniej; część z listy go nie ma', () => {
    expect(transitions(t)).toEqual([
      { block: 2, ex: ['row', 'pushup'], secs: 100 },
      { block: 4, ex: ['plank'], secs: 220 },
    ]);
  });

  it('ujemnego przejścia nie ma', () => {
    const overlap: LogTime = {
      secs: 900,
      parts: [
        { block: 1, ex: ['a'], at: 0, end: 500 },
        { block: 2, ex: ['b'], at: 400, end: 800 },
      ],
    };
    expect(transitions(overlap)).toEqual([]);
  });

  it('podsumowanie: całość, praca, przejścia i najdłuższe z nich', () => {
    expect(summary(t)).toEqual({
      secs: 3000,
      work: 600 + 800 + 680,
      gaps: 320,
      longest: { block: 4, ex: ['plank'], secs: 220 },
    });
    expect(summary({ secs: 500, parts: [{ block: 1, ex: ['a'], at: 0, end: 400 }] }).longest).toBeNull();
  });

  it('do statystyk liczy się trening od 3 minut do 4 godzin', () => {
    expect(timed(undefined)).toBe(false);
    expect(timed({ secs: 179, parts: [] })).toBe(false);
    expect(timed({ secs: 180, parts: [] })).toBe(true);
    expect(timed({ secs: 14_400, parts: [] })).toBe(true);
    expect(timed({ secs: 14_401, parts: [] })).toBe(false);
  });

  it('czas słowami', () => {
    expect(durationText(45)).toBe('45 s');
    expect(durationText(12 * 60 + 10)).toBe('12 min');
    expect(durationText(65 * 60)).toBe('1 h 05 min');
    expect(durationText(2 * 3600)).toBe('2 h 00 min');
  });
});
