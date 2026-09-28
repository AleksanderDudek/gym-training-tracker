import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import {
  SNACK_MAX,
  SNACK_SUGGESTED,
  addSnack,
  recentExercises,
  removeSnack,
  snackHint,
  snackStats,
  snacksByExercise,
  snacksOf,
  snacksOn,
  validSnack,
} from './snacks';
import { metrics } from './metrics';
import { logDays } from './schedule';
import type { AppState } from '../types';

const at = (iso: string): number => Date.parse(iso);

describe('zapis przekąski', () => {
  it('dopisuje przekąskę z unikalnym kluczem, także w tej samej milisekundzie', () => {
    const s = freshState();
    const a = addSnack(s, 'squat_air', 15, null, at('2026-09-27T09:00:00Z'));
    const b = addSnack(s, 'squat_air', 15, null, at('2026-09-27T09:00:00Z'));
    expect(s.snacks).toHaveLength(2);
    expect(a.key).not.toBe(b.key);
    expect(a.at).toBe('2026-09-27T09:00:00.000Z');
  });

  it('odrzuca nieznane ćwiczenie i zerowy wynik', () => {
    const s = freshState();
    expect(() => addSnack(s, 'nie-ma-takiego', 10, null)).toThrow();
    expect(() => addSnack(s, 'squat_air', 0, null)).toThrow();
    expect(s.snacks).toHaveLength(0);
  });

  it('odrzuca liczbę, która nie jest przekąską, tylko literówką', () => {
    const s = freshState();
    expect(() => addSnack(s, 'squat_air', SNACK_MAX.reps + 1, null)).toThrow();
    expect(() => addSnack(s, 'plank', SNACK_MAX.secs + 1, null)).toThrow();
    expect(addSnack(s, 'plank', SNACK_MAX.reps + 1, null).reps).toBe(SNACK_MAX.reps + 1);
  });

  it('zerowy ciężar zapisuje jako brak ciężaru', () => {
    const s = freshState();
    expect(addSnack(s, 'goblet', 10, 0).w).toBeNull();
    expect(addSnack(s, 'goblet', 10, 16).w).toBe(16);
  });

  it('usuwa po kluczu i mówi, czy było co usunąć', () => {
    const s = freshState();
    const a = addSnack(s, 'squat_air', 15, null, at('2026-09-27T09:00:00Z'));
    expect(removeSnack(s, 'brak')).toBe(false);
    expect(removeSnack(s, a.key)).toBe(true);
    expect(s.snacks).toHaveLength(0);
  });

  it('stary zapis bez listy przekąsek traktuje jak pustą listę', () => {
    const s = freshState() as Partial<AppState> as AppState;
    delete (s as Partial<AppState>).snacks;
    expect(snacksOf(s)).toEqual([]);
    expect(() => metrics(s)).not.toThrow();
    addSnack(s, 'squat_air', 10, null);
    expect(snacksOf(s)).toHaveLength(1);
  });

  it('sprawdza wpisy z importu: znane ćwiczenie, data i dodatni wynik', () => {
    const ok = { key: 'k', at: '2026-09-27T09:00:00.000Z', ex: 'squat_air', reps: 10, w: null };
    expect(validSnack(ok)).toBe(true);
    expect(validSnack({ ...ok, ex: 'nie-ma' })).toBe(false);
    expect(validSnack({ ...ok, reps: 0 })).toBe(false);
    expect(validSnack({ ...ok, at: 'wczoraj' })).toBe(false);
    expect(validSnack(null)).toBe(false);
  });
});

describe('przekąska nie jest treningiem', () => {
  it('nie trafia do dziennika ani do kalendarza planu', () => {
    const s = freshState();
    addSnack(s, 'squat_air', 20, null, at('2026-09-27T09:00:00Z'));
    expect(s.log).toHaveLength(0);
    expect(logDays(s)).toEqual([]);
    const m = metrics(s);
    // Dorobek liczy zamknięte treningi — przekąski mają własne liczniki.
    expect(m.workouts).toBe(0);
    expect(m.reps).toBe(0);
    expect(m.snacks.count).toBe(1);
  });
});

describe('skróty i podpowiedzi', () => {
  it('skróty to same ćwiczenia: ostatnio robione od najnowszego, bez powtórzeń', () => {
    const s = freshState();
    addSnack(s, 'squat_air', 15, null, at('2026-09-27T08:00:00Z'));
    addSnack(s, 'goblet', 8, 12, at('2026-09-27T09:00:00Z'));
    addSnack(s, 'squat_air', 20, null, at('2026-09-27T10:00:00Z'));
    expect(recentExercises(s, 2)).toEqual(['squat_air', 'goblet']);
  });

  it('bez historii i przy krótkiej historii dopełnia listę propozycjami na start', () => {
    const s = freshState();
    expect(recentExercises(s)).toEqual([...SNACK_SUGGESTED].slice(0, 4));
    addSnack(s, 'goblet', 8, 12, at('2026-09-27T09:00:00Z'));
    const list = recentExercises(s);
    expect(list[0]).toBe('goblet');
    expect(list).toHaveLength(4);
    expect(new Set(list).size).toBe(4);
  });

  it('propozycje na start to ćwiczenia z biblioteki', () => {
    SNACK_SUGGESTED.forEach((id) => expect(freshState().prog[id], id).toBeTruthy());
  });

  it('podpowiedź mówi tylko, ile było ostatnio — nic nie zmyśla z celu biblioteki', () => {
    const s = freshState();
    expect(snackHint(s, 'goblet')).toEqual({ last: null, w: null });
    addSnack(s, 'goblet', 12, 12, at('2026-09-27T08:00:00Z'));
    addSnack(s, 'goblet', 9, 16, at('2026-09-27T12:00:00Z'));
    expect(snackHint(s, 'goblet')).toEqual({ last: 9, w: 16 });
  });

  it('dzień przekąsek jest ułożony od najwcześniejszej', () => {
    const s = freshState();
    addSnack(s, 'plank', 30, null, at('2026-09-27T15:00:00Z'));
    addSnack(s, 'squat_air', 15, null, at('2026-09-27T08:00:00Z'));
    addSnack(s, 'squat_air', 15, null, at('2026-09-26T08:00:00Z'));
    expect(snacksOn(s, '2026-09-27').map((x) => x.ex)).toEqual(['squat_air', 'plank']);
  });

  it('dzień w rozbiciu na ćwiczenia: suma, liczba przekąsek, najświeższe na górze', () => {
    const s = freshState();
    addSnack(s, 'squat_air', 15, null, at('2026-09-27T08:00:00Z'));
    addSnack(s, 'plank', 30, null, at('2026-09-27T09:00:00Z'));
    addSnack(s, 'squat_air', 20, null, at('2026-09-27T10:00:00Z'));
    addSnack(s, 'squat_air', 50, null, at('2026-09-26T10:00:00Z'));
    expect(snacksByExercise(s, '2026-09-27').map(({ ex, total, count }) => ({ ex, total, count }))).toEqual([
      { ex: 'squat_air', total: 35, count: 2 },
      { ex: 'plank', total: 30, count: 1 },
    ]);
    expect(snacksByExercise(s, '2026-09-25')).toEqual([]);
  });
});

describe('liczby przekąsek', () => {
  const snack = (iso: string, ex = 'squat_air') => ({ key: iso, at: iso, ex, reps: 10, w: null });

  it('liczy najlepszy dzień, ciąg dni i różne ćwiczenia', () => {
    const st = snackStats([
      snack('2026-09-21T08:00:00Z'),
      snack('2026-09-21T12:00:00Z', 'plank'),
      snack('2026-09-21T16:00:00Z'),
      snack('2026-09-22T08:00:00Z'),
      snack('2026-09-23T08:00:00Z', 'burpee'),
      snack('2026-09-25T08:00:00Z'),
    ]);
    expect(st.count).toBe(6);
    expect(st.bestDay).toBe(3);
    expect(st.run).toBe(3);
    expect(st.distinct).toBe(3);
  });

  it('pełny tydzień to siedem dni od poniedziałku do niedzieli', () => {
    // 2026-09-21 to poniedziałek.
    const week = ['21', '22', '23', '24', '25', '26', '27'].map((d) => snack(`2026-09-${d}T08:00:00Z`));
    expect(snackStats(week).fullWeeks).toBe(1);
    // Siedem dni z rzędu, ale od wtorku do poniedziałku — to dwa niepełne tygodnie.
    const shifted = ['22', '23', '24', '25', '26', '27', '28'].map((d) => snack(`2026-09-${d}T08:00:00Z`));
    expect(snackStats(shifted).fullWeeks).toBe(0);
    expect(snackStats(shifted).run).toBe(7);
  });

  it('pusta lista nie wywraca liczb', () => {
    expect(snackStats([])).toMatchObject({ count: 0, bestDay: 0, run: 0, fullWeeks: 0, distinct: 0 });
  });
});
