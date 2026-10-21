import { addDays, daysBetween } from '../diet/model';
import type { PrepPlan } from './types';

/**
 * Moving a plan to other dates. Cooking blocks follow the day index (`cookingBlocks`), not the
 * weekday, so a plan stays valid when every one of its dates moves by the same number of days:
 * the same recipes, portions, boxes and list, on other days. A different length is a different
 * plan (other portions, another list) - that is „Następny plan”, not a move.
 */

/** How far back a plan may start: a plan begun two weeks ago can still be moved. */
export const MOVE_BACK = 13;
/** How far ahead: reusing a plan for a week up to three months away. */
export const MOVE_AHEAD = 90;

/** The first days a plan may be moved to, as of `today`. */
export const moveRange = (today: string): { min: string; max: string } => ({
  min: addDays(today, -MOVE_BACK),
  max: addDays(today, MOVE_AHEAD),
});

/** The same plan starting on `start`: every date in it moved by the same offset. */
export function shiftPlan(plan: PrepPlan, start: string): PrepPlan {
  const by = daysBetween(plan.settings.start, start);
  if (by === 0) return plan;
  const move = (date: string) => addDays(date, by);
  return {
    ...plan,
    settings: { ...plan.settings, start },
    dayTargets: plan.dayTargets.map((d) => ({ ...d, date: move(d.date) })),
    meals: plan.meals.map((m) => ({ ...m, date: move(m.date) })),
    batches: plan.batches.map((b) => ({ ...b, date: move(b.date), boxes: b.boxes.map((x) => ({ ...x, date: move(x.date) })) })),
    shopping: plan.shopping.map((i) => ({ ...i, freeze: i.freeze.map((f) => ({ ...f, date: move(f.date) })) })),
  };
}
