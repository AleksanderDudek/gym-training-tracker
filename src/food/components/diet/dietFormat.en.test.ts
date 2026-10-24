import { describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { dayMonth, dayMonthLong, kcalText, monthRange, okKcal, paceWord } from './dietFormat';

describe('diet number and date words (English)', () => {
  test('kcal, about, pace', () => {
    expect(kcalText(1950)).toBe('1,950 kcal');
    expect(okKcal(647)).toBe('about 650 kcal');
    expect(paceWord(0.5)).toBe('−0.5 kg');
    expect(paceWord(0)).toBe('maintenance');
    expect(paceWord(-0.25)).toBe('+0.25 kg');
  });

  test('dates and month ranges', () => {
    expect(dayMonth('2026-10-31')).toBe('31 Oct');
    expect(dayMonthLong('2026-11-07')).toBe('7 November');
    expect(monthRange('2027-02-10', '2027-04-20')).toBe('February–April 2027');
    expect(monthRange('2026-12-21', '2027-02-01')).toBe('December 2026 – February 2027');
    expect(monthRange('2027-03-02', null)).toBe('March 2027');
  });
});
