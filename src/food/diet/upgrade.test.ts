import { describe, expect, test } from 'vitest';
import { eer, targetOn } from './target';
import type { LegacyFields, Profile } from './types';
import { legacyBurn, noticeNotes, upgradedPace, upgradeProfile, type LegacyRow } from './upgrade';
import { cleanProfile } from './validate';

/*
 * The upgrade of an existing user (spec §3.4, tests A17–A18). Every number is from
 * `numbers-final.mjs`: the owner-like row keeps 1860 to the kcal, his history and every old key.
 */

const TODAY = '2026-10-24'; // a Saturday

/** The owner as the old model stored him: ×1,28, 4000 / 10 000 steps, 0,4, no extra, correction 0, 1860. */
const OWNER: LegacyRow = {
  sex: 'M',
  age: 35,
  heightCm: 175,
  startWeightKg: 84,
  targetWeightKg: 75,
  startDate: '2026-09-01',
  activityMultiplier: 1.28,
  baseSteps: 4000,
  targetSteps: 10_000,
  kcalPer1000StepsPerKg: 0.4,
  extraWeeklyKcal: 0,
  kcalPerKg: 7500,
  dailyKcal: 1860,
  kcalCorrection: 0,
  goalSince: '2026-09-20',
  dietProfile: 'redukcja',
  adaptWeekly: true,
  preferredStore: null,
};

const LEGACY_KEYS = [
  'activityMultiplier',
  'baseSteps',
  'targetSteps',
  'kcalPer1000StepsPerKg',
  'extraWeeklyKcal',
  'kcalCorrection',
  'goalSince',
  'adaptWeekly',
] as const satisfies readonly (keyof LegacyFields)[];

const upgrade = (row: Partial<LegacyRow> = {}, ctx: { weightKg?: number; fresh?: boolean } = {}) =>
  upgradeProfile({ ...OWNER, ...row }, { today: TODAY, weightKg: 80, ...ctx });

describe('A17 — the owner keeps his target to the kcal', () => {
  test('the old burn at 80 kg is 2398,4 (×1,28 + 6000 steps of walking)', () => {
    expect(legacyBurn(OWNER, 80)).toBeCloseTo(2398.4, 6);
  });

  test('version 2: 1860 unchanged, one migration entry from the start, inactive, offset −241, pace 0,5, anchored', () => {
    const p = upgrade();
    expect(p).toMatchObject({
      version: 2,
      dailyKcal: 1860,
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
      activityLevel: 'inactive',
      burnOffset: -241,
      goalPace: 0.5,
      anchored: true,
      autoAdjust: true,
      hideKcal: false,
      pregnancy: false,
      belowFloorOk: false,
      pauses: [],
      hold: null,
      reached: null,
      notice: 'show',
      settle: { from: '2026-09-15', why: 'start' },
    });
    // The first check: Monday 2 November, 9 days later (the run condition is lastCheck.week < this Monday).
    expect(p.lastCheck).toEqual({
      week: '2026-10-26',
      status: 'migrated',
      from: 1860,
      to: 1860,
      reason: null,
      note: null,
      settle: null,
      facts: null,
      missing: null,
      floor: null,
      offsetAfter: null,
      goalPace: 0.5,
      answer: null,
    });
    // The burn the old model had, within a kcal.
    expect(Math.abs(eer(p, 80) + p.burnOffset - 2398.4)).toBeLessThan(1);
  });

  test('every old key stays, with its old value', () => {
    const p = upgrade();
    for (const key of LEGACY_KEYS) expect(p[key]).toEqual(OWNER[key]);
  });

  test('with a correction of −120: offset −361, pace 0,4 (0,39 is over 0,1 from every chip, so it is rounded to 0,05)', () => {
    expect(upgrade({ kcalCorrection: -120 })).toMatchObject({ burnOffset: -361, goalPace: 0.4, dailyKcal: 1860 });
  });

  test('Marek (M 35, 180 cm, 89 kg, ×1,28, 2040): offset −224, pace 0,5, 2040 kept', () => {
    const p = upgrade({ heightCm: 180, startWeightKg: 89, dailyKcal: 2040 }, { weightKg: 89 });
    expect(p).toMatchObject({ burnOffset: -224, goalPace: 0.5, dailyKcal: 2040 });
  });

  test('the multiplier as a level; missing old keys read with the old defaults and stay missing', () => {
    expect(upgrade({ activityMultiplier: 1.55 }).activityLevel).toBe('active');
    const { activityMultiplier: _m, baseSteps: _b, targetSteps: _t, kcalCorrection: _c, adaptWeekly: _w, ...rest } = OWNER;
    const bare = upgradeProfile(rest, { today: TODAY, weightKg: 80 });
    // The owner's values are the old defaults: the same burn, the same offset and pace.
    expect(bare).toMatchObject({ burnOffset: -241, goalPace: 0.5 });
    for (const key of ['activityMultiplier', 'baseSteps', 'targetSteps', 'kcalCorrection', 'adaptWeekly'])
      expect(bare).not.toHaveProperty(key);
  });

  test('without a weight the start weight is used', () => {
    const p = upgradeProfile({ ...OWNER, startWeightKg: 80 }, { today: TODAY });
    expect(p.burnOffset).toBe(-241);
  });

  test('a start after today: the history starts today', () => {
    expect(upgrade({ startDate: '2026-11-02' }).goals).toEqual([{ from: TODAY, kcal: 1860, by: 'migration' }]);
  });

  test('the normaliser upgrades an old row the same way, and only once', () => {
    const p = cleanProfile(OWNER, { today: TODAY, weightKg: 80 });
    expect(p).toMatchObject({ version: 2, dailyKcal: 1860, burnOffset: -241, goalPace: 0.5, notice: 'show' });
    expect(targetOn(p, '2026-09-01')).toBe(1860);
    // goalSince is older than nothing in the history: no extra entry.
    expect(p.goals).toHaveLength(1);
    expect(cleanProfile(p, { today: TODAY, weightKg: 70 })).toEqual(p);
  });

  test('a workbook import of a new profile is a setup, not an upgrade', () => {
    const p = upgrade({}, { fresh: true });
    expect(p).toMatchObject({
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'setup' }],
      lastCheck: { week: '2026-10-19', status: 'setup' },
      anchored: false,
      notice: null,
    });
  });
});

describe('the pace an old target implied', () => {
  test('the nearest chip within 0,1, else rounded to 0,05, within [−0,5, 1]', () => {
    expect([0.5025, 0.3905, 0.6, 0.62, 0.04, -0.2, -0.7, 1.3, 0.875].map(upgradedPace)).toEqual([
      0.5, 0.4, 0.5, 0.6, 0, -0.25, -0.5, 1, 0.9,
    ]);
  });
});

describe('A18 — safety exceptions', () => {
  test('under 18: pace 0 and a „safety” entry at maintenance from today', () => {
    const p = upgrade({ age: 16 });
    // Old burn at 16 (BMR at 16) 2520; NASEM counts age from 19: 2812,8 → offset −293 → maintenance 2500.
    expect(p).toMatchObject({ goalPace: 0, burnOffset: -293, dailyKcal: 2500 });
    expect(p.goals).toEqual([
      { from: '2026-09-01', kcal: 1860, by: 'migration' },
      { from: TODAY, kcal: 2500, by: 'safety' },
    ]);
    expect(noticeNotes(p, 80)).toEqual({ age: true, bmi: false, hardMin: null, floor: null });
  });

  test('a deficit at a BMI under 18,5 becomes maintenance', () => {
    // K 30 y, 165 cm, 49 kg (BMI 18,0), 1500 kcal: the old burn 1666,7 implies 0,16 → 0,25 kg a week.
    const p = upgrade({ sex: 'K', age: 30, heightCm: 165, startWeightKg: 49, targetWeightKg: 47, dailyKcal: 1500 }, { weightKg: 49 });
    expect(p).toMatchObject({ goalPace: 0, dailyKcal: 1650 });
    expect(p.goals.at(-1)).toEqual({ from: TODAY, kcal: 1650, by: 'safety' });
    expect(noticeNotes(p, 49)).toMatchObject({ bmi: true, hardMin: null });
  });

  test('a target under the hard minimum is raised to it: K at 1100 → 1200', () => {
    const p = upgrade({ sex: 'K', age: 30, heightCm: 165, startWeightKg: 62, targetWeightKg: 55, dailyKcal: 1100 }, { weightKg: 62 });
    expect(p.dailyKcal).toBe(1200);
    expect(p.goals).toEqual([
      { from: '2026-09-01', kcal: 1100, by: 'migration' },
      { from: TODAY, kcal: 1200, by: 'safety' },
    ]);
    expect(noticeNotes(p, 62)).toMatchObject({ age: false, bmi: false, hardMin: 1200 });
  });

  test('a target between the hard minimum and the BMR floor is kept: the notice offers the floor', () => {
    const p = upgrade({ dailyKcal: 1600 });
    expect(p.dailyKcal).toBe(1600);
    expect(p.goals).toHaveLength(1);
    expect(noticeNotes(p, 80)).toEqual({ age: false, bmi: false, hardMin: null, floor: 1750 });
    // Agreed with a doctor or dietitian: nothing to offer.
    expect(noticeNotes({ ...p, belowFloorOk: true } as Profile, 80).floor).toBeNull();
  });

  test('the owner gets no safety line', () => {
    expect(noticeNotes(upgrade(), 80)).toEqual({ age: false, bmi: false, hardMin: null, floor: null });
  });
});
