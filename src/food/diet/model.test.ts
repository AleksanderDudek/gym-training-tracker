import { describe, expect, test } from 'vitest';
import type { Plan } from './plan';
import { DIET_PROFILES } from './profiles';
import { completeProfile } from './store';
import { tdee } from './energy';
import {
  addDays,
  dayGoal,
  dayLabel,
  forecastInputs,
  lastWeighing,
  mealsLeftAt,
  mondayOf,
  projectFromWeighing,
  remainingOf,
  weightOn,
} from './model';

const profile = completeProfile({ startDate: '2026-10-05', startWeightKg: 100, dailyKcal: 2000, adaptWeekly: true });

describe('dates', () => {
  test('days are added across months and a week starts on Monday', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });

  test('near days get a word, the rest a date', () => {
    expect(dayLabel('2026-10-11', '2026-10-11')).toBe('Dziś');
    expect(dayLabel('2026-10-10', '2026-10-11')).toBe('Wczoraj');
    expect(dayLabel('2026-10-14', '2026-10-11')).toMatch(/środa, 14 października/);
  });
});

describe('model', () => {
  test('the weight on a date is the last one logged up to it', () => {
    const days = [
      { date: '2026-10-06', weightKg: 99.4 },
      { date: '2026-10-09', weightKg: 98.9 },
      { date: '2026-10-08' },
    ];
    expect(weightOn(days, '2026-10-08', 100)).toBe(99.4);
    expect(weightOn(days, '2026-10-20', 100)).toBe(98.9);
    expect(weightOn(days, '2026-10-05', 100)).toBe(100);
  });

  test('the day winds down: four meals in the morning, one at night', () => {
    expect([8, 12, 17, 21].map(mealsLeftAt)).toEqual([4, 3, 2, 1]);
  });

  test('what is left counts carbohydrates down to the limit of a low-carb profile', () => {
    const keto = DIET_PROFILES.keto.targets(1800, 90);
    expect(remainingOf(keto, { kcal: 600, protein: 40, carbs: 12, fat: 40, unknownMacros: 0 }).carbs).toBe(18);
  });

  test('the goal follows the week only when the user wants it', () => {
    const eaten = new Map([['2026-10-05', 2600]]);
    expect(dayGoal(profile, eaten, '2026-10-06', '2026-10-06').kcal).toBe(1900);
    expect(dayGoal({ ...profile, adaptWeekly: false }, eaten, '2026-10-06', '2026-10-06')).toEqual({
      kcal: 2000,
      adjustment: null,
    });
  });

  test("looking ahead, today's half-eaten day does not count as a day eaten", () => {
    // Tuesday's breakfast (300 kcal) seen from Wednesday must not read as a 1700 kcal deficit.
    const eaten = new Map([
      ['2026-10-05', 2000],
      ['2026-10-06', 300],
    ]);
    expect(dayGoal(profile, eaten, '2026-10-07', '2026-10-06').kcal).toBe(2000);
    // Once Tuesday is over, it counts.
    expect(dayGoal(profile, eaten, '2026-10-07', '2026-10-07').kcal).toBe(2200);
  });

  test('the forecast takes real calories only from past days that were logged', () => {
    const plan: Plan = {
      id: 'p',
      name: 'p',
      startDate: '2026-10-05',
      days: ['1A'],
      foods: [],
      notes: [],
      templates: {
        '1A': [
          {
            index: 1,
            items: [{ text: 'x', kcal: 1800, protein: 1, carbs: 1, fat: 1, stores: [] }],
            totals: { kcal: 1800, protein: 1, carbs: 1, fat: 1 },
          },
        ],
      },
    };
    const history = {
      eaten: new Map([
        ['2026-10-05', 2500],
        ['2026-10-07', 1500],
      ]),
      days: new Map([['2026-10-06', { date: '2026-10-06', steps: 12000 }]]),
    };
    const inputs = forecastInputs(profile, plan, history, '2026-10-07', 4);
    expect(inputs).toEqual([
      { date: '2026-10-05', plannedKcal: 1800, eatenKcal: 2500, steps: null },
      { date: '2026-10-06', plannedKcal: 1800, eatenKcal: null, steps: 12000 },
      { date: '2026-10-07', plannedKcal: 1800, eatenKcal: null, steps: null },
      { date: '2026-10-08', plannedKcal: 1800, eatenKcal: null, steps: null },
    ]);
    expect(forecastInputs(profile, null, history, '2026-10-07', 1)[0]?.plannedKcal).toBe(2000);
  });

  test('the projection starts from the scale, not from the model of what was eaten', () => {
    const days = [{ date: '2026-10-06', weightKg: 99 }, { date: '2026-10-08', weightKg: 98.4 }, { date: '2026-10-09' }];
    const weighing = lastWeighing(days);
    expect(weighing).toEqual({ date: '2026-10-08', kg: 98.4 });
    const inputs = forecastInputs(profile, null, { eaten: new Map(), days: new Map() }, '2026-10-08', 5);
    const projection = projectFromWeighing(profile, inputs, weighing);
    expect([...projection.keys()]).toEqual(['2026-10-08', '2026-10-09']);
    expect(projection.get('2026-10-08')).toBe(98.4);
    expect(projection.get('2026-10-09')).toBeCloseTo(98.4 - (tdee(profile, 98.4) - 2000) / 7500, 6);
    expect(projectFromWeighing(profile, inputs, null).size).toBe(0);
  });
});
