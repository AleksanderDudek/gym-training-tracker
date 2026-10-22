import { describe, expect, test } from 'vitest';
import type { MoveDay } from '../../bridge';
import { activityOn } from '../../diet/activity';
import { completeProfile } from '../../diet/store';
import { activityParts, pendingParts } from './activityText';

const p = completeProfile({ dailyKcal: 2000 });
/** Polish numbers group with a no-break space — compared as plain spaces. */
const plain = (t: string | undefined) => t?.replace(/\s/g, ' ');
const move = (over: Partial<MoveDay> = {}): MoveDay => ({
  trained: false,
  workoutKcal: 0,
  cardioKcal: 0,
  otherKcal: 0,
  planned: null,
  planActive: true,
  typicalWorkoutKcal: 300,
  workouts: 0,
  snacks: 0,
  outings: 0,
  activeMin: 0,
  stepsWorth: null,
  ...over,
});

describe('steps in words', () => {
  test('the worth is named only when it differs from the count', () => {
    const run = activityOn(p, 80, move({ stepsWorth: 15_000 }), 12_000, 'past');
    expect(plain(activityParts(run)[0])).toBe('+160 kcal za kroki (12 000 zamiast 10 000; w rachunku jak 15 000 — rozpis w „Kroki i cardio”)');
    const same = activityOn(p, 80, move({ stepsWorth: 12_100 }), 12_000, 'past');
    expect(plain(activityParts(same)[0])).toBe('+70 kcal za kroki (12 000 zamiast 10 000)');
  });

  test('what is still missing today is counted from the worth', () => {
    const a = activityOn(p, 80, move({ stepsWorth: 7000 }), 6000, 'today');
    expect(pendingParts(a)[0]).toMatch(/^3000 kroków do celu/);
  });
});
