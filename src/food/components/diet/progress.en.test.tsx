// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

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

describe('progress in English', () => {
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
});
