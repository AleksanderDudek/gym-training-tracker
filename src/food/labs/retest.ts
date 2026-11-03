import { addDays } from '../diet/model';
import type { FocusId } from './assess';
import { FOCUS } from './focus';
import { MARKERS } from './markers';
import type { LabPlan } from './types';

/**
 * When and what to retest after the diet plan for the results: the longest wait of the plan's
 * focuses (at least four weeks), and their markers together. One rule for the labs page, the
 * calendar and the export.
 */
export const MIN_RETEST_WEEKS = 4;

export function retestWeeks(ids: readonly FocusId[]): number {
  return Math.max(...ids.map((id) => FOCUS[id].retestWeeks), MIN_RETEST_WEEKS);
}

/** Marker ids to retest, each once, only the ones the catalog knows. */
export function retestMarkers(ids: readonly FocusId[]): string[] {
  return [...new Set(ids.flatMap((id) => FOCUS[id].retest))].filter((m) => MARKERS[m]);
}

/** The plan's known focuses (a backup may carry one a newer version added). */
export const planFocus = (plan: LabPlan): FocusId[] => plan.focus.filter((f) => f in FOCUS) as FocusId[];

/** The retest of a started plan: its date and markers. */
export function retestOf(plan: LabPlan): { date: string; markers: string[] } {
  const ids = planFocus(plan);
  return { date: addDays(plan.start, retestWeeks(ids) * 7), markers: retestMarkers(ids) };
}
