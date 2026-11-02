// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { db, type Entry } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { renderWithBridge } from '../../test/bridge';
import DiaryPage from './DiaryPage';
import DietProfilePage from './DietProfilePage';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Product data isn’t included in this version of the app.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});
vi.mock('../../hooks/useWeeklyCheck', () => ({ useWeeklyCheck: () => 'ready' }));

/** Polish letters: none may be left in the text these cards compose. */
const POLISH = /[ąćęłńóśźż]/i;

const TODAY = '2026-10-14';

const profile = (over: Partial<Profile> = {}) =>
  completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, ...over });

const entry = (date: string, time: string, name: string, over: Partial<Entry> = {}): Entry => ({
  date,
  time,
  name,
  amountLabel: '1 serving',
  kcal: 400,
  protein: 20,
  carbs: 40,
  fat: 15,
  source: 'custom',
  ...over,
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T21:00:00`));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('diary extras in English', () => {
  test('copy, hydration, the eating window and fibre, sugars and salt', async () => {
    await saveProfile(profile({ fastPlan: '16:8' }));
    await db.entries.bulkAdd([
      entry(TODAY, '08:00', 'Oats', { fiber: 8, sugars: 12, salt: 0.4 }),
      entry(TODAY, '19:40', 'Supper', { fiber: null, sugars: null, salt: null }),
    ]);
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);

    const balance = await screen.findByRole('region', { name: 'Day balance' });
    expect(within(balance).getByText('More: carbs, fat, fibre, sugars, salt')).toBeInTheDocument();
    expect(balance).toHaveTextContent('Fibreat least 8 of 25 g (no data in 1 entry)');
    expect(balance).toHaveTextContent('Saltat least 0.4 of 5 g (upper limit; no data in 1 entry)');

    const eaten = screen.getByRole('region', { name: /^Eaten/ });
    expect(within(eaten).getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument();
    expect(within(eaten).getByRole('heading', { name: 'Dinner' })).toBeInTheDocument();
    await user.click(within(eaten).getByRole('button', { name: 'Copy breakfast to…' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Copy breakfast' }));
    expect(sheet.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Tomorrow' }));
    await waitFor(() =>
      expect(bridge.toast).toHaveBeenCalledWith('Copied 1 entry to tomorrow.', expect.objectContaining({ label: 'Undo' })),
    );

    const water = screen.getByRole('region', { name: 'Hydration' });
    expect(water).toHaveTextContent('0 l of 2 l');
    await user.click(within(water).getByRole('button', { name: 'Add 500 ml — water' }));
    await user.click(within(water).getByRole('button', { name: 'Tea' }));
    await user.click(within(water).getByRole('button', { name: 'Add 250 ml — tea' }));
    expect(await within(water).findByText('0.75 l of 2 l')).toBeInTheDocument();
    expect(within(water).getByText('Water 0.5 l · Tea 0.25 l')).toBeInTheDocument();
    expect(within(water).getByText(/^Caffeine from coffee and tea: about 50 mg\. EFSA considers up to 400 mg a day safe for adults/)).toBeInTheDocument();

    const fast = screen.getByRole('region', { name: /^Eating window/ });
    expect(within(fast).getByLabelText('Fast started at')).toHaveValue('19:40');
    expect(fast).toHaveTextContent('Intermittent fasting isn’t for people who are pregnant');
    await user.click(within(fast).getByRole('button', { name: 'Start fasting' }));
    expect(await within(fast).findByText('Fasting since 19:40 · 14 h 40 min to go')).toBeInTheDocument();

    for (const region of [balance, eaten, water, fast]) expect(region.textContent).not.toMatch(POLISH);
  }, 15_000);

  test('the diet profile: hydration and the eating window', async () => {
    await saveProfile(profile({ sex: 'K', pregnancy: true }));
    renderWithBridge(<DietProfilePage />);
    const water = await screen.findByRole('region', { name: 'Hydration' });
    expect(within(water).getByRole('checkbox', { name: 'Show hydration in the diary' })).toBeChecked();
    expect(water).toHaveTextContent('Empty: 1,900 ml after EFSA');
    const group = screen.getByRole('group', { name: 'Eating window' });
    expect(within(group).getByRole('radio', { name: '16:8 — 16 h fasting, 8 h for eating' })).toBeDisabled();
    expect(group).toHaveTextContent('In pregnancy and while breastfeeding the eating window isn’t available');
    for (const region of [water, group]) expect(region.textContent).not.toMatch(POLISH);
  });
});
