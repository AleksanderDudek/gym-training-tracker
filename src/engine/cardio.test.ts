import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import {
  ACTIVE_DAY_MIN,
  BASE_STEPS,
  SESSION_MIN,
  STEP_GOAL,
  WHO_WEEK_MIN,
  activeMinutes,
  addCardio,
  cardioStats,
  minutesByDay,
  weekMinutes,
  cardioOf,
  cardioOn,
  inputProblem,
  lastOf,
  normalize,
  removeCardio,
  sportOf,
  stepsOn,
  validCardio,
} from './cardio';
import {
  heightOf,
  latestWeight,
  removeBodyWeight,
  setBodyWeight,
  validBody,
  validWeight,
  weightOn,
} from './body';
import {
  cardioBurn,
  cardioDays,
  dayBurn,
  exercisePlannedBurn,
  plannedBurn,
  rowBurn,
  snackBurn,
  workoutBurn,
} from './burn';
import { cardioEnergy, setsEnergy } from './energy';
import { exerciseRows } from './history';
import { addSnack } from './snacks';
import { BUILTIN } from '../data/exercises';
import type { AppState, LogEntry } from '../types';

const at = (iso: string): number => Date.parse(iso);

const withWeight = (kg = 80, day = '2026-01-01'): AppState => {
  const s = freshState();
  setBodyWeight(s, kg, day);
  return s;
};

const entry = (date: string, id = 'squat_back', reps = [5, 5, 5]): LogEntry => ({
  date,
  workout: 'Test',
  ready: 'ok',
  items: [{ id, sets: reps.map((r) => ({ reps: r, w: 60 })), effort: 'solid' }],
});

describe('wpis ruchu', () => {
  it('kroki na ten sam dzień zastępują poprzedni wpis — to stan licznika, nie przyrost', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: 4000 }, '2026-09-28', at('2026-09-28T12:00:00Z'));
    const { replaced } = addCardio(s, { kind: 'steps', steps: 9500 }, '2026-09-28', at('2026-09-28T21:00:00Z'));
    expect(replaced?.kind === 'steps' && replaced.steps).toBe(4000);
    expect(stepsOn(s, '2026-09-28')).toBe(9500);
    expect(cardioOf(s)).toHaveLength(1);
  });

  it('bieżnia i rower się sumują, a kroki z innego dnia zostają', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: 8000 }, '2026-09-27');
    addCardio(s, { kind: 'steps', steps: 6000 }, '2026-09-28');
    addCardio(s, { kind: 'treadmill', kmh: 6, min: 30, grade: 0 }, '2026-09-28');
    addCardio(s, { kind: 'treadmill', kmh: 6, min: 20, grade: 2 }, '2026-09-28');
    addCardio(s, { kind: 'bike', kmh: 22, min: 45 }, '2026-09-28');
    expect(cardioOn(s, '2026-09-28')).toHaveLength(4);
    expect(stepsOn(s, '2026-09-27')).toBe(8000);
    expect(cardioDays(s)).toEqual(['2026-09-28', '2026-09-27']);
  });

  it('klucz jest unikalny także w tej samej milisekundzie', () => {
    const s = freshState();
    const t = at('2026-09-28T10:00:00Z');
    const a = addCardio(s, { kind: 'bike', kmh: 20, min: 30 }, '2026-09-28', t).entry;
    const b = addCardio(s, { kind: 'bike', kmh: 20, min: 30 }, '2026-09-28', t).entry;
    expect(a.key).not.toBe(b.key);
  });

  it('odrzuca literówki i nie zapisuje ich', () => {
    const s = freshState();
    expect(() => addCardio(s, { kind: 'steps', steps: 0 }, '2026-09-28')).toThrow();
    expect(() => addCardio(s, { kind: 'steps', steps: 250_000 }, '2026-09-28')).toThrow();
    expect(() => addCardio(s, { kind: 'treadmill', kmh: 40, min: 30, grade: 0 }, '2026-09-28')).toThrow();
    expect(() => addCardio(s, { kind: 'bike', kmh: 20, min: 0 }, '2026-09-28')).toThrow();
    expect(() => addCardio(s, { kind: 'ergo', watts: 5000, min: 30 }, '2026-09-28')).toThrow();
    expect(() => addCardio(s, { kind: 'steps', steps: 100 }, '28.09.2026')).toThrow();
    expect(cardioOf(s)).toHaveLength(0);
  });

  it('opisuje problem zdaniem, które da się pokazać pod formularzem', () => {
    expect(inputProblem({ kind: 'treadmill', kmh: 6, min: 30, grade: 40 })).toMatch(/Nachylenie/);
    expect(inputProblem({ kind: 'bike', kmh: 2, min: 30 })).toMatch(/Prędkość roweru/);
    expect(inputProblem({ kind: 'ergo', watts: 150, min: 30 })).toBeNull();
  });

  it('liczby idą w formie z wyświetlacza: całe kroki, prędkość z jedną cyfrą po przecinku', () => {
    expect(normalize({ kind: 'steps', steps: 8421.6 })).toEqual({ kind: 'steps', steps: 8422 });
    expect(normalize({ kind: 'treadmill', kmh: 5.55, min: 29.6, grade: 1.25 })).toEqual({
      kind: 'treadmill',
      kmh: 5.6,
      min: 30,
      grade: 1.3,
    });
  });

  it('usuwa wpis po kluczu', () => {
    const s = freshState();
    const { entry: e } = addCardio(s, { kind: 'bike', kmh: 20, min: 30 }, '2026-09-28');
    expect(removeCardio(s, 'nie-ma')).toBe(false);
    expect(removeCardio(s, e.key)).toBe(true);
    expect(cardioOf(s)).toHaveLength(0);
  });

  it('wczytuje tylko wpisy, które mają sens', () => {
    const s = freshState();
    const { entry: e } = addCardio(s, { kind: 'treadmill', kmh: 5, min: 30, grade: 3 }, '2026-09-28');
    expect(validCardio(JSON.parse(JSON.stringify(e)))).toBe(true);
    expect(validCardio({ ...e, kmh: 'szybko' })).toBe(false);
    expect(validCardio({ ...e, day: 'wczoraj' })).toBe(false);
    expect(validCardio({ ...e, kind: 'kajak' })).toBe(false);
    expect(validCardio(null)).toBe(false);
  });

  it('rower stacjonarny należy do roweru, a ostatni wpis rodzaju służy za podpowiedź', () => {
    const s = freshState();
    expect(sportOf({ kind: 'ergo' })).toBe('bike');
    addCardio(s, { kind: 'bike', kmh: 18, min: 30 }, '2026-09-27', at('2026-09-27T10:00:00Z'));
    addCardio(s, { kind: 'bike', kmh: 24, min: 30 }, '2026-09-28', at('2026-09-28T10:00:00Z'));
    expect(lastOf(s, 'bike')?.kmh).toBe(24);
    expect(lastOf(s, 'ergo')).toBeNull();
  });
});

describe('zajęcia tańca', () => {
  const day = '2026-10-05';

  it('dwa wyjścia na parkiet tego samego dnia się sumują, jak bieżnia', () => {
    const s = freshState();
    addCardio(s, { kind: 'dance', style: 'pair', mix: 'half', min: 60 }, day, at('2026-10-05T17:00:00Z'));
    addCardio(s, { kind: 'dance', style: 'solo', mix: 'full', min: 45 }, day, at('2026-10-05T19:00:00Z'));
    expect(cardioOn(s, day).map((c) => c.kind)).toEqual(['dance', 'dance']);
    expect(sportOf(cardioOn(s, day)[0]!)).toBe('dance');
    expect(lastOf(s, 'dance')?.style).toBe('solo');
  });

  it('odrzuca nieznany rodzaj tańca, nieznany podział zajęć i zły czas', () => {
    const ok = { kind: 'dance', style: 'pair', mix: 'half', min: 60 } as const;
    expect(inputProblem(ok)).toBeNull();
    expect(inputProblem({ ...ok, style: 'disco' } as never)).toMatch(/taniec/i);
    expect(inputProblem({ ...ok, mix: 'all' } as never)).toMatch(/tańca/i);
    expect(inputProblem({ ...ok, min: 0 })).toMatch(/minut/);
    // Klucze z prototypu obiektu to nie rodzaj tańca — import pliku nie może ich przemycić.
    expect(inputProblem({ ...ok, style: 'constructor' } as never)).not.toBeNull();
    expect(validCardio({ ...ok, style: 'toString', key: 'k', day, at: '2026-10-05T18:00:00.000Z' })).toBe(false);
    expect(validCardio({ ...ok, key: 'k', day, at: '2026-10-05T18:00:00.000Z' })).toBe(true);
  });

  it('czas zajęć idzie w pełnych minutach, rodzaj i podział zostają', () => {
    expect(normalize({ kind: 'dance', style: 'solo', mix: 'talk', min: 59.6 })).toEqual({
      kind: 'dance',
      style: 'solo',
      mix: 'talk',
      min: 60,
    });
  });

  it('minuty ruchu to tylko czas tańca — tłumaczenie się nie liczy, waga też nie', () => {
    const s = freshState();
    const full = addCardio(s, { kind: 'dance', style: 'pair', mix: 'full', min: 60 }, day).entry;
    const half = addCardio(s, { kind: 'dance', style: 'pair', mix: 'half', min: 60 }, day).entry;
    const talk = addCardio(s, { kind: 'dance', style: 'solo', mix: 'talk', min: 60 }, day).entry;
    expect(activeMinutes(s, full)).toBeCloseTo(51, 5);
    expect(activeMinutes(s, half)).toBeCloseTo(30, 5);
    expect(activeMinutes(s, talk)).toBeCloseTo(15, 5);
    setBodyWeight(s, 120, '2026-01-01');
    expect(activeMinutes(s, full)).toBeCloseTo(51, 5);
  });

  it('zajęcia od dziesięciu minut to osobna statystyka, bez kilometrów i bez wyjść na bieżnię', () => {
    const s = freshState();
    addCardio(s, { kind: 'dance', style: 'pair', mix: 'half', min: 90 }, day);
    addCardio(s, { kind: 'dance', style: 'solo', mix: 'full', min: SESSION_MIN - 1 }, day);
    const st = cardioStats(s);
    expect(st.dances).toBe(1);
    expect(st.sessions).toBe(0);
    expect(st.km).toBe(0);
  });
});

describe('waga ciała', () => {
  it('drugie ważenie tego samego dnia zastępuje pierwsze, lista zostaje po kolei', () => {
    const s = freshState();
    setBodyWeight(s, 82, '2026-09-10');
    setBodyWeight(s, 84, '2026-08-01');
    setBodyWeight(s, 81.46, '2026-09-10');
    expect(s.body).toEqual([
      { day: '2026-08-01', kg: 84 },
      { day: '2026-09-10', kg: 81.5 },
    ]);
    expect(latestWeight(s)?.kg).toBe(81.5);
  });

  it('dzień bierze ostatnie ważenie przed nim, a czas sprzed pierwszego — pierwsze', () => {
    const s = freshState();
    expect(weightOn(s, '2026-09-10')).toBeNull();
    setBodyWeight(s, 90, '2026-06-01');
    setBodyWeight(s, 85, '2026-08-01');
    expect(weightOn(s, '2026-05-01')).toBe(90);
    expect(weightOn(s, '2026-07-15')).toBe(90);
    expect(weightOn(s, '2026-08-01')).toBe(85);
    expect(weightOn(s, '2026-12-31')).toBe(85);
  });

  it('odrzuca wagę spoza ludzkiego zakresu', () => {
    const s = freshState();
    expect(() => setBodyWeight(s, 8, '2026-09-10')).toThrow();
    expect(validWeight(800)).toBe(false);
    expect(validBody({ day: '2026-09-10', kg: 75 })).toBe(true);
    expect(validBody({ day: 'dziś', kg: 75 })).toBe(false);
  });

  it('usuwa ważenie z dnia', () => {
    const s = withWeight(80, '2026-09-10');
    expect(removeBodyWeight(s, '2026-09-11')).toBe(false);
    expect(removeBodyWeight(s, '2026-09-10')).toBe(true);
    expect(latestWeight(s)).toBeNull();
  });

  it('wzrost spoza zakresu nie psuje długości kroku', () => {
    const s = freshState();
    s.cfg.height = 17;
    expect(heightOf(s)).toBeUndefined();
    s.cfg.height = 182;
    expect(heightOf(s)).toBe(182);
  });
});

describe('kalorie z zapisów', () => {
  it('bez żadnego ważenia nie ma liczby — lepiej zapytać, niż zgadywać', () => {
    const s = freshState();
    const { entry: c } = addCardio(s, { kind: 'steps', steps: 5000 }, '2026-09-28');
    s.log.push(entry('2026-09-28T18:00:00Z'));
    expect(cardioBurn(s, c)).toBeNull();
    expect(workoutBurn(s, s.log[0]!)).toBeNull();
    expect(dayBurn(s, '2026-09-28')).toBeNull();
    expect(plannedBurn(s, BUILTIN[0]!)).toBeNull();
  });

  it('ruch liczy się z wagą z jego dnia, a nie z dzisiejszą', () => {
    const s = freshState();
    setBodyWeight(s, 100, '2026-01-01');
    setBodyWeight(s, 80, '2026-09-01');
    const { entry: old } = addCardio(s, { kind: 'steps', steps: 10_000 }, '2026-03-01');
    const { entry: now } = addCardio(s, { kind: 'steps', steps: 10_000 }, '2026-09-28');
    expect(cardioBurn(s, old)!.active).toBeCloseTo(cardioEnergy(old, 100).active, 6);
    expect(cardioBurn(s, now)!.active).toBeCloseTo(cardioEnergy(now, 80).active, 6);
  });

  it('wzrost z profilu wydłuża krok i dokłada kalorii', () => {
    const s = withWeight();
    const { entry: c } = addCardio(s, { kind: 'steps', steps: 10_000 }, '2026-09-28');
    const base = cardioBurn(s, c)!.active;
    s.cfg.height = 190;
    expect(cardioBurn(s, c)!.active).toBeGreaterThan(base);
  });

  it('trening to suma ćwiczeń, a wiersz historii ćwiczenia ma tę samą liczbę', () => {
    const s = withWeight();
    const e: LogEntry = {
      date: '2026-09-28T18:00:00Z',
      workout: 'A',
      ready: 'ok',
      items: [
        { id: 'swing2', sets: [10, 10, 10, 10].map((r) => ({ reps: r, w: 20 })), effort: 'solid' },
        { id: 'goblet', sets: [8, 8, 8].map((r) => ({ reps: r, w: 16 })), effort: 'solid' },
        { id: 'usuniete', sets: [{ reps: 5, w: 10 }], effort: 'easy' },
      ],
    };
    s.log.push(e);
    const b = workoutBurn(s, e)!;
    expect(b.items.map((i) => i.id)).toEqual(['swing2', 'goblet']);
    expect(b.active).toBeCloseTo(b.items[0]!.active + b.items[1]!.active, 6);
    const row = exerciseRows(s, 'goblet')[0]!;
    expect(rowBurn(s, 'goblet', row)).toBeCloseTo(b.items[1]!.active, 6);
  });

  it('dzień zbiera wpisy, treningi i przekąski', () => {
    const s = withWeight();
    const day = '2026-09-28';
    addCardio(s, { kind: 'steps', steps: 7000 }, day);
    addCardio(s, { kind: 'bike', kmh: 20, min: 30 }, day);
    s.log.push(entry(`${day}T18:00:00Z`));
    addSnack(s, 'squat_air', 20, null, at(`${day}T10:00:00Z`));
    const d = dayBurn(s, day)!;
    expect(d.steps).toBe(7000);
    expect(d.cardio).toBeGreaterThan(0);
    expect(d.workouts).toBeGreaterThan(0);
    expect(d.snacks).toBeGreaterThan(0);
    expect(d.snacks).toBeLessThan(10);
    expect(d.total).toBeCloseTo(d.cardio + d.workouts + d.snacks, 6);
    expect(snackBurn(s, s.snacks[0]!)).toBeCloseTo(d.snacks, 6);
  });

  it('szacunek przed treningiem idzie z poziomu z progresji i ostatniej wagi', () => {
    const s = withWeight(70);
    const w = BUILTIN.find((x) => x.id === 'A')!;
    const light = plannedBurn(s, w)!;
    setBodyWeight(s, 105, '2026-09-28');
    const heavy = plannedBurn(s, w)!;
    expect(light.items).toHaveLength(w.items.length);
    expect(heavy.active / light.active).toBeCloseTo(1.5, 5);
    const p = s.prog.goblet!;
    const one = exercisePlannedBurn(s, 'goblet')!;
    expect(one.active).toBeCloseTo(
      setsEnergy('goblet', Array.from({ length: p.sets }, () => ({ reps: p.target })), 105).active,
      6,
    );
  });
});

describe('minuty ruchu', () => {
  it('kroki liczą się dopiero ponad bazę, po 100 na minutę', () => {
    const s = freshState();
    const low = addCardio(s, { kind: 'steps', steps: 4000 }, '2026-09-27').entry;
    const high = addCardio(s, { kind: 'steps', steps: 10_000 }, '2026-09-28').entry;
    expect(activeMinutes(s, low)).toBe(0);
    expect(activeMinutes(s, high)).toBe((10_000 - BASE_STEPS) / 100);
  });

  it('bieżnia i rower: umiarkowanie minuta za minutę, intensywnie podwójnie, lekko zero', () => {
    const s = withWeight(80);
    const walk = addCardio(s, { kind: 'treadmill', kmh: 5, min: 30, grade: 0 }, '2026-09-28').entry;
    const run = addCardio(s, { kind: 'treadmill', kmh: 10, min: 30, grade: 0 }, '2026-09-28').entry;
    const stroll = addCardio(s, { kind: 'treadmill', kmh: 2, min: 30, grade: 0 }, '2026-09-28').entry;
    const hard = addCardio(s, { kind: 'ergo', watts: 200, min: 20 }, '2026-09-28').entry;
    expect(activeMinutes(s, walk)).toBe(30);
    expect(activeMinutes(s, run)).toBe(60);
    expect(activeMinutes(s, stroll)).toBe(0);
    expect(activeMinutes(s, hard)).toBe(40);
    expect(minutesByDay(s)['2026-09-28']).toBe(130);
  });

  it('rower z mocą bez ważenia dostaje intensywność z przeciętnej wagi, a nie zero', () => {
    const s = freshState();
    const e = addCardio(s, { kind: 'ergo', watts: 120, min: 30 }, '2026-09-28').entry;
    expect(activeMinutes(s, e)).toBeGreaterThan(0);
  });

  it('tydzień liczy się od poniedziałku do niedzieli', () => {
    const s = freshState();
    // 2026-09-28 to poniedziałek, 2026-09-27 — niedziela poprzedniego tygodnia.
    addCardio(s, { kind: 'bike', kmh: 20, min: 60 }, '2026-09-27');
    addCardio(s, { kind: 'bike', kmh: 20, min: 45 }, '2026-09-28');
    addCardio(s, { kind: 'bike', kmh: 20, min: 30 }, '2026-10-04');
    expect(weekMinutes(s, '2026-10-01')).toBe(2 * (45 + 30));
    expect(weekMinutes(s, '2026-09-27')).toBe(2 * 60);
  });
});

describe('statystyki kroków i cardio', () => {
  it('pusty stan daje same zera', () => {
    expect(cardioStats(freshState())).toEqual({
      steps: 0,
      bestDaySteps: 0,
      goalDays: 0,
      sessions: 0,
      dances: 0,
      km: 0,
      whoWeeks: 0,
      run: 0,
    });
  });

  it('sumy, rekord dnia, dni z celem, wyjścia i kilometry', () => {
    const s = freshState();
    addCardio(s, { kind: 'steps', steps: STEP_GOAL }, '2026-09-26');
    addCardio(s, { kind: 'steps', steps: 12_000 }, '2026-09-27');
    addCardio(s, { kind: 'steps', steps: 3000 }, '2026-09-28');
    addCardio(s, { kind: 'treadmill', kmh: 6, min: 30, grade: 0 }, '2026-09-28');
    addCardio(s, { kind: 'bike', kmh: 20, min: 9 }, '2026-09-28');
    addCardio(s, { kind: 'ergo', watts: 150, min: 40 }, '2026-09-28');
    const st = cardioStats(s);
    expect(st.steps).toBe(23_000);
    expect(st.bestDaySteps).toBe(12_000);
    expect(st.goalDays).toBe(2);
    // Dziewięć minut roweru to rozgrzewka, nie wyjście.
    expect(st.sessions).toBe(2);
    // Kroki ok. 16,2 km + bieżnia 3 km + rower 3 km; rower stacjonarny drogi nie ma.
    expect(st.km).toBe(22);
  });

  it('tydzień WHO i ciąg dni aktywnych', () => {
    const s = freshState();
    // Pięć dni po 35 minut marszu na bieżni: 175 minut w jednym tygodniu.
    ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].forEach((d) =>
      addCardio(s, { kind: 'treadmill', kmh: 5, min: 35, grade: 0 }, d),
    );
    // Przerwa, potem dzień poniżej progu aktywności — nie przedłuża ciągu.
    addCardio(s, { kind: 'treadmill', kmh: 5, min: ACTIVE_DAY_MIN - 5, grade: 0 }, '2026-10-05');
    const st = cardioStats(s);
    expect(35 * 5).toBeGreaterThanOrEqual(WHO_WEEK_MIN);
    expect(st.whoWeeks).toBe(1);
    expect(st.run).toBe(5);
  });
});
