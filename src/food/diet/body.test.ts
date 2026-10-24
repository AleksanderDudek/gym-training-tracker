import { describe, expect, it } from 'vitest';
import { mergeBody, weightsToMigrate } from './body';
import type { DayRow } from './db';

const noSteps = (): number | null => null;

describe('jedno ciało: dni diety scalone z danymi treningowymi', () => {
  it('waga z dziennika wagi wygrywa z wagą zapisaną w diecie tego samego dnia', () => {
    const days: DayRow[] = [{ date: '2026-10-01', weightKg: 82, steps: 4000, note: 'urodziny' }];
    const merged = mergeBody(days, [{ day: '2026-10-01', kg: 81.4 }], noSteps);
    expect(merged).toEqual([{ date: '2026-10-01', weightKg: 81.4, steps: 4000, note: 'urodziny' }]);
  });

  it('ważenie z treningów w dniu bez wpisu diety dokłada wiersz', () => {
    const days: DayRow[] = [{ date: '2026-10-03', steps: 6000 }];
    const merged = mergeBody(days, [{ day: '2026-10-01', kg: 80 }], noSteps);
    expect(merged).toEqual([
      { date: '2026-10-01', weightKg: 80 },
      { date: '2026-10-03', steps: 6000 },
    ]);
  });

  it('kroki z treningów (wpis albo zegarek) wygrywają z krokami diety', () => {
    const days: DayRow[] = [
      { date: '2026-10-01', steps: 3000 },
      { date: '2026-10-02', steps: 5000 },
    ];
    const steps = (day: string) => (day === '2026-10-01' ? 9500 : null);
    expect(mergeBody(days, [], steps)).toEqual([
      { date: '2026-10-01', steps: 9500 },
      { date: '2026-10-02', steps: 5000 },
    ]);
  });

  it('wiersz dołożony z ważenia też dostaje kroki z treningów', () => {
    const steps = (day: string) => (day === '2026-10-05' ? 12000 : null);
    expect(mergeBody([], [{ day: '2026-10-05', kg: 79.5 }], steps)).toEqual([
      { date: '2026-10-05', weightKg: 79.5, steps: 12000 },
    ]);
  });

  it('nie wymyśla dni: kroki trafiają tylko do dni, które już są w wyniku', () => {
    const asked: string[] = [];
    const steps = (day: string) => {
      asked.push(day);
      return 10000;
    };
    const merged = mergeBody([{ date: '2026-10-02' }], [{ day: '2026-10-04', kg: 80 }], steps);
    expect(merged.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-04']);
    expect(asked.sort()).toEqual(['2026-10-02', '2026-10-04']);
  });

  it('zostawia wartości diety tam, gdzie treningi nic nie mają, i nie rusza wejścia', () => {
    const days: DayRow[] = [{ date: '2026-10-02', weightKg: 83, steps: 7000, training: true }];
    const copy = structuredClone(days);
    const merged = mergeBody(days, [{ day: '2026-10-01', kg: 82 }], noSteps);
    expect(merged[1]).toEqual({ date: '2026-10-02', weightKg: 83, steps: 7000, training: true });
    expect(days).toEqual(copy);
    expect(merged[1]).not.toBe(days[0]);
  });

  it('wynik idzie rosnąco po dniu', () => {
    const days: DayRow[] = [{ date: '2026-10-09' }, { date: '2026-10-02' }];
    const merged = mergeBody(days, [{ day: '2026-10-05', kg: 80 }], noSteps);
    expect(merged.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-05', '2026-10-09']);
  });
});

describe('jednorazowe przeniesienie ważeń z diety do dziennika wagi', () => {
  it('bierze ważenia diety z dni, których dziennik wagi nie ma', () => {
    const diet: DayRow[] = [
      { date: '2026-09-01', weightKg: 84.2 },
      { date: '2026-09-02', weightKg: 84 },
      { date: '2026-09-03', steps: 5000 },
      { date: '2026-09-04', weightKg: null },
    ];
    expect(weightsToMigrate(diet, [{ day: '2026-09-02', kg: 83.8 }])).toEqual([{ day: '2026-09-01', kg: 84.2 }]);
  });

  it('pomija wagi spoza zakresu dziennika wagi (30–300 kg) i zepsute daty', () => {
    const diet: DayRow[] = [
      { date: '2026-09-05', weightKg: 29.9 },
      { date: '2026-09-06', weightKg: 300.5 },
      { date: '2026-09-07', weightKg: Number.NaN },
      { date: '7.09.2026', weightKg: 80 },
      { date: '2026-09-08', weightKg: 30 },
      { date: '2026-09-09', weightKg: 300 },
    ];
    expect(weightsToMigrate(diet, [])).toEqual([
      { day: '2026-09-08', kg: 30 },
      { day: '2026-09-09', kg: 300 },
    ]);
  });

  it('idzie rosnąco po dniu i bez dni, które dziennik wagi już ma', () => {
    const diet: DayRow[] = [
      { date: '2026-09-10', weightKg: 80 },
      { date: '2026-09-01', weightKg: 82 },
    ];
    expect(weightsToMigrate(diet, [])).toEqual([
      { day: '2026-09-01', kg: 82 },
      { day: '2026-09-10', kg: 80 },
    ]);
    expect(weightsToMigrate(diet, [{ day: '2026-09-01', kg: 82 }, { day: '2026-09-10', kg: 79 }])).toEqual([]);
  });
});
