// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { activityOn } from '../../diet/activity';
import { simulateCheat } from '../../diet/cheat';
import { macroStatus, totals, weeklyAdjustment } from '../../diet/day';
import { db } from '../../diet/db';
import { planFood, recipeFood, setFood } from '../../diet/foods';
import { dayLabel, longDay, paceText } from '../../diet/model';
import type { Plan } from '../../diet/plan';
import { DIET_PROFILES, DIET_PROFILE_IDS } from '../../diet/profiles';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from '../../diet/store';
import { slotLabel, suggest, swaps, type Context } from '../../diet/suggest';
import { renderWithBridge, testBridge, testMove } from '../../test/bridge';
import { activityLine, activityParts, pendingParts } from './activityText';
import { beyondTexts, macroTexts, planText, verdictText } from './cheatText';
import DiaryPage from './DiaryPage';
import DietProfilePage from './DietProfilePage';
import DietProgressPage from './DietProgressPage';

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

/**
 * Polish texts of the diet catalogs that must not show up in English (data — product names — may;
 * so may the shared star button, which another area translates).
 */
const POLISH_UI = [
  'Co teraz',
  'Dodaj zjedzone',
  'Zjedzone',
  'Kroki i ruch',
  'Bilans dnia',
  'Zaplanowany cheat meal',
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
  test('the day, its balance, the plan, the planned cheat meal, what now and the links', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
    await db.plans.put(PLAN);
    await logQuick(TODAY, 'Kanapka z serem', 520, { protein: 24, carbs: 50, fat: 22 });
    await logQuick(TODAY, 'Baton', 210);
    await planCheat(TODAY, { name: 'Pizza', kcal: 900, protein: 30, carbs: null, fat: null });
    window.history.replaceState(null, '', '/#/jedzenie');
    renderWithBridge(<DiaryPage />, testBridge({ moveOn: () => testMove({ planActive: true }) }));

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 14 October')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Day balance' })).toHaveTextContent('Protein');
    expect(screen.getByText(/1 entry has calories only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add food' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favourites' })).toBeInTheDocument();

    const cheat = screen.getByRole('region', { name: /Planned cheat meal/ });
    expect(cheat).toHaveTextContent('900 kcal · P 30 · C ? · F ?');
    expect(within(cheat).getByRole('button', { name: 'Eaten' })).toBeInTheDocument();

    const eaten = screen.getByRole('region', { name: /^Eaten/ });
    expect(within(eaten).getByRole('button', { name: 'Delete: Baton' })).toBeInTheDocument();
    expect(eaten).toHaveTextContent('macros unknown');

    const now = screen.getByRole('region', { name: 'What now?' });
    expect(now).toHaveTextContent(/kcal and \d+ g protein left for \d meals? — after the planned cheat meal/);
    expect(now).toHaveTextContent('Profile: High-protein cut.');

    expect(screen.getByRole('heading', { name: 'Steps & activity' })).toBeInTheDocument();
    const links = within(screen.getByRole('navigation', { name: 'Diet' }));
    for (const name of ['Meal plan', 'My plans', 'Progress', 'Diet profile'])
      expect(links.getByRole('link', { name })).toBeInTheDocument();
    expectNoPolishUi();
  });

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

  test('the add-food sheet and the cheat-meal simulation speak English', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Cheat meal' }));
    const sheet = screen.getByRole('dialog', { name: 'Cheat meal' });
    await user.click(within(sheet).getByRole('button', { name: 'Enter macros' }));
    await user.type(within(sheet).getByLabelText('Calories (kcal)'), '1200');
    const sim = within(sheet).getByRole('region', { name: 'What it means' });
    expect(sim).toHaveTextContent(/Today’s goal\s*2\s?000 kcal/);
    expect(sim).toHaveTextContent('You’ll go over the goal by 700 kcal (35%).');
    expect(sim).toHaveTextContent('Week: the goal for the next 4 days drops by about 170 kcal a day.');
    expect(sim).toHaveTextContent('In the weight forecast that’s about 93 g.');
    expect(sim.textContent).not.toMatch(POLISH);
    expect(within(sheet).getByRole('button', { name: 'Plan it' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Eaten now' })).toBeInTheDocument();
  });
});

describe('progress and diet profile in English', () => {
  test('progress: weight, the last fortnight and what works for you', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', startWeightKg: 84, targetWeightKg: 78 }));
    await logQuick('2026-10-12', 'Obiad', 1800, { protein: 120, carbs: 180, fat: 60 });
    window.history.replaceState(null, '', '/#/jedzenie/postep');
    renderWithBridge(
      <DietProgressPage />,
      testBridge({ weights: [{ day: '2026-10-02', kg: 84 }, { day: '2026-10-12', kg: 82.4 }] }),
    );
    expect(await screen.findByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'What works for you' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Calories eaten day by day' })).toBeInTheDocument();
    expect(screen.getByText(/On plan, you reach your goal on/)).toBeInTheDocument();
    expectNoPolishUi(['Waga', 'Co działa u ciebie', 'Zjedzone kalorie', 'Według planu', 'kg/tydz', 'Do celu']);
  });

  test('first visit asks for the profile in English', async () => {
    window.history.replaceState(null, '', '/#/jedzenie/profil');
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Start with your profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.getByLabelText('Starting weight')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and start' })).toBeInTheDocument();
    expectNoPolishUi(['Zacznij od profilu', 'Zapisz i zacznij', 'Wzrost']);
  });

  test('a saved profile: diet types and the goal options in English, stored ids untouched', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dietProfile: 'keto' }));
    window.history.replaceState(null, '', '/#/jedzenie/profil');
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByRole('heading', { name: 'Calorie goal' })).toBeInTheDocument();
    for (const label of ['High-protein cut', 'Balanced', 'Low carb', 'Keto', 'Athletic'])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: /^Match the goal to the week/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Match the goal to activity/ })).toBeInTheDocument();
    expect((await db.profile.get('me'))?.dietProfile).toBe('keto');
    expectNoPolishUi(['Zbilansowana', 'Sportowa', 'Dopasowuj', 'Cel kalorii']);
  });
});

describe('diet texts composed in code', () => {
  const p = completeProfile({ dailyKcal: 2000 });
  const noPolish = (texts: (string | null)[]) => {
    for (const t of texts) if (t) expect(t, t).not.toMatch(POLISH);
  };

  test('activity in words', () => {
    const run = activityOn(p, 80, testMove({ stepsWorth: 15_000, planActive: true }), 12_000, 'past');
    expect(activityParts(run)[0]).toMatch(/^\+160 kcal for steps \(12\D?000 instead of 10\D?000; counted as 15\D?000 — breakdown in “Steps & cardio”\)$/);
    const skipped = activityOn(p, 80, testMove({ planActive: true, planned: { name: 'Push', kcal: 300 } }), 8000, 'past');
    expect(activityParts(skipped)).toContainEqual('−300 kcal: planned “Push” not done');
    const today = activityOn(p, 80, testMove({ planActive: true, planned: { name: 'Push', kcal: 300 } }), 6000, 'today');
    expect(pendingParts(today)[0]).toMatch(/^4\D?000 steps to go/);
    const trained = activityOn(p, 80, testMove({ trained: true, workoutKcal: 400, otherKcal: 200 }), 11_000, 'past');
    expect(activityLine(today)).toMatch(/^If that doesn’t happen by tonight, the goal drops by at most/);
    expect(activityLine(trained)).toMatch(/^Activity: \+/);
    noPolish([...activityParts(run), ...activityParts(skipped), ...pendingParts(today), ...activityParts(trained)]);
    noPolish([activityLine(run), activityLine(skipped), activityLine(today), activityLine(trained)]);
  });

  test('the cheat-meal sentences', () => {
    const base = {
      targets: DIET_PROFILES.redukcja.targets(2000, 75),
      profile: p,
      kg: 80,
      date: '2026-10-14',
      eatenByDate: new Map<string, number>(),
      plannedLeftKcal: 1200,
      typicalWorkoutKcal: 300,
    };
    const fits = simulateCheat({ ...base, cheat: { kcal: 600, protein: 20, carbs: 70, fat: 25 }, eaten: totals([]), mealsLeft: 3 });
    const tight = simulateCheat({ ...base, cheat: { kcal: 1500, protein: 20, carbs: 150, fat: 70 }, eaten: totals([]), mealsLeft: 4 });
    const over = simulateCheat({
      ...base,
      cheat: { kcal: 1400, protein: 30, carbs: 200, fat: 80 },
      eaten: totals([{ kcal: 1400, protein: 60, carbs: 120, fat: 40 }]),
      mealsLeft: 2,
    });
    expect(verdictText(fits)).toMatch(/^It fits: 1\D?400 kcal left for 2 meals — about 700 kcal and \d+ g protein each\.$/);
    expect(verdictText(tight)).toMatch(/^It just fits/);
    expect(verdictText(over)).toMatch(/^You’ll go over the goal by/);
    expect(beyondTexts(over, true).join(' ')).toMatch(/× a typical workout/);
    noPolish([verdictText(fits), verdictText(tight), verdictText(over), planText(fits), planText(tight), planText(over)]);
    noPolish([...macroTexts(fits), ...macroTexts(over), ...beyondTexts(over, true), ...beyondTexts({ ...over, week: { kind: 'sunday' } }, false)]);
  });

  test('day notes, the weekly correction, profiles, slots, dates and suggestions', () => {
    const t = DIET_PROFILES.lowcarb.targets(2000, 75);
    const status = macroStatus(t, totals([{ kcal: 2600, protein: 40, carbs: 220, fat: 30 }]), true);
    expect(status.kcal.note).toBe('600 kcal over the goal');
    noPolish(Object.values(status).map((s) => s.note));
    noPolish(Object.values(macroStatus(t, totals([{ kcal: 900, protein: 160, carbs: 20, fat: 90 }]), false)).map((s) => s.note));
    const week = weeklyAdjustment(2000, [{ date: '2026-10-12', eatenKcal: 2600 }], '2026-10-14');
    expect(week.explanation).toBe('This week you’ve eaten 600 kcal over the plan – I’m spreading it over 5 days.');
    expect(weeklyAdjustment(2000, [], '2026-10-14').explanation).toBe('This week is going to plan.');

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
