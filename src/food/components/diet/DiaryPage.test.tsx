// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
import DiaryPage from './DiaryPage';

// Baza produktów z danych testowych, gotowa od razu — bez pobierania i rozpakowywania.
vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

// Środa: poniedziałek i wtorek tego tygodnia już minęły.
const WEDNESDAY = new Date('2026-10-14T12:00:00');

const item = (text: string, kcal: number, protein: number, carbs: number, fat: number) => ({
  text,
  kcal,
  protein,
  carbs,
  fat,
  stores: [],
});
const TERIYAKI = item('½ opak. Teriyaki', 640, 41, 43, 31);
const BURRITO = item('½ opak. Burrito', 600, 50, 13, 27);
const MASLO = item('Masło 10 g', 54, 0.1, 0.1, 6);

const PLAN: Plan = {
  id: 'active',
  name: 'Plan testowy',
  startDate: '2026-10-12',
  days: ['1A'],
  templates: {
    '1A': [{ index: 1, items: [TERIYAKI, MASLO], totals: { kcal: 694, protein: 41.1, carbs: 43.1, fat: 37 } }],
  },
  foods: [TERIYAKI, BURRITO, MASLO],
  notes: [],
};

const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  await clearAll();
  window.localStorage.clear();
  at('#/jedzenie');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Dziennik', () => {
  test('bez profilu diety mówi, co robi, i prowadzi do profilu — bez niczego, co profilu wymaga', async () => {
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('heading', { name: 'Dziennik jedzenia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustaw profil diety' })).toHaveAttribute('href', '#/jedzenie/profil');
    expect(screen.queryByRole('button', { name: 'Dodaj zjedzone' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('gt:diet')).toBeNull();
  });

  test('z profilem: dzień bez planu dostaje propozycję, a znaleziony profil stawia znacznik dla ekranu Dziś', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('heading', { name: 'Dziś' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Propozycja dnia' })).toBeInTheDocument();
    for (const name of ['Plan posiłków', 'Postęp', 'Profil diety'])
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Postęp' })).toHaveAttribute('href', '#/jedzenie/postep');
    await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
  });

  test('same kalorie da się zapisać, a dzień mówi, że makro są niepełne', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', adaptWeekly: false }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Dodaj zjedzone' }));
    const dialog = screen.getByRole('dialog', { name: 'Dodaj zjedzone' });
    await user.click(within(dialog).getByRole('button', { name: 'Tylko kalorie' }));
    await user.type(within(dialog).getByLabelText('Co to było'), 'Obiad u rodziców');
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '650');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));

    expect(await screen.findByText('Obiad u rodziców')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Zjedzone/ })).toHaveTextContent('650 kcal');
    expect(screen.getByText(/1 wpis ma tylko kalorie/)).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute('open');
    expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Obiad u rodziców · 650 kcal.');
  });

  test('„Dodaj zjedzone”: fokus w wyszukiwaniu, × zamyka i oddaje fokus, ponowne otwarcie zaczyna od nowa', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const add = await screen.findByRole('button', { name: 'Dodaj zjedzone' });
    await user.click(add);
    const dialog = screen.getByRole('dialog', { name: 'Dodaj zjedzone' }) as HTMLDialogElement;
    const search = within(dialog).getByRole('searchbox', { name: 'Szukaj jedzenia' });
    expect(search).toHaveFocus();
    await user.type(search, 'skyr');
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    expect(dialog.open).toBe(false);
    expect(add).toHaveFocus();

    await user.click(add);
    expect(within(dialog).getByRole('searchbox', { name: 'Szukaj jedzenia' })).toHaveValue('');
    expect(within(dialog).getByRole('searchbox', { name: 'Szukaj jedzenia' })).toHaveFocus();
  });

  test('produkt z bazy: wyszukany, z gramaturą zmienioną przed zapisem', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', adaptWeekly: false }));
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Dodaj zjedzone' }));
    const dialog = screen.getByRole('dialog', { name: 'Dodaj zjedzone' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Szukaj jedzenia' }), 'skyr');
    await user.click(within(dialog).getByRole('button', { name: /^Skyr naturalny/ }));
    const grams = within(dialog).getByLabelText('Ile gramów');
    await user.clear(grams);
    await user.type(grams, '300');
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));
    await waitFor(async () =>
      expect(await db.entries.toArray()).toMatchObject([{ amountLabel: '300 g', source: 'product' }]),
    );
  });

  test('pozycja planu zamieniona na coś o podobnej kaloryczności, potem odhaczona', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-12', adaptWeekly: false }));
    await db.plans.put(PLAN);
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = (await screen.findByRole('heading', { name: /Plan na ten dzień/ })).closest('section')!;
    await user.click(within(card).getAllByRole('button', { name: /Zamień/ })[0]!);

    const dialog = screen.getByRole('dialog', { name: /Zamień: ½ opak. Teriyaki/ });
    await user.click(within(dialog).getByRole('button', { name: 'Wybierz: ½ opak. Burrito' }));

    await waitFor(() => expect(within(card).getByText('½ opak. Burrito')).toBeInTheDocument());
    expect(within(card).getByText(/zamiast: ½ opak. Teriyaki/)).toBeInTheDocument();
    await user.click(within(card).getAllByRole('button', { name: /Zjadłem/ })[0]!);
    await waitFor(async () =>
      expect(await db.entries.toArray()).toMatchObject([{ name: '½ opak. Burrito', kcal: 600, planIndex: 0 }]),
    );
  });

  test('nadwyżka z początku tygodnia obniża dzisiejszy cel i mówi dlaczego', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, adaptWeekly: true }));
    await logQuick('2026-10-12', 'Wesele', 2600);
    renderWithBridge(<DiaryPage />);
    // 600 ponad plan, rozłożone na pięć dni do niedzieli.
    expect(await screen.findByText(/Cel na dziś obniżony o 120 kcal/)).toBeInTheDocument();
  });

  test('dzień z adresu: poprzedni dzień przez strzałkę, z powrotem „Wróć do dziś”', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Poprzedni dzień' }));
    expect(await screen.findByRole('heading', { name: 'Wczoraj' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/jedzenie?dzien=2026-10-13');
    // Plan posiłków otwiera się na tygodniu oglądanego dnia.
    const plan = screen.getByRole('link', { name: 'Plan posiłków' });
    expect(plan).toHaveAttribute('href', '#/jedzenie/plan?dzien=2026-10-13');
    await user.click(screen.getByRole('button', { name: 'Wróć do dziś' }));
    expect(await screen.findByRole('heading', { name: 'Dziś' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/jedzenie');
    expect(screen.getByRole('link', { name: 'Plan posiłków' })).toHaveAttribute('href', '#/jedzenie/plan');
  });
});

describe('Waga, kroki i ruch — przez most do treningów', () => {
  test('waga wpisana w dzienniku idzie do dziennika wagi z dniem oglądanym w dzienniku', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    at('#/jedzenie?dzien=2026-10-13');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const weight = await screen.findByLabelText('Waga, kg');
    await user.type(weight, '81,4');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(bridge.setWeight).toHaveBeenCalledWith(81.4, '2026-10-13');
    expect(bridge.setSteps).not.toHaveBeenCalled();
    expect(await db.days.get('2026-10-13')).toBeUndefined();
  });

  test('kroki idą do kroków w treningach; waga spoza zakresu nie wychodzi', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    await user.type(await screen.findByLabelText('Waga, kg'), '12');
    await user.type(screen.getByLabelText('Kroki'), '9500');
    expect(screen.getByText('Waga od 30 do 300 kg.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(bridge.setSteps).toHaveBeenCalledWith('2026-10-14', 9500);
    expect(bridge.setWeight).not.toHaveBeenCalled();
  });

  test('pola pokazują wagę i kroki z treningów, a ruch dnia stoi obok jako informacja', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const bridge = testBridge({
      weights: [{ day: '2026-10-14', kg: 82.5 }],
      stepsOn: (day) => (day === '2026-10-14' ? 7200 : null),
      moveOn: () => ({ trained: true, workoutKcal: 310, cardioKcal: 180 }),
    });
    renderWithBridge(<DiaryPage />, bridge);
    expect(await screen.findByLabelText('Waga, kg')).toHaveValue('82,5');
    expect(screen.getByLabelText('Kroki')).toHaveValue('7200');
    expect(screen.getByText(/trening 310 kcal · kroki i cardio 180 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/nie dodaję tego do celu kalorii/)).toBeInTheDocument();
    // Nic do zapisania, dopóki nikt nie zmienił liczb.
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
  });
});

describe('„Dodaj zjedzone” z ekranu Dziś', () => {
  test('`dodaj=1` otwiera arkusz po wejściu i znika z adresu', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    at('#/jedzenie?dodaj=1');
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('dialog', { name: 'Dodaj zjedzone' })).toHaveAttribute('open');
    await waitFor(() => expect(window.location.hash).toBe('#/jedzenie'));
    expect(screen.getByRole('searchbox', { name: 'Szukaj jedzenia' })).toHaveFocus();
  });
});
