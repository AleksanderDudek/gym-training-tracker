import { useContext, useMemo } from 'react';
import { BridgeContext } from '../bridge';
import { activityOn, type Activity, type Assumptions } from '../diet/activity';
import type { Profile } from '../diet/types';

/** The day's activity against the plan, for a date; with the user's guesses for the rest of today. */
export type ActivityOf = (date: string, assumptions?: Assumptions) => Activity;

/**
 * Weight on a date from the gym's weighings: the last one up to it; before the first, the first -
 * as the gym engine counts calories. `null` without any weighing.
 */
export function weightFrom(weights: readonly { day: string; kg: number }[], date: string): number | null {
  let kg: number | null = weights[0]?.kg ?? null;
  for (const w of weights) if (w.day <= date) kg = w.kg;
  return kg;
}

/**
 * Activity of any day, from the gym data through the bridge - steps, trainings, the training plan.
 * `null` when the profile does not want the goal to follow activity, or without a bridge (a card
 * drawn outside the app's provider has no activity to follow). Days before `today` are closed,
 * `today` counts what already happened, later days nothing.
 */
export function useActivity(profile: Profile | null | undefined, today: string): ActivityOf | null {
  const bridge = useContext(BridgeContext);
  return useMemo(() => {
    if (!profile || profile.adaptActivity === false || !bridge) return null;
    return (date, assumptions) => {
      const phase = date < today ? 'past' : date === today ? 'today' : 'future';
      const kg = weightFrom(bridge.weights, date) ?? profile.startWeightKg;
      return activityOn(profile, kg, bridge.moveOn(date), bridge.stepsOn(date), phase, assumptions);
    };
  }, [profile, today, bridge]);
}

/** The goal's activity part for `dayGoal`: kcal counted now. */
export const activityKcalOf = (activity: ActivityOf | null) =>
  activity ? (date: string) => activity(date).kcal : undefined;
