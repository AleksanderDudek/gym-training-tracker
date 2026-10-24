// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BridgeContext } from '../../bridge';
import { db, type Favorite } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { savePrepPlan } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
import { renderWithBridge, testBridge, testMove } from '../../test/bridge';
import TodayFoodCard from '../../TodayFoodCard';
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

/**
 * Poniedziałkowe sprawdzenie, jak je widzi dziennik: `pending`, póki może jeszcze zmienić dzisiejszy
 * cel, potem `ready`. Stanem haka steruje sam test; hak ma własne testy (`useWeeklyCheck.test`).
 */
const weekly = vi.hoisted(() => ({ state: 'ready' as 'ready' | 'pending', listeners: new Set<() => void>() }));
vi.mock('../../hooks/useWeeklyCheck', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => {
    weekly.listeners.add(listener);
    return () => void weekly.listeners.delete(listener);
  };
  return { useWeeklyCheck: () => useSyncExternalStore(subscribe, () => weekly.state) };
});
const setWeekly = (state: 'ready' | 'pending') => {
  weekly.state = state;
  weekly.listeners.forEach((listener) => listener());
};

// Środa: poniedziałek i wtorek tego tygodnia już minęły.
const WEDNESDAY = new Date('2026-10-14T12:00:00');
const TODAY = '2026-10-14';

/** Cel 2000 kcal od początku; redukcja przy wadze docelowej 75 kg: 150 g białka. */
const profile = (over: Partial<Profile> = {}) =>
  completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, ...over });

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

/** Ulubione „Jedzenie i”, zjedzone `uses` razy. */
const favorite = (i: number, uses: number, name = `Jedzenie ${i}`): Favorite => ({
  key: `custom:${i}`,
  food: {
    key: `custom:${i}`,
    name,
    detail: 'moje',
    source: 'custom',
    amountLabel: '1 porcja',
    nutrients: { kcal: 100 + i, protein: 10, carbs: 10, fat: 2 },
    per100: null,
    grams: null,
    stores: [],
    atHome: true,
    role: 'light',
  },
  addedAt: '',
  uses,
  lastUsed: null,
});

/** Plan z zakupami bez posiłków — dziennikowi wystarczą jego daty, nazwa i sklep. */
const prepPlan = (start: string, days: number, over: Partial<PrepPlan> = {}): PrepPlan => ({
  createdAt: '2026-10-10T08:00:00.000Z',
  settings: { start, days, meals: 4, cooking: 'lunch', store: 'biedronka', online: null, exclude: [], seed: 1, avoid: [] },
  shops: [{ key: 'biedronka', name: 'Biedronka', online: false, url: null }],
  goal: { kcal: 2200, source: 'profile', dietProfile: 'redukcja', styleLabel: 'Redukcja', pace: 0.5, weightKg: 82 },
  checkIn: null,
  dayTargets: [],
  slots: [],
  choices: {},
  meals: [],
  batches: [],
  shopping: [],
  bought: [],
  ...over,
});

/**
 * Wszystko, co widać albo słychać na stronie poza zamkniętymi arkuszami (zamknięty `<dialog>`
 * zostaje w drzewie, ale nikt go nie widzi): tekst i dostępne atrybuty.
 */
function visibleText(): string {
  const page = document.body.cloneNode(true) as HTMLElement;
  page.querySelectorAll('dialog:not([open])').forEach((d) => d.remove());
  const attrs = [...page.querySelectorAll('[aria-label],[title],[placeholder],[aria-valuetext]')].flatMap((el) =>
    ['aria-label', 'title', 'placeholder', 'aria-valuetext'].map((a) => el.getAttribute(a) ?? ''),
  );
  return [page.textContent ?? '', ...attrs].join('\n');
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  setWeekly('ready');
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
    await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
  });

  test('kolejność od góry: dzień, waga, karta dnia z akcjami, zjedzone, plan dnia, „Co teraz?”, kroki, a na dole wejścia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000 }));
    renderWithBridge(<DiaryPage />);
    const blocks = [
      await screen.findByRole('heading', { name: 'Dziś' }),
      screen.getByRole('region', { name: 'Ile dziś ważysz?' }),
      screen.getByRole('region', { name: 'Bilans dnia' }),
      screen.getByRole('region', { name: /^Zjedzone/ }),
      screen.getByRole('region', { name: 'Propozycja dnia' }),
      screen.getByRole('region', { name: 'Co teraz?' }),
      screen.getByRole('region', { name: 'Kroki' }),
      screen.getByRole('navigation', { name: 'Dieta' }),
    ];
    blocks.slice(1).forEach((block, i) =>
      expect(blocks[i]!.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(),
    );
    // Zjedzone zaraz pod kartą dnia: dopisane pojawia się tam, gdzie się stuknęło.
    expect(screen.getByRole('region', { name: 'Bilans dnia' }).nextElementSibling).toBe(
      screen.getByRole('region', { name: /^Zjedzone/ }),
    );
    const balance = screen.getByRole('region', { name: 'Bilans dnia' });
    expect(within(balance).getByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
    expect(within(balance).getByRole('button', { name: 'Dodaj zjedzone' })).toBeInTheDocument();
    expect(within(balance).getByRole('button', { name: 'Ulubione' })).toBeInTheDocument();
    expect(within(balance).getByRole('button', { name: 'Większy posiłek' })).toBeInTheDocument();
  }, 15_000);

  test('na górze dnia to, na co dziennik czeka: zmiany w liczeniu, sprawdzenie celu, przerwa — nad wagą', async () => {
    await saveProfile(
      profile({
        notice: 'show',
        pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 2000 }],
        lastCheck: {
          week: '2026-10-12',
          status: 'data',
          from: 2000,
          to: 2000,
          reason: null,
          note: null,
          settle: null,
          facts: null,
          missing: { weighIns: 3, completeDays: 8 },
          floor: null,
          offsetAfter: null,
          goalPace: 0.5,
          answer: null,
        },
      }),
    );
    vi.setSystemTime(new Date('2026-10-13T12:00:00'));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const notice = await screen.findByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' });
    const quiet = screen.getByText(/^Ten tydzień: cel bez zmian \(2000 kcal\)\. Do dopasowania potrzebuję/);
    const pause = screen.getByText('Przerwa do 18 października: cel to utrzymanie wagi (2000 kcal), a dopasowanie czeka.');
    const weigh = screen.getByRole('region', { name: 'Ile dziś ważysz?' });
    for (const [a, b] of [
      [notice, quiet],
      [quiet, pause],
      [pause, weigh],
    ] as const)
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(quiet).toHaveTextContent('teraz 3 ważenia i pełne zapisy z 8 dni.');
    // „Zakończ przerwę” kończy przerwę w magazynie i mówi, do jakiego celu wraca.
    await user.click(screen.getByRole('button', { name: 'Zakończ przerwę' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Przerwa zakończona. Cel: 2000 kcal.'));
    // Na inny dzień — nic z tego.
    await user.click(screen.getByRole('button', { name: 'Poprzedni dzień' }));
    expect(await screen.findByRole('heading', { name: 'Wczoraj' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ten tydzień/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Przerwa do/)).not.toBeInTheDocument();
  }, 15_000);

  test('wejścia na dole: plan posiłków, moje plany, postęp i profil diety', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    renderWithBridge(<DiaryPage />);
    const nav = await screen.findByRole('navigation', { name: 'Dieta' });
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Plan posiłków', '#/jedzenie/plan'],
      ['Moje plany', '#/jedzenie/plany'],
      ['Postęp', '#/jedzenie/postep'],
      ['Profil diety', '#/jedzenie/profil'],
    ]);
  });

  test('ulubione: bez nich arkusz mówi, jak je dodać; gwiazdka przy zjedzonym dodaje je, a „Zjedzone” zapisuje i zostawia arkusz otwarty', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await logQuick('2026-10-14', 'Obiad u mamy', 650);
    window.history.replaceState(null, '', '/#/jedzenie?dzien=2026-10-14');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Ulubione' }));
    const sheet = screen.getByRole('dialog', { name: 'Ulubione' });
    expect(sheet).toHaveAttribute('open');
    expect(within(sheet).getByText(/oznacz gwiazdką/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Zamknij' }));
    expect(sheet).not.toHaveAttribute('open');

    // Gwiazdka przy tym, co już zjedzone; przycisk ulubionych liczy je od razu.
    await user.click(screen.getByRole('button', { name: 'Ulubione: Obiad u mamy' }));
    await user.click(await screen.findByRole('button', { name: 'Ulubione (1)' }));
    expect(sheet).toHaveAttribute('open');
    expect(within(sheet).getByRole('status')).toHaveTextContent('„Zjedzone” zapisuje od razu na dziś, w ilości z gwiazdki.');
    await user.click(within(sheet).getByRole('button', { name: 'Zjedzone z ulubionych: Obiad u mamy' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Obiad u mamy · 650 kcal.'));
    expect(await db.entries.where('date').equals('2026-10-14').count()).toBe(2);
    expect(await db.favorites.get('quick:Obiad u mamy')).toMatchObject({ uses: 1 });
    // Arkusz zostaje: komunikat aplikacji stoi pod nim, więc potwierdza pasek arkusza.
    expect(sheet).toHaveAttribute('open');
    expect(within(sheet).getByRole('status')).toHaveTextContent('Zapisane na dziś: Obiad u mamy · 650 kcal.');
    await user.click(within(sheet).getByRole('button', { name: 'Zjedzone z ulubionych: Obiad u mamy' }));
    await waitFor(() => expect(within(sheet).getByRole('status')).toHaveTextContent('Obiad u mamy · 650 kcal (2×).'));
    expect(await db.entries.where('date').equals('2026-10-14').count()).toBe(3);
  }, 15_000);

  test('ulubione: pełna lista najczęściej jedzonych pierwszych, pole do zawężania, kolejność stoi do zamknięcia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.favorites.bulkPut(Array.from({ length: 10 }, (_, i) => favorite(i, i)));
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Ulubione (10)' }));
    const sheet = screen.getByRole('dialog', { name: 'Ulubione' });
    const names = () =>
      within(sheet)
        .getAllByRole('button', { name: /^Zjedzone z ulubionych/ })
        .map((b) => b.getAttribute('aria-label'));
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Zjedzone z ulubionych: Jedzenie 9');

    // Zapis podbija licznik, ale wiersze nie skaczą pod palcem, póki arkusz jest otwarty.
    await user.click(within(sheet).getByRole('button', { name: 'Zjedzone z ulubionych: Jedzenie 0' }));
    await waitFor(async () => expect(await db.favorites.get('custom:0')).toMatchObject({ uses: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names().at(-1)).toBe('Zjedzone z ulubionych: Jedzenie 0');

    // Więcej niż osiem — pole do zawężania, bez względu na wielkość liter i ogonki.
    const filter = within(sheet).getByRole('searchbox', { name: 'Szukaj w ulubionych' });
    await user.type(filter, 'JEDZENIE 3');
    expect(names()).toEqual(['Zjedzone z ulubionych: Jedzenie 3']);
    await user.clear(filter);
    await user.type(filter, 'pierogi');
    expect(within(sheet).getByText('Nic z ulubionych nie pasuje do „pierogi”.')).toBeInTheDocument();

    // Ponowne otwarcie: puste pole i świeża kolejność (Jedzenie 0, zjedzone przed chwilą, przed Jedzeniem 1).
    await user.click(within(sheet).getByRole('button', { name: 'Zamknij' }));
    await user.click(screen.getByRole('button', { name: 'Ulubione (10)' }));
    expect(within(sheet).getByRole('searchbox', { name: 'Szukaj w ulubionych' })).toHaveValue('');
    expect(names().slice(-2)).toEqual(['Zjedzone z ulubionych: Jedzenie 0', 'Zjedzone z ulubionych: Jedzenie 1']);
  }, 15_000);

  test('ulubione na dzień, który nie nadszedł: lista jest, zapis — nie', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.favorites.put(favorite(1, 3));
    at('#/jedzenie?dzien=2026-10-16');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Ulubione (1)' }));
    const sheet = screen.getByRole('dialog', { name: 'Ulubione' });
    expect(within(sheet).getByRole('button', { name: 'Zjedzone z ulubionych: Jedzenie 1' })).toBeDisabled();
    expect(within(sheet).getByRole('status')).toHaveTextContent(/jeszcze nie nadszedł/);
  });

  test('same kalorie da się zapisać, a dzień mówi, że suma białka może być zaniżona', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
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
    expect(screen.getByText('1 wpis ma tylko kalorie – suma białka może być zaniżona.')).toBeInTheDocument();
    // Arkusz zamyka się po zapisie do bazy, a lista odświeża się z bazy na żywo — bywa, że wpis
    // stoi na liście, zanim arkusz zdąży się zamknąć (CI, obciążona maszyna). Czekamy na oba.
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Obiad u rodziców · 650 kcal.'));
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

  test('produkt z bazy: wyszukany, z gramaturą zmienioną przed zapisem — i ile zostanie z dnia', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Śniadanie', 1200, { protein: 60, carbs: 120, fat: 40 });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Dodaj zjedzone' }));
    const dialog = screen.getByRole('dialog', { name: 'Dodaj zjedzone' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Szukaj jedzenia' }), 'skyr');
    await user.click(within(dialog).getByRole('button', { name: /^Skyr naturalny/ }));
    const grams = within(dialog).getByLabelText('Ile gramów');
    await user.clear(grams);
    await user.type(grams, '300');
    // Zostało 800 kcal z 2000; 300 g skyru to 189 kcal.
    expect(within(dialog).getByText('Po tym zostanie ok. 610 kcal na dziś.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Dodaj' }));
    await waitFor(async () =>
      expect((await db.entries.toArray()).filter((e) => e.source === 'product')).toMatchObject([{ amountLabel: '300 g' }]),
    );
  });

  test('pozycja planu zamieniona na coś o podobnej kaloryczności, potem odhaczona', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-12' }));
    await db.plans.put(PLAN);
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = (await screen.findByRole('heading', { name: /Plan na ten dzień/ })).closest('section')!;
    await user.click(within(card).getAllByRole('button', { name: /Zamień/ })[0]!);

    const dialog = screen.getByRole('dialog', { name: /Zamień: ½ opak. Teriyaki/ });
    await user.click(within(dialog).getByRole('button', { name: 'Wybierz: ½ opak. Burrito' }));

    await waitFor(() => expect(within(card).getByText('½ opak. Burrito')).toBeInTheDocument());
    expect(within(card).getByText(/zamiast: ½ opak. Teriyaki/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Zjedzone: ½ opak. Burrito' }));
    await waitFor(async () =>
      expect(await db.entries.toArray()).toMatchObject([{ name: '½ opak. Burrito', kcal: 600, planIndex: 0 }]),
    );
  });

  test('przyciski propozycji to „Zjedzone” — w propozycji dnia i w „Co teraz?” (★)', async () => {
    await saveProfile(profile());
    renderWithBridge(<DiaryPage />);
    const day = await screen.findByRole('region', { name: 'Propozycja dnia' });
    await waitFor(() => expect(within(day).getAllByRole('button', { name: /^Zjedzone: / }).length).toBeGreaterThan(0));
    const now = screen.getByRole('region', { name: 'Co teraz?' });
    expect(within(now).getAllByRole('button', { name: /^Zjedzone: / }).length).toBeGreaterThan(0);
    expect(within(day).getAllByRole('button', { name: /^Zjedzone: / })[0]).toHaveTextContent(/^Zjedzone$/);
    expect(visibleText()).not.toMatch(/Zjadłem/);
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

  test('poniedziałkowe sprawdzenie w toku: dziennik czeka, potem pokazuje dzień', async () => {
    setWeekly('pending');
    await saveProfile(profile());
    renderWithBridge(<DiaryPage />);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole('heading', { name: 'Dziś' })).not.toBeInTheDocument();
    act(() => setWeekly('ready'));
    expect(await screen.findByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
  });
});

describe('Jeden cel na dzień', () => {
  test('wczoraj zjedzone do celu: „Zjedzone 1940 kcal · cel 1940”, kroki niczego nie zmieniają (★)', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 1940 }));
    await logQuick('2026-10-13', 'Cały dzień', 1940, { protein: 150, carbs: 180, fat: 60 });
    at('#/jedzenie?dzien=2026-10-13');
    const bridge = testBridge({
      weights: [{ day: '2026-10-01', kg: 80 }],
      stepsOn: (day) => (day === '2026-10-13' ? 5400 : null),
    });
    renderWithBridge(<DiaryPage />, bridge);
    const card = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(within(card).getByRole('heading', { name: 'Zjedzone 1940 kcal · cel 1940' })).toBeInTheDocument();
    expect(within(card).getByRole('meter', { name: 'Kalorie' })).toHaveAttribute('aria-valuetext', '1940 z 1940 kcal');
    expect(card).not.toHaveTextContent(/ponad cel/);
  });

  test('zamknięty dzień ponad pasmem mówi o ile, spokojnie', async () => {
    await saveProfile(profile());
    await logQuick('2026-10-13', 'Wesele', 2440, { protein: 150, carbs: 260, fat: 100 });
    at('#/jedzenie?dzien=2026-10-13');
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(within(card).getByRole('heading', { name: 'Zjedzone 2440 kcal · cel 2000' })).toBeInTheDocument();
    expect(card).toHaveTextContent('To ok. 440 kcal ponad cel — jeden dzień nie zmienia trendu.');
  });

  test('dzień, który nie nadszedł, ma swój cel', async () => {
    await saveProfile(profile());
    at('#/jedzenie?dzien=2026-10-16');
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(within(card).getByRole('heading', { name: 'Cel na ten dzień: 2000 kcal i 150 g białka' })).toBeInTheDocument();
  });

  test('duży poniedziałek nie obniża wtorku: „Na dziś: 2000 kcal …” (★)', async () => {
    vi.setSystemTime(new Date('2026-10-13T12:00:00'));
    await saveProfile(profile());
    await logQuick('2026-10-12', 'Wesele', 2600);
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
    expect(visibleText()).not.toMatch(/Cel na dziś obniżony|rozkładam/);
  });

  test('wtorek z samymi 400 kcal: dzień to mówi i daje „To był cały dzień”; środa zostaje przy 2000 (★)', async () => {
    await saveProfile(profile());
    await logQuick('2026-10-13', 'Śniadanie', 400, { protein: 20, carbs: 50, fat: 10 });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    // Środa: cel bez zmian.
    expect(await screen.findByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Poprzedni dzień' }));
    expect(await screen.findByRole('heading', { name: 'Wczoraj' })).toBeInTheDocument();
    const eaten = screen.getByRole('region', { name: /^Zjedzone/ });
    expect(
      within(eaten).getByText('Mało zapisów jak na cały dzień — ten dzień nie liczy się do dopasowania celu ani średnich.'),
    ).toBeInTheDocument();
    await user.click(within(eaten).getByRole('button', { name: 'To był cały dzień' }));
    await waitFor(async () => expect((await db.days.get('2026-10-13'))?.partial).toBe(false));
    expect(await within(eaten).findByText('Liczę jako pełny dzień.')).toBeInTheDocument();
    expect(within(eaten).getByRole('button', { name: 'Cofnij' })).toHaveFocus();
  });

  test('„Nie wszystko zapisane” oznacza dzień jako niepełny; „Cofnij” to cofa', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Obiad', 900, { protein: 50, carbs: 90, fat: 30 });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    await user.click(within(eaten).getByRole('button', { name: 'Nie wszystko zapisane' }));
    await waitFor(async () => expect((await db.days.get(TODAY))?.partial).toBe(true));
    expect(
      await within(eaten).findByText('Dzień niepełny — nie liczy się do dopasowania celu ani średnich.'),
    ).toBeInTheDocument();
    expect(within(eaten).getByRole('button', { name: 'Cofnij' })).toHaveFocus();
    await user.click(within(eaten).getByRole('button', { name: 'Cofnij' }));
    await waitFor(async () => expect((await db.days.get(TODAY))?.partial).toBeUndefined());
    expect(await within(eaten).findByRole('button', { name: 'Nie wszystko zapisane' })).toHaveFocus();
  });

  test('dzień bez wpisów nie ma stopki — tylko jak zacząć', async () => {
    await saveProfile(profile());
    renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(eaten).toHaveTextContent(
      'Nic jeszcze nie zapisane. Odhacz pozycję planu albo dodaj jedzenie — liczy się to, co naprawdę zjedzone.',
    );
    expect(within(eaten).queryByRole('button', { name: 'Nie wszystko zapisane' })).not.toBeInTheDocument();
  });
});

describe('Większy posiłek', () => {
  test('przycisk to „Większy posiłek”, a w dzienniku nigdzie „Cheat meal” (★)', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Śniadanie', 650, { protein: 40, carbs: 60, fat: 20 });
    await planCheat(TODAY, { name: '', kcal: 900, protein: 30, carbs: null, fat: null });
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Zaplanowany większy posiłek/ });
    // Bez nazwy to po prostu „Większy posiłek”.
    expect(within(card).getByText('Większy posiłek')).toBeInTheDocument();
    expect(card).toHaveTextContent('900 kcal · B 30 · W ? · T ?');
    expect(screen.getByRole('button', { name: 'Większy posiłek' })).toBeInTheDocument();
    // Karta dnia i „Co teraz?” liczą już z nim.
    expect(screen.getByRole('heading', { name: 'Zostało ok. 450 kcal i 80 g białka' })).toBeInTheDocument();
    expect(screen.getByText('Liczę już z zaplanowanym większym posiłkiem (900 kcal).')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Co teraz?' })).toHaveTextContent(
      /^Co teraz\?Zostało ok\. 450 kcal i 80 g białka na \d posiłk\w+ — po zaplanowanym większym posiłku\. Najlepsze oznaczone gwiazdką\./,
    );
    expect(visibleText()).not.toMatch(/cheat/i);

    await user.click(within(card).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Większy posiłek usunięty z planu dnia.'));
  });

  test('„Zjedzone” na karcie zapisuje go pod jego nazwą albo jako „Większy posiłek”', async () => {
    await saveProfile(profile());
    await planCheat(TODAY, { name: '', kcal: 950, protein: 40, carbs: 80, fat: 50 });
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Zaplanowany większy posiłek/ });
    await user.click(within(card).getByRole('button', { name: 'Zjedzone' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Większy posiłek · 950 kcal.'));
    expect(await db.entries.where('date').equals(TODAY).toArray()).toEqual([
      expect.objectContaining({ name: 'Większy posiłek', kcal: 950 }),
    ]);
  });
});

describe('Bez liczenia kalorii', () => {
  test('karta dnia bez kcal, zjedzone „B 41 g”, bez większego posiłku, zapis „Zapisane: Skyr.” (★)', async () => {
    await saveProfile(profile({ hideKcal: true }));
    await logQuick(TODAY, 'Kurczak z ryżem', 640, { protein: 41, carbs: 43, fat: 31 });
    await db.favorites.put(favorite(5, 2, 'Skyr'));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(within(card).getByRole('heading', { name: 'Białka jeszcze 109 g' })).toBeInTheDocument();
    expect(within(card).getAllByRole('meter')).toHaveLength(1);
    expect(card.textContent).not.toMatch(/kcal|Węglowodany/);
    const eaten = screen.getByRole('region', { name: 'Zjedzone' });
    expect(eaten).toHaveTextContent('B 41 g');
    expect(eaten.textContent).not.toMatch(/kcal/);
    // Bez stopki „Nie wszystko zapisane”: dopasowanie celu liczy się tu bez słów o kaloriach.
    expect(within(eaten).queryByRole('button', { name: 'Nie wszystko zapisane' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Większy posiłek' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Cheat meal|Większy posiłek/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Co teraz?' }).textContent).not.toMatch(/kcal/);

    await user.click(within(card).getByRole('button', { name: 'Ulubione (1)' }));
    const sheet = screen.getByRole('dialog', { name: 'Ulubione' });
    expect(sheet.textContent).not.toMatch(/kcal/);
    await user.click(within(sheet).getByRole('button', { name: 'Zjedzone z ulubionych: Skyr' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Skyr.'));
    expect(within(sheet).getByRole('status')).toHaveTextContent('Zapisane na dziś: Skyr.');
  }, 15_000);
});

/** Dziennik pod mostem, który zapisuje ważenia jak App: lista wagi rośnie, a dziennik od razu ją widzi. */
function WithScale({ weights: start = [] }: { weights?: { day: string; kg: number }[] }) {
  const [weights, setWeights] = useState(start);
  const bridge = useMemo(
    () =>
      testBridge({
        weights,
        setWeight: (kg, day) =>
          setWeights((list) => [...list.filter((w) => w.day !== day), { day, kg }].sort((a, b) => a.day.localeCompare(b.day))),
      }),
    [weights],
  );
  return (
    <BridgeContext.Provider value={bridge}>
      <DiaryPage />
    </BridgeContext.Provider>
  );
}

describe('Waga na górze dziennika — przez most do dziennika wagi', () => {
  test('dzień bez ważenia pyta o wagę, podpowiada ostatnie ważenie i jak się ważyć', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    renderWithBridge(<DiaryPage />, testBridge({ weights: [{ day: '2026-10-10', kg: 83 }, { day: '2026-10-12', kg: 82.4 }] }));
    const card = await screen.findByRole('region', { name: 'Ile dziś ważysz?' });
    expect(within(card).getByLabelText('Waga, kg')).toHaveValue('');
    expect(within(card).getByText('Ostatnio 82,4 kg, 2 dni temu. Najlepiej rano, po toalecie, przed jedzeniem.')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Postęp' })).toHaveAttribute('href', '#/jedzenie/postep');
    // Nic do zapisania, dopóki pole jest puste.
    expect(within(card).getByRole('button', { name: 'Zapisz wagę' })).toBeDisabled();
  });

  test('„Nie dziś” pomija ważenie przez most i zwija kartę; dzień z przeszłości mówi „Waga tego dnia: bez ważenia.” (★)', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Ile dziś ważysz?' });
    await user.click(within(card).getByRole('button', { name: 'Nie dziś' }));
    expect(bridge.skipWeigh).toHaveBeenCalledTimes(1);
    const skipped = await screen.findByRole('region', { name: 'Bez ważenia dziś.' });
    expect(within(skipped).getByRole('button', { name: 'Dodaj wagę' })).toHaveFocus();
    await user.click(within(skipped).getByRole('button', { name: 'Dodaj wagę' }));
    expect(screen.getByLabelText('Waga, kg')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.getByRole('button', { name: 'Dodaj wagę' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Poprzedni dzień' }));
    expect(await screen.findByRole('region', { name: 'Waga tego dnia: bez ważenia.' })).toBeInTheDocument();
    expect(visibleText()).not.toMatch(/Ile ważyłeś|ważyłaś/);
  });

  test('pominięte na ekranie Dziś: dziennik już nie pyta', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    renderWithBridge(<DiaryPage />, testBridge({ weighSkipped: () => true }));
    expect(await screen.findByRole('region', { name: 'Bez ważenia dziś.' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Waga, kg')).not.toBeInTheDocument();
  });

  test('waga dopisana do dnia z przeszłości idzie do dziennika wagi z dniem oglądanym w dzienniku', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    at('#/jedzenie?dzien=2026-10-13');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />, testBridge({ weights: [{ day: '2026-10-12', kg: 82.4 }] }));
    const line = await screen.findByRole('region', { name: 'Waga tego dnia: bez ważenia.' });
    await user.click(within(line).getByRole('button', { name: 'Dodaj' }));
    const card = screen.getByRole('region', { name: 'Waga tego dnia' });
    expect(within(card).getByLabelText('Waga, kg')).toHaveFocus();
    expect(within(card).getByText(/^Poprzednie ważenie: 82,4 kg, dzień wcześniej\./)).toBeInTheDocument();
    await user.type(within(card).getByLabelText('Waga, kg'), '81,4');
    await user.click(within(card).getByRole('button', { name: 'Zapisz wagę' }));
    expect(bridge.setWeight).toHaveBeenCalledWith(81.4, '2026-10-13');
    expect(bridge.setSteps).not.toHaveBeenCalled();
    expect(await db.days.get('2026-10-13')).toBeUndefined();
  });

  test('waga spoza zakresu nie wychodzi', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const field = await screen.findByLabelText('Waga, kg');
    await user.type(field, '12');
    expect(screen.getByText('Waga od 30 do 300 kg.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Zapisz wagę' })).toBeDisabled();
    await user.type(field, '{Enter}');
    expect(bridge.setWeight).not.toHaveBeenCalled();
  });

  test('po zapisie zostaje jedna linijka z wagą; „Zmień” odsłania pole, a fokus idzie za tym, co widać', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    render(<WithScale />);
    await user.type(await screen.findByLabelText('Waga, kg'), '82,4');
    await user.click(screen.getByRole('button', { name: 'Zapisz wagę' }));
    const card = await screen.findByRole('region', { name: 'Waga: 82,4 kg' });
    expect(within(card).queryByLabelText('Waga, kg')).not.toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Zmień wagę' })).toHaveFocus();

    await user.click(within(card).getByRole('button', { name: 'Zmień wagę' }));
    const field = within(card).getByLabelText('Waga, kg');
    expect(field).toHaveValue('82,4');
    expect(field).toHaveFocus();
    // Ta sama liczba to nic nowego.
    expect(within(card).getByRole('button', { name: 'Zapisz wagę' })).toBeDisabled();
    await user.click(within(card).getByRole('button', { name: 'Anuluj' }));
    expect(within(card).getByRole('button', { name: 'Zmień wagę' })).toHaveFocus();

    await user.click(within(card).getByRole('button', { name: 'Zmień wagę' }));
    await user.clear(within(card).getByLabelText('Waga, kg'));
    await user.type(within(card).getByLabelText('Waga, kg'), '82,1{Enter}');
    expect(await screen.findByRole('heading', { name: 'Waga: 82,1 kg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zmień wagę' })).toHaveFocus();
  }, 15_000);

  test('dzień z ważeniem: od razu jedna linijka; dzień, który nie nadszedł: bez pytania o wagę', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    render(<WithScale weights={[{ day: '2026-10-14', kg: 82.5 }]} />);
    expect(await screen.findByRole('heading', { name: 'Waga: 82,5 kg' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Waga, kg')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Następny dzień' }));
    expect(await screen.findByRole('heading', { name: 'Jutro' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /waż|Waga/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Waga, kg')).not.toBeInTheDocument();
    expect(screen.getByText('Kroki wpiszesz tego dnia.')).toBeInTheDocument();
  });
});

describe('Kroki — przez most do treningów', () => {
  test('kroki idą do kroków w treningach, z dniem oglądanym w dzienniku', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Kroki' });
    await user.type(within(card).getByLabelText('Kroki'), '9500');
    await user.click(within(card).getByRole('button', { name: 'Zapisz kroki' }));
    expect(bridge.setSteps).toHaveBeenCalledWith('2026-10-14', 9500);
    expect(bridge.setWeight).not.toHaveBeenCalled();
  });

  test('pole i jedno zdanie: ruch nie przesuwa celu, a karta nie liczy jego kalorii (★)', async () => {
    await saveProfile(profile());
    const bridge = testBridge({
      weights: [{ day: '2026-10-14', kg: 82.5 }],
      stepsOn: (day) => (day === '2026-10-14' ? 7200 : null),
      moveOn: (day) =>
        testMove({
          workouts: day === '2026-10-14' ? 1 : 0,
        }),
    });
    renderWithBridge(<DiaryPage />, bridge);
    const card = await screen.findByRole('region', { name: 'Kroki' });
    expect(within(card).getByLabelText('Kroki')).toHaveValue('7200');
    expect(within(card).queryByLabelText('Waga, kg')).not.toBeInTheDocument();
    expect(card).toHaveTextContent(
      'Ruch nie zmienia celu jedzenia. Twój zwykły ruch jest już w celu, a gdy ruszasz się więcej przez kilka tygodni, pokaże to waga — wtedy cel sam urośnie.',
    );
    for (const old of ['Cel a ruch', 'Ruch dziś:', 'Cel zakłada', 'kcal']) expect(card).not.toHaveTextContent(old);
    // Ten sam cel w karcie dnia: 2000, bez dopisków za trening.
    expect(within(screen.getByRole('region', { name: 'Bilans dnia' })).getByRole('meter', { name: 'Kalorie' })).toHaveAttribute(
      'aria-valuetext',
      '0 z 2000 kcal',
    );
    // Nic do zapisania, dopóki nikt nie zmienił liczby.
    expect(within(card).getByRole('button', { name: 'Zapisz kroki' })).toBeDisabled();
  });
});

describe('Zmiany w liczeniu', () => {
  test('raz po przejściu: punkty z zachowanym celem, „Rozumiem” chowa je tu i na ekranie Dziś', async () => {
    await saveProfile(profile({ dailyKcal: 1860, notice: 'show' }));
    const user = userEvent.setup();
    renderWithBridge(
      <>
        <DiaryPage />
        <TodayFoodCard />
      </>,
    );
    const notice = await screen.findByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' });
    expect(within(notice).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Jeden cel na każdy dzień: 1860 kcal. Nie zmienia się w ciągu dnia ani po północy.',
      'Kroki i treningi nie zmieniają już celu. Kalorie z ruchu to szacunek z dużym błędem, a Twój zwykły ruch jest już w celu.',
      'Nadwyżka z jednego dnia nie obniża kolejnych, a ±100 kcal to wciąż cel — jeden dzień nie zmienia trendu.',
      'W poniedziałki sprawdzam wagę i zapisy z ostatnich 4 tygodni. Gdy się nie zgadzają, zmieniam cel o 100 kcal i mówię dlaczego. Gdy wychodzi, że spalasz mniej, niż liczyłem, zanim obniżę cel, pytam.',
      '„Cheat meal” to teraz „Większy posiłek”, a porównanie tygodni na stronie Postęp pokazuje tylko pewne wnioski.',
    ]);
    expect(within(notice).getByRole('link', { name: 'Ustawienia w profilu diety' })).toHaveAttribute('href', '#/jedzenie/profil');
    const link = await screen.findByRole('link', { name: 'Liczenie kalorii jest teraz prostsze — zobacz, co się zmieniło' });
    expect(link).toHaveAttribute('href', '#/jedzenie');

    await user.click(within(notice).getByRole('button', { name: 'Rozumiem' }));
    await waitFor(async () => expect((await db.profile.get('me'))?.notice).toBe('seen'));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: /zobacz, co się zmieniło/ })).not.toBeInTheDocument();
  }, 15_000);

  test('bez liczenia kalorii punkty mówią to samo bez liczb', async () => {
    await saveProfile(profile({ dailyKcal: 1860, notice: 'show', age: 16 }));
    renderWithBridge(<DiaryPage />);
    const notice = await screen.findByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' });
    const bullets = within(notice).getAllByRole('listitem').map((li) => li.textContent);
    expect(bullets[0]).toBe('Jeden cel na każdy dzień. Nie zmienia się w ciągu dnia ani po północy.');
    expect(bullets[3]).toBe(
      'W poniedziałki sprawdzam wagę i zapisy z ostatnich 4 tygodni. Gdy się nie zgadzają, podnoszę cel i mówię dlaczego — nigdy go nie obniżam.',
    );
    expect(bullets.at(-1)).toBe(
      'Poniżej 18 lat nie liczę kalorii ani nie ustawiam deficytu — dziennik pokazuje białko i podpowiada posiłki.',
    );
  });

  test('cel zachowany poniżej podstawowej przemiany materii: dwa wyjścia', async () => {
    // Mężczyzna 80 kg: podstawowa przemiana 1750 kcal po zaokrągleniu w górę, minimum 1500.
    await saveProfile(profile({ dailyKcal: 1600, notice: 'show' }));
    renderWithBridge(<DiaryPage />);
    const notice = await screen.findByRole('region', { name: 'Liczenie kalorii jest teraz prostsze' });
    expect(notice).toHaveTextContent('Twój cel jest niższy niż Twoja podstawowa przemiana materii (1750 kcal).');
    expect(within(notice).getByRole('button', { name: 'Podnieś do 1750 kcal' })).toBeInTheDocument();
    expect(within(notice).getByRole('button', { name: 'Zostaw — ustalony z lekarzem albo dietetykiem' })).toBeInTheDocument();
  });
});

describe('Plan z zakupami w dzienniku', () => {
  test('plan dnia z nazwą planu i odnośnikiem do niego, w miejscu pod zjedzonym', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const id = await savePrepPlan(prepPlan('2026-10-13', 7, { name: 'Tydzień w biurze' }));
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Plan na ten dzień: Tydzień w biurze · dzień 2 z 7' });
    expect(within(card).getByRole('link', { name: 'Tydzień w biurze' })).toHaveAttribute('href', `#/jedzenie/plan?plan=${id}`);
    expect(screen.getByRole('region', { name: /^Zjedzone/ }).nextElementSibling).toBe(card);
    expect(screen.queryByRole('heading', { name: 'Propozycja dnia' })).not.toBeInTheDocument();
  });

  test('dzień bez planu: zapowiedź planu, który zaczyna się później, nad propozycją dnia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const soon = await savePrepPlan(prepPlan('2026-10-15', 3));
    const later = await savePrepPlan(prepPlan('2026-10-19', 7, { name: 'Po weekendzie' }));
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    // Bez własnej nazwy plan nazywa się stylem i sklepem.
    const link = await screen.findByRole('link', { name: 'Redukcja · Biedronka' });
    expect(link).toHaveAttribute('href', `#/jedzenie/plan?plan=${soon}`);
    const note = link.closest('p')!;
    expect(note).toHaveTextContent('Plan „Redukcja · Biedronka” zaczyna się jutro.');
    const proposal = screen.getByRole('region', { name: 'Propozycja dnia' });
    expect(note.compareDocumentPosition(proposal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Jutro plan już prowadzi dzień — bez zapowiedzi i bez propozycji.
    await user.click(screen.getByRole('button', { name: 'Następny dzień' }));
    expect(await screen.findByRole('region', { name: /^Plan na ten dzień: Redukcja · Biedronka · dzień 1 z 3/ })).toBeInTheDocument();
    expect(screen.queryByText(/zaczyna się/)).not.toBeInTheDocument();

    // Sobota po nim: zapowiedź następnego, z dniem tygodnia.
    for (const day of ['2026-10-16', '2026-10-17', '2026-10-18']) {
      await user.click(screen.getByRole('button', { name: 'Następny dzień' }));
      await waitFor(() => expect(window.location.hash).toBe(`#/jedzenie?dzien=${day}`));
    }
    const next = await screen.findByRole('link', { name: 'Po weekendzie' });
    expect(next).toHaveAttribute('href', `#/jedzenie/plan?plan=${later}`);
    expect(next.closest('p')).toHaveTextContent('Plan „Po weekendzie” zaczyna się w pon. 19 paź.');
    expect(screen.getByRole('region', { name: 'Propozycja dnia' })).toBeInTheDocument();
  }, 15_000);
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
