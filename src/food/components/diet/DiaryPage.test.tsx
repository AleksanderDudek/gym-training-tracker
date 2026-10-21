// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BridgeContext } from '../../bridge';
import { db, type Favorite } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import { savePrepPlan } from '../../prep/store';
import type { PrepPlan } from '../../prep/types';
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

/** Ulubione „Jedzenie i”, zjedzone `uses` razy. */
const favorite = (i: number, uses: number): Favorite => ({
  key: `custom:${i}`,
  food: {
    key: `custom:${i}`,
    name: `Jedzenie ${i}`,
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
    await waitFor(() => expect(window.localStorage.getItem('gt:diet')).toBe('1'));
  });

  test('kolejność od góry: dzień, waga, bilans z akcjami, zjedzone, plan dnia, „Co teraz?”, kroki, a na dole wejścia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    renderWithBridge(<DiaryPage />);
    const blocks = [
      await screen.findByRole('heading', { name: 'Dziś' }),
      screen.getByRole('region', { name: 'Ile dziś ważysz?' }),
      screen.getByRole('region', { name: 'Bilans dnia' }),
      screen.getByRole('region', { name: /^Zjedzone/ }),
      screen.getByRole('region', { name: 'Propozycja dnia' }),
      screen.getByRole('region', { name: 'Co teraz?' }),
      screen.getByRole('region', { name: 'Kroki i ruch' }),
      screen.getByRole('navigation', { name: 'Dieta' }),
    ];
    blocks.slice(1).forEach((block, i) =>
      expect(blocks[i]!.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(),
    );
    // Zjedzone zaraz pod bilansem: dopisane pojawia się tam, gdzie się stuknęło.
    expect(screen.getByRole('region', { name: 'Bilans dnia' }).nextElementSibling).toBe(
      screen.getByRole('region', { name: /^Zjedzone/ }),
    );
    const balance = screen.getByRole('region', { name: 'Bilans dnia' });
    expect(within(balance).getByRole('button', { name: 'Dodaj zjedzone' })).toBeInTheDocument();
    expect(within(balance).getByRole('button', { name: 'Ulubione' })).toBeInTheDocument();
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

  test('ulubione: bez nich arkusz mówi, jak je dodać; gwiazdka przy zjedzonym dodaje je, a „Zjadłem” zapisuje i zostawia arkusz otwarty', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', adaptWeekly: false }));
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
    expect(within(sheet).getByRole('status')).toHaveTextContent('„Zjadłem” zapisuje od razu na dziś, w ilości z gwiazdki.');
    await user.click(within(sheet).getByRole('button', { name: 'Zjadłem z ulubionych: Obiad u mamy' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Obiad u mamy · 650 kcal.'));
    expect(await db.entries.where('date').equals('2026-10-14').count()).toBe(2);
    expect(await db.favorites.get('quick:Obiad u mamy')).toMatchObject({ uses: 1 });
    // Arkusz zostaje: komunikat aplikacji stoi pod nim, więc potwierdza pasek arkusza.
    expect(sheet).toHaveAttribute('open');
    expect(within(sheet).getByRole('status')).toHaveTextContent('Zapisane na dziś: Obiad u mamy · 650 kcal.');
    await user.click(within(sheet).getByRole('button', { name: 'Zjadłem z ulubionych: Obiad u mamy' }));
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
    const names = () => within(sheet).getAllByRole('button', { name: /^Zjadłem/ }).map((b) => b.getAttribute('aria-label'));
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Zjadłem z ulubionych: Jedzenie 9');

    // Zapis podbija licznik, ale wiersze nie skaczą pod palcem, póki arkusz jest otwarty.
    await user.click(within(sheet).getByRole('button', { name: 'Zjadłem z ulubionych: Jedzenie 0' }));
    await waitFor(async () => expect(await db.favorites.get('custom:0')).toMatchObject({ uses: 1 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names().at(-1)).toBe('Zjadłem z ulubionych: Jedzenie 0');

    // Więcej niż osiem — pole do zawężania, bez względu na wielkość liter i ogonki.
    const filter = within(sheet).getByRole('searchbox', { name: 'Szukaj w ulubionych' });
    await user.type(filter, 'JEDZENIE 3');
    expect(names()).toEqual(['Zjadłem z ulubionych: Jedzenie 3']);
    await user.clear(filter);
    await user.type(filter, 'pierogi');
    expect(within(sheet).getByText('Nic z ulubionych nie pasuje do „pierogi”.')).toBeInTheDocument();

    // Ponowne otwarcie: puste pole i świeża kolejność (Jedzenie 0, zjedzone przed chwilą, przed Jedzeniem 1).
    await user.click(within(sheet).getByRole('button', { name: 'Zamknij' }));
    await user.click(screen.getByRole('button', { name: 'Ulubione (10)' }));
    expect(within(sheet).getByRole('searchbox', { name: 'Szukaj w ulubionych' })).toHaveValue('');
    expect(names().slice(-2)).toEqual(['Zjadłem z ulubionych: Jedzenie 0', 'Zjadłem z ulubionych: Jedzenie 1']);
  }, 15_000);

  test('ulubione na dzień, który nie nadszedł: lista jest, zapis — nie', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.favorites.put(favorite(1, 3));
    at('#/jedzenie?dzien=2026-10-16');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    await user.click(await screen.findByRole('button', { name: 'Ulubione (1)' }));
    const sheet = screen.getByRole('dialog', { name: 'Ulubione' });
    expect(within(sheet).getByRole('button', { name: 'Zjadłem z ulubionych: Jedzenie 1' })).toBeDisabled();
    expect(within(sheet).getByRole('status')).toHaveTextContent(/jeszcze nie nadszedł/);
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

  test('waga wpisana w dzienniku idzie do dziennika wagi z dniem oglądanym w dzienniku', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    at('#/jedzenie?dzien=2026-10-13');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />, testBridge({ weights: [{ day: '2026-10-12', kg: 82.4 }] }));
    const card = await screen.findByRole('region', { name: 'Ile ważyłeś tego dnia?' });
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

describe('Kroki i ruch — przez most do treningów', () => {
  test('kroki idą do kroków w treningach, z dniem oglądanym w dzienniku', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Kroki i ruch' });
    await user.type(within(card).getByLabelText('Kroki'), '9500');
    await user.click(within(card).getByRole('button', { name: 'Zapisz kroki' }));
    expect(bridge.setSteps).toHaveBeenCalledWith('2026-10-14', 9500);
    expect(bridge.setWeight).not.toHaveBeenCalled();
  });

  test('pole pokazuje kroki z treningów, a ruch dnia stoi obok jako informacja', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const bridge = testBridge({
      weights: [{ day: '2026-10-14', kg: 82.5 }],
      stepsOn: (day) => (day === '2026-10-14' ? 7200 : null),
      moveOn: () => ({ trained: true, workoutKcal: 310, cardioKcal: 180 }),
    });
    renderWithBridge(<DiaryPage />, bridge);
    const card = await screen.findByRole('region', { name: 'Kroki i ruch' });
    expect(within(card).getByLabelText('Kroki')).toHaveValue('7200');
    expect(within(card).queryByLabelText('Waga, kg')).not.toBeInTheDocument();
    expect(within(card).getByText(/trening 310 kcal · kroki i cardio 180 kcal/)).toBeInTheDocument();
    expect(within(card).getByText(/nie dodaję tego do celu kalorii/)).toBeInTheDocument();
    // Nic do zapisania, dopóki nikt nie zmienił liczby.
    expect(within(card).getByRole('button', { name: 'Zapisz kroki' })).toBeDisabled();
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
