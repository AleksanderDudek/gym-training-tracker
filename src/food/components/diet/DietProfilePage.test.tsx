// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
import DietProfilePage from './DietProfilePage';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
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

describe('Profil diety', () => {
  test('pierwsze wejście pyta o profil — z wagą i wzrostem z treningów — a zapis otwiera dziennik', async () => {
    const user = userEvent.setup();
    const bridge = testBridge({ weights: [{ day: '2026-10-10', kg: 90 }], heightCm: 182 });
    renderWithBridge(<DietProfilePage />, bridge);
    expect(await screen.findByRole('heading', { level: 2, name: 'Zacznij od profilu' })).toBeInTheDocument();
    // Liczby formularza liczą się na żywo z tego, co wpisane.
    expect(screen.getByText('Podstawowe spalanie (BMR)')).toBeInTheDocument();
    expect(screen.getByLabelText('Wzrost')).toHaveValue('182');
    expect(screen.getByLabelText('Waga na starcie')).toHaveValue('90');
    await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));

    await waitFor(async () =>
      expect(await db.profile.get('me')).toMatchObject({
        dailyKcal: 2000,
        dietProfile: 'redukcja',
        heightCm: 182,
        startWeightKg: 90,
        targetWeightKg: 85,
        startDate: '2026-10-14',
      }),
    );
    await waitFor(() => expect(window.location.hash).toBe('#/jedzenie'));
    expect(window.localStorage.getItem('gt:diet')).toBe('1');
    // Wzrost się nie zmienił — treningi nie dostają zbędnego zapisu.
    expect(bridge.setHeight).not.toHaveBeenCalled();
  });

  test('literówka w liczbie zatrzymuje zapis i mówi, czego się spodziewa', async () => {
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const age = await screen.findByLabelText('Wiek');
    await user.clear(age);
    await user.type(age, '3x');
    expect(screen.getByText('Wpisz liczbę od 14 do 100.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
    expect(age).toHaveFocus();
    expect(await db.profile.get('me')).toBeUndefined();
  });

  test('wzrost czyta z treningów i zapisuje do obu miejsc', async () => {
    await saveProfile(completeProfile({ heightCm: 175, startDate: '2026-10-01' }));
    const user = userEvent.setup();
    // Jak w App: zapis wzrostu zmienia to, co most podaje przy następnym renderze.
    const bridge = testBridge({ heightCm: 182 });
    bridge.setHeight = vi.fn((cm: number) => {
      bridge.heightCm = cm;
    });
    renderWithBridge(<DietProfilePage />, bridge);
    const height = await screen.findByLabelText('Wzrost');
    expect(height).toHaveValue('182');
    await user.clear(height);
    await user.type(height, '180');
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByText('Zapisano')).toBeInTheDocument();
    expect(await db.profile.get('me')).toMatchObject({ heightCm: 180 });
    expect(bridge.setHeight).toHaveBeenCalledWith(180);
  });

  test('wyczyszczenie danych diety zdejmuje znacznik karty z ekranu Dziś', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    await user.click(await screen.findByRole('button', { name: 'Usuń wszystkie dane diety' }));
    await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
    const confirm = screen.getByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Usuń wszystko' }));
    await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBeNull());
    expect(await db.profile.get('me')).toBeUndefined();
    // Bez profilu strona wraca do pierwszego kroku.
    expect(await screen.findByRole('heading', { name: 'Zacznij od profilu' })).toBeInTheDocument();
  });
});
