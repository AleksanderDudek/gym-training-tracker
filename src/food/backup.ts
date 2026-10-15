import { db as defaultDb } from './diet/db';
import type { DietDb } from './diet/db';
import { clearAll, exportAll, restoreAll } from './diet/store';
import type { Backup } from './diet/store';
import { markDiet } from './dietFlag';

/**
 * Jedzenie w kopii zapasowej i w „Usuń wszystkie dane”. Aplikacja ma jedną kopię i jeden reset:
 * plik z ustawień niesie trening razem z dziennikiem jedzenia, a reset czyści oba. Moduł jest
 * ładowany dynamicznie, więc Dexie nie trafia do głównej paczki.
 */

/** Ostatnie miejsce, promień i kopia sklepów z „W pobliżu” — dane tego urządzenia, nie konta. */
export const FOOD_KEYS = ['produkty-pl:position', 'produkty-pl:radius', 'produkty-pl:shops'] as const;

/**
 * Kopie service workera (`src/sw.ts`), które mówią coś o człowieku: kafelki mapy zdradzają, jakie
 * okolice oglądał, a zdjęcia — jakie produkty. Baza produktów zostaje: jest ta sama dla wszystkich.
 */
export const FOOD_CACHES = ['osm-tiles', 'off-images'] as const;

/**
 * Czy w dzienniku jedzenia cokolwiek jest — te same tabele, które trafiają do kopii. Rozstrzyga
 * zawartość bazy, nie znacznik diety: dziennik bez profilu (wpisy, plan z Excela) też jest
 * danymi. Bez IndexedDB — „nie”: w takiej przeglądarce dziennika i tak nie ma.
 */
export async function hasFoodData(database: DietDb = defaultDb): Promise<boolean> {
  try {
    const counts = await Promise.all([
      database.profile.count(),
      database.days.count(),
      database.entries.count(),
      database.plans.count(),
      database.foods.count(),
      database.sets.count(),
      database.favorites.count(),
    ]);
    return counts.some((n) => n > 0);
  } catch {
    return false;
  }
}

/** Kopia dziennika jedzenia albo `null`, gdy nie ma w nim nic — plik bez pustej sekcji. */
export async function dietBackup(database: DietDb = defaultDb): Promise<Backup | null> {
  const b = await exportAll(database);
  const empty =
    !b.profile &&
    !b.days.length &&
    !b.entries.length &&
    !b.plans.length &&
    !b.foods.length &&
    !b.sets?.length &&
    !b.favorites?.length;
  return empty ? null : b;
}

/** Dziennik z kopii zastępuje obecny; znacznik diety idzie za tym, czy w kopii jest profil. */
export async function restoreDiet(backup: unknown, database: DietDb = defaultDb): Promise<{ dropped: number }> {
  const result = await restoreAll(backup, database);
  markDiet((await database.profile.count()) > 0);
  return result;
}

/**
 * Całe jedzenie z tego urządzenia: dziennik, znacznik diety, zapamiętane miejsce sklepów i kopie
 * kafelków mapy i zdjęć. Miejsce i kopie idą pierwsze i niezależnie od bazy — gdyby baza odmówiła,
 * ślad po oglądanych okolicach i tak znika.
 */
export async function clearFood(database: DietDb = defaultDb): Promise<void> {
  FOOD_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Zablokowana pamięć przeglądarki: nie ma czego czyścić.
    }
  });
  // `caches` jest tylko w bezpiecznym kontekście (https, localhost) — bez niego nie ma też kopii.
  if (typeof caches !== 'undefined')
    await Promise.all(FOOD_CACHES.map((name) => caches.delete(name).catch(() => false)));
  await clearAll(database);
  markDiet(false);
}

/**
 * Po przeniesieniu ważeń do dziennika wagi dziennik diety zapomina własne — wszystkie, także te
 * z dni, w których dziennik wagi miał już swoje. Inaczej ważenie usunięte potem w profilu wracałoby
 * na wykres diety z jej starego zapisu. Waga ma jedno źródło.
 */
export async function forgetDietWeights(database: DietDb = defaultDb): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    await database.days
      .filter((day) => day.weightKg != null)
      .modify((day) => {
        delete day.weightKg;
      });
  });
}
