import { describe, expect, test } from 'vitest';
import { completeProfile } from './store';
import {
  BAND,
  COMPLETE_DAY,
  PACE_CHIPS,
  activityFromMultiplier,
  bmiOf,
  burnOf,
  c50,
  currentWeight,
  directionOf,
  eer,
  floorOf,
  hardMinOf,
  hidesKcal,
  impliedPace,
  isComplete,
  kcalStatus,
  maintenanceOf,
  minHealthyKg,
  minTargetOf,
  pauseOn,
  r10,
  r50,
  safePace,
  safety,
  setTarget,
  snap05,
  targetFor,
  targetOn,
} from './target';
import type { GoalChange, Profile } from './types';

// The spec's people (§2.2): every number below is from `numbers-final.mjs`.
const man = completeProfile({ sex: 'M', age: 35, heightCm: 175, startWeightKg: 80, goalPace: 0.5, dailyKcal: 2100 });
const woman = completeProfile({ sex: 'K', age: 30, heightCm: 165, startWeightKg: 65, targetWeightKg: 60, goalPace: 0.5 });
const older = completeProfile({ sex: 'K', age: 60, heightCm: 155, startWeightKg: 58, targetWeightKg: 55, goalPace: 0.5 });
const big = completeProfile({ sex: 'M', age: 45, heightCm: 185, startWeightKg: 110, targetWeightKg: 95, goalPace: 0.5 });

describe('the starting estimate (NASEM 2023)', () => {
  test('EER of the spec’s people', () => {
    expect(eer(man, 80)).toBeCloseTo(2639.52, 2);
    expect(eer({ ...man, activityLevel: 'low' }, 80)).toBeCloseTo(2850.12, 2);
    expect(eer(woman, 65)).toBeCloseTo(2079.55, 2);
    expect(eer(older, 58)).toBeCloseTo(1730.08, 2);
    expect(eer(big, 110)).toBeCloseTo(3019.22, 2);
  });

  test('age counts from 19: a 17-year-old gets the formula at 19', () => {
    expect(eer({ ...man, age: 17 }, 80)).toBe(eer({ ...man, age: 19 }, 80));
  });

  test('the burn is NASEM plus what the Monday check learned', () => {
    expect(burnOf({ ...man, burnOffset: -241 }, 80)).toBeCloseTo(2398.52, 2);
  });
});

describe('the daily target', () => {
  test('−0,5 kg a week: 2100 for the default man, 2300 when he moves an hour a day, 1550, 1200, 2500', () => {
    expect(targetFor(man, 80)).toBe(2100);
    expect(targetFor({ ...man, activityLevel: 'low' }, 80)).toBe(2300);
    expect(targetFor(woman, 65)).toBe(1550);
    // Raw 1194 — the floor holds it at 1200.
    expect(eer(older, 58) - (0.5 * 7500) / 7).toBeCloseTo(1194.37, 2);
    expect(targetFor(older, 58)).toBe(1200);
    expect(targetFor(big, 110)).toBe(2500);
  });

  test('floors: max(BMR rounded up to 50, the hard minimum)', () => {
    expect(floorOf(man, 80)).toBe(1750);
    expect(floorOf(woman, 65)).toBe(1400);
    expect(floorOf(older, 58)).toBe(1200);
    expect(floorOf(big, 110)).toBe(2050);
    expect([hardMinOf(man), hardMinOf(woman)]).toEqual([1500, 1200]);
  });

  test('a doctor- or dietitian-agreed target may go down to the hard minimum, never lower', () => {
    expect(minTargetOf(man, 80)).toBe(1750);
    expect(minTargetOf({ ...man, belowFloorOk: true }, 80)).toBe(1500);
    // A learned burn far down: the losing target stops at the floor.
    expect(targetFor({ ...man, burnOffset: -900 }, 80)).toBe(1750);
    expect(targetFor({ ...man, burnOffset: -900, belowFloorOk: true }, 80)).toBe(1500);
  });

  test('the chips: maintenance, faster loss, gain', () => {
    expect([0, 0.25, 0.75, -0.25].map((pace) => targetFor(man, 80, pace))).toEqual([2650, 2350, 1850, 2900]);
    expect(maintenanceOf(man, 80)).toBe(2650);
    expect(targetFor(man, 80, 0)).toBe(maintenanceOf(man, 80));
    expect(PACE_CHIPS).toEqual([0.25, 0.5, 0.75, 0, -0.25]);
  });

  test('example F: the learned burn −150 at the trend 79,325 gives an ideal of 1950', () => {
    expect(targetFor({ ...man, burnOffset: -150 }, 79.325)).toBe(1950);
    expect(targetFor(man, 79.325)).toBe(2100);
  });

  test('a target is a pace too: the owner’s 1860 at offset −241 is 0,5025 kg a week, snapped to 0,5', () => {
    const owner = { ...man, burnOffset: -241 };
    expect(impliedPace(owner, 80, 1860)).toBeCloseTo(0.5026, 4);
    expect(snap05(impliedPace(owner, 80, 1860))).toBe(0.5);
    // Example G: keeping 1860 after the offset learned +150 more.
    expect(snap05(impliedPace({ ...man, burnOffset: -91 }, 80, 1860))).toBe(0.65);
  });

  test('rounding: to 10, to 50, up to 50, pace to 0,05 — and never a negative zero', () => {
    expect([r10(644), r10(645), r50(2124), r50(2125), c50(1723.75), c50(1750)]).toEqual([640, 650, 2100, 2150, 1750, 1750]);
    expect(snap05(0.643)).toBe(0.65);
    expect(snap05(-0.01)).toBe(0);
    expect(r10(-4)).toBe(0);
  });

  test('direction from the pace: positive is losing', () => {
    expect([0.5, 0, -0.25].map(directionOf)).toEqual(['loss', 'keep', 'gain']);
  });
});

describe('safety rails', () => {
  test('safePace: under 18, BMI under 18,5, 1 % of the weight a week, gain 0,5 %, pregnancy', () => {
    expect(safePace({ ...man, age: 17 }, 80, 0.5)).toBe(0);
    expect(safePace({ ...man, age: 17 }, 80, -0.25)).toBe(0);
    // BMI 18,0 at 175 cm is 55,125 kg.
    expect(bmiOf(175, 55.125)).toBeCloseTo(18, 6);
    expect(safePace(man, 55.125, 0.5)).toBe(0);
    expect(safePace(man, 55.125, -0.25)).toBe(-0.25);
    expect(safePace({ ...woman, targetWeightKg: 60 }, 60, 0.75)).toBe(0.6);
    expect(safePace(man, 80, -0.5)).toBe(-0.4);
    expect(safePace({ ...woman, pregnancy: true }, 65, 0.5)).toBe(0);
    expect(safePace({ ...woman, pregnancy: true }, 65, -0.25)).toBe(0);
  });

  test('a target weight below BMI 18,5 closes loss too; the lowest is in whole kg, rounded up', () => {
    expect(minHealthyKg(175)).toBe(57);
    expect(bmiOf(175, minHealthyKg(175))).toBeGreaterThanOrEqual(18.5);
    expect(safety({ ...man, targetWeightKg: 55 }, 80)).toMatchObject({ noLoss: 'bmi', maxLoss: 0 });
    expect(safety(man, 80)).toEqual({ noLoss: null, noGain: null, maxLoss: 0.8, maxGain: 0.4 });
    expect(safety({ ...man, age: 16 }, 80)).toMatchObject({ noLoss: 'age', noGain: 'age' });
    expect(safety({ ...woman, pregnancy: true }, 65)).toMatchObject({ noLoss: 'pregnancy', noGain: 'pregnancy' });
  });

  test('a pace over the limit gives the target of the limit: 0,75 at 60 kg is 0,6', () => {
    const light = { ...woman, targetWeightKg: 55 };
    expect(targetFor(light, 60, 0.75)).toBe(targetFor(light, 60, 0.6));
  });

  test('no numbers: chosen, or always under 18', () => {
    expect(hidesKcal(man)).toBe(false);
    expect(hidesKcal({ ...man, hideKcal: true })).toBe(true);
    expect(hidesKcal({ ...man, age: 16 })).toBe(true);
  });
});

describe('judging a day', () => {
  test(`kcalStatus on the ±${BAND} band`, () => {
    expect(kcalStatus(2000, 1880)).toEqual({ kind: 'left', kcal: 120 });
    expect(kcalStatus(2000, 1900)).toEqual({ kind: 'within', kcal: 0 });
    expect(kcalStatus(2000, 2080)).toEqual({ kind: 'within', kcal: 0 });
    expect(kcalStatus(2000, 2101)).toEqual({ kind: 'over', kcal: 100 });
    expect(kcalStatus(2000, 2150)).toEqual({ kind: 'over', kcal: 150 });
  });

  test(`a complete day: ${COMPLETE_DAY * 100} % of its target, unless the person says otherwise`, () => {
    expect(isComplete(1199, undefined, 2000)).toBe(false);
    expect(isComplete(1200, undefined, 2000)).toBe(true);
    expect(isComplete(1800, true, 2000)).toBe(false);
    expect(isComplete(500, false, 2000)).toBe(true);
    expect(isComplete(null, undefined, 2000)).toBe(false);
    expect(isComplete(null, false, 2000)).toBe(false);
    expect(isComplete(0, false, 2000)).toBe(false);
    // Exactly 60 % of another target counts too.
    expect(isComplete(1110, undefined, 1850)).toBe(true);
    expect(isComplete(1109, undefined, 1850)).toBe(false);
  });
});

describe('the target of a day is a lookup', () => {
  const goals: GoalChange[] = [
    { from: '2026-10-01', kcal: 1950, by: 'setup' },
    { from: '2026-10-19', kcal: 1850, by: 'check' },
  ];
  const p = { goals, dailyKcal: 1850 };

  test('the last entry on or before the date; a date before the first takes the first', () => {
    expect(targetOn(p, '2026-10-18')).toBe(1950);
    expect(targetOn(p, '2026-10-19')).toBe(1850);
    expect(targetOn(p, '2026-09-01')).toBe(1950);
    expect(targetOn(p, '2027-01-01')).toBe(1850);
  });

  test('unsorted history reads the same; no history keeps dailyKcal', () => {
    expect(targetOn({ goals: [goals[1]!, goals[0]!], dailyKcal: 1 }, '2026-10-18')).toBe(1950);
    expect(targetOn({ goals: [], dailyKcal: 2040 }, '2026-10-18')).toBe(2040);
  });

  test('setTarget drops the entries from its day on, keeps the newest 200 and mirrors dailyKcal', () => {
    const next = setTarget(p, 2050, '2026-10-19', 'user');
    expect(next.goals).toEqual([goals[0], { from: '2026-10-19', kcal: 2050, by: 'user' }]);
    expect(next.dailyKcal).toBe(2050);
    // History is not re-clamped; the new entry is kept in the stored range.
    expect(setTarget(p, 9000, '2026-10-20', 'user').goals.at(-1)!.kcal).toBe(6000);

    const long: GoalChange[] = Array.from({ length: 250 }, (_, i) => ({
      from: new Date(Date.UTC(2020, 0, 1 + 7 * i)).toISOString().slice(0, 10),
      kcal: 1500 + i,
      by: 'check' as const,
    }));
    const kept = setTarget({ goals: long, dailyKcal: 1749 }, 1600, '2099-01-01', 'user');
    expect(kept.goals).toHaveLength(200);
    expect(kept.goals.at(-1)).toEqual({ from: '2099-01-01', kcal: 1600, by: 'user' });
    expect(kept.goals[0]!.kcal).toBe(1500 + 51);
  });

  test('a future entry (the end of a break) leaves today’s mirror alone', () => {
    const paused = setTarget(p, 2650, '2026-10-20', 'break');
    const back = setTarget(paused, 1850, '2026-10-27', 'break', '2026-10-20');
    expect(back.goals.map((g) => g.from)).toEqual(['2026-10-01', '2026-10-19', '2026-10-20', '2026-10-27']);
    expect(back.dailyKcal).toBe(2650);
    expect(targetOn(back, '2026-10-27')).toBe(1850);
  });

  test('the break covering a date, both ends included', () => {
    const q = { pauses: [{ from: '2026-10-20', to: '2026-10-26', kcal: 1850 }] };
    expect(pauseOn(q, '2026-10-19')).toBeNull();
    expect(pauseOn(q, '2026-10-20')).toEqual(q.pauses[0]);
    expect(pauseOn(q, '2026-10-26')).toEqual(q.pauses[0]);
    expect(pauseOn(q, '2026-10-27')).toBeNull();
  });
});

describe('the upgrade and the weight', () => {
  test('the old multiplier as a level', () => {
    expect([1.2, 1.28, 1.375, 1.4, 1.55, 1.725].map(activityFromMultiplier)).toEqual([
      'inactive',
      'inactive',
      'low',
      'low',
      'active',
      'very',
    ]);
  });

  test('the weight the targets use: the trend on that day, the start weight before any weigh-in', () => {
    const p: Pick<Profile, 'startWeightKg'> = { startWeightKg: 82 };
    const weighIns = [
      { day: '2026-10-10', kg: 80 },
      { day: '2026-10-11', kg: 81 },
    ];
    expect(currentWeight(p, weighIns, '2026-10-09')).toBe(82);
    expect(currentWeight(p, weighIns, '2026-10-10')).toBe(80);
    expect(currentWeight(p, weighIns, '2026-10-20')).toBeCloseTo(80.1, 9);
    expect(currentWeight(p, [], '2026-10-20')).toBe(82);
  });
});
