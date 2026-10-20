import { db, type DietDb } from '../diet/db';
import { addDays } from '../diet/model';
import { saveProfile } from '../diet/store';
import type { Profile } from '../diet/types';
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

/**
 * The plans still worth showing, in the order they run: each one the diary follows on at least one
 * day from today on. A plan made again for the same week (the newer covers all of the older one's
 * days) drops out; the week running now and the one planned ahead both stay.
 */
export function openPlans(plans: readonly PrepPlan[], today: string): PrepPlan[] {
  return plans
    .filter((p) => {
      for (let d = p.settings.start < today ? today : p.settings.start; d <= planEnd(p); d = addDays(d, 1))
        if (planCovering(plans, d) === p) return true;
      return false;
    })
    .sort((a, b) => a.settings.start.localeCompare(b.settings.start) || byNewest(a, b));
}

/**
 * The plan a screen shows: the one asked for (`?plan=`) while it is open, else the one running
 * today, else the first one ahead. The plan page, the list and the diary then speak of one plan.
 */
export function shownPlan(plans: readonly PrepPlan[], today: string, wanted: number | null): PrepPlan | null {
  const open = openPlans(plans, today);
  return open.find((p) => p.id === wanted) ?? planCovering(open, today) ?? open[0] ?? null;
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

/**
 * A new plan and, when the check-in changed the goal, the profile with it: both or neither. A plan
 * saved without its goal (or the goal without its plan) would make the diary and the plan disagree.
 */
export async function startPlan(plan: PrepPlan, profile: Profile | null, database: DietDb = db): Promise<number> {
  return database.transaction('rw', database.prep, database.profile, async () => {
    const id = await savePrepPlan(plan, database);
    if (profile) await saveProfile(profile, database);
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

/**
 * A line ticked or not, as the checkbox now shows it. Idempotent: two quick taps in flight end as
 * the last one says, never in the opposite state.
 */
export async function markBought(id: number, key: string, bought: boolean, database: DietDb = db): Promise<void> {
  await database.transaction('rw', database.prep, async () => {
    const plan = await database.prep.get(id);
    if (!plan || plan.bought.includes(key) === bought) return;
    await database.prep.put({ ...plan, bought: withTick(plan.bought, key, bought) });
  });
}

const withTick = (list: string[], key: string, on: boolean): string[] =>
  on ? [...list.filter((k) => k !== key), key] : list.filter((k) => k !== key);

/** Every tick off at once ("Odznacz wszystko"). */
export async function clearBought(id: number, database: DietDb = db): Promise<void> {
  await database.prep.update(id, { bought: [] });
}
