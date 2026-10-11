import { describe, expect, test } from 'vitest';
import { macroStatus, totals, weeklyAdjustment } from './day';
import { DIET_PROFILES } from './profiles';

const targets = DIET_PROFILES.redukcja.targets(1800, 92); // P 184, F 60, C ~131

describe('totals', () => {
  test('adds what is known and counts entries with unknown macros', () => {
    const t = totals([
      { kcal: 500, protein: 40, carbs: 30, fat: 20 },
      { kcal: 300, protein: null, carbs: null, fat: null },
    ]);
    expect(t).toEqual({ kcal: 800, protein: 40, carbs: 30, fat: 20, unknownMacros: 1 });
  });
});

describe('macroStatus', () => {
  test('during the day protein short is "brakuje", not a failure yet', () => {
    const s = macroStatus(targets, { kcal: 600, protein: 40, carbs: 50, fat: 15, unknownMacros: 0 }, false);
    expect(s.protein).toMatchObject({ status: 'brak', delta: -144 });
    expect(s.protein.note).toMatch(/brakuje 144 g/);
  });

  test('over the fat ceiling is excess at any time', () => {
    expect(
      macroStatus(targets, { kcal: 1500, protein: 120, carbs: 60, fat: 95, unknownMacros: 0 }, false).fat.status,
    ).toBe('nadmiar');
  });

  test('keto: carbohydrates over 30 g are excess', () => {
    const keto = DIET_PROFILES.keto.targets(1800, 92);
    expect(
      macroStatus(keto, { kcal: 900, protein: 80, carbs: 45, fat: 50, unknownMacros: 0 }, false).carbs.status,
    ).toBe('nadmiar');
  });

  test('calories: a little over is fine, clearly over is excess; at day end too little is short', () => {
    expect(
      macroStatus(targets, { kcal: 1850, protein: 184, carbs: 100, fat: 60, unknownMacros: 0 }, true).kcal.status,
    ).toBe('ok');
    expect(
      macroStatus(targets, { kcal: 2100, protein: 184, carbs: 100, fat: 60, unknownMacros: 0 }, true).kcal.status,
    ).toBe('nadmiar');
    expect(
      macroStatus(targets, { kcal: 1100, protein: 184, carbs: 30, fat: 30, unknownMacros: 0 }, true).kcal.status,
    ).toBe('brak');
  });
});

describe('weeklyAdjustment', () => {
  // 2026-10-14 is a Wednesday.
  test('a surplus earlier this week is paid back over the days left, a little each day', () => {
    const a = weeklyAdjustment(
      1800,
      [
        { date: '2026-10-12', eatenKcal: 2400 }, // Monday +600
        { date: '2026-10-13', eatenKcal: 1800 },
      ],
      '2026-10-14',
    );
    // +600 over 5 days left (Wed..Sun) = -120 a day
    expect(a).toMatchObject({ surplus: 600, daysLeft: 5, delta: -120, adjusted: 1680 });
    expect(a.explanation).toMatch(/600 kcal/);
  });

  test('never more than 10% of the goal in either direction', () => {
    expect(weeklyAdjustment(1800, [{ date: '2026-10-12', eatenKcal: 4800 }], '2026-10-14').delta).toBe(-180);
    expect(weeklyAdjustment(1800, [{ date: '2026-10-12', eatenKcal: 200 }], '2026-10-14').delta).toBe(180);
  });

  test('only this week counts, and days without a log are not guessed', () => {
    const a = weeklyAdjustment(
      1800,
      [
        { date: '2026-10-11', eatenKcal: 3000 }, // last Sunday
        { date: '2026-10-13', eatenKcal: null },
      ],
      '2026-10-14',
    );
    expect(a).toMatchObject({ surplus: 0, delta: 0, adjusted: 1800 });
  });

  test('Monday starts clean', () => {
    expect(weeklyAdjustment(1800, [], '2026-10-12')).toMatchObject({ daysLeft: 7, delta: 0 });
  });
});
