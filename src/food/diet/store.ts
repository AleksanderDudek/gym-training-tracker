import { say } from '../../i18n';
import { cleanLabPrefs, cleanLabReport } from '../labs/validate';
import { cleanPrepPlan } from '../prep/validate';
import { applyAnswer, CHECK, checkDue, weeklyCheck } from './calibrate';
import { db, type DayRow, type DietDb, type Entry, type PlannedCheat } from './db';
import { bumpFavorite } from './favorites';
import type { Food } from './foods';
import { addDays, mondayOf } from './model';
import type { DayChoices, Plan, PlanItem } from './plan';
import { importPlan, type ImportedPlan } from './plan-import';
import { floorOf, hardMinOf, maintenanceOf, pauseOn, setTarget, targetOn } from './target';
import type { WeighIn } from './trend';
import type { LegacyFields, Profile, WeekCheck } from './types';
import {
  cleanCustomFood,
  cleanDay,
  cleanEntry,
  cleanFavorite,
  cleanPlan,
  cleanProfile,
  cleanRows,
  cleanSet,
  newProfile,
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

/**
 * A complete profile (version 2) from a partial one: the defaults for what is missing (spec §3.5).
 * The target is the starting estimate unless given — 2100 for the default man — and the target
 * history starts with it today, so `targetOn(profile, today)` is `dailyKcal`.
 */
export function completeProfile(partial: Partial<Profile>): Profile {
  return newProfile(partial, now().date);
}

/**
 * Merges the profile into the stored row in one transaction (`{...stored, ...profile}`), so no write
 * path drops a key it does not know — the old model's keys stay in the row untouched. A legacy row
 * is never in the way: the profile comes from `useProfile`, which upgraded it already. `dailyKcal`
 * comes already in step with the target history (`completeProfile`, `applyProfileEdit`).
 */
export async function saveProfile(profile: Profile, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const stored = await database.profile.get('me');
    await database.profile.put({ ...stored, ...profile, id: 'me' });
  });
}

/** The profile page's save, after `applyProfileEdit` (`diet/edit.ts`) worked out the target history. */
export const saveProfileEdit = (next: Profile, database: DietDb = db): Promise<void> => saveProfile(next, database);

/**
 * „Rozumiem” on the upgrade notice: shown once, never again. A row still legacy (the upgrade's own
 * write not done yet, or failed) is upgraded here first, as `persistUpgrade` would.
 */
export async function dismissNotice(ctx: { weightKg: number; today: string }, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const row = await database.profile.get('me');
    if (!row) return;
    const stored = row.version === 2 ? row : { ...row, ...cleanProfile(row, { ...ctx, fresh: false }) };
    if (stored.notice === 'show') await database.profile.put({ ...stored, notice: 'seen', id: 'me' });
  });
}

type StoredProfile = Profile & LegacyFields;

/**
 * Reads the stored profile through the normaliser and writes what `change` makes of it, in one
 * transaction; `null` from `change` writes nothing. Merged into the row, so keys the app does not
 * know stay in it.
 */
async function changeProfile(
  database: DietDb,
  ctx: { today: string; weightKg?: number },
  change: (p: StoredProfile) => StoredProfile | null,
): Promise<StoredProfile | null> {
  return database.transaction('rw', database.profile, async () => {
    const row = await database.profile.get('me');
    if (!row) return null;
    const next = change(cleanProfile(row, ctx));
    if (next) await database.profile.put({ ...row, ...next, id: 'me' });
    return next;
  });
}

/** The latest weigh-in's weight (the newest day), or none. */
export function latestKg(weighIns: readonly WeighIn[] | undefined): number | undefined {
  let latest: WeighIn | undefined;
  for (const w of weighIns ?? []) if (Number.isFinite(w.kg) && w.kg > 0 && (!latest || w.day >= latest.day)) latest = w;
  return latest?.kg;
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
 * The Monday check, its answers, breaks and the upgrade (spec §2.4, §3.4, §3.6): each one
 * transaction over the stored row, read through the normaliser, so two tabs never apply it twice.
 */

/**
 * Writes the upgraded profile once, only while the stored row is still legacy (`useProfile` hands
 * out the upgraded profile at once and calls this). The old keys stay in the row untouched.
 */
export async function persistUpgrade(ctx: { weightKg: number; today: string }, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.profile, async () => {
    const row = await database.profile.get('me');
    if (!row || row.version === 2) return;
    await database.profile.put({ ...row, ...cleanProfile(row, { ...ctx, fresh: false }), id: 'me' });
  });
}

/**
 * Runs this week's check once (`weeklyCheck`, §2.4) and stores what it decided; null when there is
 * nothing to do (done this week, a Monday before 04:00, no profile). Food and day rows are read in
 * the same transaction; the weigh-ins come from the gym weight log.
 */
export async function runWeeklyCheck(
  input: { weighIns: readonly WeighIn[]; today: string; hour: number },
  database: DietDb = db,
): Promise<WeekCheck | null> {
  const monday = mondayOf(input.today);
  const from = addDays(monday, -CHECK.window);
  return database.transaction('rw', [database.profile, database.entries, database.days], async () => {
    const row = await database.profile.get('me');
    if (!row) return null;
    const profile = cleanProfile(row, { today: input.today, weightKg: latestKg(input.weighIns) });
    if (!checkDue(profile, input.today, input.hour)) return null;
    const [entries, days] = await Promise.all([
      database.entries.where('date').between(from, monday, true, false).toArray(),
      database.days.where('date').between(from, monday, true, false).toArray(),
    ]);
    const eaten = new Map<string, number>();
    for (const e of entries) eaten.set(e.date, (eaten.get(e.date) ?? 0) + e.kcal);
    const partial = new Map<string, boolean>();
    for (const d of days) if (typeof d.partial === 'boolean') partial.set(d.date, d.partial);
    const outcome = weeklyCheck({ ...input, profile, eaten, partial });
    if (!outcome) return null;
    await database.profile.put({ ...row, ...outcome.profile, id: 'me' });
    return outcome.check;
  });
}

/** An answer to the Monday card, with its effect, in one transaction (§2.4 „Answers”); a stale card changes nothing. */
export async function answerCheck(
  answer: NonNullable<WeekCheck['answer']>,
  ctx: { today: string; kgNow: number },
  database: DietDb = db,
): Promise<void> {
  await changeProfile(database, { today: ctx.today, weightKg: ctx.kgNow }, (p) => applyAnswer(p, answer, ctx));
}

/**
 * The notice's floor choice for a target under the BMR floor (§3.4): „Podnieś” raises it to the
 * floor; „Zostaw” keeps it as agreed with a doctor or dietitian (never under the hard minimum).
 */
export async function resolveFloor(
  choice: 'raise' | 'keep',
  ctx: { today: string; kgNow: number },
  database: DietDb = db,
): Promise<void> {
  await changeProfile(database, { today: ctx.today, weightKg: ctx.kgNow }, (p) => {
    const floor = floorOf(p, ctx.kgNow);
    if (p.belowFloorOk || p.dailyKcal >= floor) return null;
    if (choice === 'raise') return setTarget(p, floor, ctx.today, 'safety', ctx.today);
    return p.dailyKcal >= hardMinOf(p) ? { ...p, belowFloorOk: true } : null;
  });
}

/** Breaks kept in the profile. */
const PAUSES_KEPT = 12;

/**
 * „Przerwa” (§3.6): maintenance from today for 7 or 14 days, the old target back the day after (a
 * future entry), and the check waits 14 days past the end. Nothing while a break is on.
 */
export async function startPause(days: 7 | 14, ctx: { today: string; kgNow: number }, database: DietDb = db): Promise<void> {
  await changeProfile(database, { today: ctx.today, weightKg: ctx.kgNow }, (p) => {
    if (pauseOn(p, ctx.today)) return null;
    const to = addDays(ctx.today, days - 1);
    const pause = { from: ctx.today, to, kcal: p.dailyKcal };
    const resting = setTarget(p, maintenanceOf(p, ctx.kgNow), ctx.today, 'break', ctx.today);
    const back = setTarget(resting, pause.kcal, addDays(to, 1), 'break', ctx.today);
    return {
      ...back,
      pauses: [...p.pauses, pause].slice(-PAUSES_KEPT),
      settle: { from: addDays(to, CHECK.settleDays + 1), why: 'pause' },
    };
  });
}

/**
 * „Zakończ przerwę” (§3.6): the break ends yesterday (or is gone when it started today), the
 * planned return is dropped, the old target applies from today, and the check waits 14 days.
 */
export async function endPause(ctx: { today: string; kgNow: number }, database: DietDb = db): Promise<void> {
  await changeProfile(database, { today: ctx.today, weightKg: ctx.kgNow }, (p) => {
    const pause = pauseOn(p, ctx.today);
    if (!pause) return null;
    const startedToday = pause.from === ctx.today;
    const pauses = startedToday
      ? p.pauses.filter((x) => x !== pause)
      : p.pauses.map((x) => (x === pause ? { ...x, to: addDays(ctx.today, -1) } : x));
    const planned = (g: { from: string; by: string }) =>
      g.by === 'break' && (g.from > ctx.today || (startedToday && g.from === ctx.today));
    const goals = p.goals.filter((g) => !planned(g));
    const ended = { ...p, pauses, goals, dailyKcal: targetOn({ goals, dailyKcal: p.dailyKcal }, ctx.today) };
    const next = ended.dailyKcal === pause.kcal ? ended : setTarget(ended, pause.kcal, ctx.today, 'break', ctx.today);
    return { ...next, settle: { from: addDays(ctx.today, CHECK.settleDays), why: 'pause' } };
  });
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
 * not quietly undo those edits (or move the start date and the target history).
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
      // A new profile from the workbook's parameters: its target from the start, no upgrade notice.
      await database.profile.put({ ...cleanProfile(imported.profile, { today, fresh: true }), id: 'me' });
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
  /** Lab results and the plan built on them; absent in backups made before they existed. */
  labs?: unknown[];
  labPrefs?: unknown[];
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
    labs: await database.labs.toArray(),
    labPrefs: await database.labPrefs.toArray(),
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
  const labs = cleanRows(b.labs, cleanLabReport);
  const labPrefs = cleanRows(b.labPrefs, cleanLabPrefs);
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
      database.labs,
      database.labPrefs,
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
        database.labs.clear(),
        database.labPrefs.clear(),
      ]);
      // A backup's profile may be either model's: an old one is upgraded (with the notice) as on a first read.
      if (b.profile)
        await database.profile.put({ ...cleanProfile(b.profile, { today: now().date, fresh: false }), id: 'me' });
      await database.days.bulkPut(days.rows);
      await database.entries.bulkPut(entries.rows);
      await database.plans.bulkPut(plans.rows);
      await database.foods.bulkPut(foods.rows);
      await database.sets.bulkPut(sets.rows);
      await database.favorites.bulkPut(favorites.rows);
      await database.prep.bulkPut(prep.rows);
      await database.labs.bulkPut(labs.rows);
      await database.labPrefs.bulkPut(labPrefs.rows);
    },
  );
  return {
    dropped:
      days.dropped +
      entries.dropped +
      plans.dropped +
      foods.dropped +
      sets.dropped +
      favorites.dropped +
      prep.dropped +
      labs.dropped +
      labPrefs.dropped,
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
      database.labs,
      database.labPrefs,
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
        database.labs.clear(),
        database.labPrefs.clear(),
      ]);
    },
  );
}
