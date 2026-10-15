import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { DATASET, makeProduct } from '../test/fixtures';
import { indexProducts } from '../lib/search';
import { recipeIndex } from '../recipes/resolve';
import { DietDb, type Entry } from './db';
import { byUse, entryFood, favoriteFood, toggleFavorite } from './favorites';
import { customFood, planFood, productFood, type Food } from './foods';
import { buildPool } from './pool';
import { DIET_PROFILES } from './profiles';
import { searchFoods } from './search';
import { clearAll, exportAll, logFood, logPlanItem, restoreAll } from './store';
import { suggest } from './suggest';
import { cleanFavorite } from './validate';

const n = (kcal: number, protein: number, carbs: number, fat: number) => ({
  kcal,
  protein,
  carbs,
  fat,
  sugars: null,
  saturatedFat: null,
  fiber: null,
  salt: null,
});
const SKYR = productFood(
  makeProduct({ code: '590', name: 'Skyr naturalny', quantity: '150 g', nutrition: n(63, 11, 4, 0.2) }),
  DATASET.dictionaries,
)!;

let db: DietDb;
beforeEach(() => {
  db = new DietDb(`test-${Math.random()}`);
});

describe('favourites', () => {
  test('a star is a snapshot of the food, the second tap takes it off', async () => {
    expect(await toggleFavorite({ ...SKYR, favorite: true }, db)).toBe(true);
    const [row] = await db.favorites.toArray();
    expect(row).toMatchObject({
      key: 'product:590',
      uses: 0,
      lastUsed: null,
      food: { name: 'Skyr naturalny', grams: 150 },
    });
    expect(row!.food.favorite).toBeUndefined();
    expect(await toggleFavorite(SKYR, db)).toBe(false);
    expect(await db.favorites.count()).toBe(0);
  });

  test('every log of a starred food counts — from the picker, the plan or anywhere — and only of that food', async () => {
    const plan = planFood({ text: 'Owsianka', kcal: 400, protein: 20, carbs: 50, fat: 10, stores: [] });
    await toggleFavorite(SKYR, db);
    await toggleFavorite(plan, db);
    await logFood('2026-10-15', SKYR, {}, db);
    await logFood('2026-10-15', SKYR, {}, db);
    await logFood(
      '2026-10-15',
      customFood({ id: 1, name: 'x', amountLabel: '', kcal: 100, protein: 1, carbs: 1, fat: 1 }),
      {},
      db,
    );
    await logPlanItem(
      '2026-10-15',
      0,
      { text: 'Owsianka', kcal: 400, protein: 20, carbs: 50, fat: 10, stores: [] },
      db,
    );
    const rows = await db.favorites.toArray();
    expect(rows.find((r) => r.key === 'product:590')).toMatchObject({ uses: 2 });
    expect(rows.find((r) => r.key === 'plan:Owsianka')).toMatchObject({ uses: 1 });
    expect(rows.find((r) => r.key === 'plan:Owsianka')?.lastUsed).toEqual(expect.any(String));
    expect(await db.entries.count()).toBe(4);
  });

  test('the most eaten first, then the most recently eaten, then by name', () => {
    const fav = (name: string, uses: number, lastUsed: string | null) => ({
      key: name,
      food: { ...SKYR, key: name, name },
      addedAt: '2026-10-01T00:00:00.000Z',
      uses,
      lastUsed,
    });
    const list = [
      fav('Ser', 1, '2026-10-10'),
      fav('Banan', 3, '2026-10-01'),
      fav('Arbuz', 1, '2026-10-12'),
      fav('Zupa', 0, null),
    ];
    expect(list.sort(byUse).map((f) => f.food.name)).toEqual(['Banan', 'Arbuz', 'Ser', 'Zupa']);
  });

  test('a food from the diary is starred as it was eaten; a quick entry gets a key of its own', () => {
    const eaten: Entry = {
      date: '2026-10-15',
      time: '12:00',
      name: 'Obiad u mamy',
      amountLabel: '',
      kcal: 650,
      protein: null,
      carbs: null,
      fat: null,
      source: 'quick',
    };
    expect(entryFood(eaten)).toMatchObject({ key: 'quick:Obiad u mamy', source: 'custom', role: 'main', per100: null });
    expect(entryFood({ ...eaten, key: 'restaurant:kfc:zinger', source: 'restaurant' }).key).toBe(
      'restaurant:kfc:zinger',
    );
  });

  test('favourites go into the backup and come back; a broken one is dropped; clearing clears them', async () => {
    await toggleFavorite(SKYR, db);
    const backup = await exportAll(db);
    expect(backup.favorites).toHaveLength(1);
    const other = new DietDb(`test-${Math.random()}`);
    const broken = { ...(backup.favorites![0] as object), key: 'inny-klucz' };
    expect(await restoreAll({ ...backup, favorites: [...backup.favorites!, broken] }, other)).toEqual({ dropped: 1 });
    expect((await other.favorites.toArray()).map((f) => f.food.name)).toEqual(['Skyr naturalny']);
    await clearAll(other);
    expect(await other.favorites.count()).toBe(0);
  });

  test('a favourite from a backup keeps only what the app reads', () => {
    expect(
      cleanFavorite({ key: 'x', food: { key: 'x', name: 'x', source: 'hack', role: 'main', nutrients: { kcal: 1 } } }),
    ).toBeNull();
    expect(
      cleanFavorite({
        key: 'custom:1',
        food: {
          key: 'custom:1',
          name: 'Owsianka',
          source: 'custom',
          role: 'main',
          nutrients: { kcal: 400 },
          per100: 'x',
          grams: 50,
        },
        uses: -3,
      }),
    ).toMatchObject({ uses: 0, food: { per100: null, grams: null, nutrients: { kcal: 400, protein: null } } });
  });

  test('a version-2 database opens with its sets and an empty favourites table', async () => {
    const name = `test-v2-${Math.random()}`;
    const v2 = new Dexie(name);
    v2.version(1).stores({ profile: 'id', days: 'date', entries: '++id, date', plans: 'id', foods: '++id' });
    v2.version(2).stores({ sets: '++id' });
    await v2.table('sets').add({ name: 'Banan + batonik', parts: [] });
    v2.close();
    const upgraded = new DietDb(name);
    expect(await upgraded.sets.count()).toBe(1);
    expect(await upgraded.favorites.count()).toBe(0);
  });
});

describe('favourites in the pool, the picker and suggestions', () => {
  const products = indexProducts(
    [makeProduct({ code: '590', name: 'Skyr naturalny', quantity: '150 g', nutrition: n(63, 11, 4, 0.2) })],
    {},
  );
  const { candidates, ranking } = recipeIndex(products);
  const star = (food: Food) => ({ key: food.key, food, addedAt: '', uses: 0, lastUsed: null });

  test('a starred product joins the pool from its snapshot, starred; a starred pool item is only marked', () => {
    const own = customFood({
      id: 7,
      name: 'Owsianka',
      amountLabel: 'miska',
      kcal: 400,
      protein: 20,
      carbs: 50,
      fat: 10,
    });
    const pool = buildPool({
      products,
      dict: DATASET.dictionaries,
      candidates,
      chains: [],
      fallbackRanking: ranking,
      plan: null,
      custom: [{ id: 7, name: 'Owsianka', amountLabel: 'miska', kcal: 400, protein: 20, carbs: 50, fat: 10 }],
      favorites: [star(SKYR), star(own)],
    });
    expect(pool.filter((f) => f.key === 'custom:7')).toEqual([{ ...own, favorite: true }]);
    expect(pool.find((f) => f.key === 'product:590')).toMatchObject({ favorite: true, grams: 150 });
  });

  test('the picker shows favourites first, and a starred product only once', () => {
    const recipe = { ...SKYR, key: 'recipe:x', name: 'Skyr z malinami', source: 'recipe' as const, per100: null };
    const pool = [recipe, favoriteFood(star(SKYR))];
    expect(
      searchFoods({ query: '', pool, chains: [], products: [], dict: DATASET.dictionaries }).map((f) => f.key),
    ).toEqual(['product:590', 'recipe:x']);
    const found = searchFoods({ query: 'skyr', pool, chains: [], products, dict: DATASET.dictionaries });
    expect(found.map((f) => f.key)).toEqual(['product:590', 'recipe:x']);
  });

  test('a favourite gets a nudge in suggestions and says why', () => {
    const ctx = {
      remaining: { kcal: 500, protein: 40, carbs: 50, fat: 15 },
      targets: DIET_PROFILES.redukcja.targets(2000, 75),
      profile: DIET_PROFILES.redukcja,
      mealsLeft: 1,
      nearby: [],
      storeName: (c: string) => c,
    };
    const [plain] = suggest([SKYR], ctx);
    const [starred] = suggest([{ ...SKYR, favorite: true }], ctx);
    expect(starred!.score).toBeCloseTo(plain!.score + 0.3);
    expect(starred!.reasons[0]).toBe('Twoje ulubione');
  });
});
