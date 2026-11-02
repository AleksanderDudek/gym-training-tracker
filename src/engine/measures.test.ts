import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import {
  MEASURES,
  cleanMeasures,
  formatCm,
  formatCmChange,
  measureSeries,
  measureSummary,
  measuresOf,
  removeMeasures,
  restoreMeasures,
  setMeasures,
  validMeasure,
} from './measures';

describe('obwody ciała — dziennik', () => {
  it('zapis starszy niż obwody to pusty dziennik', () => {
    const s = freshState();
    delete s.measures;
    expect(measuresOf(s)).toEqual([]);
    expect(measureSummary(measuresOf(s), 'waist')).toBeNull();
  });

  it('jeden wpis na dzień: drugi pomiar tego samego dnia dopisuje i poprawia pola, nie kasuje reszty', () => {
    const s = freshState();
    setMeasures(s, '2026-10-01', { waist: 90.04, hips: 101 });
    setMeasures(s, '2026-10-01', { waist: 89.56, arm: 34 });
    expect(measuresOf(s)).toEqual([{ day: '2026-10-01', waist: 89.6, hips: 101, arm: 34 }]);
  });

  it('wpisy rosnąco po dniu, a `null` czyści pole; wpis bez pól znika', () => {
    const s = freshState();
    setMeasures(s, '2026-10-08', { waist: 89 });
    setMeasures(s, '2026-10-01', { waist: 90, thigh: 58 });
    expect(measuresOf(s).map((m) => m.day)).toEqual(['2026-10-01', '2026-10-08']);
    setMeasures(s, '2026-10-01', { thigh: null });
    expect(measuresOf(s)[0]).toEqual({ day: '2026-10-01', waist: 90 });
    expect(setMeasures(s, '2026-10-01', { waist: null })).toBeNull();
    expect(measuresOf(s).map((m) => m.day)).toEqual(['2026-10-08']);
  });

  it('liczba spoza zakresu to literówka: wyjątek z nazwą obwodu, nic się nie zapisuje', () => {
    const s = freshState();
    setMeasures(s, '2026-10-01', { waist: 90 });
    expect(() => setMeasures(s, '2026-10-02', { waist: 85, arm: 340 })).toThrow('Ramię: poza zakresem 10–80 cm.');
    expect(measuresOf(s)).toHaveLength(1);
    expect(validMeasure('waist', 8.5)).toBe(false);
    expect(validMeasure('waist', Number.NaN)).toBe(false);
    expect(validMeasure('thigh', 58.3)).toBe(true);
  });

  it('usunięcie dnia', () => {
    const s = freshState();
    setMeasures(s, '2026-10-01', { waist: 90 });
    expect(removeMeasures(s, '2026-10-02')).toBe(false);
    expect(removeMeasures(s, '2026-10-01')).toBe(true);
    expect(measuresOf(s)).toEqual([]);
  });
});

describe('obwody ciała — wczytanie i import', () => {
  it('odpadają zepsute daty, pola spoza zakresu i śmieci; dobre pola zostają', () => {
    const saved: unknown = [
      { day: '2026-10-01', waist: 90, hips: 'sto', chest: 2000 },
      { day: '1.10.2026', waist: 90 },
      { day: '2026-10-02', arm: -3 },
      null,
      'talia 90',
      { day: '2026-10-03', thigh: 58.27, extra: 'x' },
    ];
    expect(restoreMeasures(saved)).toEqual([
      { day: '2026-10-01', waist: 90 },
      { day: '2026-10-03', thigh: 58.3 },
    ]);
    expect(restoreMeasures(undefined)).toEqual([]);
    expect(restoreMeasures({ day: '2026-10-01', waist: 90 })).toEqual([]);
    expect(cleanMeasures({ day: '2026-10-01' })).toBeNull();
  });

  it('dwa wpisy z tego samego dnia łączą się (późniejszy wygrywa pole po polu) i lista wychodzi posortowana', () => {
    expect(
      restoreMeasures([
        { day: '2026-10-05', waist: 88 },
        { day: '2026-10-01', waist: 90, hips: 100 },
        { day: '2026-10-01', waist: 89.5 },
      ]),
    ).toEqual([
      { day: '2026-10-01', waist: 89.5, hips: 100 },
      { day: '2026-10-05', waist: 88 },
    ]);
  });

  it('kopia zapasowa niesie obwody, bo leżą w zapisie treningów', () => {
    const s = freshState();
    setMeasures(s, '2026-10-01', { waist: 90, arm: 33.5 });
    const file = JSON.parse(JSON.stringify(s)) as { measures?: unknown };
    expect(restoreMeasures(file.measures)).toEqual([{ day: '2026-10-01', waist: 90, arm: 33.5 }]);
  });
});

describe('obwody ciała — liczby', () => {
  it('ostatnia wartość i zmiana od pierwszego pomiaru danego obwodu, z pominięciem dni bez niego', () => {
    const list = restoreMeasures([
      { day: '2026-09-03', waist: 92, hips: 104 },
      { day: '2026-09-20', hips: 103 },
      { day: '2026-10-01', waist: 89.7 },
    ]);
    expect(measureSeries(list, 'waist')).toEqual([
      { day: '2026-09-03', cm: 92 },
      { day: '2026-10-01', cm: 89.7 },
    ]);
    expect(measureSummary(list, 'waist')).toEqual({
      key: 'waist',
      last: 89.7,
      lastDay: '2026-10-01',
      first: 92,
      firstDay: '2026-09-03',
      change: -2.3,
      n: 2,
    });
    expect(measureSummary(list, 'hips')?.change).toBe(-1);
    expect(measureSummary(list, 'arm')).toBeNull();
  });

  it('jedna cyfra po przecinku i znak przy zmianie zawsze', () => {
    expect(formatCm(84)).toBe('84,0');
    expect(formatCm(84.55)).toBe('84,6');
    expect(formatCmChange(-2.3)).toBe('−2,3');
    expect(formatCmChange(0.5)).toBe('+0,5');
    expect(formatCmChange(0.04)).toBe('0,0');
    expect(MEASURES).toEqual(['waist', 'hips', 'chest', 'arm', 'thigh']);
  });
});
