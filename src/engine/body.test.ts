import { describe, expect, it } from 'vitest';
import { avgWeight, setBodyWeight, weightTrend } from './body';
import { freshState } from './plan';

/**
 * Waga w czasie: o kierunku mówi średnia z tygodnia, a nie ważenie z jednego ranka, które
 * skacze o kilogram czy dwa z wodą i śniadaniem.
 */

const weighed = (entries: [string, number][]) => {
  const s = freshState();
  entries.forEach(([day, kg]) => setBodyWeight(s, kg, day));
  return s;
};

describe('średnia z 7 dni i zmiana tydzień do tygodnia', () => {
  it('średnia bierze ważenia z ostatnich siedmiu dni, do dnia włącznie', () => {
    const s = weighed([
      ['2026-10-01', 104],
      ['2026-10-03', 103.6],
      ['2026-10-08', 102.6],
      ['2026-10-09', 102.1],
    ]);
    expect(avgWeight(s, '2026-10-09')).toBe(102.8);
    expect(avgWeight(s, '2026-10-02')).toBe(104);
    expect(avgWeight(s, '2026-09-20')).toBeNull();
  });

  it('trend: dzisiejsze ważenie, obie średnie, różnica i liczba ważeń w tygodniu', () => {
    const s = weighed([
      ['2026-10-01', 104],
      ['2026-10-02', 103.6],
      ['2026-10-08', 102.6],
      ['2026-10-09', 102.1],
    ]);
    expect(weightTrend(s, '2026-10-09')).toEqual({ today: 102.1, avg: 102.4, prevAvg: 103.8, delta: -1.4, n: 2 });
    expect(weightTrend(s, '2026-10-10').today).toBeNull();
  });

  it('bez ważeń sprzed tygodnia zmiany nie ma — jest tylko bieżąca średnia', () => {
    const s = weighed([['2026-10-09', 102.1]]);
    expect(weightTrend(s, '2026-10-09')).toMatchObject({ avg: 102.1, prevAvg: null, delta: null, n: 1 });
  });
});
