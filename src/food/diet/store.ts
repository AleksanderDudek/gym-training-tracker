import { db, type DayRow, type DietDb, type Entry } from './db';
import { bumpFavorite } from './favorites';
import type { Food } from './foods';
import type { DayChoices, Plan, PlanItem } from './plan';
import { importPlan, type ImportedPlan } from './plan-import';
import { MODEL_DEFAULTS, type Profile } from './types';
import {
  cleanCustomFood,
  cleanDay,
  cleanEntry,
  cleanFavorite,
  cleanPlan,
  cleanProfile,
  cleanRows,
  cleanSet,
} from './validate';
import { readWorkbook } from './xlsx';

/** The one active plan lives under this id. */
export const ACTIVE_PLAN = 'active';

export function now(): { date: string; time: string } {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** A complete profile from a partial one: the model's defaults for what is missing. */
export function completeProfile(partial: Partial<Profile>): Profile {
  return {
    sex: 'M',
    age: 35,
    heightCm: 175,
    startWeightKg: 80,
    targetWeightKg: 75,
    startDate: now().date,
    ...MODEL_DEFAULTS,
    dailyKcal: 2000,
    dietProfile: 'redukcja',
    adaptWeekly: true,
    preferredStore: null,
    ...partial,
  };
}

export async function saveProfile(profile: Profile, database: DietDb = db): Promise<void> {
  await database.profile.put({ ...profile, id: 'me' });
}

export async function logFood(
  date: string,
  food: Food,
  extra: Partial<Entry> = {},
  database: DietDb = db,
): Promise<number> {
  const entry: Entry = {
    date,
    time: now().time,
    name: food.name,
    amountLabel: food.amountLabel,
    kcal: food.nutrients.kcal,
    protein: food.nutrients.protein,
    carbs: food.nutrients.carbs,
    fat: food.nutrients.fat,
    source: food.source,
    key: food.key,
    ...extra,
  };
  // One transaction: the entry and the favourite's count go together.
  return database.transaction('rw', database.entries, database.favorites, async () => {
    const id = await database.entries.add(entry);
    await bumpFavorite(entry.key, database);
    return id;
  });
}

/** "Something outside the plan: 650 kcal" - the workbook's "extra kcal", macros optional. */
export async function logQuick(
  date: string,
  name: string,
  kcal: number,
  macros: Partial<Pick<Entry, 'protein' | 'carbs' | 'fat'>> = {},
  database: DietDb = db,
): Promise<number> {
  return database.entries.add({
    date,
    time: now().time,
    name: name.trim() || 'Coś poza planem',
    amountLabel: '',
    kcal,
    protein: macros.protein ?? null,
    carbs: macros.carbs ?? null,
    fat: macros.fat ?? null,
    source: 'quick',
  });
}

/** Ticking off a plan line logs it as eaten, linked to the line. */
export async function logPlanItem(date: string, index: number, item: PlanItem, database: DietDb = db): Promise<number> {
  const key = `plan:${item.text}`;
  return database.transaction('rw', database.entries, database.favorites, async () => {
    const id = await database.entries.add({
      date,
      time: now().time,
      name: item.text,
      amountLabel: 'z planu',
      kcal: item.kcal,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: 'plan',
      key,
      planIndex: index,
    });
    await bumpFavorite(key, database);
    return id;
  });
}

export async function updateDay(
  date: string,
  patch: Partial<Omit<DayRow, 'date'>>,
  database: DietDb = db,
): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const current = (await database.days.get(date)) ?? { date };
    await database.days.put({ ...current, ...patch, date });
  });
}

export async function updateChoices(
  date: string,
  change: (c: DayChoices) => DayChoices,
  database: DietDb = db,
): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const current = (await database.days.get(date)) ?? { date };
    await database.days.put({ ...current, choices: change(current.choices ?? {}), date });
  });
}

export interface ImportResult extends ImportedPlan {
  /** False when a profile already existed: the app's own is kept. */
  profileApplied: boolean;
}

/**
 * Imports the workbook. The plan replaces the active one. The workbook's
 * parameters become the profile only on the FIRST import: after that the
 * profile is edited in the app, and re-importing an updated meal plan must
 * not quietly undo those edits (or move the start date under the forecast).
 * Days logged in the workbook come along without overwriting what the app
 * has. A changed plan clears the swaps and skips of days still to come:
 * they point at lines of the old plan.
 */
export async function importWorkbook(bytes: Uint8Array, database: DietDb = db): Promise<ImportResult> {
  const imported = importPlan(readWorkbook(bytes), ACTIVE_PLAN);
  const today = now().date;
  let profileApplied = false;
  await database.transaction('rw', [database.profile, database.plans, database.days, database.entries], async () => {
    const existing = await database.profile.get('me');
    if (!existing) {
      await database.profile.put({ ...cleanProfile(imported.profile, completeProfile({})), id: 'me' });
      profileApplied = true;
    }
    const previous = await database.plans.get(ACTIVE_PLAN);
    if (previous && JSON.stringify(previous.templates) !== JSON.stringify(imported.plan.templates)) {
      await database.days
        .where('date')
        .aboveOrEqual(today)
        .modify((day) => {
          delete day.choices;
        });
    }
    await database.plans.put(imported.plan);
    for (const day of imported.days) {
      const current = (await database.days.get(day.date)) ?? { date: day.date };
      await database.days.put({
        ...current,
        weightKg: current.weightKg ?? day.weightKg ?? null,
        steps: current.steps ?? day.steps ?? null,
        choices: current.choices ?? (day.variant ? { variant: day.variant } : undefined),
        date: day.date,
      });
      // Only onto a day the app has nothing for: what was logged here wins,
      // and an extra the user deleted is not brought back by a re-import.
      if (day.extraKcal && !(await database.entries.where('date').equals(day.date).count())) {
        await database.entries.add({
          date: day.date,
          time: '12:00',
          name: 'Extra kcal z planu',
          amountLabel: '',
          kcal: day.extraKcal,
          protein: null,
          carbs: null,
          fat: null,
          source: 'quick',
        });
      }
    }
  });
  return { ...imported, profileApplied };
}

export interface Backup {
  app: 'produkty-pl';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  days: DayRow[];
  entries: Entry[];
  plans: Plan[];
  foods: unknown[];
  /** Own sets; absent in backups made before they existed. */
  sets?: unknown[];
  /** Starred foods; absent in backups made before they existed. */
  favorites?: unknown[];
}

export async function exportAll(database: DietDb = db): Promise<Backup> {
  const profile = await database.profile.get('me');
  return {
    app: 'produkty-pl',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile ? (({ id: _id, ...rest }) => rest)(profile) : null,
    days: await database.days.toArray(),
    entries: await database.entries.toArray(),
    plans: await database.plans.toArray(),
    foods: await database.foods.toArray(),
    sets: await database.sets.toArray(),
    favorites: await database.favorites.toArray(),
  };
}

/**
 * Replaces everything with a backup; refuses anything that is not one. Every
 * row is checked BEFORE anything is cleared: one unreadable row is dropped
 * (and counted), it does not get stored to break the page afterwards.
 */
export async function restoreAll(backup: unknown, database: DietDb = db): Promise<{ dropped: number }> {
  const b = backup as Partial<Record<keyof Backup, unknown>> | null;
  if (b?.app !== 'produkty-pl' || b.version !== 1) throw new Error('To nie jest kopia zapasowa tej aplikacji.');
  const days = cleanRows(b.days, cleanDay);
  const entries = cleanRows(b.entries, cleanEntry);
  const plans = cleanRows(b.plans, cleanPlan);
  const foods = cleanRows(b.foods, cleanCustomFood);
  const sets = cleanRows(b.sets, cleanSet);
  const favorites = cleanRows(b.favorites, cleanFavorite);
  await database.transaction(
    'rw',
    [
      database.profile,
      database.days,
      database.entries,
      database.plans,
      database.foods,
      database.sets,
      database.favorites,
    ],
    async () => {
      await Promise.all([
        database.profile.clear(),
        database.days.clear(),
        database.entries.clear(),
        database.plans.clear(),
        database.foods.clear(),
        database.sets.clear(),
        database.favorites.clear(),
      ]);
      if (b.profile) await database.profile.put({ ...cleanProfile(b.profile, completeProfile({})), id: 'me' });
      await database.days.bulkPut(days.rows);
      await database.entries.bulkPut(entries.rows);
      await database.plans.bulkPut(plans.rows);
      await database.foods.bulkPut(foods.rows);
      await database.sets.bulkPut(sets.rows);
      await database.favorites.bulkPut(favorites.rows);
    },
  );
  return {
    dropped: days.dropped + entries.dropped + plans.dropped + foods.dropped + sets.dropped + favorites.dropped,
  };
}

export async function clearAll(database: DietDb = db): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.profile,
      database.days,
      database.entries,
      database.plans,
      database.foods,
      database.sets,
      database.favorites,
    ],
    async () => {
      await Promise.all([
        database.profile.clear(),
        database.days.clear(),
        database.entries.clear(),
        database.plans.clear(),
        database.foods.clear(),
        database.sets.clear(),
        database.favorites.clear(),
      ]);
    },
  );
}
