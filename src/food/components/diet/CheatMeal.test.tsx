// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { totals } from '../../diet/day';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from '../../diet/store';
import { DATASET } from '../../test/fixtures';
import { renderWithBridge, testBridge, testMove } from '../../test/bridge';
import { CheatMealSheet } from './CheatMealSheet';
import DiaryPage from './DiaryPage';
import { KcalShown } from './kcalShown';

/**
 * „Większy posiłek” (spec §4.4): arkusz z symulacją dnia pod polami — cel dnia z historii celu,
 * werdykt na paśmie ±100 kcal, bez tygodnia, wagi i odrabiania ruchem. Środa, południe: przed nami
 * trzy posiłki, a cel to 2000 kcal (białko 150 g).
 */

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

const WEDNESDAY = new Date('2026-10-14T12:00:00');
const TODAY = '2026-10-14';
const PROFILE = completeProfile({
  startDate: '2026-10-01',
  dailyKcal: 2000,
  targetWeightKg: 75,
  goals: [{ from: '2026-10-01', kcal: 2000, by: 'setup' }],
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie');
  await saveProfile(PROFILE);
});

afterEach(() => {
  vi.useRealTimers();
});

type SheetProps = ComponentProps<typeof CheatMealSheet>;

/** Już zjedzone tego dnia. */
const ate = (kcal: number, protein = 0) => totals([{ kcal, protein, carbs: 0, fat: 0 }]);

/** Arkusz tak, jak otwiera go dziennik. */
function renderSheet(over: Partial<SheetProps> = {}) {
  const props: SheetProps = {
    open: true,
    date: TODAY,
    today: TODAY,
    hour: 12,
    profile: PROFILE,
    eaten: ate(0),
    plannedKcal: null,
    planned: null,
    ideasFor: () => ({ variants: [], singles: [] }),
    pool: [],
    products: [],
    dict: DATASET.dictionaries,
    productsLoading: false,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    ...over,
  };
  return { props, ...renderWithBridge(<CheatMealSheet {...props} />) };
}

async function enterMacros(user: ReturnType<typeof userEvent.setup>, kcal: string, protein?: string) {
  const dialog = screen.getByRole('dialog', { name: 'Większy posiłek' });
  await user.click(within(dialog).getByRole('button', { name: 'Wpisz makro' }));
  await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), kcal);
  if (protein) await user.type(within(dialog).getByLabelText('Białko (g)'), protein);
  return dialog;
}

const sim = (dialog: HTMLElement) => within(dialog).getByRole('region', { name: 'Co z tego wynika' });

/** The diary's button and its card for a planned bigger meal. */
const DIARY_BUTTON = 'Większy posiłek';
const PLANNED_CARD = 'Zaplanowany większy posiłek';

async function openFromDiary(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: DIARY_BUTTON }));
  return screen.getByRole('dialog', { name: 'Większy posiłek' });
}

describe('arkusz „Większy posiłek”', () => {
  test('ponad cel: o ile, jedno spokojne zdanie i nic o tygodniu, prognozie wagi ani odrabianiu', async () => {
    const user = userEvent.setup();
    renderSheet({ eaten: ate(1500, 60) });
    const dialog = await enterMacros(user, '1200');
    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*2000 kcal/);
    expect(sim(dialog)).toHaveTextContent(/Większy posiłek\s*1200 kcal/);
    expect(sim(dialog)).toHaveTextContent(/Razem\s*2700 kcal/);
    expect(sim(dialog)).toHaveTextContent(
      'To ok. 700 kcal ponad cel dnia. Jeden taki dzień nie zmienia trendu — jutro jedz po prostu jak zwykle.',
    );
    expect(sim(dialog)).toHaveTextContent('Waga przez dzień–dwa może pokazać więcej — to woda i sól, nie tłuszcz.');
    for (const gone of ['Ruch do końca dnia', 'odrobić', 'Tydzień:', 'W prognozie wagi', 'Cheat meal', 'Przekroczysz'])
      expect(dialog, gone).not.toHaveTextContent(gone);
    // Werdykt bez koloru oceny: tylko słowa.
    expect(within(dialog).getByText(/^To ok\. 700 kcal/)).toHaveClass('fd-diet-verdict');
    expect(within(dialog).getByText(/^To ok\. 700 kcal/).className).not.toMatch(/fd-diet-v-/);
  });

  test('80 kcal ponad cel to wciąż cel: „Mieści się — to wypełnia cel dnia.”', async () => {
    const user = userEvent.setup();
    renderSheet({ eaten: ate(1500, 60) });
    const dialog = await enterMacros(user, '580');
    expect(sim(dialog)).toHaveTextContent('Mieści się — to wypełnia cel dnia.');
    expect(sim(dialog)).not.toHaveTextContent('ponad cel');
    expect(sim(dialog)).not.toHaveTextContent('Waga przez dzień–dwa');
  });

  test('mieści się: „ok.” na pozostałe posiłki, a „Zaplanuj” rezerwuje go w dniu', async () => {
    const user = userEvent.setup();
    const { props } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Większy posiłek' });
    expect(within(dialog).getByText('Wybierz z listy albo wpisz makro — zobaczysz, ile zostaje na resztę dnia')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Co to będzie'), 'Pizza ze znajomymi');
    await enterMacros(user, '900', '30');
    expect(sim(dialog)).toHaveTextContent('Mieści się: zostaje ok. 1100 kcal na 2 posiłki — po ok. 550 kcal i 60 g białka.');
    expect(sim(dialog)).toHaveTextContent('Białka brakuje jeszcze 120 g');

    await user.click(within(dialog).getByRole('button', { name: 'Zaplanuj' }));
    await waitFor(() =>
      expect(props.onSaved).toHaveBeenCalledWith(
        'Większy posiłek zaplanowany: Pizza ze znajomymi · 900 kcal. Reszta dnia liczy się już z nim.',
      ),
    );
    expect((await db.days.get(TODAY))?.cheat).toMatchObject({ name: 'Pizza ze znajomymi', kcal: 900, protein: 30 });
  });

  test('po południu zostaje jeden posiłek: bez „po …” na posiłek, ta sama liczba nie pada dwa razy', async () => {
    const user = userEvent.setup();
    renderSheet({ hour: 16 });
    const dialog = await enterMacros(user, '900', '30');
    expect(within(dialog).getByText(/^Mieści się:/)).toHaveTextContent(/^Mieści się: zostaje ok\. 1100 kcal na 1 posiłek\.$/);
  });

  test('bez nazwy: „Zjedzone teraz” zapisuje „Większy posiłek”', async () => {
    const user = userEvent.setup();
    const { props } = renderSheet();
    const dialog = await enterMacros(user, '900');
    await user.click(within(dialog).getByRole('button', { name: 'Zjedzone teraz' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith('Zapisane: Większy posiłek · 900 kcal.'));
    expect(await db.entries.where('date').equals(TODAY).toArray()).toEqual([
      expect.objectContaining({ name: 'Większy posiłek', kcal: 900 }),
    ]);
  });

  test('cel to cel tego dnia z historii celu; przyszły dzień można zaplanować, zjeść jeszcze nie', async () => {
    const user = userEvent.setup();
    const profile = {
      ...PROFILE,
      goals: [...PROFILE.goals, { from: '2026-10-17', kcal: 1800, by: 'user' as const }],
    };
    renderSheet({ profile, date: '2026-10-17' });
    const dialog = await enterMacros(user, '1000');
    expect(sim(dialog)).toHaveTextContent(/Cel tego dnia\s*1800 kcal/);
    expect(within(dialog).getByRole('button', { name: 'Zjedzone teraz' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Zaplanuj' })).toBeEnabled();
  });

  test('w trybie bez liczenia kalorii arkusza nie ma', () => {
    renderWithBridge(
      <KcalShown.Provider value={false}>
        <CheatMealSheet
          open
          date={TODAY}
          today={TODAY}
          hour={12}
          profile={PROFILE}
          eaten={ate(0)}
          plannedKcal={null}
          planned={null}
          ideasFor={() => ({ variants: [], singles: [] })}
          pool={[]}
          products={[]}
          dict={DATASET.dictionaries}
          productsLoading={false}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </KcalShown.Provider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Większy posiłek');
  });
});

describe('większy posiłek w dzienniku', () => {
  test('ruch nie zmienia celu: kroki i trening zostają poza arkuszem', async () => {
    const bridge = testBridge({
      weights: [{ day: '2026-10-01', kg: 80 }],
      stepsOn: (day) => (day === TODAY ? 3000 : null),
      moveOn: (day) => testMove(day === TODAY ? { trained: true, workoutKcal: 320, workouts: 1 } : {}),
    });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />, bridge);
    const dialog = await openFromDiary(user);
    await user.click(within(dialog).getByRole('button', { name: 'Wpisz makro' }));
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '800');
    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*2000 kcal/);
    expect(within(dialog).queryByRole('group', { name: 'Ruch do końca dnia' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/Ruch w celu|trening/i);
  });

  test('z ulubionych i z wyszukiwania: kilka rzeczy składa się w jeden posiłek, a suma idzie do symulacji', async () => {
    await db.favorites.put({
      key: 'custom:pizza',
      food: {
        key: 'custom:pizza',
        name: 'Pizza z Biesiady',
        detail: 'moje',
        source: 'custom',
        amountLabel: '1 pizza',
        nutrients: { kcal: 1100, protein: 45, carbs: 120, fat: 45 },
        per100: null,
        grams: null,
        stores: [],
        atHome: false,
        role: 'main',
      },
      addedAt: '2026-10-01T12:00:00Z',
      uses: 3,
      lastUsed: null,
    });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const dialog = await openFromDiary(user);
    // Ulubione widać, zanim cokolwiek się wpisze.
    await user.click(await within(dialog).findByRole('button', { name: /^Pizza z Biesiady/ }));
    await user.type(within(dialog).getByRole('searchbox', { name: 'Szukaj do większego posiłku' }), 'pepsi');
    await user.click((await within(dialog).findAllByRole('button', { name: /^Pepsi/ }))[0]!);
    expect(within(dialog).getAllByRole('button', { name: /^Usuń z większego posiłku/ })).toHaveLength(2);
    expect(within(dialog).getByLabelText('Co to będzie')).toHaveAttribute('placeholder', 'Pizza z Biesiady + Pepsi');
    expect(sim(dialog)).toHaveTextContent(/Większy posiłek\s*1\s?\d{3} kcal/);
    expect(sim(dialog)).not.toHaveTextContent('Wpisz kalorie');

    // „Wpisz makro” zaczyna od sumy z listy.
    await user.click(within(dialog).getByRole('button', { name: 'Wpisz makro' }));
    expect(Number((within(dialog).getByLabelText('Kalorie (kcal)') as HTMLInputElement).value)).toBeGreaterThan(1100);
    expect(within(dialog).getByLabelText('Co to będzie')).toHaveValue('Pizza z Biesiady + Pepsi');
  });

  test('zaplanowany posiłek: karta mówi to samo co arkusz, „Zjedzone” zapisuje go i zdejmuje z planu', async () => {
    await planCheat(TODAY, { name: 'Burger', kcal: 950, protein: 40, carbs: 80, fat: 50 });
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: PLANNED_CARD });
    expect(card).toHaveTextContent('Mieści się: zostaje ok. 1050 kcal na 2 posiłki');
    await user.click(within(card).getByRole('button', { name: 'Zjedzone' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: PLANNED_CARD })).not.toBeInTheDocument());
    expect(await db.entries.where('date').equals(TODAY).toArray()).toEqual([
      expect.objectContaining({ name: 'Burger', kcal: 950, protein: 40 }),
    ]);
    expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Burger · 950 kcal.');
  });

  test('„Zmień” otwiera arkusz z jego liczbami, „Usuń” zdejmuje go z dnia', async () => {
    await planCheat(TODAY, { name: 'Burger', kcal: 950, protein: 40, carbs: null, fat: null });
    await logQuick(TODAY, 'Śniadanie', 400);
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: PLANNED_CARD });
    await user.click(within(card).getByRole('button', { name: 'Zmień' }));
    const dialog = screen.getByRole('dialog', { name: 'Większy posiłek' });
    expect(within(dialog).getByLabelText('Kalorie (kcal)')).toHaveValue('950');
    expect(within(dialog).getByRole('button', { name: 'Zapisz zmiany' })).toBeEnabled();
    // Zaplanowany posiłek nie liczy się dwa razy: zjedzone 400 + 950 wobec 2000.
    expect(sim(dialog)).toHaveTextContent(/Razem\s*1350 kcal/);
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await user.click(within(card).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: PLANNED_CARD })).not.toBeInTheDocument());
    expect((await db.days.get(TODAY))?.cheat).toBeUndefined();
  });
});
