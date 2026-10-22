import { describe, expect, test } from 'vitest';
import type { MoveDay } from '../bridge';
import { TYPICAL_FALLBACK_KCAL, activityOn, assumedSessions, plannedTraining, walkingKcal } from './activity';
import { completeProfile } from './store';

/**
 * The goal against real activity: only the difference between planned and done changes it. The
 * default profile walks 10 000 steps a day (4 000 already in the multiplier), weighs 80 kg and
 * assumes two trainings a week (1.28): 10 000 steps are 6 × 80 × 0.4 = 192 kcal of walking.
 */

const p = completeProfile({ dailyKcal: 2000 });
const KG = 80;

const move = (over: Partial<MoveDay> = {}): MoveDay => ({
  trained: false,
  workoutKcal: 0,
  cardioKcal: 0,
  otherKcal: 0,
  planned: null,
  planActive: false,
  typicalWorkoutKcal: 300,
  ...over,
});

describe('steps', () => {
  test('the walking formula is the one in the goal', () => {
    expect(walkingKcal(p, KG, 10_000)).toBeCloseTo(192);
    expect(walkingKcal(p, KG, 3000)).toBe(0);
  });

  test('a closed day: steps above the target add, below take off; unknown steps change nothing', () => {
    expect(activityOn(p, KG, move({ planActive: true }), 12_000, 'past').kcal).toBe(60);
    expect(activityOn(p, KG, move({ planActive: true }), 5000, 'past').kcal).toBe(-160);
    expect(activityOn(p, KG, move({ planActive: true }), null, 'past').kcal).toBe(0);
  });

  test('today: a surplus counts at once, a shortfall waits as pending', () => {
    const ahead = activityOn(p, KG, move({ planActive: true }), 12_000, 'today');
    expect(ahead.kcal).toBe(60);
    expect(ahead.pending).toBe(0);
    const morning = activityOn(p, KG, move({ planActive: true }), 1500, 'today');
    expect(morning.kcal).toBe(0);
    expect(morning.pending).toBe(-190);
  });

  test('the simulation takes the user’s steps for the end of the day', () => {
    const a = activityOn(p, KG, move({ planActive: true }), 1500, 'today', { steps: 5000, training: 'planned' });
    expect(a.kcal).toBe(-160);
    expect(a.pending).toBe(0);
  });

  test('a future day changes nothing', () => {
    expect(activityOn(p, KG, move({ planActive: true, planned: { name: 'A', kcal: 300 } }), null, 'future').kcal).toBe(0);
  });
});

describe('training against the training plan', () => {
  const plannedA = move({ planActive: true, planned: { name: 'Trening A', kcal: 320 } });

  test('the planned session done as estimated changes nothing; longer or shorter changes the difference', () => {
    expect(activityOn(p, KG, { ...plannedA, trained: true, workoutKcal: 320 }, 10_000, 'past').kcal).toBe(0);
    expect(activityOn(p, KG, { ...plannedA, trained: true, workoutKcal: 400 }, 10_000, 'past').kcal).toBe(80);
  });

  test('a planned session skipped: a closed day loses it, today keeps it pending', () => {
    expect(activityOn(p, KG, plannedA, 10_000, 'past').kcal).toBe(-320);
    const today = activityOn(p, KG, plannedA, 10_000, 'today');
    expect(today.kcal).toBe(0);
    expect(today.pending).toBe(-320);
    expect(today.training).toMatchObject({ plannedName: 'Trening A', source: 'plan', planned: 320 });
  });

  test('an unplanned session adds all of it; a rest day by plan is no loss', () => {
    expect(activityOn(p, KG, move({ planActive: true, trained: true, workoutKcal: 280 }), 10_000, 'today').kcal).toBe(280);
    const rest = activityOn(p, KG, move({ planActive: true }), 10_000, 'past');
    expect(rest.kcal).toBe(0);
    expect(rest.pending).toBe(0);
  });

  test('the simulation: “no training today” takes the session off, “extra” adds a typical one', () => {
    expect(activityOn(p, KG, plannedA, 10_000, 'today', { steps: null, training: 'none' }).kcal).toBe(-320);
    expect(activityOn(p, KG, plannedA, 10_000, 'today', { steps: null, training: 'planned' }).kcal).toBe(0);
    expect(activityOn(p, KG, move({ planActive: true }), 10_000, 'today', { steps: null, training: 'extra' }).kcal).toBe(300);
  });
});

describe('training without a plan: the profile’s assumption', () => {
  test('sessions a week from the activity presets', () => {
    expect(assumedSessions(1.2)).toBe(0);
    expect(assumedSessions(1.28)).toBe(2);
    expect(assumedSessions(1.375)).toBe(2);
    expect(assumedSessions(1.55)).toBe(4);
    expect(assumedSessions(1.9)).toBe(4);
  });

  test('two sessions of a typical 300 kcal spread over the week', () => {
    expect(plannedTraining(p, move())).toEqual({ kcal: (2 * 300) / 7, name: null, source: 'profile' });
    // Nobody logs trainings here: a day without a logged one is not a day without training.
    expect(plannedTraining(p, move({ typicalWorkoutKcal: null }))).toEqual({ kcal: 0, name: null, source: 'none' });
    expect(activityOn(p, KG, move({ typicalWorkoutKcal: null }), 10_000, 'past').kcal).toBe(0);
    // With a training plan, a session without an estimate falls back to a typical hour.
    expect(plannedTraining(p, move({ planActive: true, planned: { name: 'A', kcal: null }, typicalWorkoutKcal: null })).kcal).toBe(
      TYPICAL_FALLBACK_KCAL,
    );
    expect(plannedTraining(completeProfile({ activityMultiplier: 1.2 }), move()).source).toBe('none');
  });

  test('a training day beats the average, a closed rest day falls short of it', () => {
    expect(activityOn(p, KG, move({ trained: true, workoutKcal: 300 }), 10_000, 'past').kcal).toBe(210);
    expect(activityOn(p, KG, move(), 10_000, 'past').kcal).toBe(-90);
  });
});

describe('other exercise and the cap', () => {
  test('treadmill, bike, dance and exercise snacks add in full - beyond the extra exercise the profile plans', () => {
    expect(activityOn(p, KG, move({ planActive: true, otherKcal: 150 }), 10_000, 'today').kcal).toBe(150);
    // 1400 kcal of planned extra exercise a week is 200 a day, already in the goal.
    const extra = completeProfile({ dailyKcal: 2000, extraWeeklyKcal: 1400 });
    expect(activityOn(extra, KG, move({ planActive: true, otherKcal: 200 }), 10_000, 'past').kcal).toBe(0);
    expect(activityOn(extra, KG, move({ planActive: true, otherKcal: 350 }), 10_000, 'past').kcal).toBe(150);
    expect(activityOn(extra, KG, move({ planActive: true, otherKcal: 0 }), 10_000, 'past').kcal).toBe(0);
  });

  test('a training without calories (no weighing yet) is no shortfall', () => {
    const planned = move({ planActive: true, planned: { name: 'A', kcal: null }, trained: true, workoutKcal: null });
    expect(activityOn(p, KG, planned, 10_000, 'past').kcal).toBe(0);
  });

  test('a typo of a day is capped at +60 % and −30 % of the goal', () => {
    const typo = activityOn(p, KG, move({ planActive: true }), 100_000, 'past');
    expect(typo.kcal).toBe(1200);
    expect(typo.capped).toBe(true);
    const lazy = activityOn(p, KG, move({ planActive: true, planned: { name: 'A', kcal: 900 } }), 0, 'past');
    expect(lazy.kcal).toBe(-600);
  });
});
