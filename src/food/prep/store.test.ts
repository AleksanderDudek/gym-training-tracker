import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DietDb } from '../diet/db';
import { addDays } from '../diet/model';
import { DIET_PROFILES } from '../diet/profiles';
import { clearAll, exportAll, restoreAll } from '../diet/store';
import { PREP_DICT, prepIndex, prepProfile } from '../test/prep';
import { planDates } from './blocks';
import { generatePlan } from './generate';
import { moveRange, shiftPlan } from './dates';
import {
  KEEP_PLANS,
  clearBought,
  deletePrepPlan,
  hiddenDays,
  latestPlan,
  markBought,
  movePlan,
  nextPlanAfter,
  openPlans,
  planCovering,
  planEnd,
  planName,
  renamePlan,
  replacePrepPlan,
  savePrepPlan,
  setInDiary,
  shownPlan,
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
    dayTargets: planTargets({ profile, kcal: 2200, dates: planDates(start, days) }),
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

  test('open plans: the week running and the one planned ahead, in the order they run; a plan made again drops out', () => {
    expect(openPlans([next, week], '2026-10-21')).toEqual([week, next]);
    expect(openPlans([week], '2026-10-27')).toEqual([]);
    // Made again for the rest of the week: the newer covers every day still ahead of the older.
    const again = { ...makePlan('2026-10-21', 6, '2026-10-21T10:00:00.000Z'), id: 4 };
    expect(openPlans([week, again], '2026-10-21')).toEqual([again]);
    expect(latestPlan([week, next, redo])).toBe(next);
  });

  test('the plan a screen shows: the one asked for, else the one running today, else the first ahead', () => {
    expect(shownPlan([week, next], '2026-10-21', null)).toBe(week);
    expect(shownPlan([week, next], '2026-10-21', 2)).toBe(next);
    // An id that is not on the device falls back to today's.
    expect(shownPlan([week, next], '2026-10-21', 99)).toBe(week);
    expect(shownPlan([next], '2026-10-21', null)).toBe(next);
    expect(shownPlan([week], '2026-11-30', null)).toBeNull();
    // An ended plan opens when asked for by its id (from „Moje plany”).
    expect(shownPlan([week], '2026-11-30', 1)).toBe(week);
  });

  test('the plan set last wins where plans overlap: made, moved or „Ustaw w dzienniku”', () => {
    // `redo` was made later and wins the 23rd…; setting `week` again takes those days back.
    const chosen = { ...week, setAt: '2026-10-23T07:00:00.000Z' };
    expect(planCovering([chosen, redo], '2026-10-24')).toBe(chosen);
    expect(hiddenDays([week, redo], week)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
    expect(hiddenDays([chosen, redo], chosen)).toEqual([]);
    // `redo` runs a day longer: the 27th is still its own.
    expect(hiddenDays([chosen, redo], redo)).toEqual(planDates('2026-10-23', 4));
  });

  test('the next plan after a day without one', () => {
    expect(nextPlanAfter([week, next], '2026-10-21')).toBe(next);
    expect(nextPlanAfter([next], '2026-10-19')).toBe(next);
    expect(nextPlanAfter([week], '2026-10-21')).toBeNull();
  });
});

describe('a plan’s name and dates', () => {
  test('the name: the user’s, else the style and the shop', () => {
    const plan = makePlan();
    expect(planName(plan)).toBe(`${DIET_PROFILES.redukcja.label} · ${plan.shops[0]!.name}`);
    expect(planName({ ...plan, name: '  Keto do pracy ' })).toBe('Keto do pracy');
    expect(planName({ ...plan, name: '   ' })).toBe(planName(plan));
  });

  test('moving a plan moves every date in it by the same days; the plan stays valid', () => {
    const plan = makePlan('2026-10-20', 7);
    const moved = shiftPlan(plan, '2026-11-03');
    expect(moved.settings.start).toBe('2026-11-03');
    expect(moved.dayTargets.map((d) => d.date)).toEqual(planDates('2026-11-03', 7));
    expect(moved.meals.map((m) => m.date)).toEqual(plan.meals.map((m) => addDays(m.date, 14)));
    expect(moved.batches.map((b) => b.date)).toEqual(['2026-11-03', '2026-11-07']);
    expect(moved.batches.flatMap((b) => b.boxes.map((x) => x.date)).every((d) => d >= '2026-11-03' && d <= '2026-11-09')).toBe(true);
    for (const item of moved.shopping) for (const f of item.freeze) expect(f.date >= '2026-11-05').toBe(true);
    // Recipes, portions and the list are the same plan.
    expect(moved.choices).toEqual(plan.choices);
    expect(moved.shopping.map((i) => [i.key, i.grams])).toEqual(plan.shopping.map((i) => [i.key, i.grams]));
    expect(cleanPrepPlan(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
    expect(shiftPlan(plan, plan.settings.start)).toBe(plan);
    expect(moveRange('2026-10-21')).toEqual({ min: '2026-10-08', max: '2027-01-19' });
  });

  test('renamed, moved (ticks kept or cleared) and set in the diary on the device', async () => {
    const id = await savePrepPlan({ ...makePlan(), bought: ['skyr'] }, db);
    await renamePlan(id, '  Tydzień   na masę ', db);
    expect((await db.prep.get(id))!.name).toBe('Tydzień na masę');
    await renamePlan(id, 'x'.repeat(80), db);
    expect((await db.prep.get(id))!.name).toHaveLength(60);
    await renamePlan(id, '  ', db);
    expect((await db.prep.get(id))!).not.toHaveProperty('name');

    await movePlan(id, '2026-10-22', false, db, '2026-10-21T10:00:00.000Z');
    let stored = (await db.prep.get(id))!;
    expect(stored).toMatchObject({ id, bought: ['skyr'], setAt: '2026-10-21T10:00:00.000Z' });
    expect(stored.settings.start).toBe('2026-10-22');
    await movePlan(id, '2026-12-01', true, db, '2026-10-21T11:00:00.000Z');
    stored = (await db.prep.get(id))!;
    expect(stored.bought).toEqual([]);
    expect(stored.dayTargets[0]!.date).toBe('2026-12-01');

    await setInDiary(id, db, '2026-10-21T12:00:00.000Z');
    expect((await db.prep.get(id))!.setAt).toBe('2026-10-21T12:00:00.000Z');
  });
});

describe('plans on the device', () => {
  test('saved with a new id, ticked and unticked (idempotently), replaced, deleted', async () => {
    const id = await savePrepPlan(makePlan(), db);
    await markBought(id, 'skyr', true, db);
    await markBought(id, 'rice', true, db);
    // Twice the same tick is one tick; taking it off leaves the rest.
    await markBought(id, 'rice', true, db);
    await markBought(id, 'skyr', false, db);
    expect((await db.prep.get(id))!.bought).toEqual(['rice']);
    await clearBought(id, db);
    expect((await db.prep.get(id))!.bought).toEqual([]);
    const stored = (await db.prep.get(id))!;
    await replacePrepPlan({ ...stored, id, settings: { ...stored.settings, seed: 5 } }, db);
    expect((await db.prep.get(id))!.settings.seed).toBe(5);
    await deletePrepPlan(id, db);
    expect(await db.prep.count()).toBe(0);
  });

  test(`the newest ${KEEP_PLANS} unnamed are kept; a named plan stays until deleted`, async () => {
    const plan = makePlan();
    await savePrepPlan({ ...plan, name: 'Klasyk', createdAt: '2026-09-01T08:00:00.000Z' }, db);
    for (let i = 0; i < KEEP_PLANS + 2; i++)
      await savePrepPlan({ ...plan, createdAt: `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00.000Z` }, db);
    const kept = await db.prep.toArray();
    expect(kept).toHaveLength(KEEP_PLANS + 1);
    expect(kept.filter((p) => !p.name).map((p) => p.createdAt).sort()[0]).toBe('2026-10-03T08:00:00.000Z');
    expect(kept.find((p) => p.name === 'Klasyk')).toBeDefined();
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
    await markBought(id, 'skyr', true, db);
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
    const named = { ...plan, name: 'Masa', setAt: '2026-10-21T09:00:00.000Z' };
    expect(cleanPrepPlan(named)).toEqual(named);
  });

  test('a name is tidied and cut; a blank or odd one is dropped, the plan stays', () => {
    expect(cleanPrepPlan({ ...plan, name: '  Keto   w pracy ' })?.name).toBe('Keto w pracy');
    expect(cleanPrepPlan({ ...plan, name: 'x'.repeat(200) })?.name).toHaveLength(60);
    expect(cleanPrepPlan({ ...plan, name: '   ' })).not.toHaveProperty('name');
    expect(cleanPrepPlan({ ...plan, name: 42, setAt: 7 })).toEqual(plan);
  });

  test('kept whole or not at all', () => {
    expect(cleanPrepPlan({ ...plan, settings: { ...plan.settings, days: 3 } })).toBeNull();
    expect(cleanPrepPlan({ ...plan, shops: [] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, shopping: [{ ...plan.shopping[0], aisle: 'kosmos' }] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, meals: [{ ...plan.meals[0], box: 99 }] })).toBeNull();
    expect(cleanPrepPlan({ ...plan, goal: { ...plan.goal, dietProfile: 'paleo' } })).toBeNull();
    expect(cleanPrepPlan({ ...plan, dayTargets: plan.dayTargets.slice(1) })).toBeNull();
    // Targets for other dates than the plan's would leave a day without its targets.
    expect(cleanPrepPlan({ ...plan, dayTargets: plan.dayTargets.map((d, i) => (i ? d : { ...d, date: '2026-01-01' })) })).toBeNull();
    expect(cleanPrepPlan({ ...plan, meals: [{ ...plan.meals[0], slot: 0.5 }, ...plan.meals.slice(1)] })).toBeNull();
    expect(cleanPrepPlan('plan')).toBeNull();
  });

  test('a link that is not https is dropped, the line stays', () => {
    const item = { ...plan.shopping[0]!, product: { code: '1', name: 'Skyr', brand: null, quantity: null, url: 'javascript:alert(1)' } };
    const shop = { key: 'x', name: 'X', online: true, url: 'data:text/html,hi' };
    const cleaned = cleanPrepPlan({ ...plan, shopping: [item, ...plan.shopping.slice(1)], shops: [...plan.shops, shop] });
    expect(cleaned?.shopping[0]!.product?.url).toBeNull();
    expect(cleaned?.shops.at(-1)!.url).toBeNull();
  });

  test('ticks that are not text are dropped, an unreadable check-in leaves the plan without one', () => {
    const cleaned = cleanPrepPlan({ ...plan, bought: ['skyr', 3], checkIn: { status: '?' } });
    expect(cleaned?.bought).toEqual(['skyr']);
    expect(cleaned?.checkIn).toBeNull();
  });
});
