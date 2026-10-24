import { beforeEach, describe, expect, test } from 'vitest';
import { minimalWorkbook } from '../test/workbook';
import { DietDb, type ProfileRow } from './db';
import { planFood } from './foods';
import { addDays, mondayOf } from './model';
import {
  answerCheck,
  completeProfile,
  dismissNotice,
  endPause,
  exportAll,
  importWorkbook,
  logFood,
  logPlanItem,
  logQuick,
  markDay,
  now,
  persistUpgrade,
  resolveFloor,
  restoreAll,
  runWeeklyCheck,
  saveProfile,
  saveProfileEdit,
  dropCheat,
  eatCheat,
  planCheat,
  startPause,
  updateChoices,
  updateDay,
} from './store';
import { targetOn } from './target';
import type { Profile } from './types';

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
});

/** A profile row as the app stored it before version 2: the old model's keys only. */
const LEGACY = {
  sex: 'M',
  age: 35,
  heightCm: 175,
  startWeightKg: 80,
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
/** The same row as the partial the old `useProfile` hands to `completeProfile`. */
const legacyPartial = LEGACY as unknown as Partial<Profile>;

describe('profile version 2: the contract', () => {
  test('completeProfile: version 2, a setup goal at its dailyKcal, the start settle and a setup check', () => {
    const today = now().date;
    const p = completeProfile({ startDate: '2026-10-01', dailyKcal: 1950 });
    expect(p).toMatchObject({
      version: 2,
      activityLevel: 'inactive',
      goalPace: 0.5,
      burnOffset: 0,
      anchored: false,
      autoAdjust: true,
      hideKcal: false,
      pregnancy: false,
      belowFloorOk: false,
      pauses: [],
      hold: null,
      reached: null,
      notice: null,
      goals: [{ from: today, kcal: 1950, by: 'setup' }],
      settle: { from: '2026-10-15', why: 'start' },
      lastCheck: { week: mondayOf(today), status: 'setup', from: 1950, to: 1950, goalPace: 0.5, answer: null },
      // The old screens still read the old model's keys.
      activityMultiplier: 1.28,
      targetSteps: 10_000,
      kcalCorrection: 0,
      adaptWeekly: true,
    });
    expect(targetOn(p, today)).toBe(1950);
    // The default target is still 2000 (package A switches it to the estimate).
    expect(completeProfile({}).dailyKcal).toBe(2000);
  });

  test('the first pace follows the goal, lowered to what is safe; a given one is kept', () => {
    expect(completeProfile({ startWeightKg: 80, targetWeightKg: 80 }).goalPace).toBe(0);
    expect(completeProfile({ startWeightKg: 60, targetWeightKg: 65 }).goalPace).toBe(-0.25);
    expect(completeProfile({ heightCm: 150, startWeightKg: 45, targetWeightKg: 42 }).goalPace).toBe(0.45);
    expect(completeProfile({ age: 16 }).goalPace).toBe(0);
    expect(completeProfile({ goalPace: 0.25 }).goalPace).toBe(0.25);
  });

  test('a legacy row read through completeProfile has its own target as today’s', () => {
    const p = completeProfile(legacyPartial);
    expect(p.goals).toEqual([{ from: now().date, kcal: 1860, by: 'setup' }]);
    expect(targetOn(p, '2026-09-01')).toBe(1860);
    expect(p.settle).toEqual({ from: '2026-09-15', why: 'start' });
  });

  test('a stored start date that is not a date does not break reading the profile', () => {
    expect(completeProfile({ startDate: 'wczoraj' }).settle.from).toBe(addDays(now().date, 14));
  });

  test('saveProfile merges into the stored row: keys the profile does not carry stay', async () => {
    await db.profile.put({ ...completeProfile({ dailyKcal: 1860, goalSince: '2026-09-20' }), id: 'me', later: 1 } as ProfileRow);
    await saveProfileEdit(completeProfile({ dailyKcal: 1860, age: 36 }), db);
    expect(await db.profile.get('me')).toMatchObject({ age: 36, goalSince: '2026-09-20', later: 1, version: 2 });
  });

  test('a legacy row stays legacy until the upgrade reads it; a new row is version 2', async () => {
    await db.profile.put({ ...LEGACY, id: 'me' } as unknown as ProfileRow);
    await saveProfile(completeProfile({ ...legacyPartial, age: 36 }), db);
    const row = (await db.profile.get('me'))!;
    expect(row).not.toHaveProperty('version');
    expect(row).toMatchObject({ age: 36, dailyKcal: 1860, activityMultiplier: 1.28, goalSince: '2026-09-20' });

    const fresh = new DietDb(`test-${Math.random()}`);
    await saveProfile(completeProfile({}), fresh);
    expect((await fresh.profile.get('me'))?.version).toBe(2);
  });

  test('a target changed alone (the old screens) becomes today’s entry, so dailyKcal mirrors today', async () => {
    const today = now().date;
    const p = completeProfile({ startDate: '2026-01-01', dailyKcal: 2000 });
    await saveProfile({ ...p, dailyKcal: 1850 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row.dailyKcal).toBe(1850);
    expect(row.goals).toEqual([{ from: today, kcal: 1850, by: 'user' }]);
    expect(targetOn(row, today)).toBe(1850);
  });

  test('an old backup and a workbook keep their dailyKcal as the target', async () => {
    await restoreAll({ app: 'produkty-pl', version: 1, profile: LEGACY, days: [], entries: [], plans: [], foods: [] }, db);
    expect(targetOn((await db.profile.get('me'))!, now().date)).toBe(1860);
    const fresh = new DietDb(`test-${Math.random()}`);
    await importWorkbook(minimalWorkbook(), fresh);
    const row = (await fresh.profile.get('me'))!;
    expect([row.dailyKcal, targetOn(row, now().date)]).toEqual([1800, 1800]);
  });

  test('dismissNotice: „show” becomes „seen”; no notice or no profile — nothing', async () => {
    await db.profile.put({ ...completeProfile({ notice: 'show' }), id: 'me' });
    await dismissNotice(db);
    expect((await db.profile.get('me'))?.notice).toBe('seen');
    await db.profile.put({ ...completeProfile({}), id: 'me' });
    await dismissNotice(db);
    expect((await db.profile.get('me'))?.notice).toBeNull();
    const empty = new DietDb(`test-${Math.random()}`);
    await dismissNotice(empty);
    expect(await empty.profile.count()).toBe(0);
  });

  test('markDay: incomplete, the whole day, taken back — the rest of the day row untouched', async () => {
    await updateDay('2026-10-20', { note: 'x', steps: 5000 }, db);
    await markDay('2026-10-20', true, db);
    expect(await db.days.get('2026-10-20')).toEqual({ date: '2026-10-20', note: 'x', steps: 5000, partial: true });
    await markDay('2026-10-20', false, db);
    expect((await db.days.get('2026-10-20'))?.partial).toBe(false);
    await markDay('2026-10-20', undefined, db);
    expect(await db.days.get('2026-10-20')).toEqual({ date: '2026-10-20', note: 'x', steps: 5000 });
    // Taking back a mark on a day without a row creates none; marking one does.
    await markDay('2026-10-21', undefined, db);
    expect(await db.days.get('2026-10-21')).toBeUndefined();
    await markDay('2026-10-22', true, db);
    expect(await db.days.get('2026-10-22')).toEqual({ date: '2026-10-22', partial: true });
  });

  test('an unnamed bigger meal is logged as „Większy posiłek”', async () => {
    const id = await eatCheat('2026-10-17', { name: '  ', kcal: 900, protein: null, carbs: null, fat: null }, {}, db);
    expect((await db.entries.get(id!))?.name).toBe('Większy posiłek');
  });

  test('the Monday check, its answers, breaks and the upgrade are inert until package A', async () => {
    await db.profile.put({ ...completeProfile({ dailyKcal: 2000 }), id: 'me' });
    const before = await db.profile.get('me');
    const ctx = { today: '2026-10-26', kgNow: 80 };
    expect(await runWeeklyCheck({ weighIns: [{ day: '2026-10-25', kg: 80 }], today: ctx.today, hour: 9 }, db)).toBeNull();
    await answerCheck('ok', ctx, db);
    await resolveFloor('raise', ctx, db);
    await startPause(7, ctx, db);
    await endPause(ctx, db);
    await persistUpgrade({ weightKg: 80, today: ctx.today }, db);
    expect(await db.profile.get('me')).toEqual(before);
  });
});

describe('store', () => {
  test('a logged food is a snapshot of its nutrients', async () => {
    const id = await logFood(
      '2026-10-11',
      planFood({ text: '½ opak. Teriyaki', kcal: 640, protein: 41, carbs: 43, fat: 31, stores: [] }),
      {},
      db,
    );
    expect(await db.entries.get(id)).toMatchObject({
      date: '2026-10-11',
      name: '½ opak. Teriyaki',
      kcal: 640,
      protein: 41,
      source: 'plan',
    });
  });

  test('quick kcal without macros keeps them unknown, not zero', async () => {
    const id = await logQuick('2026-10-11', 'Obiad u rodziców', 650, {}, db);
    expect(await db.entries.get(id)).toMatchObject({ kcal: 650, protein: null, source: 'quick' });
  });

  test('a planned cheat meal sits on its day; eaten, it becomes one entry and leaves the plan', async () => {
    await updateDay('2026-10-17', { note: 'urodziny' }, db);
    const cheat = { name: 'Pizza ze znajomymi', kcal: 1200, protein: 45, carbs: null, fat: 50 };
    await planCheat('2026-10-17', cheat, db);
    expect((await db.days.get('2026-10-17'))?.cheat).toEqual(cheat);
    const id = await eatCheat('2026-10-17', cheat, { planned: true }, db);
    expect(await db.entries.get(id!)).toMatchObject({ name: 'Pizza ze znajomymi', kcal: 1200, protein: 45, carbs: null, source: 'quick' });
    const day = await db.days.get('2026-10-17');
    expect(day).not.toHaveProperty('cheat');
    expect(day?.note).toBe('urodziny');
  });

  test('a planned cheat meal eaten twice (double tap, second tab) is logged once', async () => {
    const cheat = { name: 'Burger', kcal: 950, protein: null, carbs: null, fat: null };
    await planCheat('2026-10-17', cheat, db);
    const [a, b] = await Promise.all([
      eatCheat('2026-10-17', cheat, { planned: true }, db),
      eatCheat('2026-10-17', cheat, { planned: true }, db),
    ]);
    expect([a, b].filter((x) => x !== null)).toHaveLength(1);
    expect(await db.entries.where('date').equals('2026-10-17').count()).toBe(1);
  });

  test('dropping a cheat meal from a day without one changes nothing', async () => {
    await dropCheat('2026-10-18', db);
    expect(await db.days.get('2026-10-18')).toBeUndefined();
  });

  test('ticking a plan line links the entry to the line', async () => {
    const id = await logPlanItem(
      '2026-10-11',
      1,
      { text: 'Masło 10 g', kcal: 54, protein: 0.1, carbs: 0.1, fat: 6, stores: [] },
      db,
    );
    expect((await db.entries.get(id))!.planIndex).toBe(1);
  });

  test('a day is patched, not replaced', async () => {
    await updateDay('2026-10-11', { weightKg: 105.2 }, db);
    await updateDay('2026-10-11', { steps: 9000 }, db);
    await updateChoices('2026-10-11', (c) => ({ ...c, variant: 3 }), db);
    expect(await db.days.get('2026-10-11')).toEqual({
      date: '2026-10-11',
      weightKg: 105.2,
      steps: 9000,
      choices: { variant: 3 },
    });
  });

  test("the first import takes the workbook's parameters, clamped to what the form accepts", async () => {
    const imported = await importWorkbook(minimalWorkbook(), db);
    expect(imported.profileApplied).toBe(true);
    expect(imported.plan.days).toEqual(['1A', '1A']);
    expect(await db.profile.get('me')).toMatchObject({ startWeightKg: 95, dailyKcal: 1800 });
    expect((await db.plans.get('active'))?.templates['1A']?.[0]?.items[0]?.text).toBe('Coś');
  });

  test('a re-import keeps the profile edited in the app, and what the app logged', async () => {
    await saveProfile(completeProfile({ heightCm: 182, startWeightKg: 110, dailyKcal: 2100 }), db);
    await updateDay('2026-03-03', { weightKg: 83.5 }, db);
    const imported = await importWorkbook(minimalWorkbook(), db);
    expect(imported.profileApplied).toBe(false);
    expect(await db.profile.get('me')).toMatchObject({ heightCm: 182, startWeightKg: 110, dailyKcal: 2100 });
    // The app's own weight for that day wins over the workbook's.
    expect((await db.days.get('2026-03-03'))!.weightKg).toBe(83.5);
    // The workbook's extra kcal arrives once, however often it is imported.
    await importWorkbook(minimalWorkbook(), db);
    expect(await db.entries.where('date').equals('2026-03-03').count()).toBe(1);
  });

  test("the workbook's extra kcal never lands on a day the app already has entries for", async () => {
    await logQuick('2026-03-03', 'Obiad', 700, {}, db);
    await importWorkbook(minimalWorkbook(), db);
    expect((await db.entries.where('date').equals('2026-03-03').toArray()).map((e) => e.name)).toEqual(['Obiad']);
  });

  test('a CHANGED plan clears the swaps of days to come, not of days gone', async () => {
    await importWorkbook(minimalWorkbook(), db);
    const plan = (await db.plans.get('active'))!;
    const variant = plan.templates['1A']![0]!;
    await db.plans.put({
      ...plan,
      templates: { '1A': [{ ...variant, items: [{ ...variant.items[0]!, text: 'Stare' }] }] },
    });
    const future = '2999-01-01';
    await updateChoices(
      future,
      () => ({ swaps: { 0: { text: 'X', kcal: 1, protein: 1, carbs: 1, fat: 1, stores: [] } } }),
      db,
    );
    await updateChoices('2000-01-01', () => ({ skipped: [0] }), db);
    await importWorkbook(minimalWorkbook(), db);
    expect((await db.days.get(future))!.choices).toBeUndefined();
    expect((await db.days.get('2000-01-01'))!.choices).toEqual({ skipped: [0] });
  });

  test('a backup restores exactly what was exported, and anything else is refused', async () => {
    await saveProfile(completeProfile({ age: 40 }), db);
    await logQuick('2026-10-11', 'x', 100, {}, db);
    const backup = await exportAll(db);
    const other = new DietDb(`test-${Math.random()}`);
    await restoreAll(JSON.parse(JSON.stringify(backup)), other);
    expect((await other.profile.get('me'))!.age).toBe(40);
    expect(await other.entries.count()).toBe(1);
    await expect(restoreAll({ hello: 1 }, other)).rejects.toThrow(/kopia zapasowa/);
  });

  test('a damaged backup is cleaned before it is stored: bad rows dropped, bad numbers defaulted', async () => {
    const result = await restoreAll(
      {
        app: 'produkty-pl',
        version: 1,
        profile: { age: 40, kcalPerKg: 0, dailyKcal: 'dużo', dietProfile: 'paleo' },
        days: [{ date: '2026-10-11', weightKg: 104 }, { date: 'wczoraj' }],
        entries: [
          { date: '2026-10-11', name: 'Skyr', kcal: 95, protein: 16 },
          { date: '2026-10-11', name: 'Zły', kcal: '650' },
        ],
        plans: [{ id: 'active', startDate: '2026-10-01', days: ['1A'] }],
        foods: [],
      },
      db,
    );
    expect(result.dropped).toBe(3);
    expect(await db.profile.get('me')).toMatchObject({
      age: 40,
      kcalPerKg: 3000,
      dailyKcal: 2000,
      dietProfile: 'redukcja',
    });
    expect(await db.entries.toArray()).toMatchObject([
      { name: 'Skyr', kcal: 95, protein: 16, carbs: null, time: '12:00', source: 'quick' },
    ]);
    expect(await db.plans.count()).toBe(0);
  });
});
