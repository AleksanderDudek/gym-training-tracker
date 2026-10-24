// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { simulateCheat } from '../../diet/cheat';
import { totals } from '../../diet/day';
import { DIET_PROFILES } from '../../diet/profiles';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import { renderWithBridge } from '../../test/bridge';
import { beyondTexts, macroTexts, planText, verdictText } from './cheatText';
import DiaryPage from './DiaryPage';

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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cheat meal in English', () => {
  test('the cheat-meal simulation speaks English', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
    await logQuick(TODAY, 'Kanapka', 1500);
    window.history.replaceState(null, '', '/#/jedzenie');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);

    await user.click(await screen.findByRole('button', { name: 'Cheat meal' }));
    const sheet = screen.getByRole('dialog', { name: 'Cheat meal' });
    await user.click(within(sheet).getByRole('button', { name: 'Enter macros' }));
    await user.type(within(sheet).getByLabelText('Calories (kcal)'), '1200');
    const sim = within(sheet).getByRole('region', { name: 'What it means' });
    expect(sim).toHaveTextContent(/Today’s goal\s*2,000 kcal/);
    expect(sim).toHaveTextContent('You’ll go over the goal by 700 kcal (35%).');
    expect(sim).toHaveTextContent('Week: the goal for the next 4 days drops by about 170 kcal a day.');
    expect(sim).toHaveTextContent('In the weight forecast that’s about 93 g.');
    expect(sim.textContent).not.toMatch(POLISH);
    expect(within(sheet).getByRole('button', { name: 'Plan it' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Eaten now' })).toBeInTheDocument();
  });
});

describe('cheat-meal texts composed in code', () => {
  const p = completeProfile({ dailyKcal: 2000 });
  const noPolish = (texts: (string | null)[]) => {
    for (const t of texts) if (t) expect(t, t).not.toMatch(POLISH);
  };

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
});
