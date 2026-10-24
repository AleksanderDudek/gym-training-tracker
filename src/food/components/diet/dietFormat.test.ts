import { describe, expect, test } from 'vitest';
import { dayMonth, dayMonthLong, howHref, kcalText, monthRange, okKcal, paceWord } from './dietFormat';

describe('diet number and date words (Polish)', () => {
  test('kcal: whole, Polish CLDR grouping; „ok.” rounded to 10', () => {
    expect(kcalText(1950)).toBe('1950 kcal');
    expect(kcalText(1949.6)).toBe('1950 kcal');
    expect(kcalText(10_000)).toMatch(/^10\s000 kcal$/);
    expect(okKcal(647)).toBe('ok. 650 kcal');
    expect(okKcal(1234)).toBe('ok. 1230 kcal');
  });

  test('the plan’s pace as a weight change', () => {
    expect(paceWord(0.5)).toBe('−0,5 kg');
    expect(paceWord(0.65)).toBe('−0,65 kg');
    expect(paceWord(0)).toBe('utrzymanie');
    expect(paceWord(0.004)).toBe('utrzymanie');
    expect(paceWord(-0.25)).toBe('+0,25 kg');
  });

  test('dates: „31.10”, „7 listopada”', () => {
    expect(dayMonth('2026-10-31')).toBe('31.10');
    expect(dayMonth('2027-03-05')).toBe('5.03');
    expect(dayMonthLong('2026-11-07')).toBe('7 listopada');
  });

  test('a month range: one month, one year, across a new year', () => {
    expect(monthRange('2027-03-02', '2027-03-28')).toBe('marzec 2027');
    expect(monthRange('2027-03-02', null)).toBe('marzec 2027');
    expect(monthRange('2027-02-10', '2027-04-20')).toBe('luty–kwiecień 2027');
    expect(monthRange('2026-12-21', '2027-02-01')).toBe('grudzień 2026 – luty 2027');
    expect(monthRange('2027-02', '2027-04')).toBe('luty–kwiecień 2027');
  });

  test('„Jak liczę cel” link', () => {
    expect(howHref).toBe('#/jedzenie/profil?jak=1');
  });
});
