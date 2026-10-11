import { describe, expect, test } from 'vitest';
import { makeProduct } from '../test/fixtures';
import { divideMacros, isProteinForward, macrosOf, proteinEnergyShare, scale, sumMacros } from './macros';

describe('the rule: more protein than carbs AND more protein than fat', () => {
  test('passes when protein beats each of them', () => {
    expect(isProteinForward({ protein: 34, carbs: 15, fat: 2 })).toBe(true);
  });
  test('fails when carbs win', () => {
    expect(isProteinForward({ protein: 20, carbs: 40, fat: 10 })).toBe(false);
  });
  test('fails when fat wins', () => {
    expect(isProteinForward({ protein: 20, carbs: 5, fat: 25 })).toBe(false);
  });
  test('a tie is not "more"', () => {
    expect(isProteinForward({ protein: 10, carbs: 10, fat: 1 })).toBe(false);
  });
  test('unknown values cannot pass', () => {
    expect(isProteinForward({ protein: 30, carbs: null, fat: 1 })).toBe(false);
  });
});

describe('macros', () => {
  test('a product gives its per-100 g macros only when all four are known', () => {
    const full = makeProduct({
      code: '1',
      name: 'x',
      nutrition: { kcal: 63, protein: 11, carbs: 4, fat: 0, saturatedFat: null, sugars: null, fiber: null, salt: null },
    });
    expect(macrosOf(full)).toEqual({ kcal: 63, protein: 11, carbs: 4, fat: 0 });
    expect(macrosOf(makeProduct({ code: '2', name: 'y' }))).toBeNull();
  });

  test('scale turns per-100 g into an amount', () => {
    expect(scale({ kcal: 63, protein: 11, carbs: 4, fat: 0.2 }, 150)).toEqual({
      kcal: 94.5,
      protein: 16.5,
      carbs: 6,
      fat: 0.3,
    });
  });

  test('sum adds, and an empty list is zero', () => {
    expect(
      sumMacros([
        { kcal: 1, protein: 2, carbs: 3, fat: 4 },
        { kcal: 1, protein: 1, carbs: 1, fat: 1 },
      ]),
    ).toEqual({ kcal: 2, protein: 3, carbs: 4, fat: 5 });
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });

  test('a serving is the total divided by the servings', () => {
    expect(divideMacros({ kcal: 900, protein: 120, carbs: 60, fat: 30 }, 3)).toEqual({
      kcal: 300,
      protein: 40,
      carbs: 20,
      fat: 10,
    });
  });

  test('a serving is not rounded, so a total that passes by a hair still passes per serving', () => {
    const total = { kcal: 100, protein: 10, carbs: 9.99, fat: 1 };
    expect(isProteinForward(total)).toBe(true);
    expect(isProteinForward(divideMacros(total, 3))).toBe(true);
  });

  test('protein share of energy, at 4 kcal per gram', () => {
    expect(proteinEnergyShare({ kcal: 200, protein: 25, carbs: 0, fat: 0 })).toBe(0.5);
    expect(proteinEnergyShare({ kcal: 0, protein: 0, carbs: 0, fat: 0 })).toBe(0);
  });
});
