// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { renderWithBridge, testBridge } from '../../test/bridge';
import { minimalWorkbook } from '../../test/workbook';
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

  test('pierwszy import arkusza tworzy profil, prowadzi do dziennika i mówi, co wczytał', async () => {
    const user = userEvent.setup();
    const bridge = testBridge();
    renderWithBridge(<DietProfilePage />, bridge);
    const file = new File([minimalWorkbook() as BlobPart], 'plan.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(await screen.findByLabelText('Wczytaj z Excela'), file);

    await waitFor(() => expect(window.location.hash).toBe('#/jedzenie'));
    expect(bridge.toast).toHaveBeenCalledWith(
      expect.stringMatching(/^Wczytano „.*”: 2 dni, 1 dni wzorcowych, 1 wariantów.* Profil diety ustawiony z arkusza\.$/),
    );
    expect(await db.profile.get('me')).toMatchObject({ startWeightKg: 95, dailyKcal: 1800 });
    expect(await db.plans.count()).toBe(1);
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

  test('wzrost w całych centymetrach: ułamek z profilu diety nie cofa szkicu po zapisie', async () => {
    // Profil z arkusza albo z Produktów PL, a treningi bez wzrostu.
    await saveProfile(completeProfile({ heightCm: 180.5, startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const bridge = testBridge();
    // Jak w App: treningi trzymają wzrost w całych centymetrach.
    bridge.setHeight = vi.fn((cm: number) => {
      bridge.heightCm = Math.round(cm);
    });
    renderWithBridge(<DietProfilePage />, bridge);
    const height = await screen.findByLabelText('Wzrost');
    expect(height).toHaveValue('181');
    expect(height).toHaveAttribute('inputmode', 'numeric');
    const age = screen.getByLabelText('Wiek');
    await user.clear(age);
    await user.type(age, '36');
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));

    await waitFor(async () => expect(await db.profile.get('me')).toMatchObject({ heightCm: 181, age: 36 }));
    expect(bridge.setHeight).toHaveBeenCalledWith(181);
    // Wiersz wraca z IndexedDB z tym samym wzrostem, więc formularz zostaje przy „Zapisano”.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Zapisano')).toBeInTheDocument();
    expect(screen.getByLabelText('Wzrost')).toHaveValue('181');
  });

  describe('przywrócona kopia: znacznik karty na ekranie Dziś idzie za profilem z kopii', () => {
    const backup = (profile: Profile | null) => ({
      app: 'produkty-pl',
      version: 1,
      exportedAt: '2026-10-14T10:00:00.000Z',
      profile,
      days: [],
      entries: [],
      plans: [],
      foods: [],
    });

    async function restoreFrom(data: object) {
      const user = userEvent.setup();
      const file = new File([JSON.stringify(data)], 'dieta-kopia.json', { type: 'application/json' });
      await user.upload(await screen.findByLabelText('Przywróć z kopii'), file);
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Przywróć' }));
    }

    test('kopia bez profilu zdejmuje znacznik', async () => {
      await saveProfile(completeProfile({ startDate: '2026-10-01' }));
      renderWithBridge(<DietProfilePage />);
      await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
      await restoreFrom(backup(null));
      await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBeNull());
      expect(await db.profile.count()).toBe(0);
    });

    test('kopia z profilem stawia znacznik', async () => {
      await saveProfile(completeProfile({ startDate: '2026-10-01' }));
      renderWithBridge(<DietProfilePage />);
      await screen.findByLabelText('Przywróć z kopii');
      // Znacznik zgubiony (np. wyczyszczony na innej karcie) — kopia z profilem stawia go z powrotem.
      window.localStorage.removeItem('gt:diet');
      await restoreFrom(backup(completeProfile({ startDate: '2026-09-01', dailyKcal: 2200 })));
      expect(await screen.findByText('Kopia przywrócona.')).toBeInTheDocument();
      expect(window.localStorage.getItem('gt:diet')).toBe('1');
      expect(await db.profile.get('me')).toMatchObject({ startDate: '2026-09-01', dailyKcal: 2200 });
    });
  });

  test('moje zestawy: lista z sumą i składem, usuwanie jednym stuknięciem', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.sets.add({
      name: 'Banan i batonik',
      parts: [
        { name: 'Banan', amountLabel: '120 g', kcal: 107, protein: 1.3, carbs: 27.4, fat: 0.4 },
        { name: 'Baton proteinowy', amountLabel: '45 g', kcal: 171, protein: 14.9, carbs: 13, fat: 7.2 },
      ],
    });
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const row = (await screen.findByText('Banan i batonik')).closest('li')!;
    expect(row).toHaveTextContent('278 kcal · Banan 120 g + Baton proteinowy 45 g');
    await user.click(within(row).getByRole('button', { name: 'Usuń zestaw: Banan i batonik' }));
    await waitFor(async () => expect(await db.sets.count()).toBe(0));
    expect(await screen.findByText(/W „Dodaj zjedzone → Zestaw”/)).toBeInTheDocument();
  });

  test('ulubione: lista z liczbą zjedzeń i usuwanie z ulubionych', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.favorites.put({
      key: 'custom:1',
      food: {
        key: 'custom:1',
        name: 'Owsianka',
        detail: 'moje',
        source: 'custom',
        amountLabel: '1 miska',
        nutrients: { kcal: 400, protein: 20, carbs: 50, fat: 10 },
        per100: null,
        grams: null,
        stores: [],
        atHome: true,
        role: 'main',
      },
      addedAt: '',
      uses: 3,
      lastUsed: null,
    });
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const row = (await screen.findByText('Owsianka')).closest('li')!;
    expect(row).toHaveTextContent('400 kcal · 1 miska · zjedzone 3×');
    await user.click(within(row).getByRole('button', { name: 'Usuń z ulubionych: Owsianka' }));
    await waitFor(async () => expect(await db.favorites.count()).toBe(0));
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
