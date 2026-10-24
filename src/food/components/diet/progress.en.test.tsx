// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { addDays } from '../../diet/model';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
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

const TODAY = '2026-10-14';
const POLISH = /[ąćęłńóśźż]/i;

/**
 * Polish texts of the progress page that must not show up in English (data — product names — may).
 */
const POLISH_UI = [
  'Postęp',
  'Teraz',
  'Od startu',
  'Do celu',
  'waga docelowa',
  'Waga',
  'Tempo',
  'tydzień',
  'Przy zakładanym',
  'Cel kalorii',
  'Tydzień po tygodniu',
  'Jedzenie',
  'Kroki',
  'Treningi',
  'Kalorie',
  'brak zapisów',
  'cel 2000',
  'Białko',
  'Średnio',
  'Kreska',
  'Zjedzone kalorie',
  'ponad cel',
  'Według planu',
  'Co działa u ciebie',
];

/** Every text and accessible label on the page, for the absence checks. */
function pageText(): string {
  const attrs = [...document.querySelectorAll('[aria-label],[title],[placeholder],[aria-valuetext]')].flatMap((el) =>
    ['aria-label', 'title', 'placeholder', 'aria-valuetext'].map((a) => el.getAttribute(a) ?? ''),
  );
  return [document.body.textContent ?? '', ...attrs].join('\n');
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

describe('progress in English', () => {
  test('the trend, the pace and when the target weight comes, the target history, the weeks, the fortnight and protein', async () => {
    await saveProfile(completeProfile({ startDate: '2026-09-01', startWeightKg: 84, targetWeightKg: 77.7, dailyKcal: 2000, anchored: true }));
    await logQuick('2026-10-12', 'Obiad', 1800, { protein: 120, carbs: 180, fat: 60 });
    // 28 daily weigh-ins losing 0.5 kg a week, ±0.1 kg of water day to day.
    const weights = Array.from({ length: 28 }, (_, i) => ({ day: addDays(TODAY, i - 27), kg: 84 - (0.5 / 7) * i + (i % 2 ? -0.1 : 0.1) }));
    window.history.replaceState(null, '', '/#/jedzenie/postep');
    renderWithBridge(<DietProgressPage />, testBridge({ weights }));

    expect(await screen.findByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    expect(screen.getByText('Now (trend) · last weigh-in 14 Oct')).toBeInTheDocument();
    expect(screen.getByText('To go · target weight 77.7 kg')).toBeInTheDocument();
    expect(screen.getByText('Pace over the last 4 weeks: −0.5 kg a week (±0.1).')).toBeInTheDocument();
    expect(screen.getByText('At this pace, the target weight: around December 2026 – January 2027.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Weight chart: 28 weigh-ins, the trend, a forecast and the target weight 77.7 kg.' })).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Calorie target — changes' });
    expect(within(history).getByText('14 Oct · 2,000 kcal · start')).toBeInTheDocument();
    const weeks = screen.getByRole('region', { name: 'Week by week' });
    expect(within(weeks).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Week', 'Weight', 'Food', 'Steps', 'Workouts']);
    expect(weeks).toHaveTextContent('I’ll show findings when the difference between weeks is clearly bigger than the scale’s noise.');
    const days = within(screen.getByRole('list', { name: 'Calories eaten day by day' })).getAllByRole('listitem');
    expect(days[11]).toHaveTextContent(/: 1,800 kcal, target 2,000$/);
    expect(screen.getByText('Line: the day’s target · light bar: incomplete day.')).toBeInTheDocument();
    expect(screen.getByText('120 g a day on average (target 155 g), from 1 day with full data.')).toBeInTheDocument();

    const all = pageText();
    for (const pl of POLISH_UI) expect(all, `“${pl}” still on the page`).not.toContain(pl);
    expect(all.replace('Obiad', '')).not.toMatch(POLISH);
  });

  test('before the first fit: the planned pace in weeks', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', startWeightKg: 84, targetWeightKg: 78, dailyKcal: 2000 }));
    window.history.replaceState(null, '', '/#/jedzenie/postep');
    renderWithBridge(<DietProgressPage />, testBridge({ weights: [{ day: '2026-10-12', kg: 83 }] }));
    expect(
      await screen.findByText(
        'At the planned pace (−0.5 kg a week) that’s about 10 weeks. I’ll show a forecast from your data after the first fit of your target.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Too few weigh-ins to work out a pace — I need at least 5 over 2 weeks. Weigh yourself in the morning, a few times a week.'),
    ).toBeInTheDocument();
  });
});
