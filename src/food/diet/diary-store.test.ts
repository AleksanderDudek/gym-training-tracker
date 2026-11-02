import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb, type Entry } from './db';
import { addWater, completeProfile, copyEntries, deleteEntries, exportAll, restoreAll, saveFast, saveProfile, undoWater } from './store';
import { cleanDay, cleanEntry, cleanProfile } from './validate';

/*
 * The diary's own small writes of this round: „Kopiuj na…” / „Jak wczoraj”, water and the eating
 * window, the version 6 upgrade (fibre, sugars and salt on entries) and their way through a backup.
 */

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
});

const entry = (over: Partial<Entry> = {}): Entry => ({
  date: '2026-11-01',
  time: '08:10',
  name: 'Owsianka',
  amountLabel: '1 porcja',
  kcal: 420,
  protein: 18,
  carbs: 60,
  fat: 11,
  fiber: 8,
  sugars: 14,
  salt: 0.3,
  source: 'recipe',
  key: 'recipe:owsianka',
  ...over,
});

describe('copying entries', () => {
  test('copies keep name, amount, values and time; the plan line stays behind; ids come back', async () => {
    const id = await db.entries.add(entry({ planIndex: 2 }));
    const [source] = await db.entries.where('date').equals('2026-11-01').toArray();
    const ids = await copyEntries([source!], '2026-11-02', db);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(id);
    const copy = await db.entries.get(ids[0]!);
    const { id: _a, planIndex: _b, ...rest } = { ...source!, date: '2026-11-02' };
    expect(copy).toEqual({ ...rest, id: ids[0] });
    expect(copy).not.toHaveProperty('planIndex');
    // The original stays where it was.
    expect(await db.entries.where('date').equals('2026-11-01').count()).toBe(1);
  });

  test('nothing to copy: nothing written', async () => {
    expect(await copyEntries([], '2026-11-02', db)).toEqual([]);
    expect(await db.entries.count()).toBe(0);
  });

  test('„Cofnij” deletes the copies only', async () => {
    await db.entries.add(entry());
    const sources = await db.entries.toArray();
    const ids = await copyEntries([...sources, ...sources], '2026-11-02', db);
    expect(await db.entries.count()).toBe(3);
    await deleteEntries(ids, db);
    expect((await db.entries.toArray()).map((e) => e.date)).toEqual(['2026-11-01']);
  });
});

describe('water', () => {
  test('+250 and +500 add up; „−” takes back the last addition', async () => {
    await db.days.put({ date: '2026-11-02', steps: 4000 });
    await addWater('2026-11-02', 250, db);
    await addWater('2026-11-02', 500, db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', steps: 4000, water: 750, waterAdds: [250, 500] });
    await undoWater('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', steps: 4000, water: 250, waterAdds: [250] });
  });

  test('back to nothing: the keys go, the rest of the day stays', async () => {
    await db.days.put({ date: '2026-11-02', partial: true });
    await addWater('2026-11-02', 250, db);
    await undoWater('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', partial: true });
    // „−” on an empty day changes nothing.
    await undoWater('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', partial: true });
  });

  test('a day that forgot its additions (a backup without them) takes back 250 ml, never below 0', async () => {
    await db.days.put({ date: '2026-11-02', water: 400 });
    await undoWater('2026-11-02', db);
    expect((await db.days.get('2026-11-02'))!.water).toBe(150);
    await undoWater('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02' });
  });

  test('only the last 20 additions are remembered', async () => {
    for (let i = 0; i < 25; i++) await addWater('2026-11-02', 250, db);
    const day = (await db.days.get('2026-11-02'))!;
    expect(day.water).toBe(6250);
    expect(day.waterAdds).toHaveLength(20);
  });
});

describe('the eating window', () => {
  test('saveFast writes the fast on the profile, nothing else changes', async () => {
    await saveProfile(completeProfile({ fastPlan: '16:8' }), db);
    const before = await db.profile.get('me');
    await saveFast({ start: '2026-11-01T20:15', end: null }, db);
    const after = await db.profile.get('me');
    expect(after).toEqual({ ...before, fast: { start: '2026-11-01T20:15', end: null } });
    // The target is untouched: one target a day stays the only calorie rule.
    expect(after!.goals).toEqual(before!.goals);
  });

  test('no profile: nothing written', async () => {
    await saveFast({ start: '2026-11-01T20:15', end: null }, db);
    expect(await db.profile.count()).toBe(0);
  });

  test('defaults: water shown, EFSA target, the window off', () => {
    expect(completeProfile({})).toMatchObject({ showWater: true, waterMl: null, fastPlan: null, fast: null });
  });
});

describe('Dexie version 6', () => {
  test('entries stored before it get fibre, sugars and salt as null (unknown, not zero)', async () => {
    const name = `test-v5-${Math.random()}`;
    const old = new Dexie(name);
    old.version(5).stores({
      profile: 'id',
      days: 'date',
      entries: '++id, date',
      plans: 'id',
      foods: '++id',
      sets: '++id',
      favorites: 'key',
      prep: '++id',
      labs: '++id, date',
      labPrefs: 'id',
    });
    await old.table('entries').add({ date: '2026-10-01', time: '12:00', name: 'Stary', amountLabel: '', kcal: 500, protein: 30, carbs: 50, fat: 20, source: 'quick' });
    old.close();

    const upgraded = new DietDb(name);
    expect(await upgraded.entries.toArray()).toMatchObject([{ name: 'Stary', kcal: 500, fiber: null, sugars: null, salt: null }]);
    expect(upgraded.verno).toBe(6);
    upgraded.close();
  });
});

describe('backup', () => {
  test('water, the window and the extras go out and come back', async () => {
    await saveProfile(completeProfile({ fastPlan: '14:10', waterMl: 2300, showWater: false, fast: { start: '2026-11-01T20:00', end: '2026-11-02T10:00' } }), db);
    await addWater('2026-11-02', 500, db);
    await db.entries.add(entry());
    const backup = JSON.parse(JSON.stringify(await exportAll(db)));
    const other = new DietDb(`test-${Math.random()}`);
    await restoreAll(backup, other);
    expect(await other.profile.get('me')).toMatchObject({
      fastPlan: '14:10',
      waterMl: 2300,
      showWater: false,
      fast: { start: '2026-11-01T20:00', end: '2026-11-02T10:00' },
    });
    expect(await other.days.get('2026-11-02')).toMatchObject({ water: 500, waterAdds: [500] });
    expect(await other.entries.toArray()).toMatchObject([{ fiber: 8, sugars: 14, salt: 0.3 }]);
  });

  test('an older backup without them: empty values', () => {
    const e = cleanEntry({ date: '2026-10-01', name: 'x', kcal: 100 });
    expect(e).not.toHaveProperty('fiber');
    expect(cleanDay({ date: '2026-10-01' })).toEqual({ date: '2026-10-01' });
    const p = cleanProfile({ ...completeProfile({}), showWater: undefined, fastPlan: undefined, fast: undefined }, { today: '2026-11-02', weightKg: 80 });
    expect(p).toMatchObject({ showWater: true, waterMl: null, fastPlan: null, fast: null });
  });

  test('bad values are cleaned: water capped at 20 l, a negative extra unknown, a fast ending before it starts open, a split not known off', () => {
    expect(cleanDay({ date: '2026-10-01', water: 99_999, waterAdds: [250, -5, 'x', 500] })).toEqual({
      date: '2026-10-01',
      water: 20_000,
      waterAdds: [250, 500],
    });
    expect(cleanEntry({ date: '2026-10-01', name: 'x', kcal: 100, fiber: -1, salt: 'dużo', sugars: 3 })).toMatchObject({
      fiber: null,
      salt: null,
      sugars: 3,
    });
    const p = cleanProfile(
      { ...completeProfile({}), fastPlan: '20:4', waterMl: 90_000, fast: { start: '2026-11-02T10:00', end: '2026-11-01T10:00' } },
      { today: '2026-11-02', weightKg: 80 },
    );
    expect(p).toMatchObject({ fastPlan: null, waterMl: 5000, fast: { start: '2026-11-02T10:00', end: null } });
  });
});
