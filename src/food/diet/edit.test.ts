import { describe, expect, test } from 'vitest';
import {
  applyProfileEdit,
  manualProblem,
  paceChips,
  rebased,
  startPace,
  targetWeightProblem,
  typedPace,
} from './edit';
import { completeProfile } from './store';
import type { Profile } from './types';

/**
 * Saving the diet profile (spec §4.5, C15). Wednesday 2026-10-14; the default man is M 35 y,
 * 175 cm, 80 kg, „Głównie siedzę”: NASEM burn 2639,5 kcal, BMR floor 1750.
 */

const TODAY = '2026-10-14';
const ctx = (over: { kgNow?: number; manual?: number | null } = {}) => ({ today: TODAY, kgNow: 80, ...over });

/** A stored profile with its own history: target `kcal` since October 1st. */
const stored = (kcal: number, over: Partial<Profile> = {}): Profile =>
  completeProfile({
    startDate: '2026-10-01',
    dailyKcal: kcal,
    goals: [{ from: '2026-10-01', kcal, by: 'setup' }],
    settle: { from: '2026-10-15', why: 'start' },
    targetWeightKg: 75,
    ...over,
  });

/** The owner after the upgrade: 1860 kept to the kcal, the burn tied to data (offset −241). */
const owner = stored(1860, {
  goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
  anchored: true,
  burnOffset: -241,
  goalPace: 0.5,
});

describe('a new profile', () => {
  test('starts its history with the target, a setup check and a 14-day settle', () => {
    const draft = completeProfile({ startDate: TODAY, goalPace: 0.5, targetWeightKg: 75, dailyKcal: 2000 });
    const p = applyProfileEdit(null, draft, ctx());
    expect(p.dailyKcal).toBe(2100);
    expect(p.goals).toEqual([{ from: TODAY, kcal: 2100, by: 'setup' }]);
    expect(p.lastCheck).toMatchObject({ week: '2026-10-12', status: 'setup', from: 2100, to: 2100, goalPace: 0.5, answer: null });
    expect(p.settle).toEqual({ from: '2026-10-28', why: 'start' });
    expect(p).toMatchObject({ hold: null, notice: null, reached: null, targetWeightKg: 75 });
  });

  test('keeping the weight: maintenance, and the target weight is today’s weight', () => {
    const p = applyProfileEdit(null, completeProfile({ startDate: TODAY, goalPace: 0, targetWeightKg: 70 }), ctx({ kgNow: 79.26 }));
    expect(p.goalPace).toBe(0);
    expect(p.targetWeightKg).toBe(79.3);
    expect(p.dailyKcal).toBe(2650);
  });

  test('under 18 and in pregnancy there is no pace: maintenance, whatever the chips said', () => {
    const teen = applyProfileEdit(null, completeProfile({ startDate: TODAY, age: 16, goalPace: 0.5 }), ctx());
    expect(teen.goalPace).toBe(0);
    // NASEM counts every age under 19 as 19: 2812,8 → 2800.
    expect(teen.dailyKcal).toBe(2800);
    const pregnant = applyProfileEdit(
      null,
      completeProfile({ startDate: TODAY, sex: 'K', age: 30, heightCm: 165, startWeightKg: 65, pregnancy: true, goalPace: 0.5 }),
      ctx({ kgNow: 65 }),
    );
    expect(pregnant.goalPace).toBe(0);
  });
});

describe('an existing profile', () => {
  test('an edit that decides nothing keeps the target to the kcal (a migrated 1860 never re-rounds)', () => {
    const p = applyProfileEdit(owner, { ...owner, dietProfile: 'keto', autoAdjust: false }, ctx());
    expect(p.dailyKcal).toBe(1860);
    expect(p.goals).toEqual(owner.goals);
    expect(p.hold).toBeNull();
  });

  test('anchored: a new usual week rebases the burn, the target stays (C6: −241 → −641)', () => {
    const p = applyProfileEdit(owner, { ...owner, activityLevel: 'active' }, ctx());
    expect(p.burnOffset).toBe(-641);
    expect(p.dailyKcal).toBe(1860);
    expect(p.goals).toEqual(owner.goals);
    // Without anchoring the same answer would move the estimate by ~400 kcal.
    expect(rebased({ ...owner, anchored: false }, { ...owner, activityLevel: 'active' }, 80).burnOffset).toBe(-241);
  });

  test('before anchoring the formula moves: a new usual week is a new target from today, with a hold', () => {
    const prev = stored(2100, { goalPace: 0.5 });
    const p = applyProfileEdit(prev, { ...prev, activityLevel: 'low' }, ctx());
    expect(p.dailyKcal).toBe(2300);
    expect(p.goals.at(-1)).toEqual({ from: TODAY, kcal: 2300, by: 'user' });
    expect(p.goals[0]).toEqual({ from: '2026-10-01', kcal: 2100, by: 'setup' });
    expect(p.hold).toEqual({ dir: 0, until: '2026-10-28' });
    // +200 the same way: no new settle.
    expect(p.settle).toEqual(prev.settle);
  });

  test('a user change of −400 waits 14 days of water and holds the check for two weeks', () => {
    const prev = stored(2350, { goalPace: 0.25 });
    const p = applyProfileEdit(prev, prev, ctx({ manual: 1950 }));
    expect(p.dailyKcal).toBe(1950);
    expect(p.goals.at(-1)).toEqual({ from: TODAY, kcal: 1950, by: 'user' });
    expect(p.hold).toEqual({ dir: 0, until: '2026-10-28' });
    expect(p.settle).toEqual({ from: '2026-10-28', why: 'change' });
    // A typed target is a pace too: (2639,5 − 1950) · 7 / 7500 = 0,64 → 0,65.
    expect(p.goalPace).toBe(0.65);
  });

  test('a change of direction settles even when it is smaller than 300 kcal', () => {
    const prev = stored(2650, { goalPace: 0, targetWeightKg: 80 });
    const p = applyProfileEdit(prev, { ...prev, goalPace: -0.25, targetWeightKg: 84 }, ctx());
    expect(p.dailyKcal).toBe(2900);
    expect(p.settle).toEqual({ from: '2026-10-28', why: 'change' });
    expect(p.hold).toEqual({ dir: 0, until: '2026-10-28' });
  });

  test('a slower pace the same way: a hold, no settle', () => {
    const prev = stored(2100, { goalPace: 0.5 });
    const p = applyProfileEdit(prev, { ...prev, goalPace: 0.25 }, ctx());
    expect(p.dailyKcal).toBe(2350);
    expect(p.hold).toEqual({ dir: 0, until: '2026-10-28' });
    expect(p.settle).toEqual(prev.settle);
  });

  test('switching to keeping the weight: maintenance and today’s weight as the target weight', () => {
    const prev = stored(2100, { goalPace: 0.5 });
    const p = applyProfileEdit(prev, { ...prev, goalPace: 0 }, ctx({ kgNow: 78.04 }));
    expect(p.goalPace).toBe(0);
    expect(p.targetWeightKg).toBe(78);
    expect(p.dailyKcal).toBe(2600);
  });
});

describe('a typed target', () => {
  const prev = stored(2100, { goalPace: 0.5 });

  test('is kept as typed, to 10', () => {
    expect(applyProfileEdit(prev, prev, ctx({ manual: 1863 })).dailyKcal).toBe(1860);
  });

  test('never goes under the BMR floor without the doctor checkbox, never under the hard minimum with it', () => {
    expect(applyProfileEdit(prev, prev, ctx({ manual: 1600 })).dailyKcal).toBe(1750);
    const agreed = applyProfileEdit(prev, { ...prev, belowFloorOk: true }, ctx({ manual: 1600 }));
    expect(agreed).toMatchObject({ dailyKcal: 1600, belowFloorOk: true });
    expect(applyProfileEdit(prev, { ...prev, belowFloorOk: true }, ctx({ manual: 1000 })).dailyKcal).toBe(1500);
  });

  test('its pace stays within the safety rails, and close to keeping it is keeping', () => {
    // 1500 at 80 kg would be 1,06 kg a week: the stored pace is the 1 % limit.
    expect(typedPace(prev, 80, 1500)).toBe(0.8);
    // 2600 is 0,04 kg a week from maintenance: keeping, not a 0,05 loss.
    expect(typedPace(prev, 80, 2600)).toBe(0);
    const p = applyProfileEdit(prev, prev, ctx({ manual: 2600 }));
    expect(p).toMatchObject({ goalPace: 0, dailyKcal: 2600 });
    expect(p.settle).toEqual({ from: '2026-10-28', why: 'change' });
  });
});

describe('pace chips', () => {
  test('a faster pace than 1 % a week is closed: K 60 y, 155 cm, 58 kg (C10)', () => {
    const p = completeProfile({ sex: 'K', age: 60, heightCm: 155, startWeightKg: 58, targetWeightKg: 54 });
    expect(paceChips(p, 58, 'loss', null)).toEqual([
      { pace: 0.25, current: false, disabled: false },
      // 1194 rounds to 1200: still the floor, still allowed.
      { pace: 0.5, current: false, disabled: false },
      { pace: 0.75, current: false, disabled: true },
    ]);
  });

  test('the default man has all three; a stored pace that matches none is „(obecne)”', () => {
    const p = completeProfile({});
    expect(paceChips(p, 80, 'loss', null).every((c) => !c.disabled)).toBe(true);
    expect(paceChips(p, 80, 'loss', 0.4).map((c) => [c.pace, c.current])).toEqual([
      [0.25, false],
      [0.4, true],
      [0.5, false],
      [0.75, false],
    ]);
    // A gaining pace is not „current” among the losing chips.
    expect(paceChips(p, 80, 'loss', -0.25)).toHaveLength(3);
  });

  test('with a BMI under 18,5 every loss chip is closed; gaining is lowered for a light person', () => {
    expect(paceChips(completeProfile({ startWeightKg: 56 }), 56, 'loss', null).every((c) => c.disabled)).toBe(true);
    expect(paceChips(completeProfile({}), 80, 'gain', null)).toEqual([{ pace: -0.25, current: false, disabled: false }]);
    const light = completeProfile({ sex: 'K', age: 30, heightCm: 160, startWeightKg: 45, targetWeightKg: 50 });
    expect(paceChips(light, 45, 'gain', null)).toEqual([{ pace: -0.2, current: false, disabled: false }]);
  });

  test('a goal starts at 0,5 losing (0,25 when 0,5 is closed), the gaining chip, or the stored pace', () => {
    const p = completeProfile({});
    expect(startPace(p, 80, 'loss', null)).toBe(0.5);
    expect(startPace(p, 80, 'loss', 0.4)).toBe(0.4);
    expect(startPace(p, 80, 'gain', 0.4)).toBe(-0.25);
    expect(startPace(p, 80, 'keep', 0.4)).toBe(0);
    // K 80 y, 150 cm, 50 kg: 0,5 would go under 1200.
    const small = completeProfile({ sex: 'K', age: 80, heightCm: 150, startWeightKg: 50, targetWeightKg: 48 });
    expect(startPace(small, 50, 'loss', null)).toBe(0.25);
  });
});

describe('checks that block a save', () => {
  test('the target weight: required, BMI 18,5 at least, on the right side of today’s weight', () => {
    expect(targetWeightProblem('loss', null, 80, 175)).toEqual({ kind: 'missing' });
    expect(targetWeightProblem('loss', 55, 80, 175)).toEqual({ kind: 'min', kg: 57 });
    expect(targetWeightProblem('loss', 80, 80.04, 175)).toEqual({ kind: 'side', goal: 'loss' });
    expect(targetWeightProblem('gain', 79, 80, 175)).toEqual({ kind: 'side', goal: 'gain' });
    expect(targetWeightProblem('loss', 75, 80, 175)).toBeNull();
    expect(targetWeightProblem('keep', null, 80, 175)).toBeNull();
    expect(targetWeightProblem(null, null, 80, 175)).toBeNull();
  });

  test('a typed target: the hard minimum, the stored range, the BMR floor without the checkbox', () => {
    const man = completeProfile({});
    expect(manualProblem(man, 80, 1400)).toEqual({ kind: 'min', min: 1500 });
    expect(manualProblem(man, 80, 1600)).toEqual({ kind: 'floor', floor: 1750 });
    expect(manualProblem({ ...man, belowFloorOk: true }, 80, 1600)).toBeNull();
    expect(manualProblem(man, 80, 6500)).toEqual({ kind: 'max', min: 1500, max: 6000 });
    expect(manualProblem(man, 80, 1800)).toBeNull();
    expect(manualProblem(man, 80, null)).toBeNull();
    expect(manualProblem(completeProfile({ sex: 'K', age: 60, heightCm: 155 }), 58, 1150)).toEqual({ kind: 'min', min: 1200 });
  });
});

describe('the reached record', () => {
  const before = { ...owner, reached: { at: '2026-09-07', kg: 75, prevPace: 0.5, prevKcal: 1860, askAgain: null } };

  test('a new target weight starts a new chance to reach it: the old record goes', () => {
    expect(applyProfileEdit(before, { ...before, targetWeightKg: 77 }, ctx()).reached).toBeNull();
  });

  test('editing anything else keeps it', () => {
    expect(applyProfileEdit(before, { ...before, age: 36 }, ctx()).reached).toEqual(before.reached);
  });
});
