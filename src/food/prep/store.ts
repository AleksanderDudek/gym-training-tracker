import { db, type DietDb } from '../diet/db';
import { addDays } from '../diet/model';
import type { PrepPlan } from './types';

/** Plans kept on the device: the newest twelve - three months of weekly shopping. */
export const KEEP_PLANS = 12;

/** The plan's last day. */
export const planEnd = (plan: Pick<PrepPlan, 'settings'>): string => addDays(plan.settings.start, plan.settings.days - 1);

export const coversDate = (plan: Pick<PrepPlan, 'settings'>, date: string): boolean =>
  date >= plan.settings.start && date <= planEnd(plan);

/** The newest made first; a plan made in the same millisecond, by its id. */
export function byNewest(a: PrepPlan, b: PrepPlan): number {
  return b.createdAt.localeCompare(a.createdAt) || (b.id ?? 0) - (a.id ?? 0);
}

/**
 * The plan a date follows: the newest one made whose days include it. A plan made later is the
 * newer decision; one made for next week ahead does not cut the current week short.
 */
export function planCovering(plans: readonly PrepPlan[], date: string): PrepPlan | null {
  return [...plans].sort(byNewest).find((p) => coversDate(p, date)) ?? null;
}

/** The plan the plan page shows: the newest one made that has not ended yet. */
export function currentPlan(plans: readonly PrepPlan[], today: string): PrepPlan | null {
  return [...plans].sort(byNewest).find((p) => planEnd(p) >= today) ?? null;
}

/** The newest plan made, ended or not: its settings start the next one. */
export function latestPlan(plans: readonly PrepPlan[]): PrepPlan | null {
  return [...plans].sort(byNewest)[0] ?? null;
}

/** Stores a new plan and forgets the oldest beyond `KEEP_PLANS`. Returns its id. */
export async function savePrepPlan(plan: PrepPlan, database: DietDb = db): Promise<number> {
  return database.transaction('rw', database.prep, async () => {
    const { id: _old, ...fresh } = plan;
    const id = await database.prep.add(fresh as PrepPlan);
    const all = (await database.prep.toArray()).sort(byNewest);
    const extra = all.slice(KEEP_PLANS).map((p) => p.id!);
    if (extra.length) await database.prep.bulkDelete(extra);
    return id;
  });
}

/** The same plan, changed (another seed, a swapped recipe): stored under its id. */
export async function replacePrepPlan(plan: PrepPlan & { id: number }, database: DietDb = db): Promise<void> {
  await database.prep.put(plan);
}

export async function deletePrepPlan(id: number, database: DietDb = db): Promise<void> {
  await database.prep.delete(id);
}

/** Ticks a shopping line, or takes the tick off. */
export async function toggleBought(id: number, key: string, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.prep, async () => {
    const plan = await database.prep.get(id);
    if (!plan) return;
    const bought = plan.bought.includes(key) ? plan.bought.filter((k) => k !== key) : [...plan.bought, key];
    await database.prep.put({ ...plan, bought });
  });
}

/** Every tick off at once ("Odznacz wszystko"). */
export async function clearBought(id: number, database: DietDb = db): Promise<void> {
  await database.prep.update(id, { bought: [] });
}
