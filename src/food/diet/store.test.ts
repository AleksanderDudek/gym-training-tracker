import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
  latestKg,
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
import { newProfile } from './validate';

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
/** The same row as the partial the old `useProfile` handed to `completeProfile`. */
const legacyPartial = LEGACY as unknown as Partial<Profile>;

const M = '2026-10-26'; // a Monday
const at = (offset: number) => addDays(M, offset);
const START = '2026-08-03';

/** A version-2 row: M 35 y, 175 cm, inactive, −0,5 kg a week, 2100, started in August. */
const stored = (over: Partial<Profile> = {}): ProfileRow => ({
  ...newProfile(
    { sex: 'M', age: 35, heightCm: 175, startWeightKg: 80, targetWeightKg: 70, startDate: START, goalPace: 0.5, dailyKcal: 2100, ...over },
    START,
  ),
  id: 'me',
});

/** Example F: 28 daily weigh-ins 80 − 0,025·i up to last Sunday. */
const EXAMPLE_F = Array.from({ length: 28 }, (_, i) => ({ day: at(-28 + i), kg: 80 - 0.025 * i }));

/** The same kcal logged on every day of the 4 weeks before M. */
async function logEvery(kcal: number, database: DietDb) {
  for (let d = -28; d <= -1; d++) await logQuick(at(d), 'Obiad', kcal, {}, database);
}

describe('profile version 2', () => {
  test('completeProfile: the defaults of the other fields', () => {
    const p = completeProfile({ startDate: '2026-10-01', dailyKcal: 1950 });
    expect(p).toMatchObject({
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
      settle: { from: '2026-10-15', why: 'start' },
      // The old screens still read the old model's keys until I2.
      activityMultiplier: 1.28,
      targetSteps: 10_000,
      kcalCorrection: 0,
      adaptWeekly: true,
    });
    expect(targetOn(p, now().date)).toBe(1950);
  });

  test('the first pace follows the goal, lowered to what is safe; a given one is kept', () => {
    expect(completeProfile({ startWeightKg: 80, targetWeightKg: 80 }).goalPace).toBe(0);
    expect(completeProfile({ startWeightKg: 60, targetWeightKg: 65 }).goalPace).toBe(-0.25);
    expect(completeProfile({ heightCm: 150, startWeightKg: 45, targetWeightKg: 42 }).goalPace).toBe(0.45);
    expect(completeProfile({ age: 16 }).goalPace).toBe(0);
    expect(completeProfile({ goalPace: 0.25 }).goalPace).toBe(0.25);
  });

  test('a stored start date that is not a date does not break reading the profile', () => {
    expect(completeProfile({ startDate: 'wczoraj' }).settle.from).toBe(addDays(now().date, 14));
  });

  test('saveProfile merges into the stored row: keys the profile does not carry stay', async () => {
    await db.profile.put({ ...completeProfile({ dailyKcal: 1860, goalSince: '2026-09-20' }), id: 'me', later: 1 } as ProfileRow);
    await saveProfileEdit(completeProfile({ dailyKcal: 1860, age: 36 }), db);
    expect(await db.profile.get('me')).toMatchObject({ age: 36, goalSince: '2026-09-20', later: 1, version: 2 });
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

  test('the latest weigh-in is the newest day’s, whatever the order', () => {
    expect(latestKg([{ day: '2026-10-20', kg: 80 }, { day: '2026-10-22', kg: 79.5 }, { day: '2026-10-21', kg: 81 }])).toBe(79.5);
    expect(latestKg([])).toBeUndefined();
    expect(latestKg(undefined)).toBeUndefined();
  });
});

describe('the upgrade, written once', () => {
  test('persistUpgrade writes the upgraded row while it is legacy, keeping every old key and unknown keys', async () => {
    await db.profile.put({ ...LEGACY, id: 'me', later: 1 } as unknown as ProfileRow);
    await persistUpgrade({ weightKg: 80, today: '2026-10-24' }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({
      ...LEGACY,
      later: 1,
      version: 2,
      dailyKcal: 1860,
      burnOffset: -241,
      goalPace: 0.5,
      notice: 'show',
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
      lastCheck: { week: '2026-10-26', status: 'migrated' },
    });
    // Once: a second call on another day (another weight) changes nothing.
    await persistUpgrade({ weightKg: 70, today: '2026-11-03' }, db);
    expect(await db.profile.get('me')).toEqual(row);
  });

  test('a version-2 row or no row: nothing to write', async () => {
    await persistUpgrade({ weightKg: 80, today: '2026-10-24' }, db);
    expect(await db.profile.count()).toBe(0);
    const row = stored();
    await db.profile.put(row);
    await persistUpgrade({ weightKg: 80, today: '2026-10-24' }, db);
    expect(await db.profile.get('me')).toEqual(row);
  });

  test('the profile from an upgraded read, saved, is the upgrade — no legacy guard any more', async () => {
    await db.profile.put({ ...LEGACY, id: 'me' } as unknown as ProfileRow);
    await saveProfile({ ...completeProfile(legacyPartial), burnOffset: -241, age: 36 }, db);
    expect(await db.profile.get('me')).toMatchObject({ version: 2, age: 36, burnOffset: -241, activityMultiplier: 1.28 });
  });

  test('A23 importWorkbook on a fresh database: version 2 with the workbook’s target, a setup, no notice', async () => {
    const today = now().date;
    await importWorkbook(minimalWorkbook(), db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({ version: 2, dailyKcal: 1800, startWeightKg: 95, notice: null, anchored: false });
    expect(row.goals[0]).toMatchObject({ kcal: 1800, by: 'setup' });
    expect(row.lastCheck).toMatchObject({ week: mondayOf(today), status: 'setup', from: 1800, to: 1800 });
    expect(targetOn(row, today)).toBe(1800);
  });

  test('restoreAll of an old backup upgrades its profile, with the notice', async () => {
    await restoreAll({ app: 'produkty-pl', version: 1, profile: LEGACY, days: [], entries: [], plans: [], foods: [] }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({ version: 2, dailyKcal: 1860, notice: 'show', burnOffset: -241, goalSince: '2026-09-20' });
    expect(targetOn(row, now().date)).toBe(1860);
  });

  test('A19 a version-2 backup keeps its history and its check (the old normaliser rebuilt them from defaults)', async () => {
    const profile = stored({
      dailyKcal: 1950,
      goals: [
        { from: START, kcal: 2100, by: 'setup' },
        { from: '2026-10-19', kcal: 1950, by: 'check' },
      ],
      burnOffset: -150,
      anchored: true,
      hold: { dir: 1, until: '2026-11-16' },
    });
    const { id: _id, ...backupProfile } = profile;
    await restoreAll({ app: 'produkty-pl', version: 1, profile: { ...backupProfile, later: 1 }, days: [], entries: [], plans: [], foods: [] }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({ burnOffset: -150, anchored: true, hold: { dir: 1, until: '2026-11-16' }, goals: profile.goals });
    expect(row).not.toHaveProperty('later');
  });
});

describe('the Monday check in the store', () => {
  test('A1 a diary user gets the Monday check: example F is asked, stored, and „Tak” sets 2000', async () => {
    await db.profile.put(stored());
    await logEvery(2100, db);
    const c = await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 9 }, db);
    expect(c).toMatchObject({ week: M, status: 'ask', from: 2100, to: 2000, reason: 'burn', offsetAfter: -150 });
    expect(await db.profile.get('me')).toMatchObject({ dailyKcal: 2100, burnOffset: 0, lastCheck: c });

    await answerCheck('yes', { today: M, kgNow: 79.4 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({ dailyKcal: 2000, burnOffset: -150, hold: { dir: 1, until: at(28) }, lastCheck: { answer: 'yes' } });
    expect(row.goals.at(-1)).toEqual({ from: M, kcal: 2000, by: 'check' });
  });

  test('A6 two parallel checks (two tabs) apply it once; the same week again does nothing', async () => {
    // Loses 0,5 kg a week on 2450 kcal: a raise from 2000 to 2100.
    await db.profile.put(stored({ dailyKcal: 2000 }));
    await logEvery(2450, db);
    const weighIns = Array.from({ length: 28 }, (_, i) => ({ day: at(-28 + i), kg: 79.3 + (0.5 / 7) * (27 - i) }));
    const results = await Promise.all([
      runWeeklyCheck({ weighIns, today: M, hour: 9 }, db),
      runWeeklyCheck({ weighIns, today: M, hour: 9 }, db),
    ]);
    expect(results.filter((r) => r !== null)).toHaveLength(1);
    const row = (await db.profile.get('me'))!;
    expect(row.dailyKcal).toBe(2100);
    expect(row.goals.filter((g) => g.by === 'check')).toHaveLength(1);
    expect(await runWeeklyCheck({ weighIns, today: at(2), hour: 9 }, db)).toBeNull();
  });

  test('A16 Monday 03:00: nothing runs; a day marked incomplete is read from the day rows', async () => {
    await db.profile.put(stored());
    await logEvery(2100, db);
    expect(await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 3 }, db)).toBeNull();
    for (let d = -20; d <= -1; d++) await markDay(at(d), true, db);
    const c = await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 4 }, db);
    // 7 of 27 days left: under ¾ → not enough data.
    expect(c).toMatchObject({ status: 'data', missing: { weighIns: 28, completeDays: 8 } });
  });

  test('no profile: no check', async () => {
    expect(await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 9 }, db)).toBeNull();
  });

  test('an old row is not checked before its upgrade’s first check week', async () => {
    await db.profile.put({ ...LEGACY, id: 'me' } as unknown as ProfileRow);
    expect(await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 9 }, db)).toBeNull();
    expect((await db.profile.get('me'))?.version).toBeUndefined();
  });

  test('a stale answer (the target changed since) changes nothing', async () => {
    await db.profile.put(stored());
    await logEvery(2100, db);
    await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 9 }, db);
    await saveProfile({ ...(await db.profile.get('me'))!, dailyKcal: 2200 }, db);
    const before = await db.profile.get('me');
    await answerCheck('yes', { today: M, kgNow: 79.4 }, db);
    expect(await db.profile.get('me')).toEqual(before);
  });
});

describe('the owner’s upgrade, rehearsed (spec I5 in miniature)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('restored on Saturday 24 October: 1860 on day one, no check that Monday, the first one on 2 November — same or 100 with a reason', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T10:00:00'));
    // Eight weeks before the upgrade and the week after it: ~1900 kcal logged, weighed every morning,
    // losing what the old model's burn (2398 at 80 kg) predicts, with ±0,3 kg of water on top.
    const first = '2026-08-29';
    const entries: unknown[] = [];
    const weighIns: { day: string; kg: number }[] = [];
    for (let i = 0; i < 65; i++) {
      const day = addDays(first, i);
      entries.push({ date: day, time: '13:00', name: 'Obiad', amountLabel: '', kcal: 1880 + (i % 3) * 20, protein: 120, carbs: null, fat: null, source: 'quick', id: i + 1 });
      weighIns.push({ day, kg: Math.round((84.2 - (0.465 / 7) * i + 0.3 * Math.sin(i * 1.7)) * 10) / 10 });
    }
    await restoreAll({ app: 'produkty-pl', version: 1, profile: LEGACY, days: [], entries, plans: [], foods: [] }, db);
    const upgraded = (await db.profile.get('me'))!;
    expect(upgraded).toMatchObject({ ...LEGACY, version: 2, dailyKcal: 1860, lastCheck: { week: '2026-10-26', status: 'migrated' } });

    expect(await runWeeklyCheck({ weighIns, today: '2026-10-26', hour: 9 }, db)).toBeNull();
    const c = (await runWeeklyCheck({ weighIns, today: '2026-11-02', hour: 9 }, db))!;
    expect(c.week).toBe('2026-11-02');
    expect(['same', 'changed', 'ask']).toContain(c.status);
    expect([0, 100]).toContain(Math.abs(c.to - c.from));
    if (c.status !== 'same') expect(['burn', 'weight']).toContain(c.reason);
    // Eating to the old model's burn: the data agrees with the estimate, the target stays.
    expect(c).toMatchObject({ status: 'same', from: 1860, to: 1860 });
    expect(await db.entries.count()).toBe(65);
  });
});

describe('A18 — the notice’s floor choice', () => {
  /** The upgraded man at 1600: above the hard minimum, under his BMR floor (1750). */
  const below = () => db.profile.put({ ...LEGACY, dailyKcal: 1600, id: 'me' } as unknown as ProfileRow);

  test('„Podnieś do 1750 kcal” → 1750 from today, as the safe minimum', async () => {
    await below();
    await persistUpgrade({ weightKg: 80, today: '2026-10-24' }, db);
    expect((await db.profile.get('me'))?.dailyKcal).toBe(1600);
    await resolveFloor('raise', { today: '2026-10-24', kgNow: 80 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row.dailyKcal).toBe(1750);
    expect(row.goals.at(-1)).toEqual({ from: '2026-10-24', kcal: 1750, by: 'safety' });
  });

  test('„Zostaw — ustalony z lekarzem albo dietetykiem” → the target stays, agreed', async () => {
    await below();
    await resolveFloor('keep', { today: '2026-10-24', kgNow: 80 }, db);
    expect(await db.profile.get('me')).toMatchObject({ dailyKcal: 1600, belowFloorOk: true, version: 2 });
    // Nothing left to choose: another tap changes nothing.
    const row = await db.profile.get('me');
    await resolveFloor('raise', { today: '2026-10-24', kgNow: 80 }, db);
    expect(await db.profile.get('me')).toEqual(row);
  });
});

describe('A25 — a break', () => {
  test('a week’s break for the default man at 80 kg: maintenance 2650 from today, 2100 back on day 8', async () => {
    const today = '2026-10-28';
    await db.profile.put(stored());
    await startPause(7, { today, kgNow: 80 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({
      dailyKcal: 2650,
      pauses: [{ from: today, to: '2026-11-03', kcal: 2100 }],
      settle: { from: '2026-11-18', why: 'pause' },
    });
    expect(row.goals.slice(-2)).toEqual([
      { from: today, kcal: 2650, by: 'break' },
      { from: '2026-11-04', kcal: 2100, by: 'break' },
    ]);
    expect([targetOn(row, '2026-11-03'), targetOn(row, '2026-11-04')]).toEqual([2650, 2100]);
    // A second tap while it is on changes nothing.
    await startPause(14, { today, kgNow: 80 }, db);
    expect(await db.profile.get('me')).toEqual(row);
  });

  test('„Zakończ przerwę” on day 3: the old target today, the planned return gone, the break ends yesterday', async () => {
    await db.profile.put(stored());
    await startPause(7, { today: '2026-10-28', kgNow: 80 }, db);
    await endPause({ today: '2026-10-30', kgNow: 80 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({
      dailyKcal: 2100,
      pauses: [{ from: '2026-10-28', to: '2026-10-29', kcal: 2100 }],
      settle: { from: '2026-11-13', why: 'pause' },
    });
    expect(row.goals.slice(-2)).toEqual([
      { from: '2026-10-28', kcal: 2650, by: 'break' },
      { from: '2026-10-30', kcal: 2100, by: 'break' },
    ]);
    // Past days keep the break's target.
    expect(targetOn(row, '2026-10-29')).toBe(2650);
  });

  test('ended the day it started: no break left, the target as it was', async () => {
    await db.profile.put(stored());
    await startPause(14, { today: '2026-10-28', kgNow: 80 }, db);
    await endPause({ today: '2026-10-28', kgNow: 80 }, db);
    const row = (await db.profile.get('me'))!;
    expect(row).toMatchObject({ dailyKcal: 2100, pauses: [] });
    expect(row.goals).toEqual(stored().goals);
  });

  test('no break on: „Zakończ przerwę” changes nothing; the Monday check pauses during one', async () => {
    await db.profile.put(stored());
    const before = await db.profile.get('me');
    await endPause({ today: '2026-10-28', kgNow: 80 }, db);
    expect(await db.profile.get('me')).toEqual(before);
    await startPause(7, { today: at(-2), kgNow: 80 }, db);
    expect(await runWeeklyCheck({ weighIns: EXAMPLE_F, today: M, hour: 9 }, db)).toMatchObject({ status: 'paused' });
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
      version: 2,
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
