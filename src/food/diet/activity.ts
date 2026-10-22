import type { MoveDay } from '../bridge';
import type { Profile } from './types';

/**
 * The day's goal against what really moved. The goal already contains the PLANNED activity - the
 * steps of `targetSteps` and the trainings the activity multiplier assumes - so adding everything
 * the gym engine burned would count it twice. What changes the goal is only the difference:
 *
 * - steps: the diet's own walking formula at the day's steps minus the same at `targetSteps`;
 * - training: what was done (gym engine kcal) minus what was planned - the session the training
 *   plan put on that day, or, without a plan, the profile's weekly assumption spread over the week;
 * - other exercise (treadmill, bike, dance, exercise snacks): planned at zero, so all of it counts.
 *
 * A closed day counts in full. Today counts what already happened (steps above the target, a
 * training done, extra cardio) and keeps what may still be missing - steps short of the target, a
 * planned training not done yet - as `pending`: steps pile up all day and trainings are often in
 * the evening. The cheat-meal simulation passes the user's guesses for the rest of today instead.
 */

export type Phase = 'past' | 'today' | 'future';

/** The user's guesses for the rest of today, in the simulation. */
export interface Assumptions {
  /** Steps the day ends with; `null` - as logged now. */
  steps: number | null;
  /**
   * The training still ahead today: `planned` - as planned (the plan's session happens, or no
   * session without one), `none` - no training today, `extra` - one more training than planned.
   */
  training: 'planned' | 'none' | 'extra';
}

export interface Activity {
  /** Counted into the goal now, kcal (positive: more to eat). */
  kcal: number;
  /** May still be taken off today (≤ 0): steps short of the target, a planned training not done. */
  pending: number;
  /** `kcal` counted now; `pending` may still be taken off today (steps short of the target). */
  steps: { planned: number; actual: number | null; kcal: number; pending: number };
  training: {
    /** What the goal assumes for this day, kcal. */
    planned: number;
    /** The plan's session for the day, when there is a plan and a session. */
    plannedName: string | null;
    /** Where the plan comes from: the training plan, the profile's assumption, or nothing planned. */
    source: 'plan' | 'profile' | 'none';
    done: number;
    trained: boolean;
    /** Counted now. */
    kcal: number;
    /** May still be taken off today: the planned session not done yet. */
    pending: number;
  };
  /** Cardio other than steps and exercise snacks, kcal - all extra. */
  other: number;
  /** The difference hit the sanity cap. */
  capped: boolean;
}

/** A session when nothing better is known: about an hour of strength training. */
export const TYPICAL_FALLBACK_KCAL = 250;

/** Bounds of the difference, as shares of the base goal: a typo must not double the goal. */
export const CAP = { min: -0.3, max: 0.6 } as const;

/** Walking above the steps the multiplier already holds, kcal - `tdee`'s formula. */
export function walkingKcal(p: Profile, kg: number, steps: number): number {
  return (Math.max(0, steps - p.baseSteps) / 1000) * kg * p.kcalPer1000StepsPerKg;
}

/** Trainings a week the activity presets assume (1.2: none, 1.28 and 1.375: two, 1.55: four). */
const PRESETS: [number, number][] = [
  [1.2, 0],
  [1.28, 2],
  [1.375, 2],
  [1.55, 4],
];

export function assumedSessions(multiplier: number): number {
  return PRESETS.reduce((best, p) => (Math.abs(p[0] - multiplier) < Math.abs(best[0] - multiplier) ? p : best))[1];
}

export interface PlannedTraining {
  kcal: number;
  name: string | null;
  source: Activity['training']['source'];
}

/**
 * What the goal assumes about training on a day with this move data. Without a training plan the
 * profile's assumption applies only to someone who logs trainings here (`typicalWorkoutKcal`): for
 * anyone else a day without a logged training is not a day without training - they may train and
 * not log it - so nothing is assumed missing.
 */
export function plannedTraining(p: Profile, move: MoveDay): PlannedTraining {
  if (move.planActive) {
    const typical = move.typicalWorkoutKcal ?? TYPICAL_FALLBACK_KCAL;
    return move.planned
      ? { kcal: move.planned.kcal ?? typical, name: move.planned.name, source: 'plan' }
      : { kcal: 0, name: null, source: 'plan' };
  }
  const sessions = assumedSessions(p.activityMultiplier);
  return sessions && move.typicalWorkoutKcal !== null
    ? { kcal: (sessions * move.typicalWorkoutKcal) / 7, name: null, source: 'profile' }
    : { kcal: 0, name: null, source: 'none' };
}

const ZERO = (p: Profile): Activity => ({
  kcal: 0,
  pending: 0,
  steps: { planned: p.targetSteps, actual: null, kcal: 0, pending: 0 },
  training: { planned: 0, plannedName: null, source: 'none', done: 0, trained: false, kcal: 0, pending: 0 },
  other: 0,
  capped: false,
});

export function activityOn(
  p: Profile,
  kg: number,
  move: MoveDay,
  steps: number | null,
  phase: Phase,
  assumptions?: Assumptions,
): Activity {
  if (phase === 'future') return ZERO(p);
  const typical = move.typicalWorkoutKcal ?? TYPICAL_FALLBACK_KCAL;
  const plannedWalk = walkingKcal(p, kg, p.targetSteps);

  // Steps. A closed day without steps is not guessed: it went by plan.
  let stepsKcal = 0;
  let stepsPending = 0;
  if (phase === 'past') stepsKcal = steps === null ? 0 : walkingKcal(p, kg, steps) - plannedWalk;
  else if (assumptions) stepsKcal = walkingKcal(p, kg, assumptions.steps ?? steps ?? 0) - plannedWalk;
  else {
    const delta = walkingKcal(p, kg, steps ?? 0) - plannedWalk;
    stepsKcal = Math.max(0, delta);
    stepsPending = Math.min(0, delta);
  }

  // Training. Done is real; what is not done yet is a guess today and a fact on a closed day.
  const plan = plannedTraining(p, move);
  const trained = move.trained || (move.workoutKcal ?? 0) > 0;
  const done = move.workoutKcal ?? 0;
  let trainingKcal = 0;
  let trainingPending = 0;
  if (trained) trainingKcal = done - plan.kcal;
  else if (phase === 'past') trainingKcal = -plan.kcal;
  else if (assumptions)
    trainingKcal = assumptions.training === 'none' ? -plan.kcal : assumptions.training === 'extra' ? typical : 0;
  else trainingPending = -plan.kcal;
  // One more training than planned on a day that already had one.
  if (trained && assumptions?.training === 'extra') trainingKcal += typical;

  const other = move.otherKcal ?? 0;
  const raw = stepsKcal + trainingKcal + other;
  const min = CAP.min * p.dailyKcal;
  const max = CAP.max * p.dailyKcal;
  const kcal = Math.min(max, Math.max(min, raw));
  const pending = Math.max(min - kcal, stepsPending + trainingPending);
  const round = (n: number) => Math.round(n / 10) * 10 || 0;

  return {
    kcal: round(kcal),
    pending: round(pending),
    steps: { planned: p.targetSteps, actual: steps, kcal: round(stepsKcal), pending: round(stepsPending) },
    training: {
      planned: Math.round(plan.kcal),
      plannedName: plan.name,
      source: plan.source,
      done: Math.round(done),
      trained,
      kcal: round(trainingKcal),
      pending: round(trainingPending),
    },
    other: Math.round(other),
    capped: raw !== kcal,
  };
}
