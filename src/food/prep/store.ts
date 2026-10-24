import { db, type DietDb } from '../diet/db';
import { addDays } from '../diet/model';
import { shiftPlan } from './dates';
import { cleanName, type PrepPlan } from './types';

/**
 * Unnamed plans kept on the device: the newest twelve - three months of weekly shopping. A plan
 * with a name is kept until the user deletes it: naming it is saying „this one stays”.
 */
export const KEEP_PLANS = 12;

/** The plan's name: the user's, or the style and the shop („Sportowy · Biedronka”). Dates are shown next to it. */
export function planName(plan: Pick<PrepPlan, 'name' | 'goal' | 'shops'>): string {
  const own = plan.name?.trim();
  if (own) return own;
  return [plan.goal.styleLabel, plan.shops.find((s) => !s.online)?.name].filter(Boolean).join(' · ');
}

/** The plan's last day. */
export const planEnd = (plan: Pick<PrepPlan, 'settings'>): string => addDays(plan.settings.start, plan.settings.days - 1);

export const coversDate = (plan: Pick<PrepPlan, 'settings'>, date: string): boolean =>
  date >= plan.settings.start && date <= planEnd(plan);

/** The newest made first; a plan made in the same millisecond, by its id. */
export function byNewest(a: PrepPlan, b: PrepPlan): number {
  return b.createdAt.localeCompare(a.createdAt) || (b.id ?? 0) - (a.id ?? 0);
}

/** The plan set last first (made, moved or „Ustaw w dzienniku”), then by when it was made. */
export function bySet(a: PrepPlan, b: PrepPlan): number {
  return (b.setAt ?? b.createdAt).localeCompare(a.setAt ?? a.createdAt) || byNewest(a, b);
}

/**
 * The plan a date follows: of the plans whose days include it, the one set last. Making a plan,
 * moving it or choosing it („Ustaw w dzienniku”) is the newest decision; a plan made for next
 * week ahead does not cut the current week short.
 */
export function planCovering(plans: readonly PrepPlan[], date: string): PrepPlan | null {
  return [...plans].sort(bySet).find((p) => coversDate(p, date)) ?? null;
}

/** The days of a plan on which the diary follows another plan. */
export function hiddenDays(plans: readonly PrepPlan[], plan: PrepPlan): string[] {
  const out: string[] = [];
  for (let d = plan.settings.start; d <= planEnd(plan); d = addDays(d, 1))
    if (planCovering(plans, d) !== plan) out.push(d);
  return out;
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
 * The plan a screen shows: the one asked for (`?plan=`, any plan on the device, ended ones too -
 * they are opened from „Moje plany”), else the one running today, else the first one ahead. The
 * plan page, the list and the diary then speak of one plan. Null: nothing running or ahead - the
 * page offers the next plan.
 */
export function shownPlan(plans: readonly PrepPlan[], today: string, wanted: number | null): PrepPlan | null {
  const open = openPlans(plans, today);
  return plans.find((p) => p.id === wanted) ?? planCovering(open, today) ?? open[0] ?? null;
}

/** The first plan the diary follows after `date`: „Plan … zaczyna się …” on a day without one. */
export function nextPlanAfter(plans: readonly PrepPlan[], date: string): PrepPlan | null {
  return openPlans(plans, date).find((p) => p.settings.start > date) ?? null;
}

/** The newest plan made, ended or not: its settings start the next one. */
export function latestPlan(plans: readonly PrepPlan[]): PrepPlan | null {
  return [...plans].sort(byNewest)[0] ?? null;
}

/** Stores a new plan and forgets the oldest unnamed ones beyond `KEEP_PLANS`. Returns its id. */
export async function savePrepPlan(plan: PrepPlan, database: DietDb = db): Promise<number> {
  return database.transaction('rw', database.prep, async () => {
    const { id: _old, ...fresh } = plan;
    const id = await database.prep.add(fresh as PrepPlan);
    const unnamed = (await database.prep.toArray()).filter((p) => !p.name).sort(byNewest);
    const extra = unnamed.slice(KEEP_PLANS).map((p) => p.id!);
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

/** A name of the user's; an empty one brings back the generated name. */
export async function renamePlan(id: number, name: string, database: DietDb = db): Promise<void> {
  const clean = cleanName(name);
  // `undefined` in a Dexie update removes the field: the plan goes back to its generated name.
  await database.prep.update(id, { name: clean || undefined });
}

/**
 * The plan moved to start on `start` (`shiftPlan`) and set to be followed on its new days. Ticks
 * stay unless `clearTicks` - a plan reused for a later week needs its shopping done again.
 */
export async function movePlan(
  id: number,
  start: string,
  clearTicks: boolean,
  database: DietDb = db,
  now = new Date().toISOString(),
): Promise<void> {
  await database.transaction('rw', database.prep, async () => {
    const plan = await database.prep.get(id);
    if (!plan) return;
    await database.prep.put({ ...shiftPlan(plan, start), setAt: now, ...(clearTicks && { bought: [] }), id });
  });
}

/** „Ustaw w dzienniku”: the diary follows this plan on all its days, over any plan made earlier. */
export async function setInDiary(id: number, database: DietDb = db, now = new Date().toISOString()): Promise<void> {
  await database.prep.update(id, { setAt: now });
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
