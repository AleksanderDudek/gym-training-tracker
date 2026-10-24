// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DietDb } from './diet/db';
import { saveProfile, completeProfile, logQuick, updateDay } from './diet/store';
import { forgetCacheEntries, FOOD_CACHES, clearFood, dietBackup, forgetDietWeights, hasFoodData, restoreDiet } from './backup';
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

/** `caches` z przeglądarki (jsdom go nie ma): kafelki, zdjęcia, kawałki danych OSM, baza produktów i indeks OSM. */
function stubCaches() {
  const names = new Set(['osm-tiles', 'off-images', 'gt-osm', 'gt-food-data', 'gt-osm-index']);
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
    sets: table,
    favorites: table,
    prep: table,
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

  it('reset usuwa kopie kafelków mapy, kawałków danych OSM i zdjęć, a bazę produktów i indeks OSM zostawia', async () => {
    const { names, remove } = stubCaches();
    await clearFood(database);
    expect(remove.mock.calls.map(([name]) => name).sort()).toEqual(['gt-osm', 'off-images', 'osm-tiles']);
    // Te są takie same dla wszystkich: nic nie mówią o człowieku.
    expect([...names]).toEqual(['gt-food-data', 'gt-osm-index']);
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
    expect(remove).toHaveBeenCalledTimes(3);
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

  it('sam zapisany zestaw to też dane jedzenia — trafia do kopii', async () => {
    await database.sets.add({
      name: 'Banan i batonik',
      parts: [{ name: 'Banan', amountLabel: '120 g', kcal: 107, protein: 1.3, carbs: 27, fat: 0.4 }],
    });
    expect(await hasFoodData(database)).toBe(true);
    expect((await dietBackup(database))?.sets).toHaveLength(1);
  });

  it('sam plan z listą zakupów to też dane jedzenia — trafia do kopii', async () => {
    // Kopia czyta wiersz tak, jak leży: zawartość planu sprawdza dopiero przywracanie.
    await database.prep.add({ createdAt: '2026-10-20T08:00:00.000Z', bought: [] } as never);
    expect(await hasFoodData(database)).toBe(true);
    expect((await dietBackup(database))?.prep).toHaveLength(1);
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

describe('zapis Workboxa o użytych plikach', () => {
  // Każdy test zaczyna bez tej bazy, jak przeglądarka, w której service worker jeszcze nic nie zapisał.
  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase('workbox-expiration');
      del.onsuccess = del.onerror = () => resolve();
    });
  });

  /** Baza `workbox-expiration` taka, jaką zakłada Workbox: magazyn `cache-entries` z indeksem `cacheName`. */
  async function workboxDb(rows: { id: string; cacheName: string; url: string; timestamp: number }[]) {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('workbox-expiration', 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('cache-entries', { keyPath: 'id' });
        store.createIndex('cacheName', 'cacheName', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction('cache-entries', 'readwrite');
        rows.forEach((r) => tx.objectStore('cache-entries').put(r));
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
      open.onerror = () => reject(open.error);
    });
  }
  const remaining = () =>
    new Promise<string[]>((resolve) => {
      const open = indexedDB.open('workbox-expiration');
      open.onsuccess = () => {
        const all = open.result.transaction('cache-entries').objectStore('cache-entries').getAll();
        all.onsuccess = () => {
          open.result.close();
          resolve((all.result as { cacheName: string }[]).map((r) => r.cacheName).sort());
        };
      };
    });

  it('reset usuwa wpisy oglądanych kawałków i kafelków, a wpisy wspólnych kopii zostawia', async () => {
    await workboxDb([
      { id: 'gt-osm|a', cacheName: 'gt-osm', url: 'a', timestamp: 1 },
      { id: 'osm-tiles|b', cacheName: 'osm-tiles', url: 'b', timestamp: 1 },
      { id: 'gt-food-data|c', cacheName: 'gt-food-data', url: 'c', timestamp: 1 },
    ]);
    await forgetCacheEntries(FOOD_CACHES);
    expect(await remaining()).toEqual(['gt-food-data']);
  });

  /** Wpisy po wizycie w „W pobliżu”: dwa oglądane kawałki i paczka sklepów (wspólna dla wszystkich). */
  const afterNearby = [
    { id: 'gt-osm|a', cacheName: 'gt-osm', url: 'https://app.example/kb/data/osm/v1/t/11-412-391.168d29f8c3.json.gz', timestamp: 1 },
    { id: 'gt-osm|b', cacheName: 'gt-osm', url: 'https://app.example/kb/data/osm/v1/t/11-413-391.5e67253ddd.json.gz', timestamp: 2 },
    { id: 'gt-shop-data|c', cacheName: 'gt-shop-data', url: 'https://app.example/kb/assets/shopData-CPHrJmUd.js', timestamp: 3 },
  ];

  it('„Usuń wszystkie dane” zapomina wpisy oglądanych kawałków razem z ich kopią', async () => {
    await workboxDb(afterNearby);
    const { remove } = stubCaches();
    await clearFood(database);
    expect(remove).toHaveBeenCalledWith('gt-osm');
    expect(await remaining()).toEqual(['gt-shop-data']);
  });

  it('gdy baza dziennika odmówi, wpisy oglądanych kawałków i tak znikają', async () => {
    await workboxDb(afterNearby);
    stubCaches();
    await expect(clearFood(brokenDb())).rejects.toThrow();
    expect(await remaining()).toEqual(['gt-shop-data']);
  });

  it('bazy, której nie ma, nie zakłada', async () => {
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase('workbox-expiration');
      del.onsuccess = del.onerror = () => resolve();
    });
    await forgetCacheEntries(FOOD_CACHES);
    const names = await indexedDB.databases();
    expect(names.map((d) => d.name)).not.toContain('workbox-expiration');
  });
});
