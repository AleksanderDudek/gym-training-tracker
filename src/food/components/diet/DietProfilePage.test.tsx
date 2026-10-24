// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { clearAll, completeProfile, endPause, saveProfile, startPause } from '../../diet/store';
import { hidesKcal } from '../../diet/target';
import type { Profile } from '../../diet/types';
import { renderWithBridge, testBridge } from '../../test/bridge';
import { minimalWorkbook } from '../../test/workbook';
import DietProfilePage from './DietProfilePage';
import { Onboarding } from './Onboarding';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

// Przerwa to zapis w magazynie (pakiet A): tu tylko to, że profil woła ją z dzisiejszą datą i wagą.
vi.mock('../../diet/store', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../diet/store')>();
  return { ...real, startPause: vi.fn(async () => {}), endPause: vi.fn(async () => {}) };
});

const TODAY = '2026-10-14';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie/profil');
  vi.mocked(startPause).mockClear();
  vi.mocked(endPause).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A stored profile with its own target history: `kcal` since `startDate`. */
function stored(kcal: number, over: Partial<Profile> = {}): Profile {
  const startDate = over.startDate ?? '2026-10-01';
  return completeProfile({
    startDate,
    dailyKcal: kcal,
    goals: [{ from: startDate, kcal, by: 'setup' }],
    settle: { from: '2026-10-15', why: 'start' },
    targetWeightKg: 75,
    goalPace: 0.5,
    ...over,
  });
}

/** The owner after the upgrade: 1860 kept to the kcal, the burn tied to data. */
const owner = (over: Partial<Profile> = {}) =>
  stored(1860, {
    startDate: '2026-09-01',
    goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
    anchored: true,
    burnOffset: -241,
    ...over,
  });

const radio = (name: string | RegExp) => screen.getByRole('radio', { name });
const resultLine = () => screen.queryByText(/^Cel: .* kcal dziennie · białko co najmniej/);

describe('Profil diety — nowy profil', () => {
  test(
    'pierwsze wejście: waga i wzrost z treningów, cel „Schudnąć”, a zapis otwiera dziennik',
    async () => {
      const user = userEvent.setup();
      const bridge = testBridge({ weights: [{ day: '2026-10-10', kg: 90 }], heightCm: 182 });
      renderWithBridge(<DietProfilePage />, bridge);
      expect(await screen.findByRole('heading', { level: 2, name: 'Zacznij od profilu' })).toBeInTheDocument();
      expect(screen.getByLabelText('Wzrost')).toHaveValue('182');
      expect(screen.getByLabelText('Ile ważysz teraz')).toHaveValue('90');
      // Najpierw pytanie, czego ktoś chce: żaden cel nie jest zaznaczony z góry, waga docelowa pusta.
      for (const goal of ['Schudnąć', 'Utrzymać wagę', 'Przybrać']) expect(radio(goal)).not.toBeChecked();
      await user.click(radio('Schudnąć'));
      expect(screen.getByLabelText('Waga docelowa')).toHaveValue('');
      await user.type(screen.getByLabelText('Waga docelowa'), '85');
      expect(resultLine()).toHaveTextContent('Cel: 2300 kcal dziennie · białko co najmniej 170 g');
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));

      await waitFor(async () =>
        expect(await db.profile.get('me')).toMatchObject({
          dailyKcal: 2300,
          goalPace: 0.5,
          heightCm: 182,
          startWeightKg: 90,
          targetWeightKg: 85,
          startDate: TODAY,
          goals: [{ from: TODAY, kcal: 2300, by: 'setup' }],
        }),
      );
      await waitFor(() => expect(window.location.hash).toBe('#/jedzenie'));
      expect(window.localStorage.getItem('gt:diet')).toBe('1');
      // Wzrost się nie zmienił — treningi nie dostają zbędnego zapisu.
      expect(bridge.setHeight).not.toHaveBeenCalled();
    },
    15_000,
  );

  test(
    'domyślny mężczyzna (35 lat, 175 cm, 80 kg): „Głównie siedzę”, −0,5 kg/tydz. → 2100 kcal z historią od dziś',
    async () => {
      const user = userEvent.setup();
      renderWithBridge(<DietProfilePage />);
      await user.click(await screen.findByRole('radio', { name: 'Schudnąć' }));
      expect(radio(/^Głównie siedzę/)).toBeChecked();
      await user.type(screen.getByLabelText('Waga docelowa'), '75');
      const paces = screen.getByRole('group', { name: 'Tempo' });
      expect(within(paces).getAllByRole('button').map((b) => b.textContent)).toEqual([
        '−0,25 kg/tydz.',
        '−0,5 kg/tydz.',
        '−0,75 kg/tydz.',
      ]);
      // Bez kalorii na przyciskach tempa — wynik to jedna linijka pod nimi.
      expect(paces).not.toHaveTextContent('kcal');
      await user.click(within(paces).getByRole('button', { name: '−0,5 kg/tydz.' }));
      expect(within(paces).getByRole('button', { name: '−0,5 kg/tydz.' })).toHaveAttribute('aria-pressed', 'true');
      expect(resultLine()).toHaveTextContent('Cel: 2100 kcal dziennie · białko co najmniej 150 g');
      expect(screen.getByText(/^To pierwszy szacunek — u większości ludzi trafia z dokładnością do ok\. 300 kcal\./)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));

      await waitFor(async () => expect((await db.profile.get('me'))?.goals).toEqual([{ from: TODAY, kcal: 2100, by: 'setup' }]));
      const saved = (await db.profile.get('me'))!;
      expect(saved).toMatchObject({ dailyKcal: 2100, activityLevel: 'inactive', goalPace: 0.5, anchored: false, burnOffset: 0 });
      expect(saved.lastCheck).toMatchObject({ week: '2026-10-12', status: 'setup', from: 2100, to: 2100 });
      expect(saved.settle).toEqual({ from: '2026-10-28', why: 'start' });
    },
    15_000,
  );

  test(
    'bez celu i bez wagi docelowej zapis pyta o nie po kolei, z fokusem na brakującym polu',
    async () => {
      const user = userEvent.setup();
      renderWithBridge(<DietProfilePage />);
      await user.click(await screen.findByRole('button', { name: 'Zapisz i zacznij' }));
      expect(screen.getByText('Wybierz cel.')).toBeInTheDocument();
      expect(radio('Schudnąć')).toHaveFocus();
      await user.click(radio('Schudnąć'));
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
      expect(screen.getByText('Wpisz wagę docelową.')).toBeInTheDocument();
      expect(screen.getByLabelText('Waga docelowa')).toHaveFocus();
      expect(await db.profile.get('me')).toBeUndefined();
      await user.type(screen.getByLabelText('Waga docelowa'), '75');
      expect(screen.queryByText('Wpisz wagę docelową.')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
      await waitFor(async () => expect((await db.profile.get('me'))?.dailyKcal).toBe(2100));
    },
    15_000,
  );

  test('poniżej 18 lat: bez celu, wagi docelowej i tempa, kalorie ukryte, cel to utrzymanie', async () => {
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const age = await screen.findByLabelText('Wiek');
    await user.clear(age);
    await user.type(age, '16');
    for (const goal of ['Schudnąć', 'Utrzymać wagę', 'Przybrać'])
      expect(screen.queryByRole('radio', { name: goal })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Waga docelowa')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tempo' })).not.toBeInTheDocument();
    expect(resultLine()).not.toBeInTheDocument();
    expect(screen.getByText(/^Poniżej 18 lat nie ustawiam deficytu ani nie pokazuję kalorii/)).toBeInTheDocument();
    const plain = screen.getByRole('checkbox', { name: /^Bez liczenia kalorii/ });
    expect(plain).toBeChecked();
    expect(plain).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
    await waitFor(async () => expect(await db.profile.get('me')).toMatchObject({ age: 16, goalPace: 0 }));
    expect(hidesKcal((await db.profile.get('me'))!)).toBe(true);
  });

  test('BMI poniżej 18,5: „Schudnąć” wyłączone z powodem; waga docelowa poniżej BMI 18,5 albo powyżej obecnej zatrzymuje zapis', async () => {
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const weight = await screen.findByLabelText('Ile ważysz teraz');
    await user.clear(weight);
    await user.type(weight, '56');
    expect(radio('Schudnąć')).toBeDisabled();
    expect(screen.getByText('Przy BMI poniżej 18,5 nie ustawiam deficytu — wybierz utrzymanie albo przybieranie.')).toBeInTheDocument();

    await user.clear(weight);
    await user.type(weight, '80');
    expect(radio('Schudnąć')).toBeEnabled();
    await user.click(radio('Schudnąć'));
    const target = screen.getByLabelText('Waga docelowa');
    await user.type(target, '55');
    expect(screen.getByText('Najniższa waga docelowa przy Twoim wzroście to 57 kg (BMI 18,5).')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
    expect(target).toHaveFocus();
    await user.clear(target);
    await user.type(target, '85');
    expect(screen.getByText('Przy tym celu waga docelowa powinna być niższa niż obecna.')).toBeInTheDocument();
    expect(await db.profile.get('me')).toBeUndefined();
  });

  test(
    'cel ręcznie: poniżej 1500 kcal błąd i fokus, poniżej podstawowej przemiany tylko z lekarzem albo dietetykiem',
    async () => {
      const user = userEvent.setup();
      renderWithBridge(<DietProfilePage />);
      await user.click(await screen.findByRole('radio', { name: 'Schudnąć' }));
      await user.type(screen.getByLabelText('Waga docelowa'), '75');
      await user.click(screen.getByText('Ustaw cel ręcznie'));
      const manual = screen.getByLabelText('Dziennie (kcal)');
      await user.type(manual, '1400');
      expect(screen.getByText('Najniżej 1500 kcal.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
      expect(manual).toHaveFocus();
      expect(await db.profile.get('me')).toBeUndefined();

      await user.clear(manual);
      await user.type(manual, '1600');
      expect(
        screen.getByText(/^To mniej niż Twoja podstawowa przemiana materii \(1750 kcal\) — trudno wtedy dostarczyć wszystkie składniki/),
      ).toBeInTheDocument();
      expect(screen.getByText('Tempo przy tym celu: ok. −0,95 kg na tydzień')).toBeInTheDocument();
      expect(screen.getByText(/^Przy tym celu tempo wychodzi ponad 1% masy ciała na tydzień/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
      expect(manual).toHaveFocus();
      expect(await db.profile.get('me')).toBeUndefined();

      await user.click(screen.getByRole('checkbox', { name: 'Ten cel jest ustalony z lekarzem albo dietetykiem' }));
      expect(resultLine()).toHaveTextContent('Cel: 1600 kcal dziennie');
      // Wpisany cel to też tempo — w granicach bezpieczeństwa (1% z 80 kg).
      expect(screen.getByRole('group', { name: 'Tempo' }).querySelector('[aria-pressed="true"]')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
      await waitFor(async () =>
        expect(await db.profile.get('me')).toMatchObject({ dailyKcal: 1600, belowFloorOk: true, goalPace: 0.8 }),
      );
    },
    15_000,
  );

  test('kroki z treningów są tylko podpowiedzią: 8400 dziennie nie zmienia „Głównie siedzę”', async () => {
    renderWithBridge(<DietProfilePage />, testBridge({ stepsOn: () => 8400 }));
    expect(await screen.findByRole('radio', { name: /^Głównie siedzę/ })).toBeChecked();
    expect(radio(/^Codziennie ok\. godziny ruchu/)).not.toBeChecked();
    expect(screen.getByText('Twoja średnia z ostatnich 2 tygodni: 8400 kroków dziennie.')).toBeInTheDocument();
  });

  test('podpowiedź kroków potrzebuje tygodnia z dwóch ostatnich', async () => {
    const steps = new Set(['2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08']);
    renderWithBridge(<DietProfilePage />, testBridge({ stepsOn: (day) => (steps.has(day) ? 9000 : null) }));
    await screen.findByRole('radio', { name: /^Głównie siedzę/ });
    expect(screen.queryByText(/^Twoja średnia z ostatnich 2 tygodni/)).not.toBeInTheDocument();
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
});

describe('Profil diety — onboarding „Bez liczenia kalorii”', () => {
  test('druga droga z dziennika otwiera profil z włączonym „Bez liczenia kalorii”', async () => {
    render(<Onboarding />);
    expect(screen.getByRole('link', { name: 'Ustaw profil diety' })).toHaveAttribute('href', '#/jedzenie/profil');
    expect(screen.getByRole('link', { name: 'Bez liczenia kalorii' })).toHaveAttribute(
      'href',
      '#/jedzenie/profil?tryb=bez-liczb',
    );
    expect(screen.getByText('Dziennik pokaże białko i podpowie posiłki, bez kalorii. Zmienisz to w profilu.')).toBeInTheDocument();
  });

  test('profil z `?tryb=bez-liczb`: przełącznik włączony, bez linijki z kaloriami, zapis go zostawia', async () => {
    window.history.replaceState(null, '', '/#/jedzenie/profil?tryb=bez-liczb');
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByRole('checkbox', { name: /^Bez liczenia kalorii/ })).toBeChecked();
    await user.click(radio('Utrzymać wagę'));
    expect(resultLine()).not.toBeInTheDocument();
    expect(screen.queryByText('Ustaw cel ręcznie')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz i zacznij' }));
    await waitFor(async () => expect(await db.profile.get('me')).toMatchObject({ hideKcal: true, goalPace: 0 }));
  });
});

describe('Profil diety — zapisany profil', () => {
  test('bez dawnych liczb: BMR, mnożnika, zaawansowanych pól, kroków w planie i celu za ruchem', async () => {
    await saveProfile(stored(2100));
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByRole('heading', { name: 'Twój cel' })).toBeInTheDocument();
    const page = document.body.textContent ?? '';
    for (const gone of ['Podstawowe spalanie (BMR)', '× 1.28', 'Zaawansowane', 'Kroki dziennie (plan)', 'Dopasowuj cel do ruchu', 'Deficyt'])
      expect(page, gone).not.toContain(gone);
    // Waga to trend z dziennika wagi (tu bez ważeń — waga na starcie), a start diety jest zwinięty.
    expect(screen.getByText('Bez ważeń — liczę z wagi na starcie (80 kg).')).toBeInTheDocument();
    expect(screen.getByText('Start diety')).toBeInTheDocument();
    expect(screen.getByLabelText('Waga na starcie')).not.toBeVisible();
    expect(radio('Schudnąć')).toBeChecked();
    expect(screen.getByLabelText('Waga docelowa')).toHaveValue('75');
  });

  test('waga teraz to trend z ważeń, nie ostatnie ważenie', async () => {
    await saveProfile(stored(2100));
    renderWithBridge(
      <DietProfilePage />,
      testBridge({ weights: [{ day: '2026-10-12', kg: 80 }, { day: '2026-10-13', kg: 81 }] }),
    );
    expect(await screen.findByText('Waga teraz: 80,1 kg (trend z ważeń).')).toBeInTheDocument();
  });

  test(
    'spalanie z danych: zmiana zwykłego tygodnia przesuwa przesunięcie spalania, a cel zostaje (−241 → −641)',
    async () => {
      await saveProfile(owner());
      const user = userEvent.setup();
      renderWithBridge(<DietProfilePage />);
      const summary = await screen.findByText('Odpowiedzi do pierwszego szacunku');
      const note = screen.getByText(/^Spalanie liczę już z Twoich danych, więc zmiana tutaj nie przesunie celu\./);
      expect(note).not.toBeVisible();
      await user.click(summary);
      expect(note).toBeVisible();
      expect(radio(/^Głównie siedzę/)).toBeChecked();
      await user.click(radio(/^Dużo ruchu/));
      expect(resultLine()).toHaveTextContent('Cel: 1860 kcal dziennie');
      // Bez linijki „pierwszy szacunek”: to już nie jest szacunek ze wzoru.
      expect(screen.queryByText(/^To pierwszy szacunek/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
      expect(await screen.findByText('Zapisano')).toBeInTheDocument();
      expect(await db.profile.get('me')).toMatchObject({
        activityLevel: 'active',
        burnOffset: -641,
        dailyKcal: 1860,
        goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
      });
    },
    15_000,
  );

  test('migrowane 1860 przy tempie spoza przycisków: „(obecne)”, a zapis bez zmian zostawia cel i historię', async () => {
    await saveProfile(owner({ goalPace: 0.4 }));
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    const paces = await screen.findByRole('group', { name: 'Tempo' });
    expect(within(paces).getByRole('button', { name: '−0,4 kg/tydz. (obecne)' })).toHaveAttribute('aria-pressed', 'true');
    expect(resultLine()).toHaveTextContent('Cel: 1860 kcal dziennie');
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByText('Zapisano')).toBeInTheDocument();
    const saved = (await db.profile.get('me'))!;
    expect(saved).toMatchObject({ dailyKcal: 1860, goalPace: 0.4, hold: null });
    expect(saved.goals).toEqual([{ from: '2026-09-01', kcal: 1860, by: 'migration' }]);
  });

  test('ostatnie sprawdzenie zamiast pierwszego szacunku, gdy spalanie jest już z danych', async () => {
    const changed = owner({
      dailyKcal: 1960,
      goals: [
        { from: '2026-09-01', kcal: 1860, by: 'migration' },
        { from: '2026-10-12', kcal: 1960, by: 'check' },
      ],
    });
    await saveProfile({
      ...changed,
      lastCheck: { ...changed.lastCheck!, week: '2026-10-12', status: 'changed', from: 1860, to: 1960, reason: 'burn' },
    });
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByText('Ostatnie sprawdzenie: 12 października — cel zmieniony.')).toBeInTheDocument();
  });

  test('K 60 lat, 155 cm, 58 kg: −0,75 kg/tydz. wyłączone z powodem pod spodem', async () => {
    await saveProfile(stored(1200, { sex: 'K', age: 60, heightCm: 155, startWeightKg: 58, targetWeightKg: 54 }));
    renderWithBridge(<DietProfilePage />);
    const paces = await screen.findByRole('group', { name: 'Tempo' });
    expect(within(paces).getByRole('button', { name: '−0,75 kg/tydz.' })).toBeDisabled();
    expect(within(paces).getByRole('button', { name: '−0,5 kg/tydz.' })).toBeEnabled();
    expect(
      screen.getByText(
        'Szybsze tempo byłoby dla Ciebie za szybkie (ponad 1% masy ciała na tydzień) albo zeszłoby poniżej bezpiecznego minimum 1200 kcal.',
      ),
    ).toBeInTheDocument();
  });

  test('ciąża lub karmienie: bez deficytu („Schudnąć” wyłączone), zapis daje tempo 0', async () => {
    await saveProfile(stored(1550, { sex: 'K', age: 30, heightCm: 165, startWeightKg: 65, targetWeightKg: 60 }));
    const user = userEvent.setup();
    renderWithBridge(<DietProfilePage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Jestem w ciąży lub karmię piersią' }));
    expect(radio('Schudnąć')).toBeDisabled();
    expect(radio('Przybrać')).toBeDisabled();
    expect(radio('Utrzymać wagę')).toBeChecked();
    expect(screen.getByText(/^W ciąży i podczas karmienia nie ustawiam deficytu/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByText('Zapisano')).toBeInTheDocument();
    expect(await db.profile.get('me')).toMatchObject({ pregnancy: true, goalPace: 0 });
  });

  test('przerwa: tydzień albo dwa od dziś, a trwająca — data końca i „Zakończ przerwę”', async () => {
    await saveProfile(stored(2100));
    const user = userEvent.setup();
    const view = renderWithBridge(<DietProfilePage />);
    expect(await screen.findByText('Na urlop albo chorobę: cel to utrzymanie wagi, a dopasowanie czeka.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Przerwa na tydzień' }));
    expect(startPause).toHaveBeenCalledWith(7, { today: TODAY, kgNow: 80 });
    await user.click(screen.getByRole('button', { name: 'Na 2 tygodnie' }));
    expect(startPause).toHaveBeenLastCalledWith(14, { today: TODAY, kgNow: 80 });
    view.unmount();

    await saveProfile({ ...stored(2100), pauses: [{ from: TODAY, to: '2026-10-20', kcal: 2100 }] });
    renderWithBridge(<DietProfilePage />);
    expect(await screen.findByText('Przerwa do 20 października.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zakończ przerwę' }));
    expect(endPause).toHaveBeenCalledWith({ today: TODAY, kgNow: 80 });
  });

  test('„Jak liczę cel” z `?jak=1`: rozwinięte i przewinięte, z liczbami tej osoby', async () => {
    await saveProfile(stored(2100));
    window.history.replaceState(null, '', '/#/jedzenie/profil?jak=1');
    // jsdom nie przewija: na czas testu szpieg w miejscu `scrollIntoView`.
    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scrolled = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true });
    try {
      renderWithBridge(<DietProfilePage />);
      const how = (await screen.findByText('Jak liczę cel')).closest('details')!;
      expect(how).toHaveAttribute('open');
      expect(how).toHaveTextContent('Od tego odejmuję tyle, ile wymaga tempo: 0,5 kg tygodniowo to ok. 540 kcal dziennie.');
      expect(how).toHaveTextContent('Teraz liczę, że spalasz ok. 2640 kcal dziennie.');
      expect(how).toHaveTextContent('Aplikacja nie zastępuje dietetyka ani lekarza.');
      await waitFor(() => expect(scrolled).toHaveBeenCalled());
      expect(scrolled.mock.contexts[0]).toBe(how);
    } finally {
      if (original) Object.defineProperty(Element.prototype, 'scrollIntoView', original);
      else delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  test('wzrost czyta z treningów i zapisuje do obu miejsc', async () => {
    await saveProfile(stored(2100, { heightCm: 175 }));
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
    await saveProfile(stored(2100, { heightCm: 180.5 }));
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
      await saveProfile(stored(2100));
      renderWithBridge(<DietProfilePage />);
      await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
      await restoreFrom(backup(null));
      await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBeNull());
      expect(await db.profile.count()).toBe(0);
    });

    test('kopia z profilem stawia znacznik, a formularz pokazuje profil z kopii', async () => {
      await saveProfile(stored(2100));
      renderWithBridge(<DietProfilePage />);
      await screen.findByLabelText('Przywróć z kopii');
      // Znacznik zgubiony (np. wyczyszczony na innej karcie) — kopia z profilem stawia go z powrotem.
      window.localStorage.removeItem('gt:diet');
      await restoreFrom(backup(stored(2200, { startDate: '2026-09-01', targetWeightKg: 70 })));
      expect(await screen.findByText('Kopia przywrócona.')).toBeInTheDocument();
      expect(window.localStorage.getItem('gt:diet')).toBe('1');
      expect(await db.profile.get('me')).toMatchObject({ startDate: '2026-09-01', dailyKcal: 2200 });
      await waitFor(() => expect(screen.getByLabelText('Waga docelowa')).toHaveValue('70'));
    });
  });

  test('moje zestawy: lista z sumą i składem, usuwanie jednym stuknięciem', async () => {
    await saveProfile(stored(2100));
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
    await saveProfile(stored(2100));
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
    await saveProfile(stored(2100));
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
