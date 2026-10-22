// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MoveDay } from '../../bridge';
import { db } from '../../diet/db';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
import DiaryPage from './DiaryPage';

/**
 * Cheat meal w dzienniku: arkusz z symulacją pod polami, zaplanowany posiłek na górze dnia, który
 * rezerwuje swoje kalorie, i ruch do końca dnia, który zmienia dostępne kalorie. Środa, południe:
 * przed nami trzy posiłki, a cel to 2000 kcal (białko 150 g).
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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie');
  await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75 }));
});

afterEach(() => {
  vi.useRealTimers();
});

const openSheet = async (user: ReturnType<typeof userEvent.setup>, mode: 'list' | 'macros' = 'macros') => {
  await user.click(await screen.findByRole('button', { name: 'Cheat meal' }));
  const dialog = screen.getByRole('dialog', { name: 'Cheat meal' });
  if (mode === 'macros') await user.click(within(dialog).getByRole('button', { name: 'Wpisz makro' }));
  return dialog;
};

const sim = (dialog: HTMLElement) => within(dialog).getByRole('region', { name: 'Co z tego wynika' });

describe('arkusz cheat mealu', () => {
  test('mieści się: zostaje na pozostałe posiłki, a „Zaplanuj” rezerwuje go w dniu', async () => {
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const dialog = await openSheet(user);
    expect(sim(dialog)).toHaveTextContent('Wpisz kalorie');
    await user.type(within(dialog).getByLabelText('Co to będzie'), 'Pizza ze znajomymi');
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '900');
    await user.type(within(dialog).getByLabelText('Białko (g)'), '30');

    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*2000 kcal/);
    expect(sim(dialog)).toHaveTextContent(/Razem\s*900 kcal/);
    // Bez wpisanych kroków „zostanę przy obecnych” nic nie znaczy — tej opcji nie ma.
    expect(within(dialog).getByRole('radio', { name: /Dojdę do celu/ })).toBeChecked();
    expect(within(dialog).queryByRole('radio', { name: /Zostanę przy obecnych/ })).not.toBeInTheDocument();
    expect(sim(dialog)).toHaveTextContent('Mieścisz się: zostaje 1100 kcal na 2 posiłki — po ok. 550 kcal i 60 g białka.');
    expect(sim(dialog)).toHaveTextContent('Białka brakuje jeszcze 120 g');

    await user.click(within(dialog).getByRole('button', { name: 'Zaplanuj' }));
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    expect(bridge.toast).toHaveBeenCalledWith(
      'Cheat meal zaplanowany: Pizza ze znajomymi · 900 kcal. Reszta dnia liczy się już z nim.',
    );
    const card = await screen.findByRole('region', { name: /Zaplanowany cheat meal/ });
    expect(card).toHaveTextContent('Pizza ze znajomymi');
    expect(card).toHaveTextContent('900 kcal · B 30 · W ? · T ?');
    // „Co teraz?” liczy już z nim: zostaje 1100 kcal na dwa posiłki.
    expect(screen.getByRole('region', { name: 'Co teraz?' })).toHaveTextContent(
      'Zostało 1100 kcal i 120 g białka na 2 posiłki — po odjęciu zaplanowanego cheat mealu.',
    );
    // Zjedzone jeszcze nic — plan to nie wpis.
    expect(screen.getByRole('region', { name: /^Zjedzone/ })).toHaveTextContent('Nic jeszcze nie zapisane');
  });

  test('ponad cel: o ile, co to robi z tygodniem i wagą, i co by to odrobiło', async () => {
    await logQuick(TODAY, 'Śniadanie i obiad', 1500);
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const dialog = await openSheet(user);
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '1200');
    // 2700 wobec 2000: 700 ponad cel. Środa: nadwyżka rozkłada się na czwartek–niedzielę.
    expect(sim(dialog)).toHaveTextContent('Przekroczysz cel o 700 kcal (35%).');
    expect(sim(dialog)).toHaveTextContent('Tydzień: cel na kolejne 4 dni spadnie o ok. 170 kcal dziennie.');
    expect(sim(dialog)).toHaveTextContent('W prognozie wagi to ok. 93 g.');
    // Bez zapisanych treningów nie ma „typowego treningu” do zaproponowania — tylko kroki.
    expect(sim(dialog)).toHaveTextContent(/ok\. 22\s000 kroków więcej\./);
  });

  test('ruch do końca dnia: opuszczony trening z planu i mniej kroków zabierają kalorie', async () => {
    const move: MoveDay = {
      trained: false,
      workoutKcal: 0,
      cardioKcal: 0,
      otherKcal: 0,
      planned: { name: 'Trening A', kcal: 320 },
      planActive: true,
      typicalWorkoutKcal: 300,
      workouts: 0,
      snacks: 0,
      outings: 0,
      activeMin: 0,
      stepsWorth: null,
    };
    const bridge = testBridge({
      weights: [{ day: '2026-10-01', kg: 80 }],
      stepsOn: (day) => (day === TODAY ? 3000 : null),
      moveOn: (day) => (day === TODAY ? move : { ...move, planned: null }),
    });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />, bridge);
    const dialog = await openSheet(user);
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '800');
    // Domyślnie: dojdziesz do celu kroków i trening z planu będzie — cel bez zmian.
    expect(within(dialog).getByRole('radio', { name: /Trening z planu będzie \(„Trening A”, ok\. 320 kcal\)/ })).toBeChecked();
    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*2000 kcal/);

    await user.click(within(dialog).getByRole('radio', { name: 'Dziś treningu nie będzie' }));
    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*1680 kcal/);
    expect(sim(dialog)).toHaveTextContent('−320 kcal: „Trening A” z planu bez wykonania');

    // 3000 kroków to mniej niż 4000 w mnożniku: całe 192 kcal chodzenia z celu znikają.
    await user.click(within(dialog).getByRole('radio', { name: 'Zostanę przy obecnych (3000)' }));
    expect(sim(dialog)).toHaveTextContent(/Cel na dziś\s*1490 kcal/);
  });

  test('przyszły dzień: zaplanować można, zjeść jeszcze nie', async () => {
    window.history.replaceState(null, '', '/#/jedzenie?dzien=2026-10-17');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const dialog = await openSheet(user);
    await user.type(within(dialog).getByLabelText('Kalorie (kcal)'), '1000');
    expect(within(dialog).getByRole('button', { name: 'Zjedzone teraz' })).toBeDisabled();
    expect(within(dialog).queryByRole('group', { name: 'Ruch do końca dnia' })).not.toBeInTheDocument();
    expect(sim(dialog)).toHaveTextContent(/Cel tego dnia\s*2000 kcal/);
  });
});

describe('cheat meal z listy', () => {
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
    const dialog = await openSheet(user, 'list');
    // Ulubione widać, zanim cokolwiek się wpisze.
    await user.click(await within(dialog).findByRole('button', { name: /^Pizza z Biesiady/ }));
    await user.type(within(dialog).getByRole('searchbox', { name: 'Szukaj do cheat mealu' }), 'pepsi');
    await user.click((await within(dialog).findAllByRole('button', { name: /^Pepsi/ }))[0]!);
    const parts = within(dialog).getAllByRole('button', { name: /^Usuń z cheat mealu/ });
    expect(parts).toHaveLength(2);
    expect(within(dialog).getByLabelText('Co to będzie')).toHaveAttribute('placeholder', 'Pizza z Biesiady + Pepsi');
    expect(sim(dialog)).toHaveTextContent(/Cheat meal\s*1\s?\d{3} kcal/);
    expect(sim(dialog)).not.toHaveTextContent('Wpisz kalorie');

    // „Wpisz makro” zaczyna od sumy z listy.
    await user.click(within(dialog).getByRole('button', { name: 'Wpisz makro' }));
    expect(Number((within(dialog).getByLabelText('Kalorie (kcal)') as HTMLInputElement).value)).toBeGreaterThan(1100);
    expect(within(dialog).getByLabelText('Co to będzie')).toHaveValue('Pizza z Biesiady + Pepsi');
  });

  test('zaplanowany z listy pokazuje na karcie, z czego jest', async () => {
    await planCheat(TODAY, {
      name: 'Kebab i cola',
      kcal: 1150,
      protein: 50,
      carbs: 120,
      fat: 45,
      items: ['Kebab duży (1 szt.)', 'Cola (0,5 l)'],
    });
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Zaplanowany cheat meal/ });
    expect(card).toHaveTextContent('Kebab duży (1 szt.) · Cola (0,5 l)');
  });
});

describe('zaplanowany cheat meal w dzienniku', () => {
  test('„Zjedzone” zapisuje go w zjedzonych i zdejmuje z planu', async () => {
    await planCheat(TODAY, { name: 'Burger', kcal: 950, protein: 40, carbs: 80, fat: 50 });
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Zaplanowany cheat meal/ });
    expect(card).toHaveTextContent('Mieścisz się: zostaje 1050 kcal na 2 posiłki');
    await user.click(within(card).getByRole('button', { name: 'Zjedzone' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /Zaplanowany cheat meal/ })).not.toBeInTheDocument());
    expect(await db.entries.where('date').equals(TODAY).toArray()).toEqual([
      expect.objectContaining({ name: 'Burger', kcal: 950, protein: 40 }),
    ]);
    expect(bridge.toast).toHaveBeenCalledWith('Zapisane: Burger · 950 kcal.');
  });

  test('„Zmień” otwiera arkusz z jego liczbami, „Usuń” zdejmuje go z dnia', async () => {
    await planCheat(TODAY, { name: 'Burger', kcal: 950, protein: 40, carbs: null, fat: null });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Zaplanowany cheat meal/ });
    await user.click(within(card).getByRole('button', { name: 'Zmień' }));
    const dialog = screen.getByRole('dialog', { name: 'Cheat meal' });
    expect(within(dialog).getByLabelText('Kalorie (kcal)')).toHaveValue('950');
    expect(within(dialog).getByRole('button', { name: 'Zapisz zmiany' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
    await user.click(within(card).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /Zaplanowany cheat meal/ })).not.toBeInTheDocument());
    expect((await db.days.get(TODAY))?.cheat).toBeUndefined();
  });
});
