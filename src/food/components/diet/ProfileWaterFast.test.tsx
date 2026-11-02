// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { renderWithBridge } from '../../test/bridge';
import DietProfilePage from './DietProfilePage';

/* Profil diety w tej rundzie: „Pokazuj nawodnienie” z celem napojów i „Okno jedzenia”. */

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

const stored = (over: Partial<Profile> = {}) =>
  completeProfile({
    startDate: '2026-10-01',
    dailyKcal: 2000,
    goals: [{ from: '2026-10-01', kcal: 2000, by: 'setup' }],
    targetWeightKg: 75,
    goalPace: 0.5,
    ...over,
  });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie/profil');
});

afterEach(() => {
  vi.useRealTimers();
});

const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Zapisz profil' }));

describe('Nawodnienie w profilu', () => {
  test('domyślnie włączona, cel pusty z wartością EFSA w opisie; własny cel się zapisuje', async () => {
    await saveProfile(stored({ sex: 'K' }));
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const section = await screen.findByRole('region', { name: 'Nawodnienie' });
    expect(within(section).getByRole('checkbox', { name: 'Pokazuj nawodnienie w dzienniku' })).toBeChecked();
    const field = within(section).getByLabelText('Cel z napojów dziennie');
    expect(field).toHaveValue('');
    expect(section).toHaveTextContent('Puste pole: 1600 ml według EFSA');
    await user.type(field, '2200');
    await save(user);
    await waitFor(async () => expect((await db.profile.get('me'))!.waterMl).toBe(2200));
  });

  test('poza zakresem: powód pod polem i zapis wstrzymany', async () => {
    await saveProfile(stored());
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const field = await screen.findByLabelText('Cel z napojów dziennie');
    await user.type(field, '90');
    await save(user);
    expect(screen.getByText('Wpisz liczbę od 500 do 5000.')).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect((await db.profile.get('me'))!.waterMl).toBeNull();
  });

  test('„Pokazuj nawodnienie” wyłączone: pole znika, zapis to pamięta', async () => {
    await saveProfile(stored());
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Pokazuj nawodnienie w dzienniku' }));
    expect(screen.queryByLabelText('Cel z napojów dziennie')).not.toBeInTheDocument();
    await save(user);
    await waitFor(async () => expect((await db.profile.get('me'))!.showWater).toBe(false));
  });
});

describe('Okno jedzenia w profilu', () => {
  test('domyślnie wyłączone; 16:8 się zapisuje, a cel zostaje ten sam', async () => {
    await saveProfile(stored());
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const group = await screen.findByRole('group', { name: 'Okno jedzenia' });
    expect(within(group).getByRole('radio', { name: 'Wyłączone' })).toBeChecked();
    expect(group).toHaveTextContent('Opcja, nie zalecenie');
    expect(within(group).getByRole('link', { name: 'Więcej o zdrowiu i bezpieczeństwie' })).toHaveAttribute('href', '#/zdrowie');
    await user.click(within(group).getByRole('radio', { name: '16:8 — 16 h postu, 8 h na jedzenie' }));
    await save(user);
    await waitFor(async () => expect((await db.profile.get('me'))!.fastPlan).toBe('16:8'));
    expect((await db.profile.get('me'))!.dailyKcal).toBe(2000);
  });

  test('w ciąży lub przy karmieniu: niedostępne z wyjaśnieniem, a zapis wyłącza zapisane wcześniej', async () => {
    await saveProfile(stored({ sex: 'K', fastPlan: '14:10' }));
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const group = await screen.findByRole('group', { name: 'Okno jedzenia' });
    expect(within(group).getByRole('radio', { name: /^14:10/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Jestem w ciąży lub karmię piersią' }));
    for (const plan of ['12:12', '14:10', '16:8', '18:6']) {
      expect(within(group).getByRole('radio', { name: new RegExp(`^${plan}`) })).toBeDisabled();
    }
    expect(within(group).getByRole('radio', { name: 'Wyłączone' })).toBeChecked();
    expect(group).toHaveAccessibleDescription(/W ciąży i podczas karmienia okno jedzenia jest niedostępne/);
    await save(user);
    await waitFor(async () => expect((await db.profile.get('me'))!).toMatchObject({ pregnancy: true, fastPlan: null }));
  });
});
