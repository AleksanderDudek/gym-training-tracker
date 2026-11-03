// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, type Entry } from '../../diet/db';
import { addDays } from '../../diet/model';
import { clearAll, saveProfile } from '../../diet/store';
import { planDates } from '../../prep/blocks';
import { generatePlan } from '../../prep/generate';
import { savePrepPlan } from '../../prep/store';
import { planTargets } from '../../prep/targets';
import { DIET_PROFILES } from '../../diet/profiles';
import { renderWithBridge } from '../../test/bridge';
import { PREP_DICT, prepIndex, prepProfile } from '../../test/prep';
import ShoppingPage from './ShoppingPage';

// The product base of the tests, ready at once; Biedronka and Myprotein in its dictionary.
vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const { PREP_DICT } = await import('../../test/prep');
  const loaded = { dataset: { ...DATASET, dictionaries: { ...DATASET.dictionaries, stores: PREP_DICT.stores } }, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

// Every recipe bought at its typical values: one shop that sells what the catalog names.
vi.mock('../../recipes/resolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../recipes/resolve')>();
  const { prepIndex } = await import('../../test/prep');
  const index = prepIndex();
  return { ...actual, recipeIndex: () => index };
});

// Tuesday morning; the default rhythm shops on Saturday 7 Nov for 7 days.
const TUESDAY = new Date('2026-11-03T09:00:00');
const TODAY = '2026-11-03';
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

const entry = (date: string, over: Partial<Entry>): Entry => ({
  date,
  time: '08:00',
  name: 'x',
  amountLabel: '1 porcja',
  kcal: 300,
  protein: 20,
  carbs: 20,
  fat: 5,
  source: 'recipe',
  ...over,
});

/** Skyr with raspberries every day of the last `n` days, and a cake once. */
async function seedDiary(n: number) {
  const days = Array.from({ length: n }, (_, i) => addDays(TODAY, -1 - i));
  await db.entries.bulkAdd([
    ...days.map((d) => entry(d, { key: 'recipe:skyr-maliny', name: 'Skyr z malinami' })),
    ...(n ? [entry(days[0]!, { source: 'custom', key: 'custom:9', name: 'Tort', amountLabel: '1 kawałek' })] : []),
    ...(n ? [entry(days[1] ?? days[0]!, { source: 'restaurant', key: 'restaurant:kfc:strips', name: 'Stripsy' })] : []),
  ]);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lista zakupów z dziennika', () => {
  test('bez profilu diety — zaproszenie do profilu', async () => {
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('heading', { name: 'Lista zakupów z dziennika' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustaw profil diety' })).toHaveAttribute('href', '#/jedzenie/profil');
  });

  test('mniej niż 3 zapisane dni — prośba o kilka dni zapisów, rytm już do ustawienia', async () => {
    await saveProfile(prepProfile());
    await seedDiary(2);
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByText('Za mało zapisów na listę')).toBeInTheDocument();
    expect(screen.getByText(/W ostatnich 4 tygodniach są 2 z co najmniej 3/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otwórz dziennik' })).toHaveAttribute('href', '#/jedzenie');
    expect(screen.getByRole('region', { name: 'Kiedy robisz zakupy' })).toBeInTheDocument();
    expect(screen.getByText(/Nie ustawione — na razie liczę do soboty, 10:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kalendarz/ })).toHaveAttribute('href', '#/kalendarz');
  });

  test('lista: nagłówek mówi, z czego policzona, dział po dziale, „Czasem” zwinięte, „Sprawdź w domu”, odhaczanie na urządzeniu', async () => {
    await saveProfile(prepProfile());
    await seedDiary(7);
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('heading', { name: 'Zakupy: sob., 7 lis' })).toBeInTheDocument();
    expect(screen.getByText('Jedzenie na 7 dni (7–13 lis): średnia z 7 zapisanych dni z ostatnich 4 tygodni.')).toBeInTheDocument();

    const list = screen.getByRole('region', { name: 'Do kupienia' });
    expect(within(list).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Nabiał i jajka', 'Mrożonki']);
    const skyr = within(list).getByRole('checkbox', { name: /Skyr naturalny/ });
    expect(skyr.closest('li')).toHaveTextContent('4 opak. · po 450 g');
    expect(skyr.closest('li')).toHaveTextContent('jedzone w 7 z 7 dni');

    // Tort zjedzony raz: w „Czasem”, nie na liście.
    expect(within(list).queryByText('Tort')).not.toBeInTheDocument();
    const sometimes = screen.getByRole('region', { name: 'Czasem (1)' });
    expect(within(sometimes).getByText('Tort')).not.toBeVisible();
    expect(screen.getByRole('region', { name: 'Sprawdź w domu' })).toHaveTextContent('Białko w proszku');
    expect(screen.getByText(/To średnia z dziennika, nie zapas w domu — zajrzyj do lodówki/)).toHaveTextContent(
      'Bez 1 wpisu z lokali, zdjęć, planu i szybkich wpisów',
    );

    await user.click(skyr);
    expect(screen.getByText(/^Kupione 1 z 2/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('gt:zakupy-dziennik')!)).toEqual({ shop: '2026-11-07', keys: ['skyr'] });
    await user.click(screen.getByRole('button', { name: 'Odznacz wszystko' }));
    expect(window.localStorage.getItem('gt:zakupy-dziennik')).toBeNull();
  });

  test('odhaczenia z poprzednich zakupów nie przechodzą na następne', async () => {
    await saveProfile(prepProfile());
    await seedDiary(7);
    window.localStorage.setItem('gt:zakupy-dziennik', JSON.stringify({ shop: '2026-10-31', keys: ['skyr'] }));
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    const list = await screen.findByRole('region', { name: 'Do kupienia' });
    expect(within(list).getByRole('checkbox', { name: /Skyr naturalny/ })).not.toBeChecked();
  });

  test('rytm: stałe dni zapisują się w profilu i zmieniają liczbę dni listy; „co kilka dni” też', async () => {
    await saveProfile(prepProfile());
    await seedDiary(7);
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    renderWithBridge(<ShoppingPage />);
    const card = await screen.findByRole('region', { name: 'Kiedy robisz zakupy' });
    await screen.findByRole('region', { name: 'Do kupienia' });
    await user.click(within(card).getByRole('button', { name: 'Ustaw' }));
    // Dziś wtorek: zakupy dziś i w sobotę, lista na wtorek–piątek.
    await user.click(within(card).getByRole('button', { name: 'wtorek' }));
    await waitFor(async () => expect((await db.profile.get('me'))!.shopping).toEqual({ kind: 'weekdays', days: [2, 6], at: '10:00' }));
    expect(within(card).getByText('Wtorek i sobota, 10:00')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Zakupy: wt., 3 lis' })).toBeInTheDocument();
    expect(screen.getByText(/^Jedzenie na 4 dni \(3–6 lis\)/)).toBeInTheDocument();

    // Ostatniego dnia nie da się odznaczyć.
    await user.click(within(card).getByRole('button', { name: 'wtorek' }));
    await user.click(within(card).getByRole('button', { name: 'sobota' }));
    await waitFor(async () => expect((await db.profile.get('me'))!.shopping).toEqual({ kind: 'weekdays', days: [6], at: '10:00' }));

    await user.click(within(card).getByRole('button', { name: 'Co kilka dni' }));
    await waitFor(async () => expect((await db.profile.get('me'))!.shopping).toEqual({ kind: 'every', days: 7, from: '2026-11-07', at: '10:00' }));
    await user.selectOptions(within(card).getByRole('combobox', { name: 'Co ile dni' }), '3');
    await waitFor(async () => expect((await db.profile.get('me'))!.shopping).toMatchObject({ kind: 'every', days: 3 }));
    expect(within(card).getByText('Co 3 dni, 10:00')).toBeInTheDocument();
  });

  test('„Udostępnij listę” wysyła listę tekstem z odhaczeniami i podstawą', async () => {
    await saveProfile(prepProfile());
    await seedDiary(7);
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderWithBridge(<ShoppingPage />);
    await user.click(await screen.findByRole('button', { name: 'Udostępnij listę' }));
    expect(share).toHaveBeenCalledWith({
      title: 'Lista zakupów',
      text: expect.stringMatching(/^Zakupy z dziennika · sob\., 7 lis \(jedzenie na 7–13 lis\)\n\nLista\n {2}Nabiał i jajka\n {2}\[ \] Skyr naturalny/),
    });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
});

describe('dwa źródła: z dziennika i z planu', () => {
  async function seedPlan() {
    const profile = prepProfile();
    const settings = { start: TODAY, days: 7, meals: 4 as const, cooking: 'lunch' as const, store: 'biedronka', online: null, exclude: [], seed: 1, avoid: [] };
    const result = generatePlan({
      settings,
      index: prepIndex(),
      dict: PREP_DICT,
      dayTargets: planTargets({ profile, kcal: 2200, dates: planDates(settings.start, settings.days) }),
      goal: { kcal: 2200, source: 'profile', dietProfile: 'redukcja', styleLabel: DIET_PROFILES.redukcja.label, pace: 0.5, weightKg: 82 },
      createdAt: '2026-11-03T07:00:00.000Z',
    });
    if (!result.ok) throw new Error(result.message);
    return savePrepPlan(result.plan);
  }

  test('z planem: przełącznik, domyślnie lista planu; „Z dziennika” w adresie i w pamięci urządzenia', async () => {
    await saveProfile(prepProfile());
    await seedDiary(7);
    await seedPlan();
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    const first = renderWithBridge(<ShoppingPage />);
    const nav = await screen.findByRole('navigation', { name: 'Skąd lista' });
    expect(within(nav).getByRole('link', { name: 'Z planu' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Biedronka — wizyta w sklepie' })).toBeInTheDocument();
    const diary = within(nav).getByRole('link', { name: 'Z dziennika' });
    expect(diary).toHaveAttribute('href', '#/jedzenie/zakupy?z=dziennik');
    await user.click(diary);
    expect(window.localStorage.getItem('gt:zakupy-zrodlo')).toBe('dziennik');
    first.unmount();

    // Następna wizyta bez `?z=`: ostatni wybór.
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('region', { name: 'Do kupienia' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Skąd lista' })).getByRole('link', { name: 'Z dziennika' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'Ułóż plan' })).not.toBeInTheDocument();
  });

  test('odnośnik z planu (`?plan=`) zawsze prowadzi do listy planu', async () => {
    await saveProfile(prepProfile());
    const id = await seedPlan();
    window.localStorage.setItem('gt:zakupy-zrodlo', 'dziennik');
    at(`#/jedzenie/zakupy?plan=${id}`);
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('region', { name: 'Biedronka — wizyta w sklepie' })).toBeInTheDocument();
  });
});
