// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { renderWithBridge } from '../../test/bridge';
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

describe('diet profile in English', () => {
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
