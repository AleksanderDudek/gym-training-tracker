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

/** Kopia dziennika jedzenia albo `null`, gdy nie ma w nim nic — plik bez pustej sekcji. */
export async function dietBackup(database: DietDb = defaultDb): Promise<Backup | null> {
  const b = await exportAll(database);
  const empty = !b.profile && !b.days.length && !b.entries.length && !b.plans.length && !b.foods.length;
  return empty ? null : b;
}

/** Dziennik z kopii zastępuje obecny; znacznik diety idzie za tym, czy w kopii jest profil. */
export async function restoreDiet(backup: unknown, database: DietDb = defaultDb): Promise<{ dropped: number }> {
  const result = await restoreAll(backup, database);
  markDiet((await database.profile.count()) > 0);
  return result;
}

/** Całe jedzenie z tego urządzenia: dziennik, znacznik diety i zapamiętane miejsce sklepów. */
export async function clearFood(database: DietDb = defaultDb): Promise<void> {
  await clearAll(database);
  markDiet(false);
  FOOD_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Zablokowana pamięć przeglądarki: nie ma czego czyścić.
    }
  });
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
