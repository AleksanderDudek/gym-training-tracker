/**
 * The check-in plans were once made with (spec 2026-10-24 §2.8, §4.7). The goal is now fitted for
 * everyone by the Monday check (`diet/calibrate.ts`); a new plan takes today's target from the
 * diet profile and stores no check-in. What stays is the shape of a check-in inside plans stored
 * before — read back by the validator (`validate.ts`) and shown as „(dopasowany do postępów)”.
 */

/** The statuses a stored check-in can have. */
export const CHECK_IN_STATUSES = ['za-malo-danych', 'zgodnie', 'korekta', 'cel'] as const;

export type CheckInStatus = (typeof CHECK_IN_STATUSES)[number];

/** A check-in as stored in an older plan (`PrepPlan.checkIn`). */
export interface CheckIn {
  status: CheckInStatus;
  today: string;
  /** Weigh-ins in the window. */
  weighIns: number;
  /** Days logged in full (at least half the goal) between the first and the last weigh-in. */
  loggedDays: number;
  /** Days between the first and the last weigh-in. */
  spanDays: number;
  /** The trend's weight at the last weigh-in. */
  trendKg: number | null;
  /** kg a week, positive is losing. */
  observedPace: number | null;
  /** What the goal gave at the trend weight by the (corrected) model: the pace aimed at. */
  plannedPace: number;
  observedTdee: number | null;
  /** The model's expenditure at the trend weight, with the corrections already measured. */
  modelTdee: number;
  profileKcal: number;
  /** The goal suggested for the plan: the profile's when nothing needed to change. */
  suggestedKcal: number;
  /** The model's correction with this check-in. */
  correction: number;
  /** Why the suggestion was not the full correction: the floor (BMR, a minimum) or the step cap. */
  limited: 'floor' | 'cap' | null;
  reason: string;
}
