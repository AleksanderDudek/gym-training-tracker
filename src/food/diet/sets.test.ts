import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb } from './db';
import { autoSetName, partOf, planFood, setAmountLabel, setFood, setTotals, type SetPart } from './foods';
import { clearAll, exportAll, logFood, restoreAll } from './store';
import { cleanEntry, cleanSet } from './validate';

const BANAN: SetPart = {
  name: 'Banan',
  amountLabel: '120 g',
  kcal: 107,
  protein: 1.3,
  carbs: 27.4,
  fat: 0.4,
  key: 'product:1',
};
const BATON: SetPart = {
  name: 'Chrupiący baton proteinowy o smaku malinowym',
  amountLabel: '45 g',
  kcal: 167,
  protein: 14.4,
  carbs: 16.7,
  fat: 7.2,
  key: 'product:2',
};

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
});

describe('sets', () => {
  test('a set adds its parts up; one unknown macro makes the sum unknown, never zero', () => {
    expect(setTotals([BANAN, BATON])).toEqual({ kcal: 274, protein: 15.7, carbs: 44.1, fat: 7.6 });
    expect(setTotals([BANAN, { ...BATON, fat: null }]).fat).toBeNull();
  });

  test('a set is one food: its own key, the parts in the amount, a role by its energy', () => {
    const food = setFood({ id: 3, name: 'Banan + batonik', parts: [BANAN, BATON] });
    expect(food).toMatchObject({
      key: 'set:3',
      name: 'Banan + batonik',
      source: 'set',
      detail: 'zestaw · 2 pozycje',
      amountLabel: 'Banan 120 g + Chrupiący baton proteinowy o sm… 45 g',
      nutrients: { kcal: 274 },
      per100: null,
      role: 'light',
    });
    expect(setFood({ name: 'Bez zapisu', parts: [BANAN] }).key).toBe('set:Bez zapisu');
  });

  test('an unnamed set is named by its parts, without the chain in brackets', () => {
    expect(autoSetName([BANAN, { ...BATON, name: 'Strips (KFC)' }])).toBe('Banan + Strips');
    expect(setAmountLabel([{ ...BANAN, amountLabel: '' }])).toBe('Banan');
  });

  test('a part is a snapshot of the food at the chosen amount', () => {
    const plan = planFood({ text: 'Skyr', kcal: 95, protein: 16.5, carbs: 6, fat: 0.3, stores: [] });
    expect(partOf(plan)).toEqual({
      name: 'Skyr',
      amountLabel: '1 pozycja',
      kcal: 95,
      protein: 16.5,
      carbs: 6,
      fat: 0.3,
      key: 'plan:Skyr',
    });
  });

  test('logging a set is one entry with the sum and the parts', async () => {
    const id = await logFood('2026-10-12', setFood({ id: 1, name: 'Banan + batonik', parts: [BANAN, BATON] }), {}, db);
    expect(await db.entries.get(id)).toMatchObject({
      name: 'Banan + batonik',
      kcal: 274,
      protein: 15.7,
      source: 'set',
      key: 'set:1',
      amountLabel: expect.stringContaining('Banan 120 g + '),
    });
  });
});

describe('validation and backup', () => {
  test('a set is kept whole or not at all', () => {
    expect(cleanSet({ id: 2, name: 'Śniadanie', parts: [BANAN] })).toEqual({
      id: 2,
      name: 'Śniadanie',
      parts: [BANAN],
    });
    expect(cleanSet({ name: 'Bez części', parts: [] })).toBeNull();
    expect(cleanSet({ name: '  ', parts: [BANAN] })).toBeNull();
    expect(cleanSet({ name: 'Zepsuty', parts: [BANAN, { name: 'x', kcal: '650' }] })).toBeNull();
    expect(cleanSet({ name: 'Bez makro', parts: [{ name: 'Kanapka', kcal: 300 }] })).toEqual({
      name: 'Bez makro',
      parts: [{ name: 'Kanapka', amountLabel: '', kcal: 300, protein: null, carbs: null, fat: null }],
    });
  });

  test('entries from sets and restaurants keep their source', () => {
    for (const source of ['set', 'restaurant'] as const)
      expect(cleanEntry({ date: '2026-10-12', name: 'x', kcal: 100, source })?.source).toBe(source);
  });

  test('sets go into the backup and come back; an older backup without them restores', async () => {
    await db.sets.add({ name: 'Banan + batonik', parts: [BANAN, BATON] });
    const backup = await exportAll(db);
    expect(backup.sets).toHaveLength(1);

    const other = new DietDb(`test-${Math.random()}`);
    await other.sets.add({ name: 'Do zastąpienia', parts: [BANAN] });
    expect(await restoreAll(backup, other)).toEqual({ dropped: 0 });
    expect((await other.sets.toArray()).map((s) => s.name)).toEqual(['Banan + batonik']);

    const { sets: _sets, ...old } = backup;
    await restoreAll({ ...old, sets: [{ name: 'zły' }] }, other).then(({ dropped }) => expect(dropped).toBe(1));
    await restoreAll(old, other);
    expect(await other.sets.count()).toBe(0);
  });

  test('clearing the diet clears the sets', async () => {
    await db.sets.add({ name: 'x', parts: [BANAN] });
    await clearAll(db);
    expect(await db.sets.count()).toBe(0);
  });

  test('a version-1 database (Produkty PL) opens with its data and an empty sets table', async () => {
    const name = `test-v1-${Math.random()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ profile: 'id', days: 'date', entries: '++id, date', plans: 'id', foods: '++id' });
    await v1
      .table('foods')
      .add({ name: 'Moja owsianka', amountLabel: '1 porcja', kcal: 420, protein: 20, carbs: 50, fat: 12 });
    v1.close();

    const upgraded = new DietDb(name);
    expect((await upgraded.foods.toArray()).map((f) => f.name)).toEqual(['Moja owsianka']);
    expect(await upgraded.sets.count()).toBe(0);
  });
});
