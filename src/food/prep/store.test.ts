import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb } from '../diet/db';
import { DIET_PROFILES } from '../diet/profiles';
import { clearAll, exportAll, restoreAll } from '../diet/store';
import { PREP_DICT, prepIndex, prepProfile } from '../test/prep';
import { planDates } from './blocks';
import { generatePlan } from './generate';
import {
  KEEP_PLANS,
  clearBought,
  currentPlan,
  deletePrepPlan,
  latestPlan,
  planCovering,
  planEnd,
  replacePrepPlan,
  savePrepPlan,
  toggleBought,
} from './store';
import { planTargets } from './targets';
import type { PrepPlan } from './types';
import { cleanPrepPlan } from './validate';

const index = prepIndex();

function makePlan(start = '2026-10-20', days = 7, createdAt = '2026-10-20T08:00:00.000Z'): PrepPlan {
  const profile = prepProfile();
  const result = generatePlan({
    settings: { start, days, meals: 4, cooking: 'lunch', store: 'biedronka', online: null, exclude: [], seed: 1, avoid: [] },
    index,
    dict: PREP_DICT,
    dayTargets: planTargets({ profile, kcal: 2200, eaten: new Map(), today: start, dates: planDates(start, days) }),
    goal: { kcal: 2200, source: 'profile', dietProfile: 'redukcja', styleLabel: DIET_PROFILES.redukcja.label, pace: 0.5, weightKg: 82 },
    checkIn: null,
    createdAt,
  });
  if (!result.ok) throw new Error(result.message);
  return result.plan;
}

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
});

describe('which plan a day follows', () => {
  const week = { ...makePlan('2026-10-20', 7, '2026-10-19T10:00:00.000Z'), id: 1 };
  const next = { ...makePlan('2026-10-27', 7, '2026-10-26T10:00:00.000Z'), id: 2 };
  const redo = { ...makePlan('2026-10-23', 5, '2026-10-22T10:00:00.000Z'), id: 3 };

  test('a plan covers its own days; the newest made wins where two overlap', () => {
    expect(planEnd(week)).toBe('2026-10-26');
    expect(planCovering([week, next], '2026-10-26')).toBe(week);
    expect(planCovering([week, next], '2026-10-27')).toBe(next);
    expect(planCovering([week, redo], '2026-10-22')).toBe(week);
    expect(planCovering([week, redo], '2026-10-23')).toBe(redo);
    expect(planCovering([week], '2026-11-30')).toBeNull();
  });

  test('the plan page shows the newest plan that has not ended; the newest of all starts the next one', () => {
    expect(currentPlan([week, next], '2026-10-21')).toBe(next);
    expect(currentPlan([week], '2026-10-27')).toBeNull();
    expect(latestPlan([week, next, redo])).toBe(next);
  });
});

describe('plans on the device', () => {
  test('saved with a new id, ticked and unticked, replaced, deleted', async () => {
    const id = await savePrepPlan(makePlan(), db);
    await toggleBought(id, 'skyr', db);
    await toggleBought(id, 'rice', db);
    await toggleBought(id, 'skyr', db);
    expect((await db.prep.get(id))!.bought).toEqual(['rice']);
    await clearBought(id, db);
    expect((await db.prep.get(id))!.bought).toEqual([]);
    const stored = (await db.prep.get(id))!;
    await replacePrepPlan({ ...stored, id, settings: { ...stored.settings, seed: 5 } }, db);
    expect((await db.prep.get(id))!.settings.seed).toBe(5);
    await deletePrepPlan(id, db);
    expect(await db.prep.count()).toBe(0);
  });

  test(`the newest ${KEEP_PLANS} are kept`, async () => {
    const plan = makePlan();
    for (let i = 0; i < KEEP_PLANS + 2; i++)
      await savePrepPlan({ ...plan, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00.000Z` }, db);
    const kept = await db.prep.toArray();
    expect(kept).toHaveLength(KEEP_PLANS);
    expect(kept.map((p) => p.createdAt).sort()[0]).toBe('2026-10-03T08:00:00.000Z');
  });

  test('a version-3 database opens with its favourites and an empty plan table', async () => {
    const name = `test-v3-${Math.random()}`;
    const v3 = new Dexie(name);
    v3.version(1).stores({ profile: 'id', days: 'date', entries: '++id, date', plans: 'id', foods: '++id' });
    v3.version(2).stores({ sets: '++id' });
    v3.version(3).stores({ favorites: 'key' });
    await v3.table('favorites').put({ key: 'custom:1', food: {}, addedAt: '', uses: 0, lastUsed: null });
    v3.close();
    const upgraded = new DietDb(name);
    expect(await upgraded.favorites.count()).toBe(1);
    expect(await upgraded.prep.count()).toBe(0);
  });
});

describe('plans in the backup', () => {
  test('exported, restored whole, cleared with everything else', async () => {
    const id = await savePrepPlan(makePlan(), db);
    await toggleBought(id, 'skyr', db);
    const backup = JSON.parse(JSON.stringify(await exportAll(db)));
    expect(backup.prep).toHaveLength(1);

    const other = new DietDb(`test-${Math.random()}`);
    expect(await restoreAll(backup, other)).toEqual({ dropped: 0 });
    const [restored] = await other.prep.toArray();
    expect(restored).toEqual(await db.prep.get(id));

    await clearAll(other);
    expect(await other.prep.count()).toBe(0);
  });

  test('an older backup without plans restores; a broken plan is dropped and counted', async () => {
    const backup = JSON.parse(JSON.stringify(await exportAll(db)));
    delete backup.prep;
    expect(await restoreAll(backup, db)).toEqual({ dropped: 0 });
    const good = JSON.parse(JSON.stringify(makePlan()));
    const broken = { ...good, meals: [{ ...good.meals[0], portion: '1' }, ...good.meals.slice(1)] };
    expect(await restoreAll({ ...backup, prep: [good, broken] }, db)).toEqual({ dropped: 1 });
    expect(await db.prep.count()).toBe(1);
  });
});

describe('a plan from a file', () => {
  const plan = JSON.parse(JSON.stringify(makePlan())) as PrepPlan;

  test('a stored plan reads back as it was', () => {
    expect(cleanPrepPlan(plan)).toEqual(plan);
  });

  test('kept whole or not at all', () => {
    expect(cleanPrepPlan({ ...plan, settings: { ...plan.settings, days: 3 } })).toBeNull();
    expect(cleanPrepPlan({ ...plan, shops: [] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, shopping: [{ ...plan.shopping[0], aisle: 'kosmos' }] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, meals: [{ ...plan.meals[0], box: 99 }] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, goal: { ...plan.goal, dietProfile: 'paleo' } })).toBeNull();
    expect(cleanPrepPlan({ ...plan, dayTargets: plan.dayTargets.slice(1) })).toBeNull();
    expect(cleanPrepPlan('plan')).toBeNull();
  });

  test('ticks that are not text are dropped, an unreadable check-in leaves the plan without one', () => {
    const cleaned = cleanPrepPlan({ ...plan, bought: ['skyr', 3], checkIn: { status: '?' } });
    expect(cleaned?.bought).toEqual(['skyr']);
    expect(cleaned?.checkIn).toBeNull();
  });
});
