import { describe, expect, test } from 'vitest';
import { dayState, totals } from './day';
import type { PlannedCheat } from './db';
import { dayNeeds } from './now';

describe('dayState', () => {
  // Redukcja at a 75 kg target weight: 150 g protein.
  const stateOf = (eaten: { kcal: number; protein: number }, cheat: PlannedCheat | null = null) => {
    const day = totals([{ kcal: eaten.kcal, protein: eaten.protein, carbs: 0, fat: 0 }]);
    const needs = dayNeeds({
      profile: { dietProfile: 'redukcja', targetWeightKg: 75 },
      goalKcal: 2000,
      eaten: day,
      cheat,
      mealsAhead: 3,
    });
    return dayState(needs, day);
  };
  const bigMeal = (kcal: number, protein: number | null = null): PlannedCheat => ({
    name: '',
    kcal,
    protein,
    carbs: null,
    fat: null,
  });

  test('target 2000, eaten 1240 with 96 of 150 g protein: about 760 kcal and 54 g left', () => {
    expect(stateOf({ kcal: 1240, protein: 96 })).toEqual({
      kind: 'left',
      target: 2000,
      kcal: 760,
      protein: 54,
      proteinDone: false,
      planned: null,
      overPlanned: false,
    });
  });

  test('a planned bigger meal of 900 is set aside: eaten 650 leaves about 450', () => {
    expect(stateOf({ kcal: 650, protein: 40 }, bigMeal(900, 30))).toMatchObject({
      kind: 'left',
      kcal: 450,
      protein: 80,
      planned: 900,
    });
    // Planned but nothing eaten yet is no longer the start of the day.
    expect(stateOf({ kcal: 0, protein: 0 }, bigMeal(900))).toMatchObject({ kind: 'left', kcal: 1100, planned: 900 });
  });

  test('the ±100 band: 2050 is within the target, 2150 is about 150 over', () => {
    expect(stateOf({ kcal: 2050, protein: 120 })).toMatchObject({ kind: 'within', kcal: 0, protein: 30 });
    expect(stateOf({ kcal: 2150, protein: 160 })).toMatchObject({ kind: 'over', kcal: 150, protein: 0, proteinDone: true });
  });

  test('over only with the planned meal, or over already without it', () => {
    expect(stateOf({ kcal: 1500, protein: 90 }, bigMeal(900))).toMatchObject({ kind: 'over', kcal: 400, overPlanned: true });
    expect(stateOf({ kcal: 2300, protein: 90 }, bigMeal(900))).toMatchObject({ kind: 'over', overPlanned: false });
  });

  test('nothing eaten, nothing planned: the start of the day shows the whole target', () => {
    expect(stateOf({ kcal: 0, protein: 0 })).toMatchObject({ kind: 'start', kcal: 2000, protein: 150, planned: null });
  });
});

describe('totals', () => {
  test('adds what is known and counts entries with unknown macros', () => {
    const t = totals([
      { kcal: 500, protein: 40, carbs: 30, fat: 20 },
      { kcal: 300, protein: null, carbs: null, fat: null },
    ]);
    expect(t).toEqual({ kcal: 800, protein: 40, carbs: 30, fat: 20, unknownMacros: 1 });
  });
});
