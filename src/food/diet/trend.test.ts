import { describe, expect, test } from 'vitest';
import { leastSquares, paceOver, reachRange, trendOn, trendSeries, type WeighIn } from './trend';

/** Day `i` of a run of days from 1 September 2026. */
const day = (i: number) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
const weighIns = (pairs: [number, number][]): WeighIn[] => pairs.map(([d, kg]) => ({ day: day(d), kg }));

describe('the display trend', () => {
  test('a day later a tenth of the way, a week later about a half, a typo moves it 3 kg at most', () => {
    expect(trendSeries(weighIns([[0, 80], [1, 81]])).at(-1)!.trend).toBeCloseTo(80.1, 9);
    expect(trendSeries(weighIns([[0, 80], [7, 81]])).at(-1)!.trend).toBeCloseTo(80.522, 3);
    expect(trendSeries(weighIns([[0, 80], [1, 90]])).at(-1)!.trend).toBeCloseTo(80.3, 9);
  });

  test('the first weigh-in starts it; the raw weights stay next to it', () => {
    expect(trendSeries(weighIns([[0, 80], [1, 81]]))).toEqual([
      { day: day(0), kg: 80, trend: 80 },
      { day: day(1), kg: 81, trend: expect.closeTo(80.1, 9) },
    ]);
    expect(trendSeries([])).toEqual([]);
  });

  test('one weigh-in a day (the last given wins), in date order, unreadable ones left out', () => {
    const series = trendSeries([
      { day: day(1), kg: 81 },
      { day: day(0), kg: 79 },
      { day: day(0), kg: 80 },
      { day: day(2), kg: Number.NaN },
      { day: 'wczoraj', kg: 82 },
    ]);
    expect(series.map((p) => [p.day, p.kg])).toEqual([
      [day(0), 80],
      [day(1), 81],
    ]);
  });

  test('on a date: the trend at the last weigh-in on or before it, null before the first', () => {
    const w = weighIns([[0, 80], [1, 81]]);
    expect(trendOn(w, day(-1))).toBeNull();
    expect(trendOn(w, day(0))).toBe(80);
    expect(trendOn(w, day(30))).toBeCloseTo(80.1, 9);
  });
});

describe('least squares with an honest standard error', () => {
  // Example F: 28 daily weigh-ins, 80 − 0,025·i.
  const exact = Array.from({ length: 28 }, (_, i) => ({ day: day(i), kg: 80 - 0.025 * i }));

  test('28 exact daily points: the slope, the trend at the end, SE·7500 = 61,41 (residual floor 0,35 kg)', () => {
    const line = leastSquares(exact)!;
    expect(line.slope).toBeCloseTo(-0.025, 12);
    expect(line.at(day(27))).toBeCloseTo(79.325, 9);
    expect(line.sd).toBe(0.35);
    expect(line.r1).toBe(0);
    expect(line.se * 7500).toBeCloseTo(61.41, 2);
    expect([line.n, line.first, line.last]).toEqual([28, day(0), day(27)]);
  });

  test('below 10 weigh-ins the autocorrelation is assumed 0,3', () => {
    const six = [0, 3, 6, 8, 11, 14].map((d, i) => ({ day: day(d), kg: 80 - 0.05 * d + (i % 2 ? 0.8 : -0.8) }));
    const line = leastSquares(six)!;
    expect(line.r1).toBe(0.3);
    const xs = [0, 3, 6, 8, 11, 14];
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sxx = xs.reduce((s, x) => s + (x - mean) ** 2, 0);
    expect(line.se).toBeCloseTo((line.sd / Math.sqrt(sxx)) * Math.sqrt(1.3 / 0.7), 12);
    // Even points on a line: too few to measure, so 0,3 too.
    expect(leastSquares(exact.slice(0, 9))!.r1).toBe(0.3);
  });

  test('from 10 weigh-ins it is measured, clamped to [0, 0,6]', () => {
    const alternating = Array.from({ length: 20 }, (_, i) => ({ day: day(i), kg: 80 + (i % 2 ? 0.5 : -0.5) }));
    expect(leastSquares(alternating)!.r1).toBe(0);
    const blocks = Array.from({ length: 20 }, (_, i) => ({ day: day(i), kg: 80 + (Math.floor(i / 5) % 2 ? 1 : -1) }));
    expect(leastSquares(blocks)!.r1).toBe(0.6);
  });

  test('points exactly on a line leave only floating-point dust: no autocorrelation, the plain SE', () => {
    // −0,5 kg a week to the last bit the floats allow: the residuals are about 1e-14 kg, not 0.
    const line = leastSquares(Array.from({ length: 28 }, (_, i) => ({ day: day(i), kg: 84 - (0.5 / 7) * i })))!;
    expect(line.slope * 7).toBeCloseTo(-0.5, 12);
    expect(line.r1).toBe(0);
    expect(line.se * 7).toBeCloseTo(0.0573, 4);
    // The same weight every day, too.
    expect(leastSquares(Array.from({ length: 12 }, (_, i) => ({ day: day(i), kg: 81.3 })))!.r1).toBe(0);
  });

  test('a line needs two weigh-ins; two give no spread to trust', () => {
    expect(leastSquares(weighIns([[0, 80]]))).toBeNull();
    expect(leastSquares(weighIns([[0, 80], [7, 79]]))!.se).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('the observed pace', () => {
  test('kg a week, positive when losing, with its SE', () => {
    const exact = Array.from({ length: 28 }, (_, i) => ({ day: day(i), kg: 80 - 0.025 * i }));
    const fit = paceOver(exact, day(0), day(27))!;
    expect(fit.pace).toBeCloseTo(0.175, 12);
    expect(fit.se).toBeCloseTo((61.41 / 7500) * 7, 4);
    expect([fit.weighIns, fit.spanDays]).toEqual([28, 27]);
  });

  test('null below 5 weigh-ins or 14 days', () => {
    expect(paceOver(weighIns([[0, 80], [5, 80], [10, 79], [20, 79]]), day(0), day(20))).toBeNull();
    expect(paceOver(weighIns([[0, 80], [3, 80], [6, 79], [9, 79], [13, 78]]), day(0), day(20))).toBeNull();
    const enough = paceOver(weighIns([[0, 80], [3, 80], [6, 79], [9, 79], [14, 78]]), day(0), day(20));
    expect(enough).toMatchObject({ weighIns: 5, spanDays: 14 });
    expect(enough!.pace).toBeGreaterThan(0);
  });

  test('only the weigh-ins inside the window count', () => {
    const w = weighIns([[0, 90], [10, 80], [13, 80], [16, 79], [19, 79], [24, 78]]);
    expect(paceOver(w, day(10), day(24))).toMatchObject({ weighIns: 5, spanDays: 14 });
    expect(paceOver(w, day(10), day(23))).toBeNull();
  });

  test('a gain is a negative pace', () => {
    expect(paceOver(weighIns([[0, 60], [4, 60.2], [8, 60.4], [12, 60.6], [16, 60.8]]), day(0), day(16))!.pace).toBeCloseTo(
      -0.35,
      9,
    );
  });
});

describe('when the target weight comes', () => {
  const today = '2026-10-24';

  test('a range from the pace ± 2 SE', () => {
    // 5 kg at 0,5 ± 0,05: 58 days at 0,6, 88 days at 0,4.
    expect(reachRange({ trendKg: 80, targetKg: 75, pace: 0.5, se: 0.05, today })).toEqual({
      kind: 'range',
      early: '2026-12-21',
      late: '2027-01-20',
    });
    // Gaining toward a higher target works the same way.
    expect(reachRange({ trendKg: 60, targetKg: 65, pace: -0.5, se: 0.05, today })).toEqual({
      kind: 'range',
      early: '2026-12-21',
      late: '2027-01-20',
    });
  });

  test('month boundaries: 30 days from 1 October is 31 October, 31 days is 1 November', () => {
    const at = (days: number) => reachRange({ trendKg: 80, targetKg: 80 - days / 7, pace: 1, se: 0, today: '2026-10-01' });
    expect(at(30)).toEqual({ kind: 'range', early: '2026-10-31', late: '2026-10-31' });
    expect(at(31)).toEqual({ kind: 'range', early: '2026-11-01', late: '2026-11-01' });
  });

  test('no late end when the pace minus 2 SE is 0,05 kg a week or less: only „at the earliest”', () => {
    expect(reachRange({ trendKg: 80, targetKg: 75, pace: 0.15, se: 0.05, today })).toMatchObject({ kind: 'range', late: null });
  });

  test('the 730-day cut: an early end beyond it is „further than 2 years”, a late end beyond it is dropped', () => {
    // 0,1 kg a week: 70 days a kilo.
    expect(reachRange({ trendKg: 90, targetKg: 90 - 730 / 70, pace: 0.1, se: 0, today })).toMatchObject({ kind: 'range' });
    expect(reachRange({ trendKg: 90, targetKg: 90 - 731 / 70, pace: 0.1, se: 0, today })).toEqual({ kind: 'far' });
    // 10 kg at 0,5 ± 0,2: the late end at 0,1 is 700 days; 11 kg makes it 770.
    expect(reachRange({ trendKg: 90, targetKg: 80, pace: 0.5, se: 0.2, today }).kind).toBe('range');
    expect(reachRange({ trendKg: 90, targetKg: 80, pace: 0.5, se: 0.2, today })).not.toMatchObject({ late: null });
    expect(reachRange({ trendKg: 91, targetKg: 80, pace: 0.5, se: 0.2, today })).toMatchObject({ kind: 'range', late: null });
  });

  test('a pace pointing away, under 0,1 kg a week, or the target already there: the plan sentence', () => {
    expect(reachRange({ trendKg: 80, targetKg: 75, pace: -0.3, se: 0.05, today })).toEqual({ kind: 'plan' });
    expect(reachRange({ trendKg: 80, targetKg: 75, pace: 0.09, se: 0, today })).toEqual({ kind: 'plan' });
    expect(reachRange({ trendKg: 75, targetKg: 75, pace: 0.5, se: 0.05, today })).toEqual({ kind: 'plan' });
  });
});
