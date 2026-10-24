// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DietDb } from './diet/db';
import { saveProfile, completeProfile, logQuick, updateDay } from './diet/store';
import { forgetCacheEntries, FOOD_CACHES, clearFood, dietBackup, forgetDietWeights, hasFoodData, restoreDiet } from './backup';
import { DIET_FLAG, hasDiet } from './dietFlag';
import { refetchWhenControlled } from '../swWarm';
import { boxCoverage, osmResponse, osmRow, osmTestData } from './test/osm';
// Service worker jako tekst (`?raw`): nazwy jego kopii muszą zgadzać się z tymi, które czyści reset.
import swSource from '../sw.ts?raw';

// Dane OSM „W pobliżu” w tej wersji aplikacji (pod Vitestem domyślnie ich nie ma): reset zapomina też ich kawałki.
vi.mock('virtual:osm-places', () => ({ default: { index: 'data/osm/v1/index.json' } }));

let database: DietDb;
let n = 0;

beforeEach(() => {
  database = new DietDb(`backup-test-${n++}`);
  window.localStorage.clear();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
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
    // Miejsce wybrane ręcznie w tej karcie przetrwałoby przeładowanie — reset nie może go zostawić.
    window.sessionStorage.setItem('produkty-pl:position-picked', '{"lat":50.06,"lon":19.94}');
    window.localStorage.setItem('kb-trener-v3', '{}');
    await clearFood(database);
    expect(await database.profile.count()).toBe(0);
    expect(hasDiet()).toBe(false);
    expect(window.localStorage.getItem('produkty-pl:position')).toBeNull();
    expect(window.sessionStorage.getItem('produkty-pl:position-picked')).toBeNull();
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

  it('nazwy kopii do wyczyszczenia to te, których używa service worker — i te, które on sam usuwa na prośbę resetu', () => {
    FOOD_CACHES.forEach((name) => expect(swSource).toContain(`cacheName: '${name}'`));
    const trail = swSource.match(/const TRAIL = \[([^\]]*)\]/)?.[1];
    expect(trail?.match(/'[^']+'/g)?.map((name) => name.slice(1, -1)).sort()).toEqual([...FOOD_CACHES].sort());
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

  it('reset przed przejęciem strony przez service worker: kawałek, który miał wtedy pobrać do swojej kopii, nie wraca — baza produktów tak', async () => {
    // Pierwsza wizyta: strona jeszcze nie jest pod jego opieką, a kawałek i baza przyszły obok niego.
    const sw = Object.assign(new EventTarget(), { controller: null as object | null });
    Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true });
    const fetchMock = vi.fn(async (_url: string) => new Response('x'));
    vi.stubGlobal('fetch', fetchMock);
    const products = 'https://app.example/kb/data/products.19a087023af2.json.gz';
    refetchWhenControlled(afterNearby[0]!.url, Promise.resolve(), { trail: true });
    refetchWhenControlled(products);
    stubCaches();
    await clearFood(database);
    sw.controller = {};
    sw.dispatchEvent(new Event('controllerchange'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Baza jest taka sama dla wszystkich: trafia do kopii, żeby Jedzenie działało bez sieci.
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([products]);
  });

  it('po resecie nic nie sprząta drugi raz: kawałek, który był wtedy w drodze, nie zostaje w pamięci, a kopia i wpisy wizyty zaraz po resecie zostają', async () => {
    // Udawany tylko `setTimeout`: IndexedDB w pamięci odmierza swoje kroki `setImmediate`, który
    // musi biec naprawdę.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const data = osmTestData([osmRow('n1', 50.0614, 19.9366, { amenity: 'cafe', name: 'Kawiarnia' })], boxCoverage(49, 18, 51, 21));
    let answer = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/t/')) await new Promise<void>((arrive) => (answer = arrive));
        return osmResponse(data, url)!;
      }),
    );
    const nearby = await import('./nearby/staticData');
    const [leaf] = nearby.leafRefs(await nearby.loadIndex());
    const loading = nearby.loadLeaf(leaf!);
    await workboxDb(afterNearby);
    const { names, remove } = stubCaches();
    const sweeps = () => remove.mock.calls.filter(([name]) => name === 'gt-osm').length;

    // Reset na kawałek nie czeka: na wolnym łączu może iść jeszcze minutę.
    await clearFood(database);
    expect(sweeps()).toBe(1);
    expect(await remaining()).toEqual(['gt-shop-data']);

    answer();
    await loading;
    // Przyszedł po resecie: strona go nie zapamiętuje (service worker też nie — `src/swPlugins.ts`).
    expect(nearby.leafNow(leaf!)).toBeUndefined();
    // Nowa wizyta w „W pobliżu” zaraz po resecie: service worker zapisuje jej kawałki i wpisy o nich.
    names.add('gt-osm');
    await workboxDb([{ id: 'gt-osm|nowa', cacheName: 'gt-osm', url: afterNearby[1]!.url, timestamp: 4 }]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sweeps()).toBe(1);
    expect(names.has('gt-osm')).toBe(true);
    expect(await remaining()).toEqual(['gt-osm', 'gt-shop-data']);
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

describe('reset a service worker, pod którego opieką jest strona', () => {
  /** Strona pod opieką service workera, który odpowiada na prośbę resetu po `ms` (`null`: nigdy). */
  function controlledBy(ms: number | null) {
    const controller = {
      postMessage: vi.fn((_message: unknown, transfer: MessagePort[]) => {
        if (ms !== null) setTimeout(() => transfer[0]!.postMessage('done'), ms);
      }),
    };
    Object.defineProperty(navigator, 'serviceWorker', { value: { controller }, configurable: true });
    return controller;
  }

  /** Kroki IndexedDB w pamięci (prawdziwy `setImmediate`): wszystko, co reset robi bez service workera. */
  async function letDatabaseWork() {
    for (let k = 0; k < 50; k++) await new Promise((resolve) => setImmediate(resolve));
  }

  it('reset prosi go o zapomnienie śladu (`FORGET_TRAIL`, odpowiedź przez port) i czeka, aż skończy', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const controller = controlledBy(1000);
    stubCaches();
    let done = false;
    const reset = clearFood(database).then(() => (done = true));
    await letDatabaseWork();
    expect(controller.postMessage).toHaveBeenCalledWith({ type: 'FORGET_TRAIL' }, [expect.any(MessagePort)]);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await reset;
    expect(await database.profile.count()).toBe(0);
  });

  it('gdy nie odpowiada, reset czeka na niego najwyżej 3 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    controlledBy(null);
    stubCaches();
    let done = false;
    const reset = clearFood(database).then(() => (done = true));
    await letDatabaseWork();
    await vi.advanceTimersByTimeAsync(2900);
    await letDatabaseWork();
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await reset;
    expect(done).toBe(true);
  });

  it('strona bez service workera nie ma kogo pytać: kopie usuwa sama', async () => {
    const { remove } = stubCaches();
    await clearFood(database);
    expect(remove.mock.calls.map(([name]) => name).sort()).toEqual(['gt-osm', 'off-images', 'osm-tiles']);
  });
});

// Na końcu pliku: podmienia moduł danych OSM każdemu, kto go potem wczyta.
describe('reset a moduły, których strona jeszcze nie wczytała', () => {
  it('reset nie pobiera modułu danych OSM: na wolnym łączu kopie i dziennik nie czekają na niego, a moduł niewczytany niczego nie pamięta', async () => {
    // Moduł, który pobierałby się bez końca (zawieszone łącze, strona bez service workera).
    vi.doMock('./nearby/staticData', () => new Promise(() => {}));
    try {
      const { remove } = stubCaches();
      const outcome = await Promise.race([
        clearFood(database).then(() => 'gotowe'),
        new Promise((resolve) => setTimeout(resolve, 2000, 'czeka na moduł')),
      ]);
      expect(outcome).toBe('gotowe');
      expect(remove).toHaveBeenCalledWith('gt-osm');
      expect(await database.profile.count()).toBe(0);
    } finally {
      vi.doUnmock('./nearby/staticData');
    }
  });
});
