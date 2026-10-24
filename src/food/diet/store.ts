import { say } from '../../i18n';
import { cleanPrepPlan } from '../prep/validate';
import { db, type DayRow, type DietDb, type Entry, type PlannedCheat, type ProfileRow } from './db';
import { goalDirection } from './energy';
import { bumpFavorite } from './favorites';
import type { Food } from './foods';
import { addDays, mondayOf } from './model';
import type { DayChoices, Plan, PlanItem } from './plan';
import { importPlan, type ImportedPlan } from './plan-import';
import { safePace, setTarget, targetOn } from './target';
import type { WeighIn } from './trend';
import { MODEL_DEFAULTS, type Profile, type WeekCheck } from './types';
import {
  cleanCustomFood,
  cleanDay,
  cleanEntry,
  cleanFavorite,
  cleanPlan,
  cleanProfile,
  cleanRows,
  cleanSet,
  isCalendarDate,
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

/** The first pace by the goal's direction (spec §3.1), lowered to what is safe. */
const FIRST_PACE = { loss: 0.5, keep: 0, gain: -0.25 } as const;

/** The check of a new profile: nothing to look at yet, its week is this week. */
const setupCheck = (today: string, kcal: number, goalPace: number): WeekCheck => ({
  week: mondayOf(today),
  status: 'setup',
  from: kcal,
  to: kcal,
  reason: null,
  note: null,
  settle: null,
  facts: null,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace,
  answer: null,
});

/**
 * A complete profile (version 2) from a partial one: the defaults for what is missing. The target
 * history starts from the merged `dailyKcal`, so `targetOn(profile, today)` is that number.
 * The default `dailyKcal` is still 2000; package A switches it to `targetFor` (tests pass it).
 */
export function completeProfile(partial: Partial<Profile>): Profile {
  const today = now().date;
  const merged = {
    sex: 'M' as const,
    age: 35,
    heightCm: 175,
    startWeightKg: 80,
    targetWeightKg: 75,
    startDate: today,
    activityLevel: 'inactive' as const,
    ...MODEL_DEFAULTS,
    dailyKcal: 2000,
    kcalCorrection: 0,
    burnOffset: 0,
    anchored: false,
    autoAdjust: true,
    hideKcal: false,
    pregnancy: false,
    belowFloorOk: false,
    pauses: [],
    hold: null,
    reached: null,
    notice: null,
    dietProfile: 'redukcja' as const,
    adaptWeekly: true,
    preferredStore: null,
    ...partial,
  };
  const goalPace = partial.goalPace ?? safePace(merged, merged.startWeightKg, FIRST_PACE[goalDirection(merged)]);
  // Every read of the profile comes through here: a malformed start date must not throw in `addDays`.
  const start = isCalendarDate(merged.startDate) ? merged.startDate : today;
  return {
    ...merged,
    version: 2,
    goalPace,
    goals: partial.goals ?? [{ from: today, kcal: merged.dailyKcal, by: 'setup' }],
    settle: partial.settle ?? { from: addDays(start, 14), why: 'start' },
    lastCheck: partial.lastCheck !== undefined ? partial.lastCheck : setupCheck(today, merged.dailyKcal, goalPace),
  };
}

/**
 * Every write keeps `dailyKcal` the mirror of today's target (§2.2). The old screens, the workbook
 * and old backups set `dailyKcal` alone; their number becomes the target from today.
 */
function inStep(profile: Profile, today: string): Profile {
  return profile.dailyKcal === targetOn(profile, today)
    ? profile
    : setTarget(profile, profile.dailyKcal, today, 'user', today);
}

/**
 * Merges the profile into the stored row in one transaction (`{...stored, ...profile}`), so no write
 * path drops a key it does not know — the old model's keys stay in the row untouched.
 */
export async function saveProfile(profile: Profile, database: DietDb = db): Promise<void> {
  const next = inStep(profile, now().date);
  await database.transaction('rw', database.profile, async () => {
    const stored = await database.profile.get('me');
    const row: ProfileRow = { ...stored, ...next, id: 'me' };
    if (stored && stored.version !== 2) {
      // Until package A upgrades rows on read, `useProfile` hands out a legacy row completed with
      // the defaults and stamped version 2. Saved as such, the row would skip the upgrade for good;
      // without the stamp the upgrade still runs and recomputes the new keys from the old ones.
      // Package A drops this once `useProfile` goes through `cleanProfile` + `persistUpgrade`.
      const { version: _stamp, ...legacy } = row;
      await database.profile.put(legacy as ProfileRow);
    } else await database.profile.put(row);
  });
}

/** The profile page's save (package C: after `applyProfileEdit`). */
export const saveProfileEdit = (next: Profile, database: DietDb = db): Promise<void> => saveProfile(next, database);

/** „Rozumiem” on the upgrade notice: shown once, never again. */
export async function dismissNotice(database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const stored = await database.profile.get('me');
    if (stored?.notice === 'show') await database.profile.put({ ...stored, notice: 'seen' });
  });
}

/**
 * The person's word on a day's log (`DayRow.partial`): `true` incomplete, `false` the whole day,
 * `undefined` takes it back (the 60 % rule decides again). The rest of the day row is untouched.
 */
export async function markDay(date: string, partial: boolean | undefined, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const current = await database.days.get(date);
    if (partial !== undefined) await database.days.put({ ...(current ?? { date }), partial, date });
    else if (current && current.partial !== undefined) {
      const { partial: _taken, ...rest } = current;
      await database.days.put(rest);
    }
  });
}

/*
 * Package A: the Monday check, its answers, breaks and the upgrade (spec §2.4, §3.4, §3.6). The
 * signatures are final; until A lands these change nothing, so the app keeps today's behaviour.
 */

/** Writes the upgraded profile once, only while the stored row is still legacy. Stub: nothing. */
export async function persistUpgrade(_ctx: { weightKg: number; today: string }, _database: DietDb = db): Promise<void> {
  // Package A.
}

/** Runs this week's check once (null: nothing to do this time). Stub: never runs. */
export async function runWeeklyCheck(
  _input: { weighIns: readonly WeighIn[]; today: string; hour: number },
  _database: DietDb = db,
): Promise<WeekCheck | null> {
  return null;
}

/** An answer to the Monday card, with its effect, in one transaction. Stub: nothing. */
export async function answerCheck(
  _answer: NonNullable<WeekCheck['answer']>,
  _ctx: { today: string; kgNow: number },
  _database: DietDb = db,
): Promise<void> {
  // Package A.
}

/** The notice's floor choice: raise to the BMR floor, or keep a doctor- or dietitian-agreed target. Stub: nothing. */
export async function resolveFloor(
  _choice: 'raise' | 'keep',
  _ctx: { today: string; kgNow: number },
  _database: DietDb = db,
): Promise<void> {
  // Package A.
}

/** „Przerwa”: maintenance for 7 or 14 days, the old target back afterwards. Stub: nothing. */
export async function startPause(
  _days: 7 | 14,
  _ctx: { today: string; kgNow: number },
  _database: DietDb = db,
): Promise<void> {
  // Package A.
}

/** „Zakończ przerwę”: the old target from today. Stub: nothing. */
export async function endPause(_ctx: { today: string; kgNow: number }, _database: DietDb = db): Promise<void> {
  // Package A.
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
    name: name.trim() || say('Coś poza planem', 'Something off-plan'),
    amountLabel: '',
    kcal,
    protein: macros.protein ?? null,
    carbs: macros.carbs ?? null,
    fat: macros.fat ?? null,
    source: 'quick',
  });
}

/** A cheat meal planned for a day: the rest of the day is planned around it. */
export async function planCheat(date: string, cheat: PlannedCheat, database: DietDb = db): Promise<void> {
  await updateDay(date, { cheat }, database);
}

/** The planned cheat meal off the day, the rest of the day row untouched. */
export async function dropCheat(date: string, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const current = await database.days.get(date);
    if (!current?.cheat) return;
    const { cheat: _dropped, ...rest } = current;
    await database.days.put(rest);
  });
}

/**
 * The cheat meal eaten: one entry in „Zjedzone”, and the plan gone - in one transaction. With
 * `planned`, only while the day still has it: a double tap or a second tab logs it once (`null`).
 */
export async function eatCheat(
  date: string,
  cheat: PlannedCheat,
  { planned = false }: { planned?: boolean } = {},
  database: DietDb = db,
): Promise<number | null> {
  return database.transaction('rw', database.entries, database.days, async () => {
    if (planned && !(await database.days.get(date))?.cheat) return null;
    const name = cheat.name.trim() || say('Większy posiłek', 'Bigger meal');
    const id = await logQuick(date, name, cheat.kcal, cheat, database);
    await dropCheat(date, database);
    return id;
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
      amountLabel: say('z planu', 'from the plan'),
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
      await database.profile.put({ ...inStep(cleanProfile(imported.profile, completeProfile({})), today), id: 'me' });
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
          name: say('Extra kcal z planu', 'Extra kcal from the plan'),
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
  /** Meal-prep plans with their shopping lists; absent in backups made before they existed. */
  prep?: unknown[];
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
    prep: await database.prep.toArray(),
  };
}

/**
 * Replaces everything with a backup; refuses anything that is not one. Every
 * row is checked BEFORE anything is cleared: one unreadable row is dropped
 * (and counted), it does not get stored to break the page afterwards.
 */
export async function restoreAll(backup: unknown, database: DietDb = db): Promise<{ dropped: number }> {
  const b = backup as Partial<Record<keyof Backup, unknown>> | null;
  if (b?.app !== 'produkty-pl' || b.version !== 1) throw new Error(say('To nie jest kopia zapasowa tej aplikacji.', 'This isn’t a backup of this app.'));
  const days = cleanRows(b.days, cleanDay);
  const entries = cleanRows(b.entries, cleanEntry);
  const plans = cleanRows(b.plans, cleanPlan);
  const foods = cleanRows(b.foods, cleanCustomFood);
  const sets = cleanRows(b.sets, cleanSet);
  const favorites = cleanRows(b.favorites, cleanFavorite);
  const prep = cleanRows(b.prep, cleanPrepPlan);
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
      database.prep,
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
        database.prep.clear(),
      ]);
      if (b.profile)
        await database.profile.put({ ...inStep(cleanProfile(b.profile, completeProfile({})), now().date), id: 'me' });
      await database.days.bulkPut(days.rows);
      await database.entries.bulkPut(entries.rows);
      await database.plans.bulkPut(plans.rows);
      await database.foods.bulkPut(foods.rows);
      await database.sets.bulkPut(sets.rows);
      await database.favorites.bulkPut(favorites.rows);
      await database.prep.bulkPut(prep.rows);
    },
  );
  return {
    dropped:
      days.dropped + entries.dropped + plans.dropped + foods.dropped + sets.dropped + favorites.dropped + prep.dropped,
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
      database.prep,
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
        database.prep.clear(),
      ]);
    },
  );
}
