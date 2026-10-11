// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DietDb } from './diet/db';
import { saveProfile, completeProfile, logQuick, updateDay } from './diet/store';
import { FOOD_CACHES, clearFood, dietBackup, forgetDietWeights, hasFoodData, restoreDiet } from './backup';
import { DIET_FLAG, hasDiet } from './dietFlag';
// Service worker jako tekst (`?raw`): nazwy jego kopii muszą zgadzać się z tymi, które czyści reset.
import swSource from '../sw.ts?raw';

let database: DietDb;
let n = 0;

beforeEach(() => {
  database = new DietDb(`backup-test-${n++}`);
  window.localStorage.clear();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  database.close();
  await database.delete();
});

/** `caches` z przeglądarki (jsdom go nie ma): kafelki, zdjęcia i baza produktów. */
function stubCaches() {
  const names = new Set(['osm-tiles', 'off-images', 'gt-food-data']);
  const remove = vi.fn(async (name: string) => names.delete(name));
  vi.stubGlobal('caches', { delete: remove });
  return { names, remove };
}

/** Baza, która odmawia każdego dostępu (zablokowana IndexedDB). */
const brokenDb = () => {
  const fail = () => Promise.reject(new Error('IndexedDB zablokowana'));
  const table = { count: fail };
  return {
    profile: table,
    days: table,
    entries: table,
    plans: table,
    foods: table,
    transaction: fail,
  } as unknown as DietDb;
};

describe('kopia jedzenia', () => {
  it('pusty dziennik nie trafia do pliku', async () => {
    expect(await dietBackup(database)).toBeNull();
  });

  it('dziennik z profilem i wpisem trafia do pliku i wraca z niego', async () => {
    await saveProfile(completeProfile({ dailyKcal: 2100 }), database);
    await logQuick('2026-10-11', 'Obiad na mieście', 650, {}, database);
    const backup = await dietBackup(database);
    expect(backup?.profile?.dailyKcal).toBe(2100);
    expect(backup?.entries).toHaveLength(1);

    const other = new DietDb(`backup-test-${n++}`);
    try {
      await restoreDiet(backup, other);
      expect(await other.entries.count()).toBe(1);
      expect(hasDiet()).toBe(true);
    } finally {
      other.close();
      await other.delete();
    }
  });

  it('kopia bez profilu zdejmuje znacznik diety', async () => {
    window.localStorage.setItem(DIET_FLAG, '1');
    await restoreDiet({ app: 'produkty-pl', version: 1, profile: null, days: [], entries: [], plans: [], foods: [] }, database);
    expect(hasDiet()).toBe(false);
  });

  it('reset czyści dziennik, znacznik i zapamiętane miejsce sklepów', async () => {
    await saveProfile(completeProfile({}), database);
    window.localStorage.setItem(DIET_FLAG, '1');
    window.localStorage.setItem('produkty-pl:position', '{"lat":52,"lon":21}');
    window.localStorage.setItem('kb-trener-v3', '{}');
    await clearFood(database);
    expect(await database.profile.count()).toBe(0);
    expect(hasDiet()).toBe(false);
    expect(window.localStorage.getItem('produkty-pl:position')).toBeNull();
    // Zapis treningu czyści aplikacja osobno — tu zostaje nietknięty.
    expect(window.localStorage.getItem('kb-trener-v3')).toBe('{}');
  });

  it('reset usuwa kopie kafelków mapy i zdjęć produktów, a bazę produktów zostawia', async () => {
    const { names, remove } = stubCaches();
    await clearFood(database);
    expect(remove.mock.calls.map(([name]) => name).sort()).toEqual(['off-images', 'osm-tiles']);
    expect([...names]).toEqual(['gt-food-data']);
  });

  it('nazwy kopii do wyczyszczenia to te, których używa service worker', () => {
    FOOD_CACHES.forEach((name) => expect(swSource).toContain(`cacheName: '${name}'`));
  });

  it('gdy baza odmówi, miejsce sklepów i kopie i tak znikają', async () => {
    const { remove } = stubCaches();
    window.localStorage.setItem('produkty-pl:position', '{"lat":52,"lon":21}');
    window.localStorage.setItem(DIET_FLAG, '1');
    await expect(clearFood(brokenDb())).rejects.toThrow();
    expect(window.localStorage.getItem('produkty-pl:position')).toBeNull();
    expect(remove).toHaveBeenCalledTimes(2);
    // Dziennik został, więc znacznik też — nie udaje, że diety nie ma.
    expect(hasDiet()).toBe(true);
  });

  it('o danych jedzenia rozstrzyga zawartość bazy, nie znacznik', async () => {
    expect(await hasFoodData(database)).toBe(false);
    // Sam wpis, bez profilu i bez znacznika diety — to też dane do kopii i do resetu.
    await logQuick('2026-10-11', 'Obiad na mieście', 650, {}, database);
    expect(hasDiet()).toBe(false);
    expect(await hasFoodData(database)).toBe(true);
    expect((await dietBackup(database))?.entries).toHaveLength(1);
  });

  it('dzień z samymi krokami to też dane jedzenia', async () => {
    await updateDay('2026-10-11', { steps: 4000 }, database);
    expect(await hasFoodData(database)).toBe(true);
  });

  it('baza, której nie da się odczytać, to brak danych jedzenia', async () => {
    expect(await hasFoodData(brokenDb())).toBe(false);
  });

  it('po przeniesieniu ważeń dziennik diety zapomina własne, resztę dnia zostawia', async () => {
    await updateDay('2026-10-10', { weightKg: 84.2, steps: 9000 }, database);
    await updateDay('2026-10-11', { steps: 4000 }, database);
    await forgetDietWeights(database);
    const days = await database.days.toArray();
    expect(days.map((d) => d.weightKg)).toEqual([undefined, undefined]);
    expect(days.map((d) => d.steps)).toEqual([9000, 4000]);
  });
});
