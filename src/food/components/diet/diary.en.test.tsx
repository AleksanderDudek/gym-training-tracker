// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { dayState, totals } from '../../diet/day';
import { db, type PlannedCheat } from '../../diet/db';
import { planFood, recipeFood, setFood } from '../../diet/foods';
import { dayLabel, longDay, paceText } from '../../diet/model';
import { dayNeeds } from '../../diet/now';
import type { Plan } from '../../diet/plan';
import { DIET_PROFILES, DIET_PROFILE_IDS } from '../../diet/profiles';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from '../../diet/store';
import { slotLabel, suggest, swaps, type Context } from '../../diet/suggest';
import type { CheckFacts, Profile, WeekCheck } from '../../diet/types';
import { renderWithBridge } from '../../test/bridge';
import TodayFoodCard from '../../TodayFoodCard';
import { dayLines, todayLink } from './dayText';
import DiaryPage from './DiaryPage';
import { KcalShown } from './kcalShown';
import { WeekCheckCard } from './WeekCheckCard';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Product data isn’t included in this version of the app.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

/** Polish letters: none may be left in text the diary composes itself. */
const POLISH = /[ąćęłńóśźż]/i;

const TODAY = '2026-10-14';

const item = (text: string, kcal: number) => ({ text, kcal, protein: 30, carbs: 40, fat: 20, stores: [] });
const PLAN: Plan = {
  id: 'active',
  name: 'Test plan',
  startDate: '2026-10-12',
  days: ['1A'],
  templates: {
    '1A': [
      {
        index: 1,
        items: [item('Owsianka', 450), item('Kurczak z ryżem', 700)],
        totals: { kcal: 1150, protein: 60, carbs: 80, fat: 40 },
      },
    ],
  },
  foods: [item('Owsianka', 450), item('Kurczak z ryżem', 700)],
  notes: [],
};

const FACTS: CheckFacts = {
  from: '2026-09-14',
  to: '2026-10-11',
  weeks: 4,
  weighIns: 20,
  completeDays: 25,
  spanDays: 27,
  pace: 0.6,
  paceSe: 0.08,
  intake: 1960,
  burn: 2700,
  burnSe: 100,
  before: 2550,
  after: 2650,
  trendKg: 80.2,
};

/** Monday's check raised the target from 1950 to 2050 and waits for an answer. */
const CHANGED: WeekCheck = {
  week: '2026-10-12',
  status: 'changed',
  from: 1950,
  to: 2050,
  reason: 'burn',
  note: null,
  settle: null,
  facts: FACTS,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace: 0.5,
  answer: null,
};

/**
 * Polish texts of the diet catalogs that must not show up in English (data — product names — may;
 * so may the shared star button, which another area translates).
 */
const POLISH_UI = [
  'Co teraz',
  'Dodaj zjedzone',
  'Zjedzone',
  'Kroki',
  'Bilans dnia',
  'Zaplanowany',
  'Większy posiłek',
  'większym posiłkiem',
  'Zostało',
  'Na dziś',
  'w zakresie celu',
  'Białka jeszcze',
  'Nie wszystko zapisane',
  'Dzień niepełny',
  'Mało zapisów',
  'Liczenie kalorii',
  'Ruch nie zmienia',
  'Przerwa',
  'Od dziś cel',
  'Propozycja',
  'Ten tydzień',
  'Szczegóły',
  'Jak liczę cel',
  'Ile dziś ważysz',
  'Nie dziś',
  'Plan posiłków',
  'Moje plany',
  'Postęp',
  'Profil diety',
  'Poprzedni dzień',
  'Następny dzień',
  'Profil:',
  'kcal ponad',
  'zostało',
  'Zjadłem',
  'Wariant',
  'Reszta dnia',
  'Jeden posiłek',
  'Śniadanie',
  'Kolacja',
  'Przekąska',
  'Dodatkowo',
  'Dziś',
  'środa',
  'października',
  'Redukcja wysokobiałkowa',
  'nie pasuje',
  'może być',
  'najlepsze',
  'Plan na dziś',
  'makro nieznane',
  'Propozycje biorą',
  'Nie znam sklepów',
  'Ruch dziś',
  'Cel a ruch',
];

/** Every text and accessible label on the page, for the absence checks. */
function pageText(): string {
  const attrs = [...document.querySelectorAll('[aria-label],[title],[placeholder],[aria-valuetext]')].flatMap((el) =>
    ['aria-label', 'title', 'placeholder', 'aria-valuetext'].map((a) => el.getAttribute(a) ?? ''),
  );
  return [document.body.textContent ?? '', ...attrs].join('\n');
}

function expectNoPolishUi(extra: string[] = []) {
  const all = pageText();
  for (const pl of [...POLISH_UI, ...extra]) expect(all, `“${pl}” still on the page`).not.toContain(pl);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('diary in English', () => {
  test('the day, its balance, the plan, the planned bigger meal, what now and the links', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
    await db.plans.put(PLAN);
    await logQuick(TODAY, 'Kanapka z serem', 520, { protein: 24, carbs: 50, fat: 22 });
    await logQuick(TODAY, 'Baton', 210);
    await planCheat(TODAY, { name: 'Pizza', kcal: 900, protein: 30, carbs: null, fat: null });
    window.history.replaceState(null, '', '/#/jedzenie');
    renderWithBridge(<DiaryPage />);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 14 October')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    const balance = screen.getByRole('region', { name: 'Day balance' });
    // 2000 − 730 eaten − 900 planned; 150 − 24 − 30 g protein.
    expect(within(balance).getByRole('heading', { name: 'About 370 kcal and 96 g protein left' })).toBeInTheDocument();
    expect(balance).toHaveTextContent('Protein24 of 150 g');
    expect(balance).toHaveTextContent('Calories730 of 2,000 kcal');
    expect(balance).toHaveTextContent('This already counts the planned bigger meal (900 kcal).');
    expect(balance).toHaveTextContent('Carbs and fat');
    expect(screen.getByText('1 entry has calories only – the protein total may be too low.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add food' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favourites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bigger meal' })).toBeInTheDocument();

    const meal = screen.getByRole('region', { name: /Planned bigger meal/ });
    expect(meal).toHaveTextContent('900 kcal · P 30 · C ? · F ?');
    expect(within(meal).getByRole('button', { name: 'Eaten' })).toBeInTheDocument();

    const eaten = screen.getByRole('region', { name: /^Eaten/ });
    expect(within(eaten).getByRole('button', { name: 'Delete: Baton' })).toBeInTheDocument();
    expect(eaten).toHaveTextContent('macros unknown');
    expect(within(eaten).getByRole('button', { name: 'Not everything logged' })).toBeInTheDocument();

    const now = screen.getByRole('region', { name: 'What now?' });
    expect(now).toHaveTextContent(
      /About 370 kcal and 96 g protein left for \d meals? — after the planned bigger meal\. The best are starred\./,
    );
    expect(now).toHaveTextContent('Profile: High-protein cut.');

    const steps = screen.getByRole('region', { name: 'Steps' });
    expect(steps).toHaveTextContent(
      'Activity doesn’t change your food target. Your usual activity is already in it, and if you move more for a few weeks, the scale shows it — then the target grows by itself.',
    );
    expect(screen.getByRole('region', { name: 'What do you weigh today?' })).toHaveTextContent('Not today');
    const links = within(screen.getByRole('navigation', { name: 'Diet' }));
    for (const name of ['Meal plan', 'My plans', 'Progress', 'Diet profile'])
      expect(links.getByRole('link', { name })).toBeInTheDocument();
    expectNoPolishUi();
  });

  test('what waits on today’s page: the notice, the Monday card and a break, all in English', async () => {
    await saveProfile(
      completeProfile({
        startDate: '2026-08-01',
        dailyKcal: 2050,
        targetWeightKg: 75,
        goalPace: 0.5,
        notice: 'show',
        goals: [
          { from: '2026-08-01', kcal: 1950, by: 'setup' },
          { from: '2026-10-12', kcal: 2050, by: 'check' },
        ],
        pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 2050 }],
        lastCheck: CHANGED,
      }),
    );
    await logQuick('2026-10-13', 'Owsianka', 400, { protein: 20, carbs: 60, fat: 10 });
    window.history.replaceState(null, '', '/#/jedzenie');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const notice = await screen.findByRole('region', { name: 'Calorie counting is simpler now' });
    expect(notice).toHaveTextContent('One target for every day: 2,050 kcal. It doesn’t change during the day or after midnight.');
    expect(within(notice).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
    const week = screen.getByRole('region', { name: 'New target from today: 2,050 kcal (was 1,950)' });
    expect(week).toHaveTextContent(
      'The last 4 weeks: weight −0.6 kg a week (plan: −0.5 kg), 1,960 kcal a day logged on average.',
    );
    expect(week).toHaveTextContent('Your logs and weight show you burn more than the estimate assumed — hence 100 kcal more.');
    expect(within(week).getByRole('button', { name: 'Keep 1,950 kcal' })).toBeInTheDocument();
    expect(within(week).getByRole('link', { name: 'How I work out the target' })).toBeInTheDocument();
    expect(week).toHaveTextContent('Burn from your logs and weight: about 2,700 kcal (±100)');
    expect(screen.getByText('Break until 18 October: your target is maintenance (2,050 kcal) and fitting waits.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End the break' })).toBeInTheDocument();
    expectNoPolishUi();

    // Yesterday, with only breakfast logged.
    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    const eaten = await screen.findByRole('region', { name: /^Eaten/ });
    expect(eaten).toHaveTextContent(
      'Not much logged for a whole day — this day doesn’t count towards fitting your target or the averages.',
    );
    expect(within(eaten).getByRole('button', { name: 'That was the whole day' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eaten 400 kcal · target 2,050' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Weight that day: no weigh-in.' })).toBeInTheDocument();
    expectNoPolishUi();
  }, 15_000);

  test('a day without a plan gets a suggested day with English meal slots', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    window.history.replaceState(null, '', '/#/jedzenie');
    renderWithBridge(<DiaryPage />);
    const day = (await screen.findByRole('heading', { name: 'Suggested day' })).closest('section')!;
    await waitFor(() => expect(within(day).getAllByRole('button', { name: /^Eaten: / }).length).toBeGreaterThan(0));
    expect(day).toHaveTextContent(/Breakfast|Lunch|Dinner|Snack/);
    expect(within(day).getByRole('button', { name: 'Another set' })).toBeInTheDocument();
    expectNoPolishUi();
  });

  test('the add-food sheet speaks English', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
    await logQuick(TODAY, 'Kanapka', 1500);
    window.history.replaceState(null, '', '/#/jedzenie');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);

    await user.click(await screen.findByRole('button', { name: 'Add food' }));
    const picker = screen.getByRole('dialog', { name: 'Add food' });
    expect(within(picker).getByRole('button', { name: 'Set' })).toBeInTheDocument();
    expect(within(picker).getByRole('button', { name: 'Calories only' })).toBeInTheDocument();
    expect(within(picker).getByRole('searchbox', { name: 'Search food' })).toBeInTheDocument();
  });
});

describe('diet texts composed in code', () => {
  const noPolish = (texts: (string | null)[]) => {
    for (const t of texts) if (t) expect(t, t).not.toMatch(POLISH);
  };

  test('profiles, slots, dates and suggestions', () => {
    const t = DIET_PROFILES.lowcarb.targets(2000, 75);

    for (const id of DIET_PROFILE_IDS) {
      const d = DIET_PROFILES[id];
      noPolish([d.label, d.description, d.allows, d.avoids]);
      for (const m of [
        { kcal: 300, protein: 30, carbs: 10, fat: 10 },
        { kcal: 300, protein: 2, carbs: 60, fat: 5 },
        { kcal: 300, protein: 5, carbs: 5, fat: 30 },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ])
        noPolish([d.fit(m).reason]);
    }
    expect(DIET_PROFILES.redukcja.label).toBe('High-protein cut');
    // Ids and slot keys stay Polish; only their labels are English.
    expect(DIET_PROFILE_IDS).toContain('redukcja');
    expect(['Śniadanie', 'Obiad', 'Kolacja', 'Przekąska', 'Dodatkowo'].map(slotLabel)).toEqual([
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snack',
      'Extra',
    ]);

    expect(dayLabel('2026-10-14', '2026-10-14')).toBe('Today');
    expect(dayLabel('2026-10-13', '2026-10-14')).toBe('Yesterday');
    expect(longDay('2026-10-16')).toBe('Friday 16 October');
    expect(paceText(0.5)).toMatch(/^−0.5 kg\/wk$/);

    const plan = planFood({ text: '½ opak. Teriyaki', kcal: 640, protein: 41, carbs: 43, fat: 31, stores: [] });
    const recipe = recipeFood({ id: 'r', name: 'Owsianka', kind: 'sniadanie', minutes: 10, servings: 2 }, { kcal: 400, protein: 30, carbs: 50, fat: 10 }, []);
    const set = setFood({ id: 1, name: 'Zestaw', parts: [{ name: 'Banan', amountLabel: '120 g', kcal: 100, protein: 1, carbs: 25, fat: 0 }] });
    expect([plan.detail, plan.amountLabel, recipe.detail, recipe.amountLabel, set.detail]).toEqual([
      'from the plan',
      '1 item',
      'recipe · 10 min · you cook 2 servings',
      '1 serving',
      'set · 1 item',
    ]);
    const ctx: Context = {
      remaining: { kcal: 900, protein: 80, carbs: 20, fat: 10 },
      targets: t,
      profile: DIET_PROFILES.lowcarb,
      mealsLeft: 2,
      nearby: [],
      storeName: (c) => c,
    };
    const suggestions = suggest([plan, recipe, { ...set, favorite: true }], ctx);
    noPolish(suggestions.flatMap((s) => [...s.reasons, s.fit.reason, s.where]));
    noPolish(swaps(plan, [recipe, { ...plan, key: 'plan:x', name: 'x', nutrients: { ...plan.nutrients, protein: 20 } }], ctx).flatMap((s) => s.reasons));
  });
});

describe('one target a day, in English', () => {
  const noPolish = (texts: (string | null | undefined)[]) => {
    for (const t of texts) if (t) expect(t, t).not.toMatch(POLISH);
  };
  const linesOf = (eaten: { kcal: number; protein: number }, cheat: PlannedCheat | null = null, shown = true) => {
    const day = totals(eaten.kcal || eaten.protein ? [{ kcal: eaten.kcal, protein: eaten.protein, carbs: 0, fat: 0 }] : []);
    const needs = dayNeeds({ profile: { dietProfile: 'redukcja', targetWeightKg: 75 }, goalKcal: 2000, eaten: day, cheat, mealsAhead: 3 });
    return dayLines(dayState(needs, day), shown);
  };
  const meal: PlannedCheat = { name: '', kcal: 900, protein: 30, carbs: null, fat: null };

  test('the day in one sentence', () => {
    expect(linesOf({ kcal: 0, protein: 0 }).headline).toBe('Today: 2,000 kcal and 150 g protein');
    expect(linesOf({ kcal: 1240, protein: 96 }).headline).toBe('About 760 kcal and 54 g protein left');
    expect(linesOf({ kcal: 1240, protein: 160 }).headline).toBe('About 760 kcal left — protein done for today');
    expect(linesOf({ kcal: 2080, protein: 100 }).headline).toBe('Calories for today are within your target, 50 g protein to go');
    expect(linesOf({ kcal: 2080, protein: 160 }).headline).toBe('Calories for today are within your target, and protein’s done too');
    expect(linesOf({ kcal: 2300, protein: 160 })).toEqual({
      headline: 'That’s enough calories and protein for today',
      over: 'That’s about 300 kcal over the target — one day doesn’t change the trend.',
      reserved: null,
    });
    expect(linesOf({ kcal: 2300, protein: 100 }).headline).toBe('That’s enough calories for today, 50 g protein to go');
    expect(linesOf({ kcal: 650, protein: 40 }, meal).reserved).toBe('This already counts the planned bigger meal (900 kcal).');
    expect(linesOf({ kcal: 1500, protein: 40 }, meal).over).toBe(
      'With the planned bigger meal that’s about 400 kcal over the target — one day doesn’t change the trend.',
    );
    expect(linesOf({ kcal: 650, protein: 40 }, null, false).headline).toBe('110 g protein to go');
    expect(linesOf({ kcal: 650, protein: 160 }, null, false).headline).toBe('Protein done for today');

    const p = completeProfile({ dailyKcal: 2050 });
    const links = [
      todayLink({ ...p, notice: 'show' }, TODAY, true),
      todayLink({ ...p, lastCheck: CHANGED }, TODAY, true),
      todayLink({ ...p, dailyKcal: 1950, lastCheck: { ...CHANGED, status: 'ask', to: 1850 } }, TODAY, true),
      todayLink({ ...p, lastCheck: { ...CHANGED, status: 'reached', from: 1860, goalPace: 0 } }, TODAY, true),
      todayLink({ ...p, pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 2050 }] }, TODAY, true),
    ];
    expect(links).toEqual([
      'Calorie counting is simpler now — see what changed',
      'New target from today: 2,050 kcal (was 1,950)',
      'A suggested new target is waiting in the diary',
      'Target weight reached',
      'Counting paused until 18 October.',
    ]);
    noPolish(links);
  });

  test('the Today card', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
    await logQuick(TODAY, 'Owsianka', 650, { protein: 40, carbs: 60, fat: 20 });
    const { container } = renderWithBridge(<TodayFoodCard />);
    expect(await screen.findByRole('heading', { name: 'About 1,350 kcal and 110 g protein left' })).toBeInTheDocument();
    const [protein, kcal] = screen.getAllByRole('meter');
    expect(protein).toHaveAccessibleName('Protein');
    expect(protein).toHaveAttribute('aria-valuetext', '40 of 150 g');
    expect(kcal).toHaveAccessibleName('Calories');
    expect(kcal).toHaveAttribute('aria-valuetext', '650 of 2,000 kcal');
    expect(screen.getByRole('link', { name: 'Add food' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(POLISH);
  });

  /** One Monday card or quiet line, alone, in English. */
  const week = (p: Profile, today = TODAY, shown = true) =>
    renderWithBridge(
      <KcalShown.Provider value={shown}>
        <WeekCheckCard profile={p} today={today} kgNow={80} />
      </KcalShown.Provider>,
    );

  test('every Monday card and quiet line', () => {
    const base = completeProfile({ startDate: '2026-08-01', targetWeightKg: 75, goalPace: 0.5, dailyKcal: 1950 });
    const reached = { at: '2026-10-12', kg: 74.9, prevPace: 0.5, prevKcal: 1860, askAgain: null };
    const cards: [Profile, string, string[]][] = [
      [
        { ...base, lastCheck: { ...CHANGED, status: 'ask', to: 1850 } },
        'Suggestion: 1,850 kcal instead of 1,950',
        ['Do you log almost everything you eat?', 'Yes — set 1,850 kcal', 'Not always — keep 1,950 kcal'],
      ],
      [
        { ...base, autoAdjust: false, lastCheck: { ...CHANGED, status: 'suggested' } },
        'Suggestion: 2,050 kcal instead of 1,950',
        ['Set 2,050 kcal', 'Not now'],
      ],
      [
        { ...base, dailyKcal: 2050, lastCheck: { ...CHANGED, reason: 'weight' } },
        'New target from today: 2,050 kcal (was 1,950)',
        ['You weigh more, so you burn a little more — 100 kcal more keeps the pace.', 'Keep 1,950 kcal'],
      ],
      [
        { ...base, dailyKcal: 1750, lastCheck: { ...CHANGED, reason: 'floor-up', from: 1650, to: 1750, floor: 1750, facts: null } },
        'New target from today: 1,750 kcal (was 1,650)',
        [
          'Your target was below your safe minimum (1,750 kcal), so I’m raising it to the minimum.',
          'Keep it — agreed with a doctor or dietitian',
        ],
      ],
      [
        {
          ...base,
          dailyKcal: 2550,
          reached,
          lastCheck: { ...CHANGED, status: 'reached', reason: 'reached', from: 1860, to: 2550, facts: null, goalPace: 0 },
        },
        'Target weight reached',
        ['Weight trend: 74.9 kg, target weight: 75 kg. From today the target is maintenance: 2,550 kcal a day.', 'I want to keep losing'],
      ],
      [
        {
          ...base,
          dailyKcal: 1860,
          reached,
          lastCheck: { ...CHANGED, status: 'reached', reason: 'reached', from: 1860, to: 2550, facts: null },
        },
        'Target weight reached',
        ['About 2,550 kcal a day keeps it there.', 'Switch to maintenance', 'Not yet'],
      ],
    ];
    for (const [p, title, texts] of cards) {
      const { container } = week(p);
      const card = screen.getByRole('region', { name: title });
      for (const t of texts) expect(card, t).toHaveTextContent(t);
      expect(container.textContent).not.toMatch(POLISH);
      cleanup();
    }

    const plain = week({ ...cards[4]![0], dailyKcal: 2550 }, TODAY, false);
    expect(plain.container).toHaveTextContent('From today the diary suggests meals for keeping your weight.');
    expect(plain.container).toHaveTextContent('I want to keep losing');
    cleanup();

    const quiet = (over: Partial<WeekCheck>): Profile => ({ ...base, lastCheck: { ...CHANGED, from: 1950, to: 1950, ...over } });
    const lines: [Profile, string][] = [
      [
        quiet({ status: 'same', note: 'held' }),
        'This week: target unchanged (1,950 kcal). The last 4 weeks: weight −0.6 kg a week (plan: −0.5 kg), 1,960 kcal a day logged on average. Your target changed recently — I’ll wait a few weeks before another change.',
      ],
      [quiet({ status: 'same', note: 'pace', facts: { ...FACTS, pace: 0.75 } }), 'You’re losing faster than planned — I won’t lower the target.'],
      [quiet({ status: 'same', note: 'noisy' }), 'Your weight jumps a lot from day to day — weighing every morning gives a surer result.'],
      [
        quiet({ status: 'same', note: 'floor', floor: 1750 }),
        'I won’t go below 1,750 kcal — that’s the safe minimum. The pace may be a little slower, and that’s fine.',
      ],
      [quiet({ status: 'data', facts: null, missing: { weighIns: 4, completeDays: 9 } }), 'so far 4 weigh-ins and full logs on 9 days.'],
      [
        quiet({ status: 'settling', settle: 'start', facts: null, missing: { weighIns: 4, completeDays: 9 } }),
        'I’ll start fitting it after about 4–5 weeks of weigh-ins and logs — the first 2 weeks are mostly water.',
      ],
      [
        quiet({ status: 'settling', settle: 'change', facts: null, missing: { weighIns: 4, completeDays: 9 } }),
        'After a change of target the first 2 weeks are mostly water — fitting resumes in 2–3 weeks.',
      ],
      [
        quiet({ status: 'settling', settle: 'pause', facts: null, missing: { weighIns: 4, completeDays: 9 } }),
        'After a break, fitting resumes once there are 2 weeks of new data.',
      ],
      [
        quiet({ status: 'implausible', facts: null }),
        'Your logs and weight don’t match this time — it happens with water swings or partly logged days. I’ll check again next week.',
      ],
    ];
    for (const [p, line] of lines) {
      const { container } = week(p, '2026-10-12');
      expect(container, line).toHaveTextContent(line);
      expect(container.textContent).not.toMatch(POLISH);
      cleanup();
    }
  });
});
