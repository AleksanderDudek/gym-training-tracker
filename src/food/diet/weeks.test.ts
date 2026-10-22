import { describe, expect, test } from 'vitest';
import { addDays } from './model';
import { findings, onGoal, verdictOf, weekRows, type DayFacts } from './weeks';

/**
 * Weeks side by side and what goes with progress. 2026-10-22 is a Thursday, so the current week
 * (from 2026-10-19) is unfinished; the weeks before it start on Mondays 7 days apart.
 */

const TODAY = '2026-10-22';
const THIS_MONDAY = '2026-10-19';

const day = (date: string, over: Partial<DayFacts> = {}): DayFacts => ({
  date,
  eaten: 2000,
  goal: 2000,
  steps: 8000,
  workouts: 0,
  snacks: 0,
  outings: 0,
  activeMin: 0,
  ...over,
});

interface WeekPlan {
  /** Weight change over the week, kg. */
  change: number;
  workouts?: number;
  eaten?: number;
  steps?: number;
}

/**
 * Finished weeks, oldest first, ending the week before the current one; weigh-ins every Monday,
 * Wednesday and Friday on a straight line, so the slope is exactly the planned change.
 */
function history(plans: WeekPlan[], startKg = 90) {
  const days: DayFacts[] = [];
  const weighIns: { date: string; kg: number }[] = [];
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
    for (const d of [0, 2, 4]) weighIns.push({ date: addDays(monday, d), kg: kg + (p.change * d) / 7 });
    kg += p.change;
  });
  weighIns.push({ date: THIS_MONDAY, kg });
  return { days, weighIns };
}

describe('weeks', () => {
  test('a week: slope of its weigh-ins in kg a week, averages, counts, days after today left out', () => {
    const { days, weighIns } = history([{ change: -0.5, workouts: 3, eaten: 1900, steps: 9000 }]);
    const rows = weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' });
    const last = rows.find((r) => r.monday === '2026-10-12')!;
    expect(last.complete).toBe(true);
    expect(last.weight?.change).toBeCloseTo(-0.5, 6);
    expect(last.weight?.weighIns).toBe(4);
    expect(last.verdict).toBe('good');
    expect(last.eaten).toEqual({ avg: 1900, goal: 2000, days: 7 });
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
    days.push(day(TODAY, { eaten: 400, steps: 1200 }));
    const [now] = weekRows({ days, weighIns: [], today: TODAY, stepsGoal: 8000, direction: 'loss' });
    expect(now!.days).toHaveLength(4);
    expect(now!.eaten).toEqual({ avg: 1800, goal: 2000, days: 3 });
    expect(now!.steps).toEqual({ avg: 9000, goalDays: 3 });
  });

  test('two weigh-ins closer than four days give no slope; a week with nothing is left out', () => {
    const rows = weekRows({
      days: [],
      weighIns: [
        { date: '2026-10-05', kg: 90 },
        { date: '2026-10-07', kg: 89 },
      ],
      today: TODAY,
      stepsGoal: 8000,
      direction: 'loss',
    });
    expect(rows.map((r) => r.monday)).toEqual(['2026-10-05']);
    expect(rows[0]!.weight).toBeNull();
  });

  test('verdict by the goal: down is good when losing, up when gaining, little change when keeping', () => {
    expect(verdictOf(-0.4, 'loss')).toBe('good');
    expect(verdictOf(0.3, 'loss')).toBe('bad');
    expect(verdictOf(0.05, 'loss')).toBe('flat');
    expect(verdictOf(0.3, 'gain')).toBe('good');
    expect(verdictOf(0.15, 'keep')).toBe('good');
    expect(verdictOf(-0.5, 'keep')).toBe('bad');
  });

  test('on the goal: losing - not over by more than 5 %, gaining - not under, keeping - within', () => {
    expect(onGoal(2090, 2000, 'loss')).toBe(true);
    expect(onGoal(2200, 2000, 'loss')).toBe(false);
    expect(onGoal(1500, 2000, 'loss')).toBe(true);
    expect(onGoal(1500, 2000, 'gain')).toBe(false);
    expect(onGoal(1850, 2000, 'keep')).toBe(false);
  });
});

describe('what goes with progress', () => {
  // Three weeks with three trainings lose 0.6 kg, three with one lose 0.1 - on the same food.
  const plans: WeekPlan[] = [
    { change: -0.6, workouts: 3 },
    { change: -0.1, workouts: 1 },
    { change: -0.6, workouts: 3 },
    { change: -0.1, workouts: 1 },
    { change: -0.6, workouts: 3 },
    { change: -0.1, workouts: 1 },
  ];

  test('weeks with more trainings lost more: it helps, clearly, and the food was the same', () => {
    const { days, weighIns } = history(plans);
    const rows = weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' });
    const f = findings(rows, 'loss');
    expect(f.weeks).toBe(6);
    const w = f.findings.find((x) => x.factor === 'workouts')!;
    expect(w.threshold).toBe(3);
    expect(w.more).toEqual({ weeks: 3, change: expect.closeTo(-0.6, 6) as number });
    expect(w.less.change).toBeCloseTo(-0.1, 6);
    expect(w.helps).toBe(true);
    expect(w.strength).toBe('clear');
    expect(w.kcalGap).toBe(0);
    // The same steps every week: nothing to split.
    expect(f.findings.find((x) => x.factor === 'steps')).toBeUndefined();
    expect(f.findings[0]!.factor).toBe('workouts');
  });

  test('the food difference between the groups is reported with the habit', () => {
    const { days, weighIns } = history(plans.map((p) => ({ ...p, eaten: p.workouts === 3 ? 1800 : 2200 })));
    const w = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss').findings.find(
      (x) => x.factor === 'workouts',
    )!;
    expect(w.kcalGap).toBe(-400);
    // Over the goal by 5 %: those weeks are off the goal, and they lost less.
    const eating = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss').findings.find(
      (x) => x.factor === 'eating',
    )!;
    expect(eating.helps).toBe(true);
    expect(eating.kcalGap).toBeNull();
  });

  test('when gaining, losing more is against the goal', () => {
    const { days, weighIns } = history(plans);
    const w = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'gain' }), 'gain').findings.find(
      (x) => x.factor === 'workouts',
    )!;
    expect(w.helps).toBe(false);
  });

  test('a difference under 0.1 kg a week is no clear difference', () => {
    const { days, weighIns } = history(plans.map((p) => ({ ...p, change: p.workouts === 3 ? -0.35 : -0.3 })));
    const w = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss').findings.find(
      (x) => x.factor === 'workouts',
    )!;
    expect(w.helps).toBeNull();
  });

  test('one odd week makes the averages differ, but a weak link is no clear difference', () => {
    const odd: WeekPlan[] = [
      { change: -1.5, workouts: 3 },
      { change: 0.3, workouts: 3 },
      { change: 0.3, workouts: 3 },
      { change: 0, workouts: 1 },
      { change: 0, workouts: 1 },
      { change: 0, workouts: 1 },
    ];
    const { days, weighIns } = history(odd);
    const w = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss').findings.find(
      (x) => x.factor === 'workouts',
    )!;
    expect(w.diff).toBeCloseTo(-0.3, 6);
    expect(w.strength).toBe('weak');
    expect(w.helps).toBeNull();
  });

  test('fewer than four finished weeks with a weight change: nothing is compared', () => {
    const { days, weighIns } = history(plans.slice(0, 3));
    const f = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss');
    expect(f).toEqual({ weeks: 3, findings: [] });
  });

  test('steps split at a round 500 that balances the weeks', () => {
    const { days, weighIns } = history(
      plans.map((p, i) => ({ change: p.change, steps: p.workouts === 3 ? 11_200 + i * 10 : 6300 + i * 10 })),
    );
    const s = findings(weekRows({ days, weighIns, today: TODAY, stepsGoal: 8000, direction: 'loss' }), 'loss').findings.find(
      (x) => x.factor === 'steps',
    )!;
    expect(s.threshold).toBe(11_000);
    expect(s.helps).toBe(true);
  });
});
