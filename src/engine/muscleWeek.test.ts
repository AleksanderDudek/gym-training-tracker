import { describe, expect, it } from 'vitest';
import { MUSCLES } from '../data/muscles';
import { freshState } from './plan';
import { RULES } from './design';
import { WEEK_REFERENCE, muscleWeek, shade } from './muscleWeek';
import type { AppState, LogEntry, LogItem, Snack } from '../types';

const item = (id: string, reps: number[]): LogItem => ({ id, sets: reps.map((r) => ({ reps: r, w: 16 })), effort: 'solid' });
const entry = (date: string, items: LogItem[]): LogEntry => ({ date, workout: 'Trening A', ready: 'ok', items });
const snack = (at: string): Snack => ({ key: at, at, ex: 'goblet', reps: 10, w: null }) as Snack;

const stateWith = (log: LogEntry[], snacks: Snack[] = []): AppState => {
  const s = freshState();
  s.log = log;
  s.snacks = snacks;
  return s;
};

// Środa, 14 października 2026 — tydzień od poniedziałku 12.10 do niedzieli 18.10.
const NOW = Date.parse('2026-10-14T12:00:00.000Z');
const sets = (w: ReturnType<typeof muscleWeek>, m: string) => w.muscles.find((x) => x.muscle === m)!.sets;

describe('muscleWeek', () => {
  it('tydzień od poniedziałku do niedzieli i wszystkie 16 partii w kolejności MUSCLES', () => {
    const w = muscleWeek(stateWith([]), NOW);
    expect(w.from).toBe('2026-10-12');
    expect(w.to).toBe('2026-10-18');
    expect(w.sessions).toBe(0);
    expect(w.muscles.map((m) => m.muscle)).toEqual(MUSCLES);
    expect(w.muscles.every((m) => m.sets === 0)).toBe(true);
  });

  it('główny mięsień liczy całą serię, pomocniczy pół', () => {
    // Goblet: główne czworogłowe i pośladki, pomocnicze brzuch i przywodziciele.
    const w = muscleWeek(stateWith([entry('2026-10-13T18:00:00.000Z', [item('goblet', [10, 10, 10])])]), NOW);
    expect(w.sessions).toBe(1);
    expect(sets(w, 'czworoglowe')).toBe(3);
    expect(sets(w, 'posladki')).toBe(3);
    expect(sets(w, 'brzuch')).toBe(1.5);
    expect(sets(w, 'przywodziciele')).toBe(1.5);
    expect(sets(w, 'klatka')).toBe(0);
  });

  it('liczy tylko serie z wynikiem powyżej zera', () => {
    const w = muscleWeek(stateWith([entry('2026-10-13T18:00:00.000Z', [item('curl', [12, 0, 10, 0])])]), NOW);
    expect(sets(w, 'biceps')).toBe(2);
  });

  it('sumuje treningi z tygodnia, a pomija te sprzed poniedziałku i z następnego tygodnia', () => {
    const w = muscleWeek(
      stateWith([
        entry('2026-10-11T23:30:00.000Z', [item('curl', [10, 10])]), // niedziela poprzedniego tygodnia
        entry('2026-10-12T00:10:00.000Z', [item('curl', [10])]), // poniedziałek
        entry('2026-10-18T23:50:00.000Z', [item('curl', [10, 10, 10])]), // niedziela
        entry('2026-10-19T06:00:00.000Z', [item('curl', [10, 10, 10, 10])]), // następny poniedziałek
      ]),
      NOW,
    );
    expect(w.sessions).toBe(2);
    expect(sets(w, 'biceps')).toBe(4);
  });

  it('przekąski nie wchodzą do serii — są tylko policzone', () => {
    const w = muscleWeek(stateWith([], [snack('2026-10-13T08:00:00.000Z'), snack('2026-10-14T08:00:00.000Z'), snack('2026-10-05T08:00:00.000Z')]), NOW);
    expect(w.snacks).toBe(2);
    expect(w.muscles.every((m) => m.sets === 0)).toBe(true);
  });

  it('wpis z uszkodzoną datą odpada zamiast wywrócić kartę', () => {
    const w = muscleWeek(stateWith([entry('wczoraj', [item('curl', [10])])]), NOW);
    expect(w.sessions).toBe(0);
  });
});

describe('shade', () => {
  it('stopnie idą za liczbami doradcy: 0, poniżej 4, 4–10, 10–20, ponad 20', () => {
    expect(RULES.weeklyMin).toBe(4);
    expect(WEEK_REFERENCE).toEqual({ from: 10, to: 20 });
    expect(shade(0)).toBe(0);
    expect(shade(0.5)).toBe(1);
    expect(shade(3.5)).toBe(1);
    expect(shade(4)).toBe(2);
    expect(shade(9.5)).toBe(2);
    expect(shade(10)).toBe(3);
    expect(shade(20)).toBe(3);
    expect(shade(20.5)).toBe(4);
  });
});
