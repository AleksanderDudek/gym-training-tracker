import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb, type Entry } from './db';
import { addDrink, completeProfile, copyEntries, deleteEntries, exportAll, restoreAll, saveFast, saveProfile, undoDrink } from './store';
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

describe('drinks (hydration)', () => {
  test('drinks of each kind add up; „−” takes back the last one, the rest of the day stays', async () => {
    await db.days.put({ date: '2026-11-02', steps: 4000 });
    await addDrink('2026-11-02', 'water', 250, db);
    await addDrink('2026-11-02', 'coffee', 250, db);
    const day = (await db.days.get('2026-11-02'))!;
    expect(day.steps).toBe(4000);
    expect(day.drinks).toMatchObject([
      { kind: 'water', ml: 250 },
      { kind: 'coffee', ml: 250 },
    ]);
    expect(day.drinks![0]!.at).toMatch(/^\d{2}:\d{2}$/);
    await undoDrink('2026-11-02', db);
    expect((await db.days.get('2026-11-02'))!.drinks).toMatchObject([{ kind: 'water', ml: 250 }]);
    await undoDrink('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', steps: 4000 });
    // „−” on an empty day changes nothing.
    await undoDrink('2026-11-02', db);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02', steps: 4000 });
  });

  test('a sweet drink also goes into the food diary as an estimate, and „−” takes both back', async () => {
    await addDrink('2026-11-02', 'sweet', 330, db);
    const [e] = await db.entries.toArray();
    expect(e).toMatchObject({ date: '2026-11-02', amountLabel: '330 ml', kcal: 139, carbs: 35, sugars: 35, protein: 0, fat: 0, source: 'quick' });
    expect(e!.name).toMatch(/Napój słodzony/);
    expect((await db.days.get('2026-11-02'))!.drinks).toMatchObject([{ kind: 'sweet', ml: 330, entryId: e!.id }]);
    await undoDrink('2026-11-02', db);
    expect(await db.entries.count()).toBe(0);
    expect(await db.days.get('2026-11-02')).toEqual({ date: '2026-11-02' });
  });

  test('a day on the old water total becomes one water drink; the old keys go with the next drink', async () => {
    await db.days.put({ date: '2026-11-02', water: 400, waterAdds: [400] });
    await addDrink('2026-11-02', 'tea', 250, db);
    expect(await db.days.get('2026-11-02')).toMatchObject({
      date: '2026-11-02',
      drinks: [{ kind: 'water', ml: 400 }, { kind: 'tea', ml: 250 }],
    });
    expect(await db.days.get('2026-11-02')).not.toHaveProperty('water');
  });

  test('never over 20 l a day; only the newest 100 drinks are kept', async () => {
    for (let i = 0; i < 45; i++) await addDrink('2026-11-02', 'water', 500, db);
    const day = (await db.days.get('2026-11-02'))!;
    expect(day.drinks!.reduce((s, d) => s + d.ml, 0)).toBe(20_000);
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
  test('drinks, the window and the extras go out and come back', async () => {
    await saveProfile(completeProfile({ fastPlan: '14:10', waterMl: 2300, showWater: false, fast: { start: '2026-11-01T20:00', end: '2026-11-02T10:00' } }), db);
    await addDrink('2026-11-02', 'coffee', 500, db);
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
    expect(await other.days.get('2026-11-02')).toMatchObject({ drinks: [{ kind: 'coffee', ml: 500 }] });
    expect(await other.entries.toArray()).toMatchObject([{ fiber: 8, sugars: 14, salt: 0.3 }]);
  });

  test('an older backup without them: empty values', () => {
    const e = cleanEntry({ date: '2026-10-01', name: 'x', kcal: 100 });
    expect(e).not.toHaveProperty('fiber');
    expect(cleanDay({ date: '2026-10-01' })).toEqual({ date: '2026-10-01' });
    const p = cleanProfile({ ...completeProfile({}), showWater: undefined, fastPlan: undefined, fast: undefined }, { today: '2026-11-02', weightKg: 80 });
    expect(p).toMatchObject({ showWater: true, waterMl: null, fastPlan: null, fast: null });
  });

  test('bad values are cleaned: drinks of known kinds only, 20 l at most, a negative extra unknown, a fast ending before it starts open, a split not known off', () => {
    expect(
      cleanDay({
        date: '2026-10-01',
        drinks: [{ kind: 'water', ml: 250, at: '08:00' }, { kind: 'piwo', ml: 500 }, { kind: 'tea', ml: -5 }, { kind: 'sweet', ml: 330, entryId: 7 }],
      }),
    ).toEqual({ date: '2026-10-01', drinks: [{ kind: 'water', ml: 250, at: '08:00' }, { kind: 'sweet', ml: 330, entryId: 7 }] });
    // An old backup with the water total: one water drink, capped at 20 l; the old keys don't survive.
    expect(cleanDay({ date: '2026-10-01', water: 99_999, waterAdds: [250, 500] })).toEqual({
      date: '2026-10-01',
      drinks: [{ kind: 'water', ml: 20_000 }],
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
