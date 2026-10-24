// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// This file runs in English: the language is fixed when the language module is first imported.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
import DietProfilePage from './DietProfilePage';
import { Onboarding } from './Onboarding';

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

/** Polish letters: none may be left in text the profile composes itself. */
const POLISH = /[ąćęłńóśźż]/i;

/**
 * Polish texts of the diet catalogs that must not show up in English (data — product and shop
 * names — may; so may the shared star button, which another area translates).
 */
const POLISH_UI = [
  'Profil diety',
  'Zacznij od profilu',
  'Zapisz',
  'Wzrost',
  'Twój cel',
  'Schudnąć',
  'Utrzymać',
  'Przybrać',
  'Waga docelowa',
  'Głównie siedzę',
  'Tempo',
  'Jak liczę cel',
  'Ustawienia liczenia',
  'Dopasowuj',
  'Bez liczenia',
  'Przerwa',
  'Zbilansowana',
  'Sportowa',
  'kroków',
  'dziennie',
  'Waga teraz',
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
  test('first visit asks for the profile in English: the goal first, then the target', async () => {
    window.history.replaceState(null, '', '/#/jedzenie/profil');
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />, testBridge({ stepsOn: () => 8400 }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Start with your profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.getByLabelText('Your weight now')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Mostly sitting/ })).toBeChecked();
    expect(screen.getByText('Your average over the last 2 weeks: 8,400 steps a day.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and start' }));
    expect(screen.getByText('Choose your goal.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Lose weight' }));
    await user.type(screen.getByLabelText('Target weight'), '55');
    expect(screen.getByText('The lowest target weight for your height is 57 kg (BMI 18.5).')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Target weight'));
    await user.type(screen.getByLabelText('Target weight'), '75');
    expect(screen.getByText('Target: 2,100 kcal a day · protein at least 150 g')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Pace' })).toHaveTextContent('−0.25 kg/wk−0.5 kg/wk−0.75 kg/wk');
    expect(screen.getByText(/^This is a first estimate — for most people it’s within about 300 kcal\./)).toBeInTheDocument();
    await user.click(screen.getByText('Set the target yourself'));
    await user.type(screen.getByLabelText('Daily (kcal)'), '1400');
    expect(screen.getByText('At least 1,500 kcal.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Daily (kcal)'));
    await user.type(screen.getByLabelText('Daily (kcal)'), '1600');
    expect(screen.getByText(/^That’s below your basal metabolic rate \(1,750 kcal\)/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'This target is agreed with a doctor or dietitian' })).toBeInTheDocument();
    expect(screen.getByText('Pace at this target: about −0.95 kg a week')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save and start' })).toBeInTheDocument();
    expectNoPolishUi();
    expect(document.querySelector('form')!.textContent).not.toMatch(POLISH);
  }, 15_000);

  test('a saved profile: goal, usual week, „How I work out the target” and counting settings in English, stored ids untouched', async () => {
    await saveProfile(
      completeProfile({
        startDate: '2026-10-01',
        dailyKcal: 2100,
        goals: [{ from: '2026-10-01', kcal: 2100, by: 'setup' }],
        goalPace: 0.5,
        targetWeightKg: 75,
        dietProfile: 'keto',
      }),
    );
    window.history.replaceState(null, '', '/#/jedzenie/profil?jak=1');
    renderWithBridge(<DietProfilePage />, testBridge({ weights: [{ day: '2026-10-12', kg: 80 }, { day: '2026-10-13', kg: 81 }] }));
    expect(await screen.findByRole('heading', { name: 'Your goal' })).toBeInTheDocument();
    expect(screen.getByText('Weight now: 80.1 kg (trend from your weigh-ins).')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lose weight' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^About an hour of activity every day/ })).toBeInTheDocument();
    for (const label of ['High-protein cut', 'Balanced', 'Low carb', 'Keto', 'Athletic'])
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: /^Fit the target every week — on Mondays, by 100 kcal/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^No calorie counting — the diary shows protein/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'A week’s break' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 weeks' })).toBeInTheDocument();
    const how = screen.getByText('How I work out the target').closest('details')!;
    expect(how).toHaveAttribute('open');
    expect(how).toHaveTextContent('From that I take what your pace needs: 0.5 kg a week is about 540 kcal a day.');
    expect(how).toHaveTextContent(/Right now I reckon you burn about 2,6\d0 kcal a day\./);
    expect(how).toHaveTextContent('The app doesn’t replace a dietitian or a doctor.');
    expect((await db.profile.get('me'))?.dietProfile).toBe('keto');
    expectNoPolishUi(['Zapisz profil', 'Waga na starcie']);
    expect(document.querySelector('form')!.textContent).not.toMatch(POLISH);
  });

  test('a woman can say she is pregnant or breastfeeding; under 18 the goal gives way to one sentence', async () => {
    await saveProfile(
      completeProfile({
        startDate: '2026-10-01',
        sex: 'K',
        age: 30,
        heightCm: 165,
        startWeightKg: 65,
        targetWeightKg: 60,
        dailyKcal: 1550,
        goals: [{ from: '2026-10-01', kcal: 1550, by: 'setup' }],
        goalPace: 0.5,
      }),
    );
    window.history.replaceState(null, '', '/#/jedzenie/profil');
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    await user.click(await screen.findByRole('checkbox', { name: 'I’m pregnant or breastfeeding' }));
    expect(screen.getByRole('radio', { name: 'Lose weight' })).toBeDisabled();
    expect(screen.getByText(/^During pregnancy and breastfeeding I don’t set a deficit/)).toBeInTheDocument();
    const age = screen.getByLabelText('Age');
    await user.clear(age);
    await user.type(age, '16');
    expect(screen.getByText(/^Under 18 I don’t set a deficit or show calories/)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Lose weight' })).not.toBeInTheDocument();
    expect(document.querySelector('form')!.textContent).not.toMatch(POLISH);
  });

  test('the diary’s onboarding offers the profile with or without calorie counting', () => {
    render(<Onboarding />);
    expect(screen.getByText('You log what you eat, and the diary shows what’s left for today — calories and protein.')).toBeInTheDocument();
    expect(screen.getByText('There’s one target for the whole day, and every week I fit it to your weight.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up your diet profile' })).toHaveAttribute('href', '#/jedzenie/profil');
    expect(screen.getByRole('link', { name: 'No calorie counting' })).toHaveAttribute('href', '#/jedzenie/profil?tryb=bez-liczb');
    expect(screen.getByText('The diary shows protein and suggests meals, without calories. You can change it in the profile.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(POLISH);
  });
});
