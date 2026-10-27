import { db as defaultDb, type DietDb } from '../diet/db';
import { addDays, mondayOf } from '../diet/model';
import { DEFAULT_PREFS, type LabPrefs, type LabReport } from './types';
import { cleanLabPrefs, cleanLabReport } from './validate';

/** Lab reports, newest first. Every row goes through the cleaner: an old or broken row never reaches the page. */
export async function loadReports(database: DietDb = defaultDb): Promise<LabReport[]> {
  const rows = await database.labs.toArray();
  return rows
    .map(cleanLabReport)
    .filter((r): r is LabReport => r !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0));
}

/** Saves a report; one already stored for the same day and lab takes the new results in (a second page of the same visit). */
export async function saveReport(report: Omit<LabReport, 'id'>, database: DietDb = defaultDb): Promise<number> {
  const clean = cleanLabReport(report);
  if (!clean) throw new Error('empty report');
  return database.transaction('rw', database.labs, async () => {
    const same = (await database.labs.where('date').equals(clean.date).toArray()).find((r) => r.lab === clean.lab);
    if (!same?.id) return database.labs.add(clean);
    const fresh = new Set(clean.results.map((r) => r.marker));
    await database.labs.put({ ...same, results: [...same.results.filter((r) => !fresh.has(r.marker)), ...clean.results] });
    return same.id;
  });
}

export async function replaceReport(report: LabReport, database: DietDb = defaultDb): Promise<void> {
  const clean = cleanLabReport(report);
  if (!clean?.id) throw new Error('bad report');
  await database.labs.put(clean);
}

export async function deleteReport(id: number, database: DietDb = defaultDb): Promise<void> {
  await database.labs.delete(id);
}

export async function loadPrefs(database: DietDb = defaultDb): Promise<LabPrefs> {
  return cleanLabPrefs(await database.labPrefs.get('me')) ?? DEFAULT_PREFS;
}

export async function savePrefs(patch: Partial<Omit<LabPrefs, 'id'>>, database: DietDb = defaultDb): Promise<void> {
  await database.transaction('rw', database.labPrefs, async () => {
    const current = cleanLabPrefs(await database.labPrefs.get('me')) ?? DEFAULT_PREFS;
    await database.labPrefs.put({ ...current, ...patch, id: 'me' });
  });
}

/** +1 or −1 on a habit for a day; never below zero, and a day row is created only for a +1. */
export async function tickHabit(date: string, habit: string, delta: 1 | -1, database: DietDb = defaultDb): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const day = await database.days.get(date);
    const habits = { ...day?.labHabits };
    const next = Math.max(0, Math.min(20, (habits[habit] ?? 0) + delta));
    if (next === 0) delete habits[habit];
    else habits[habit] = next;
    if (!day) {
      if (delta > 0) await database.days.put({ date, labHabits: habits });
      return;
    }
    await database.days.put({ ...day, labHabits: habits });
  });
}

/** The week (Monday to Sunday) around `date`: habit id → times, and today's own counts. */
export async function habitWeek(date: string, database: DietDb = defaultDb): Promise<{ week: Record<string, number>; today: Record<string, number> }> {
  const monday = mondayOf(date);
  const days = await database.days.where('date').between(monday, addDays(monday, 6), true, true).toArray();
  const week: Record<string, number> = {};
  for (const d of days) for (const [k, v] of Object.entries(d.labHabits ?? {})) week[k] = (week[k] ?? 0) + v;
  return { week, today: { ...days.find((d) => d.date === date)?.labHabits } };
}
