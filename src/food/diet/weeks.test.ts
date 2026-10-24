import { describe, expect, test } from 'vitest';
import { addDays } from './model';
import { isComplete } from './target';
import type { WeighIn } from './trend';
import { findings, MIN_WEEKS, onGoal, weekRows, type DayFacts } from './weeks';

/**
 * Weeks side by side and what goes with progress. 2026-10-22 is a Thursday, so the current week
 * (from 2026-10-19) is unfinished; the weeks before it start on Mondays 7 days apart.
 */

const TODAY = '2026-10-22';
const THIS_MONDAY = '2026-10-19';
const STEPS = 8000;

/** A day as the progress page builds it: its own target, and whether it counts (today never). */
const day = (date: string, over: Partial<DayFacts> & { partial?: boolean } = {}): DayFacts => {
  const { partial, ...rest } = over;
  const base = { date, eaten: 2000, goal: 2000, steps: 8000, workouts: 0, snacks: 0, outings: 0, ...rest };
  return { ...base, complete: date < TODAY && isComplete(base.eaten, partial, base.goal) };
};

interface WeekPlan {
  /** Weight change over the week, kg. */
  change: number;
  workouts?: number;
  eaten?: number;
  steps?: number;
}

/**
 * Finished weeks, oldest first, ending the week before the current one; weigh-ins every Monday,
 * Wednesday and Friday on a straight line (and the next Monday), so the slope is exactly the planned
 * change.
 */
function history(plans: WeekPlan[], startKg = 90) {
  const days: DayFacts[] = [];
  const weighIns: WeighIn[] = [];
  let kg = startKg;
  plans.forEach((p, i) => {
    const monday = addDays(THIS_MONDAY, -7 * (plans.length - i));
    for (let d = 0; d < 7; d++)
      days.push(
        day(addDays(monday, d), {
          workouts: d < (p.workouts ?? 0) ? 1 : 0,
          eaten: p.eaten ?? 2000,
          steps: p.steps ?? 8000,
        }),
      );
    for (const d of [0, 2, 4]) weighIns.push({ day: addDays(monday, d), kg: kg + (p.change * d) / 7 });
    kg += p.change;
  });
  weighIns.push({ day: THIS_MONDAY, kg });
  return { days, weighIns };
}

const rowsOf = (plans: WeekPlan[]) => {
  const { days, weighIns } = history(plans);
  return weekRows({ days, weighIns, today: TODAY, stepsGoal: STEPS, weeks: plans.length + 1 });
};

describe('weeks', () => {
  test('a week: slope of its weigh-ins in kg a week, complete-day averages, counts; days after today left out', () => {
    const rows = rowsOf([{ change: -0.5, workouts: 3, eaten: 1900, steps: 9000 }]);
    const last = rows.find((r) => r.monday === '2026-10-12')!;
    expect(last.complete).toBe(true);
    expect(last.weight?.change).toBeCloseTo(-0.5, 6);
    expect(last.weight?.weighIns).toBe(4);
    expect(last.eaten).toEqual({ avg: 1900, days: 7 });
    expect(last.steps).toEqual({ avg: 9000, goalDays: 7 });
    expect(last.workouts).toBe(3);
    // The current week: Monday to today, only its Monday weigh-in - no slope yet.
    const now = rows[0]!;
    expect(now.monday).toBe(THIS_MONDAY);
    expect(now.complete).toBe(false);
    expect(now.days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
    expect(now.weight).toBeNull();
  });

  test('today is not over: its food and steps stay out of the week’s averages', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21'].map((d) => day(d, { eaten: 1800, steps: 9000 }));
    days.push(day(TODAY, { eaten: 1900, steps: 1200 }));
    const [now] = weekRows({ days, weighIns: [], today: TODAY, stepsGoal: STEPS });
    expect(now!.days).toHaveLength(4);
    expect(now!.eaten).toEqual({ avg: 1800, days: 3 });
    expect(now!.steps).toEqual({ avg: 9000, goalDays: 3 });
  });

  test('a day logged under 60 % of its target, or marked incomplete, stays out of the food average', () => {
    const monday = '2026-10-12';
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d, i) =>
      day(d, i === 1 ? { eaten: 400 } : i === 3 ? { eaten: 1900, partial: true } : { eaten: 2000 }),
    );
    const week = weekRows({ days, weighIns: [], today: TODAY, stepsGoal: STEPS }).find((r) => r.monday === monday)!;
    expect(week.eaten).toEqual({ avg: 2000, days: 5 });
    // Only incomplete days logged: the week is there, its food average is not.
    const thin = weekRows({ days: [day(monday, { eaten: 400 })], weighIns: [], today: TODAY, stepsGoal: STEPS });
    expect(thin.map((r) => r.monday)).toEqual([monday]);
    expect(thin[0]!.eaten).toBeNull();
  });

  test('a week’s change needs three weigh-ins at least four days apart; a week with nothing is left out', () => {
    const rows = (weighIns: WeighIn[]) => weekRows({ days: [], weighIns, today: TODAY, stepsGoal: STEPS });
    const two = rows([
      { day: '2026-10-05', kg: 90 },
      { day: '2026-10-09', kg: 89.6 },
    ]);
    expect(two.map((r) => r.monday)).toEqual(['2026-10-05']);
    expect(two[0]!.weight).toBeNull();
    const close = rows([
      { day: '2026-10-05', kg: 90 },
      { day: '2026-10-06', kg: 89.9 },
      { day: '2026-10-07', kg: 89.8 },
    ]);
    expect(close[0]!.weight).toBeNull();
    const three = rows([
      { day: '2026-10-05', kg: 90 },
      { day: '2026-10-07', kg: 89.8 },
      { day: '2026-10-09', kg: 89.6 },
    ]);
    expect(three[0]!.weight).toEqual({ change: expect.closeTo(-0.7, 6) as number, weighIns: 3 });
  });

  test('on the goal on the ±100 kcal band: losing - not over it, gaining - not under it, keeping - within it', () => {
    expect(onGoal(2100, 2000, 'loss')).toBe(true);
    expect(onGoal(2101, 2000, 'loss')).toBe(false);
    expect(onGoal(1500, 2000, 'loss')).toBe(true);
    expect(onGoal(1900, 2000, 'gain')).toBe(true);
    expect(onGoal(1899, 2000, 'gain')).toBe(false);
    expect(onGoal(2080, 2000, 'keep')).toBe(true);
    expect(onGoal(1850, 2000, 'keep')).toBe(false);
  });
});

describe('what goes with progress', () => {
  // Weeks with three trainings lose 0.6 kg, weeks with one lose 0.1 - on the same food.
  const alternating = (weeks: number): WeekPlan[] =>
    Array.from({ length: weeks }, (_, i) => (i % 2 ? { change: -0.1, workouts: 1 } : { change: -0.6, workouts: 3 }));

  test('fewer than eight finished weeks with a weight change: nothing is compared', () => {
    expect(MIN_WEEKS).toBe(8);
    expect(findings(rowsOf(alternating(7)), 'loss')).toEqual({ weeks: 7, findings: [] });
  });

  test('a large, consistent difference over eight weeks: one finding, toward the goal', () => {
    const f = findings(rowsOf(alternating(8)), 'loss');
    expect(f.weeks).toBe(8);
    expect(f.findings).toHaveLength(1);
    const [w] = f.findings;
    expect(w).toMatchObject({ factor: 'workouts', threshold: 3, helps: true, kcalGap: 0 });
    expect(w!.more).toEqual({ weeks: 4, change: expect.closeTo(-0.6, 6) as number });
    expect(w!.less.change).toBeCloseTo(-0.1, 6);
    expect(w!.diff).toBeCloseTo(-0.5, 6);
    // No strength words any more: the finding says only that it is clear.
    expect(Object.keys(w!)).not.toContain('strength');
  });

  test('a noisy difference over eight weeks is no finding: the averages differ, but within the scale’s noise', () => {
    const changes = [-1.0, 0.1, 0.2, -0.6, -0.9, 0.2, 0.3, -0.5];
    const plans = changes.map((change, i) => ({ change, workouts: i % 2 ? 1 : 3 }));
    // More trainings: −0.35 a week on average; fewer: −0.2 — 0.15 apart, but ±1 kg week to week.
    const f = findings(rowsOf(plans), 'loss');
    expect(f.weeks).toBe(8);
    expect(f.findings).toEqual([]);
  });

  test('a difference under 0.1 kg a week is no finding, however consistent', () => {
    const plans = alternating(8).map((p) => ({ ...p, change: p.workouts === 3 ? -0.35 : -0.3 }));
    expect(findings(rowsOf(plans), 'loss').findings).toEqual([]);
  });

  test('each side needs three weeks', () => {
    const plans: WeekPlan[] = Array.from({ length: 8 }, (_, i) => (i < 2 ? { change: -0.6, workouts: 3 } : { change: -0.1, workouts: 1 }));
    expect(findings(rowsOf(plans), 'loss').findings).toEqual([]);
  });

  test('when gaining, losing more goes against the goal; keeping weight compares nothing', () => {
    const rows = rowsOf(alternating(8));
    expect(findings(rows, 'gain').findings[0]).toMatchObject({ factor: 'workouts', helps: false });
    expect(findings(rows, 'keep')).toEqual({ weeks: 8, findings: [] });
  });

  test('the food difference between the groups is reported with the habit; eating on the goal is a habit too', () => {
    // The three-training weeks ate 1800 (on the goal), the others 2200 (over the band).
    const rows = rowsOf(alternating(8).map((p) => ({ ...p, eaten: p.workouts === 3 ? 1800 : 2200 })));
    const f = findings(rows, 'loss').findings;
    expect(f.find((x) => x.factor === 'workouts')?.kcalGap).toBe(-400);
    expect(f.find((x) => x.factor === 'eating')).toMatchObject({ helps: true, kcalGap: null });
  });

  test('steps split at a round 500 that balances the weeks', () => {
    const plans = alternating(8).map((p, i) => ({ change: p.change, steps: p.workouts === 3 ? 11_200 + i * 10 : 6300 + i * 10 }));
    const s = findings(rowsOf(plans), 'loss').findings.find((x) => x.factor === 'steps')!;
    expect(s.threshold).toBe(11_000);
    expect(s.helps).toBe(true);
  });
});
