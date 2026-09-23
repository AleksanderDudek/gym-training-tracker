import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { doneExercises, exerciseRows, trend, weeksBetween } from './history';
import type { AppState, EffortKey, ExerciseId, LogEntry, LogItem } from '../types';

const item = (
  id: string,
  reps: number[],
  w: number | null = 16,
  effort: EffortKey = 'solid',
): LogItem => ({
  id,
  sets: reps.map((r) => ({ reps: r, w })),
  effort,
});

const entry = (date: string, items: LogItem[]): LogEntry => ({
  date: `${date}T18:00:00.000Z`,
  workout: 'Trening A',
  ready: 'ok',
  items,
});

const stateWith = (log: LogEntry[]): AppState => {
  const s = freshState();
  s.log = log;
  return s;
};

/** Seria sesji z tym samym ćwiczeniem, dzień po dniu, o zadanych ciężarach. */
const series = (id: ExerciseId, weights: (number | null)[], reps = 10): LogEntry[] =>
  weights.map((w, i) =>
    entry(`2026-0${Math.floor(i / 28) + 1}-${String((i % 28) + 1).padStart(2, '0')}`, [
      item(id, [reps, reps, reps], w),
    ]),
  );

describe('sesje jednego ćwiczenia', () => {
  it('wyciąga tylko te wpisy, w których ćwiczenie wystąpiło', () => {
    const s = stateWith([
      entry('2026-09-01', [item('swing2', [10, 10]), item('goblet', [8])]),
      entry('2026-09-03', [item('goblet', [8, 8])]),
      entry('2026-09-05', [item('swing2', [12, 12])]),
    ]);
    expect(exerciseRows(s, 'swing2').map((r) => r.total)).toEqual([20, 24]);
    expect(exerciseRows(s, 'goblet')).toHaveLength(2);
    expect(exerciseRows(s, 'plank')).toHaveLength(0);
  });

  it('bierze najcięższy ciężar sesji i liczy z niego maksimum', () => {
    const s = stateWith([
      entry('2026-09-01', [
        { id: 'swing2', effort: 'solid', sets: [{ reps: 10, w: 16 }, { reps: 8, w: 20 }] },
      ]),
    ]);
    const [row] = exerciseRows(s, 'swing2');
    expect(row!.w).toBe(20);
    expect(row!.e1rm).toBeGreaterThan(20);
    // Tonaż liczy każdą serię własnym ciężarem, nie najcięższym.
    expect(row!.tonnage).toBe(10 * 16 + 8 * 20);
  });

  it('ćwiczenie bez ciężaru nie dostaje szacowanego maksimum', () => {
    const s = stateWith([entry('2026-09-01', [item('plank', [45, 40], null)])]);
    const [row] = exerciseRows(s, 'plank');
    expect(row!.w).toBeNull();
    expect(row!.e1rm).toBeNull();
    expect(row!.tonnage).toBe(0);
  });

  it('układa sesje od najstarszej, niezależnie od kolejności w dzienniku', () => {
    const s = stateWith([
      entry('2026-09-05', [item('swing2', [12])]),
      entry('2026-09-01', [item('swing2', [10])]),
    ]);
    expect(exerciseRows(s, 'swing2').map((r) => r.total)).toEqual([10, 12]);
  });
});

describe('lista ćwiczeń z historii', () => {
  it('pokazuje tylko to, co naprawdę było, i liczy sesje', () => {
    const s = stateWith([
      entry('2026-09-01', [item('swing2', [10]), item('goblet', [8])]),
      entry('2026-09-03', [item('swing2', [10])]),
    ]);
    const list = doneExercises(s);
    expect(list.map((e) => e.id)).toEqual(['swing2', 'goblet']);
    expect(list[0]!.sessions).toBe(2);
    expect(list[0]!.first < list[0]!.last).toBe(true);
  });

  it('zbiera rekordy: najlepsza seria i najcięższy ciężar', () => {
    const s = stateWith([
      entry('2026-09-01', [item('swing2', [10, 12], 16)]),
      entry('2026-09-03', [item('swing2', [8, 9], 24)]),
    ]);
    const [sum] = doneExercises(s);
    expect(sum!.bestSet).toBe(12);
    expect(sum!.bestWeight).toBe(24);
    expect(sum!.total).toBe(39);
  });

  it('pusty dziennik daje pustą listę, a nie katalog ćwiczeń', () => {
    expect(doneExercises(freshState())).toEqual([]);
  });

  it('do wykresu bierze maksimum, gdy jest czym mierzyć, inaczej wynik sesji', () => {
    const heavy = stateWith(series('swing2', [12, 14, 16, 18]));
    const heavySeries = doneExercises(heavy)[0]!.series;
    expect(heavySeries).toHaveLength(4);
    // Przy stałych powtórzeniach maksimum rośnie razem z ciężarem, a nie z liczbą serii.
    expect(heavySeries[3]).toBeGreaterThan(heavySeries[0]!);

    const body = stateWith(series('plank', [null, null, null, null], 40));
    expect(doneExercises(body)[0]!.series).toEqual([120, 120, 120, 120]);
  });
});

describe('kierunek zmiany', () => {
  it('poniżej czterech sesji nie zgaduje', () => {
    const s = stateWith(series('swing2', [12, 16, 20]));
    expect(trend(exerciseRows(s, 'swing2'), 'swing2')).toBeNull();
  });

  it('rosnący ciężar to progres', () => {
    const s = stateWith(series('swing2', [12, 12, 16, 16, 20, 24]));
    const t = trend(exerciseRows(s, 'swing2'), 'swing2')!;
    expect(t.dir).toBe('up');
    expect(t.pct).toBeGreaterThan(5);
    expect(t.to).toBeGreaterThan(t.from);
    expect(t.metric).toBe('e1rm');
  });

  it('spadek ciężaru to regres', () => {
    const s = stateWith(series('swing2', [24, 24, 20, 16, 12, 12]));
    const t = trend(exerciseRows(s, 'swing2'), 'swing2')!;
    expect(t.dir).toBe('down');
    expect(t.pct).toBeLessThan(-5);
  });

  it('drobne wahania to nadal ten sam poziom', () => {
    const s = stateWith(series('swing2', [16, 16, 16, 16, 16, 16]));
    expect(trend(exerciseRows(s, 'swing2'), 'swing2')!.dir).toBe('flat');
  });

  it('bez ciężaru mierzy powtórzeniami, a przy ćwiczeniu na czas — sekundami', () => {
    const reps = stateWith(
      [8, 9, 10, 12, 14, 15].map((r, i) =>
        entry(`2026-09-${String(i + 1).padStart(2, '0')}`, [item('pushup', [r], null)]),
      ),
    );
    const t = trend(exerciseRows(reps, 'pushup'), 'pushup')!;
    expect(t.metric).toBe('reps');
    expect(t.dir).toBe('up');

    const secs = stateWith(
      [30, 32, 35, 40, 45, 50].map((r, i) =>
        entry(`2026-09-${String(i + 1).padStart(2, '0')}`, [item('plank', [r], null)]),
      ),
    );
    expect(trend(exerciseRows(secs, 'plank'), 'plank')!.metric).toBe('secs');
  });
});

describe('rozpiętość w czasie', () => {
  it('liczy tygodnie między pierwszym a ostatnim zapisem', () => {
    expect(weeksBetween('2026-09-01T18:00:00.000Z', '2026-09-29T18:00:00.000Z')).toBe(4);
    expect(weeksBetween('2026-09-01T18:00:00.000Z', '2026-09-02T18:00:00.000Z')).toBe(0);
  });
});
