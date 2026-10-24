import { describe, expect, test } from 'vitest';
import { targetOn } from './target';
import type { Profile } from './types';
import { cleanDay, cleanPlan, cleanProfile, isCalendarDate, newProfile } from './validate';

const TODAY = '2026-10-24';

/** A version-2 row as the app stores it (dates fixed), with what a test changes on top. */
const stored = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...newProfile(
    {
      startDate: '2026-09-01',
      dailyKcal: 1860,
      burnOffset: -241,
      anchored: true,
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
      goalSince: '2026-09-20',
      notice: 'seen',
    },
    '2026-09-01',
  ),
  id: 'me',
  ...over,
});

describe('validate', () => {
  test('a calendar date is a date the calendar has', () => {
    expect(['2026-10-11', '2028-02-29'].map(isCalendarDate)).toEqual([true, true]);
    expect(['2026-02-30', '2026-13-01', '11.10.2026', 20261011, null].map(isCalendarDate)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test('a profile keeps what is valid, clamps what is out of range, defaults the rest', () => {
    const p = cleanProfile(
      {
        age: 33,
        heightCm: 999,
        kcalPerKg: Number.NaN,
        sex: 'X',
        startDate: '2026-02-30',
        preferredStore: 'lidl',
        adaptWeekly: false,
      },
      { today: TODAY },
    );
    expect(p).toMatchObject({
      version: 2,
      age: 33,
      heightCm: 230,
      kcalPerKg: 7500,
      sex: 'M',
      startDate: TODAY,
      preferredStore: 'lidl',
      adaptWeekly: false,
    });
    expect(cleanProfile('nonsense', { today: TODAY })).toMatchObject({ version: 2, sex: 'M', age: 35, startDate: TODAY });
  });

  test('a plan is kept whole or not at all', () => {
    const variant = {
      index: 1,
      items: [{ text: 'Skyr', kcal: 95, protein: 16, carbs: 6, fat: 0.3, stores: [] }],
      totals: { kcal: 95, protein: 16, carbs: 6, fat: 0.3 },
    };
    const plan = {
      id: 'active',
      name: 'P',
      startDate: '2026-10-01',
      days: ['1A'],
      templates: { '1A': [variant] },
      foods: [],
      notes: [],
    };
    expect(cleanPlan(plan)).toEqual(plan);
    expect(
      cleanPlan({ ...plan, templates: { '1A': [{ ...variant, items: [{ text: 'Zły', kcal: 'x' }] }] } }),
    ).toBeNull();
  });

  test('a day keeps only choices that can be read, and adds no key it did not have', () => {
    expect(
      cleanDay({
        date: '2026-10-11',
        weightKg: -3,
        choices: { variant: 2, skipped: [1, 'x'], swaps: { 0: { text: 'Y' } } },
      }),
    ).toEqual({
      date: '2026-10-11',
      weightKg: null,
      choices: { variant: 2, skipped: [1], swaps: {} },
    });
    expect(cleanDay({ date: '2026-10-11', note: 'wesele' })).toStrictEqual({ date: '2026-10-11', note: 'wesele' });
  });

  test('the person’s word on a day’s log survives a backup — only as a yes or no', () => {
    expect(cleanDay({ date: '2026-10-11', partial: true })).toStrictEqual({ date: '2026-10-11', partial: true });
    expect(cleanDay({ date: '2026-10-11', partial: false })?.partial).toBe(false);
    expect(cleanDay({ date: '2026-10-11', partial: 'tak' })).not.toHaveProperty('partial');
  });

  test('a planned cheat meal survives a backup with its macros; one without calories does not', () => {
    const day = cleanDay({ date: '2026-10-11', cheat: { name: 'Pizza', kcal: 1200, protein: 45, carbs: 'dużo', fat: 50 } });
    expect(day?.cheat).toEqual({ name: 'Pizza', kcal: 1200, protein: 45, carbs: null, fat: 50 });
    expect(cleanDay({ date: '2026-10-11', cheat: { name: 'Nic', kcal: 0 } })).not.toHaveProperty('cheat');
    expect(cleanDay({ date: '2026-10-11', cheat: 'pizza' })).not.toHaveProperty('cheat');
    const listed = cleanDay({ date: '2026-10-11', cheat: { name: 'Kebab', kcal: 900, items: ['Kebab (1 szt.)', 7, 'Cola (0,5 l)'] } });
    expect(listed?.cheat?.items).toEqual(['Kebab (1 szt.)', 'Cola (0,5 l)']);
  });

  test('the activity switch is kept only as a yes or no', () => {
    expect(cleanProfile({ adaptActivity: false }, { today: TODAY }).adaptActivity).toBe(false);
    expect(cleanProfile({ adaptActivity: 'tak' }, { today: TODAY }).adaptActivity).toBeUndefined();
  });
});

describe('A19 — one normaliser for every entry point', () => {
  test('an old row (a legacy backup) is upgraded, with the notice', () => {
    const legacy = {
      sex: 'M',
      age: 35,
      heightCm: 175,
      startWeightKg: 80,
      targetWeightKg: 75,
      startDate: '2026-09-01',
      activityMultiplier: 1.28,
      targetSteps: 10_000,
      baseSteps: 4000,
      dailyKcal: 1860,
      kcalCorrection: 0,
    };
    expect(cleanProfile(legacy, { today: TODAY, fresh: false })).toMatchObject({
      version: 2,
      dailyKcal: 1860,
      burnOffset: -241,
      goalPace: 0.5,
      notice: 'show',
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
    });
  });

  test('a version-2 row keeps its new fields', () => {
    const row = stored({
      activityLevel: 'low',
      goalPace: 0.65,
      autoAdjust: false,
      hold: { dir: 1, until: '2026-11-20' },
      settle: { from: '2026-10-30', why: 'pause' },
      reached: { at: '2026-10-19', kg: 74.9, prevPace: 0.5, prevKcal: 1860, askAgain: '2026-11-16' },
    });
    expect(cleanProfile(row, { today: TODAY })).toMatchObject({
      activityLevel: 'low',
      goalPace: 0.65,
      burnOffset: -241,
      anchored: true,
      autoAdjust: false,
      hold: { dir: 1, until: '2026-11-20' },
      settle: { from: '2026-10-30', why: 'pause' },
      reached: { kg: 74.9, askAgain: '2026-11-16' },
      notice: 'seen',
    });
  });

  test('unsorted or doubled history is fixed (the last given for a day wins), and dailyKcal is today’s target', () => {
    const p = cleanProfile(
      stored({
        dailyKcal: 1850,
        goals: [
          { from: '2026-10-19', kcal: 1850, by: 'check' },
          { from: '2026-10-01', kcal: 1950, by: 'setup' },
          { from: '2026-10-19', kcal: 1800, by: 'user' },
          { from: 'wczoraj', kcal: 1700, by: 'user' },
          { from: '2026-10-20', kcal: 1700, by: 'kto' },
        ],
      }),
      { today: TODAY },
    );
    expect(p.goals).toEqual([
      { from: '2026-10-01', kcal: 1950, by: 'setup' },
      { from: '2026-10-19', kcal: 1800, by: 'user' },
    ]);
    expect(p.dailyKcal).toBe(1800);
  });

  test('an old tab changed the target (dailyKcal with goalSince): the person’s entry from goalSince', () => {
    const p = cleanProfile(stored({ dailyKcal: 1900, goalSince: '2026-10-20' }), { today: TODAY });
    expect(p.goals).toEqual([
      { from: '2026-09-01', kcal: 1860, by: 'migration' },
      { from: '2026-10-20', kcal: 1900, by: 'user' },
    ]);
    expect([p.dailyKcal, targetOn(p, '2026-10-19'), targetOn(p, '2026-10-20')]).toEqual([1900, 1860, 1900]);
    // Twice on one day: the second change wins.
    const again = cleanProfile({ ...p, dailyKcal: 1950, goalSince: '2026-10-20' }, { today: TODAY });
    expect(again.goals.at(-1)).toEqual({ from: '2026-10-20', kcal: 1950, by: 'user' });
  });

  test('the day after a planned break end: dailyKcal is the returned target, no entry of the person', () => {
    const row = stored({
      dailyKcal: 2650,
      goals: [
        { from: '2026-09-01', kcal: 1860, by: 'migration' },
        { from: '2026-10-12', kcal: 2650, by: 'break' },
        { from: '2026-10-19', kcal: 1860, by: 'break' },
      ],
      pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 1860 }],
    });
    const during = cleanProfile(row, { today: '2026-10-18' });
    const after = cleanProfile(row, { today: '2026-10-19' });
    expect([during.dailyKcal, after.dailyKcal]).toEqual([2650, 1860]);
    expect(after.goals).toEqual(row.goals);
  });

  test('history inside the stored range is never re-clamped: an old 1100 stays', () => {
    const goals = [
      { from: '2026-01-01', kcal: 1100, by: 'migration' },
      { from: '2026-10-01', kcal: 1500, by: 'safety' },
    ];
    expect(cleanProfile(stored({ goals, dailyKcal: 1500 }), { today: TODAY }).goals).toEqual(goals);
    // Outside the range: clamped into it.
    const wild = cleanProfile(stored({ goals: [{ from: '2026-09-01', kcal: 90_000, by: 'user' }] }), { today: TODAY });
    expect(wild.goals[0]!.kcal).toBe(6000);
  });

  test('an empty history starts at the start date with dailyKcal', () => {
    const p = cleanProfile(stored({ goals: [], dailyKcal: 1900 }), { today: TODAY });
    expect(p.goals).toEqual([{ from: '2026-09-01', kcal: 1900, by: 'setup' }]);
  });

  test('a 40-day break is cut to 28; breaks sorted, the last 12 kept', () => {
    const p = cleanProfile(stored({ pauses: [{ from: '2026-09-01', to: '2026-10-10', kcal: 2650 }] }), { today: TODAY });
    expect(p.pauses).toEqual([{ from: '2026-09-01', to: '2026-09-28', kcal: 2650 }]);
    const many = Array.from({ length: 14 }, (_, i) => ({
      from: `2025-${String(i < 12 ? i + 1 : 12).padStart(2, '0')}-${i < 12 ? '01' : String(10 + i).padStart(2, '0')}`,
      to: `2025-${String(i < 12 ? i + 1 : 12).padStart(2, '0')}-${i < 12 ? '07' : String(11 + i).padStart(2, '0')}`,
      kcal: 2000,
    }));
    const kept = cleanProfile(stored({ pauses: [...many].reverse() }), { today: TODAY }).pauses;
    expect(kept).toHaveLength(12);
    expect(kept[0]!.from).toBe('2025-03-01');
    expect(kept.map((x) => x.from)).toEqual([...kept.map((x) => x.from)].sort());
  });

  test('a malformed check, hold, settle or reached becomes null (or the default settle)', () => {
    const p = cleanProfile(
      stored({
        lastCheck: { week: '2026-10-19', status: 'changed', from: 1860, to: 'dużo' },
        hold: { dir: 2, until: '2026-11-01' },
        settle: { from: 'jutro', why: 'start' },
        reached: { at: '2026-10-19', kg: -1 },
      }),
      { today: TODAY },
    );
    expect(p).toMatchObject({ lastCheck: null, hold: null, reached: null, settle: { from: '2026-09-15', why: 'start' } });
    const facts = { ...stored().lastCheck as object, facts: { from: '2026-09-28', to: '2026-10-25', weeks: 'cztery' } };
    expect(cleanProfile(stored({ lastCheck: facts }), { today: TODAY }).lastCheck).toBeNull();
  });

  test('a valid check is kept field by field', () => {
    const check = {
      week: '2026-10-19',
      status: 'changed',
      from: 1860,
      to: 1960,
      reason: 'burn',
      note: null,
      settle: null,
      facts: {
        from: '2026-09-21',
        to: '2026-10-18',
        weeks: 4,
        weighIns: 28,
        completeDays: 27,
        spanDays: 27,
        pace: 0.5,
        paceSe: 0.057,
        intake: 2250,
        burn: 2800,
        burnSe: 100,
        before: 2400,
        after: 2550,
        trendKg: 80,
      },
      missing: null,
      floor: null,
      offsetAfter: null,
      goalPace: 0.5,
      answer: 'keep',
    };
    expect(cleanProfile(stored({ lastCheck: check, dailyKcal: 1960 }), { today: TODAY }).lastCheck).toEqual(check);
  });

  test('keys nobody knows are dropped; the old model’s keys are kept when valid', () => {
    const p = cleanProfile(stored({ later: 1, kcalCorrection: -120, targetSteps: 9000, baseSteps: 'dużo' }), { today: TODAY });
    expect(p).not.toHaveProperty('later');
    expect(p).not.toHaveProperty('id');
    expect(p).toMatchObject({ kcalCorrection: -120, targetSteps: 9000, goalSince: '2026-09-20' });
    // An unreadable old key is not kept: its old default stands in while the old screens read it.
    expect(p.baseSteps).toBe(4000);
  });

  test('no pace under 18 or in pregnancy', () => {
    expect(cleanProfile(stored({ age: 16, goalPace: 0.5 }), { today: TODAY }).goalPace).toBe(0);
    expect(cleanProfile(stored({ sex: 'K', pregnancy: true, goalPace: 0.5 }), { today: TODAY }).goalPace).toBe(0);
  });

  test('idempotent: cleaning twice is cleaning once', () => {
    const inputs: unknown[] = [
      stored(),
      stored({ dailyKcal: 1900, goalSince: '2026-10-20', later: 1 }),
      stored({ goals: [{ from: '2026-10-19', kcal: 1850, by: 'check' }, { from: '2026-10-01', kcal: 1950, by: 'setup' }] }),
      stored({ pauses: [{ from: '2026-09-01', to: '2026-12-01', kcal: 2650 }], burnOffset: -0 }),
      { sex: 'K', age: 16, heightCm: 160, startWeightKg: 50, targetWeightKg: 45, dailyKcal: 1100, startDate: '2026-09-01' },
      { kcalPerKg: 0, dailyKcal: 'dużo' },
      'nonsense',
    ];
    for (const input of inputs) {
      const once = cleanProfile(input, { today: TODAY, weightKg: 79 });
      expect(cleanProfile(once, { today: TODAY, weightKg: 70 })).toStrictEqual(once);
    }
  });

  test('a new profile is complete: version 2, the estimate as its target unless given', () => {
    const p: Profile = newProfile({}, TODAY);
    expect(p).toMatchObject({ version: 2, dailyKcal: 2100, goalPace: 0.5, goals: [{ from: TODAY, kcal: 2100, by: 'setup' }] });
    expect(newProfile({ goals: [{ from: '2026-10-01', kcal: 1950, by: 'setup' }] }, TODAY).dailyKcal).toBe(1950);
  });
});
