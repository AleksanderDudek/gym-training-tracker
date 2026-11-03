// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { db, type Entry } from '../../diet/db';
import { addDays } from '../../diet/model';
import { clearAll, saveProfile } from '../../diet/store';
import { historyList, historyText } from '../../shop/history';
import { renderWithBridge } from '../../test/bridge';
import { PREP_DICT, prepCandidates, prepProfile } from '../../test/prep';
import ShoppingPage from './ShoppingPage';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const { PREP_DICT } = await import('../../test/prep');
  const loaded = { dataset: { ...DATASET, dictionaries: { ...DATASET.dictionaries, stores: PREP_DICT.stores } }, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Product data is not included in this version of the app.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

vi.mock('../../recipes/resolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../recipes/resolve')>();
  const { prepIndex } = await import('../../test/prep');
  const index = prepIndex();
  return { ...actual, recipeIndex: () => index };
});

const TODAY = '2026-11-03';
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const POLISH = /[ąćęłńóśźż]/i;

const entries = (n: number): Entry[] =>
  Array.from({ length: n }, (_, i) => ({
    date: addDays(TODAY, -1 - i),
    time: '08:00',
    name: 'Skyr with raspberries',
    amountLabel: '1 serving',
    kcal: 300,
    protein: 20,
    carbs: 20,
    fat: 5,
    source: 'recipe' as const,
    key: 'recipe:skyr-maliny',
  }));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T09:00:00'));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Shopping from the diary in English', () => {
  test('the page: header, rhythm card, list, footer', async () => {
    await saveProfile(prepProfile());
    await db.entries.bulkAdd(entries(7));
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('heading', { name: 'Shopping: Sat, 7 Nov' })).toBeInTheDocument();
    expect(screen.getByText('Food for 7 days (7–13 Nov): the average of 7 logged days from the last 4 weeks.')).toBeInTheDocument();
    const list = screen.getByRole('region', { name: 'To buy' });
    expect(within(list).getByRole('checkbox', { name: /Plain skyr/ }).closest('li')).toHaveTextContent('eaten on 7 of 7 days');
    expect(screen.getByRole('region', { name: 'Check at home' })).toBeInTheDocument();
    expect(screen.getByText(/This is the diary’s average, not what’s at home/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Calendar/ })).toHaveAttribute('href', '#/kalendarz');

    const card = screen.getByRole('region', { name: 'When you shop' });
    expect(within(card).getByText(/Not set — for now I count up to Saturday/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Set' }));
    expect(within(card).getByRole('button', { name: 'Tuesday' })).toHaveTextContent('Tue');
    expect(within(card).getByRole('button', { name: 'Every few days' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(POLISH);
  });

  test('too few days, and the text list', async () => {
    await saveProfile(prepProfile());
    await db.entries.bulkAdd(entries(2));
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByText('Not enough logged for a list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Make a plan' })).toHaveAttribute('href', '#/jedzenie/plan');

    const l = historyList({ entries: entries(7), today: TODAY, rhythm: { kind: 'weekdays', days: [6], at: '10:00' }, basket: ['biedronka'], candidates: prepCandidates(), dict: PREP_DICT });
    const text = historyText(l, new Set());
    expect(text).toMatch(/^Shopping from the diary · Sat, 7 Nov \(food for 7–13 Nov\)\n\nList\n {2}Dairy & eggs\n/);
    expect(text).toContain('Check at home');
    expect(text).toMatch(/Average of 7 logged days from the last 4 weeks — check the fridge\.$/);
    expect(text).not.toMatch(POLISH);
  });
});
