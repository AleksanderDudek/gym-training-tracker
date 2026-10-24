import { describe, expect, test } from 'vitest';
import { dayState, totals } from '../../diet/day';
import type { PlannedCheat } from '../../diet/db';
import { dayNeeds } from '../../diet/now';
import { completeProfile } from '../../diet/store';
import type { WeekCheck } from '../../diet/types';
import { dayLines, gramsOf, kcalOf, overLine, shownCheck, todayLink } from './dayText';

// Redukcja at a 75 kg target weight: 150 g protein; the target is 2000 kcal.
const linesOf = (eaten: { kcal: number; protein: number }, cheat: PlannedCheat | null = null, shown = true) => {
  const day = totals(eaten.kcal || eaten.protein ? [{ kcal: eaten.kcal, protein: eaten.protein, carbs: 0, fat: 0 }] : []);
  const needs = dayNeeds({ profile: { dietProfile: 'redukcja', targetWeightKg: 75 }, goalKcal: 2000, eaten: day, cheat, mealsAhead: 3 });
  return dayLines(dayState(needs, day), shown);
};
const bigMeal = (kcal: number, protein: number | null = null): PlannedCheat => ({ name: '', kcal, protein, carbs: null, fat: null });

describe('the day in one sentence', () => {
  test('before anything is eaten: the whole target with protein', () => {
    expect(linesOf({ kcal: 0, protein: 0 })).toEqual({ headline: 'Na dziś: 2000 kcal i 150 g białka', over: null, reserved: null });
  });

  test('what is left, rounded to 10, with the protein still to eat', () => {
    expect(linesOf({ kcal: 1240, protein: 96 }).headline).toBe('Zostało ok. 760 kcal i 54 g białka');
    expect(linesOf({ kcal: 1244, protein: 96 }).headline).toBe('Zostało ok. 760 kcal i 54 g białka');
    expect(linesOf({ kcal: 1240, protein: 160 }).headline).toBe('Zostało ok. 760 kcal — białko na dziś już jest');
  });

  test('±100 kcal is still the target: within, never „ponad cel”', () => {
    for (const kcal of [1900, 2000, 2100]) {
      const lines = linesOf({ kcal, protein: 100 });
      expect(lines.headline, String(kcal)).toBe('Kalorie na dziś w zakresie celu, białka jeszcze 50 g');
      expect(lines.over).toBeNull();
    }
    expect(linesOf({ kcal: 2050, protein: 150 }).headline).toBe('Kalorie na dziś w zakresie celu, białko też już jest');
  });

  test('over the band: enough for today, and one calm line about it', () => {
    expect(linesOf({ kcal: 2300, protein: 160 })).toEqual({
      headline: 'Na dziś kalorii i białka już wystarczy',
      over: 'To ok. 300 kcal ponad cel — jeden dzień nie zmienia trendu.',
      reserved: null,
    });
    expect(linesOf({ kcal: 2101, protein: 120 }).headline).toBe('Na dziś kalorii już wystarczy, białka jeszcze 30 g');
    expect(linesOf({ kcal: 2101, protein: 120 }).over).toBe('To ok. 100 kcal ponad cel — jeden dzień nie zmienia trendu.');
  });

  test('a planned bigger meal is set aside and said; over only because of it says that too', () => {
    expect(linesOf({ kcal: 650, protein: 40 }, bigMeal(900, 30))).toEqual({
      headline: 'Zostało ok. 450 kcal i 80 g białka',
      over: null,
      reserved: 'Liczę już z zaplanowanym większym posiłkiem (900 kcal).',
    });
    // Planned, nothing eaten yet: no longer the start of the day.
    expect(linesOf({ kcal: 0, protein: 0 }, bigMeal(900)).headline).toBe('Zostało ok. 1100 kcal i 150 g białka');
    expect(linesOf({ kcal: 1500, protein: 90 }, bigMeal(900))).toEqual({
      headline: 'Na dziś kalorii już wystarczy, białka jeszcze 60 g',
      over: 'Z zaplanowanym większym posiłkiem to ok. 400 kcal ponad cel — jeden dzień nie zmienia trendu.',
      reserved: null,
    });
    expect(linesOf({ kcal: 2300, protein: 90 }, bigMeal(900)).over).toBe(
      'To ok. 1200 kcal ponad cel — jeden dzień nie zmienia trendu.',
    );
  });

  test('without calories on screen: protein only, nothing else', () => {
    expect(linesOf({ kcal: 650, protein: 40 }, null, false)).toEqual({ headline: 'Białka jeszcze 110 g', over: null, reserved: null });
    expect(linesOf({ kcal: 2600, protein: 160 }, bigMeal(900), false)).toEqual({
      headline: 'Białko na dziś już jest',
      over: null,
      reserved: null,
    });
  });

  test('bar values and the closed-day line', () => {
    expect(gramsOf(96.4, 150)).toBe('96 z 150 g');
    expect(kcalOf(1240, 2100)).toBe('1240 z 2100 kcal');
    expect(kcalOf(12_400, 21_000)).toMatch(/^12\s400 z 21\s000 kcal$/);
    expect(overLine(440)).toBe('To ok. 440 kcal ponad cel — jeden dzień nie zmienia trendu.');
  });
});

const check = (over: Partial<WeekCheck>): WeekCheck => ({
  week: '2026-10-12',
  status: 'changed',
  from: 1950,
  to: 2050,
  reason: 'burn',
  note: null,
  settle: null,
  facts: null,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace: 0.5,
  answer: null,
  ...over,
});

describe('a Monday check waiting for an answer', () => {
  test('changed while the target is still its new one; answered or changed since — gone', () => {
    const p = completeProfile({ dailyKcal: 2050, lastCheck: check({}) });
    expect(shownCheck(p, true)?.status).toBe('changed');
    expect(shownCheck({ ...p, lastCheck: check({ answer: 'ok' }) }, true)).toBeNull();
    expect(shownCheck({ ...p, dailyKcal: 2000 }, true)).toBeNull();
  });

  test('a proposal waits while the target is still the old one', () => {
    const p = completeProfile({ dailyKcal: 1950, lastCheck: check({ status: 'ask', to: 1850 }) });
    expect(shownCheck(p, true)?.status).toBe('ask');
    expect(shownCheck({ ...p, lastCheck: check({ status: 'suggested', to: 2050 }) }, true)?.status).toBe('suggested');
    expect(shownCheck({ ...p, dailyKcal: 1850 }, true)).toBeNull();
  });

  test('quiet weeks put no card up; without calories only the numberless reached card', () => {
    const p = completeProfile({ dailyKcal: 2050, lastCheck: check({ status: 'same', from: 2050, to: 2050 }) });
    expect(shownCheck(p, true)).toBeNull();
    expect(shownCheck({ ...p, lastCheck: check({}) }, false)).toBeNull();
    // Applied by the check: maintenance from Monday, the pace 0.
    const reached = { ...p, lastCheck: check({ status: 'reached', reason: 'reached', from: 1860, to: 2050, goalPace: 0 }) };
    expect(shownCheck(reached, false)?.status).toBe('reached');
  });
});

describe('the Today card’s notice line', () => {
  const base = completeProfile({ dailyKcal: 2050, startDate: '2026-10-01' });
  test('the upgrade notice first, then a waiting Monday card, then a break', () => {
    const pause = { from: '2026-10-12', to: '2026-10-18', kcal: 1950 };
    const all = { ...base, notice: 'show' as const, lastCheck: check({}), pauses: [pause] };
    expect(todayLink(all, '2026-10-14', true)).toBe('Liczenie kalorii jest teraz prostsze — zobacz, co się zmieniło');
    expect(todayLink({ ...all, notice: 'seen' }, '2026-10-14', true)).toBe('Od dziś cel: 2050 kcal (było 1950)');
    expect(todayLink({ ...all, notice: null, lastCheck: check({ answer: 'ok' }) }, '2026-10-14', true)).toBe(
      'Przerwa w liczeniu do 18 października.',
    );
    expect(todayLink({ ...base, lastCheck: check({ status: 'ask', to: 1950, from: 2050 }) }, '2026-10-14', true)).toBe(
      'Propozycja nowego celu czeka w dzienniku',
    );
    expect(todayLink({ ...base, lastCheck: check({ status: 'reached', from: 1860, to: 2050, goalPace: 0 }) }, '2026-10-14', false)).toBe(
      'Waga docelowa osiągnięta',
    );
    expect(todayLink(base, '2026-10-14', true)).toBeNull();
    // The break is over on the 19th.
    expect(todayLink({ ...base, pauses: [pause] }, '2026-10-19', true)).toBeNull();
  });
});
