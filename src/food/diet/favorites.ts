import { db, type DietDb, type Entry, type Favorite } from './db';
import type { Food, MealRole } from './foods';

/** A food from an eaten entry, as it was eaten: its amount, its macros (unknown stays unknown). */
export function entryFood(e: Entry): Food {
  const role: MealRole = e.kcal >= 350 ? 'main' : 'light';
  return {
    key: e.key ?? `quick:${e.name}`,
    name: e.name,
    detail: 'z dziennika',
    source: e.source === 'quick' ? 'custom' : e.source,
    amountLabel: e.amountLabel,
    nutrients: { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat },
    per100: null,
    grams: null,
    stores: [],
    atHome: false,
    role,
  };
}

/** The favourite as a food to log or suggest: its snapshot, marked. */
export function favoriteFood(f: Favorite): Food {
  return { ...f.food, favorite: true };
}

/** Most eaten first, then most recently eaten, then by name. */
export function byUse(a: Favorite, b: Favorite): number {
  return (
    b.uses - a.uses ||
    (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') ||
    a.food.name.localeCompare(b.food.name, 'pl')
  );
}

/** Stars a food, or takes the star off one that has it. Returns whether it is starred now. */
export async function toggleFavorite(food: Food, database: DietDb = db): Promise<boolean> {
  return database.transaction('rw', database.favorites, async () => {
    if (await database.favorites.get(food.key)) {
      await database.favorites.delete(food.key);
      return false;
    }
    // A snapshot without the mark: the mark is the table itself.
    const { favorite: _mark, ...snapshot } = food;
    await database.favorites.put({
      key: food.key,
      food: snapshot,
      addedAt: new Date().toISOString(),
      uses: 0,
      lastUsed: null,
    });
    return true;
  });
}

/** A log of a starred food counts for the order of the list. Call inside a transaction with `favorites`. */
export async function bumpFavorite(key: string | undefined, database: DietDb = db): Promise<void> {
  if (!key) return;
  const favorite = await database.favorites.get(key);
  if (favorite)
    await database.favorites.put({ ...favorite, uses: favorite.uses + 1, lastUsed: new Date().toISOString() });
}
