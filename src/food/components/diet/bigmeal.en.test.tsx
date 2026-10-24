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
import { macroTexts, planText, scaleText, verdictText } from './cheatText';
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

describe('bigger meal in English', () => {
  test('the bigger-meal sheet speaks English: the day only, on the ±100 band', async () => {
    await saveProfile(
      completeProfile({
        startDate: '2026-10-01',
        dailyKcal: 2000,
        targetWeightKg: 75,
        goals: [{ from: '2026-10-01', kcal: 2000, by: 'setup' }],
      }),
    );
    await logQuick(TODAY, 'Kanapka', 1500);
    window.history.replaceState(null, '', '/#/jedzenie');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);

    // The diary's button reads „Bigger meal” once the diary is rewritten, „Cheat meal” before that.
    await user.click(await screen.findByRole('button', { name: /^(Bigger meal|Cheat meal)$/ }));
    const sheet = screen.getByRole('dialog', { name: 'Bigger meal' });
    expect(within(sheet).getByText('Pick from the list or enter the macros — you’ll see what’s left for the rest of the day')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Enter macros' }));
    await user.type(within(sheet).getByLabelText('Calories (kcal)'), '1200');
    const sim = within(sheet).getByRole('region', { name: 'What it means' });
    expect(sim).toHaveTextContent(/Today’s target\s*2,000 kcal/);
    expect(sim).toHaveTextContent(/Bigger meal\s*1,200 kcal/);
    expect(sim).toHaveTextContent(
      'That’s about 700 kcal over the day’s target. One day like that doesn’t change the trend — tomorrow, just eat as usual.',
    );
    expect(sim).toHaveTextContent('The scale may show more for a day or two — that’s water and salt, not fat.');
    expect(sim).not.toHaveTextContent(/Week:|weight forecast|make up for it/);
    expect(sim.textContent).not.toMatch(POLISH);
    expect(within(sheet).getByRole('button', { name: 'Plan it' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Eaten now' })).toBeInTheDocument();
  });
});

describe('bigger-meal texts composed in code', () => {
  const targets = DIET_PROFILES.redukcja.targets(2000, 75);
  const noPolish = (texts: (string | null)[]) => {
    for (const t of texts) if (t) expect(t, t).not.toMatch(POLISH);
  };

  test('every verdict and its side lines in English', () => {
    const base = { targets, plannedLeftKcal: 1200 };
    const fits = simulateCheat({ ...base, cheat: { kcal: 600, protein: 20, carbs: 70, fat: 25 }, eaten: totals([]), mealsLeft: 3 });
    const tight = simulateCheat({ ...base, cheat: { kcal: 1500, protein: 20, carbs: 150, fat: 70 }, eaten: totals([]), mealsLeft: 4 });
    const full = simulateCheat({ ...base, cheat: { kcal: 650, protein: 20, carbs: 50, fat: 20 }, eaten: totals([{ kcal: 1430, protein: 60, carbs: 120, fat: 40 }]), mealsLeft: 2 });
    const last = simulateCheat({ ...base, cheat: { kcal: 700, protein: 40, carbs: 50, fat: 20 }, eaten: totals([{ kcal: 900, protein: 50, carbs: 90, fat: 30 }]), mealsLeft: 1 });
    const over = simulateCheat({
      ...base,
      cheat: { kcal: 1400, protein: 30, carbs: 200, fat: 80 },
      eaten: totals([{ kcal: 1400, protein: 60, carbs: 120, fat: 40 }]),
      mealsLeft: 2,
    });
    expect(verdictText(fits)).toMatch(/^It fits: about 1,400 kcal left for 2 meals — about 700 kcal and \d+ g protein each\.$/);
    expect(verdictText(tight)).toBe('It just fits: about 500 kcal left for 3 meals — about 170 kcal and 43 g protein each, so snacks rather than meals.');
    expect(verdictText(full)).toBe('It fits — that fills the day’s target.');
    const oneMealLeft = simulateCheat({ ...base, cheat: { kcal: 600, protein: 20, carbs: 70, fat: 25 }, eaten: totals([]), mealsLeft: 2 });
    expect(verdictText(oneMealLeft)).toBe('It fits: about 1,400 kcal left for 1 meal.');
    expect(verdictText(last)).toBe('It fits: this is the last meal of the day, with about 400 kcal to spare.');
    expect(verdictText(over)).toBe(
      'That’s about 800 kcal over the day’s target. One day like that doesn’t change the trend — tomorrow, just eat as usual.',
    );
    expect(scaleText(over)).toBe('The scale may show more for a day or two — that’s water and salt, not fat.');
    expect(scaleText(fits)).toBeNull();
    noPolish([verdictText(fits), verdictText(tight), verdictText(full), verdictText(last), verdictText(over)]);
    noPolish([planText(fits), planText(tight), planText(over), ...macroTexts(fits), ...macroTexts(over), ...macroTexts(last)]);
  });
});
