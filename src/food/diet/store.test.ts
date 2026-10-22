import { beforeEach, describe, expect, test } from 'vitest';
import { minimalWorkbook } from '../test/workbook';
import { DietDb } from './db';
import { planFood } from './foods';
import {
  completeProfile,
  exportAll,
  importWorkbook,
  logFood,
  logPlanItem,
  logQuick,
  restoreAll,
  saveProfile,
  dropCheat,
  eatCheat,
  planCheat,
  updateChoices,
  updateDay,
} from './store';

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
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
