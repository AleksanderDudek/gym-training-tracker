// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, type Entry } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import type { ToastAction } from '../../bridge';
import { renderWithBridge } from '../../test/bridge';
import DiaryPage from './DiaryPage';

/*
 * Dziennik w tej rundzie: „Kopiuj na…” i „Jak wczoraj”, woda, okno jedzenia oraz błonnik, cukry
 * i sól w bilansie dnia.
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
vi.mock('../../hooks/useWeeklyCheck', () => ({ useWeeklyCheck: () => 'ready' }));

// Środa 14 października, 21:00.
const NOW = new Date('2026-10-14T21:00:00');
const TODAY = '2026-10-14';
const YESTERDAY = '2026-10-13';
const TOMORROW = '2026-10-15';

const profile = (over: Partial<Profile> = {}) =>
  completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, ...over });

const entry = (date: string, time: string, name: string, over: Partial<Entry> = {}): Entry => ({
  date,
  time,
  name,
  amountLabel: '1 porcja',
  kcal: 400,
  protein: 20,
  carbs: 40,
  fat: 15,
  source: 'custom',
  ...over,
});

const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

/** Ostatni komunikat z przyciskiem, jak go dostał most. */
function lastAction(toast: unknown): ToastAction {
  const calls = (toast as { mock: { calls: [string, ToastAction?][] } }).mock.calls;
  const withAction = calls.filter((c) => c[1]);
  return withAction.at(-1)![1]!;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await clearAll();
  window.localStorage.clear();
  at('#/jedzenie');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Kopiuj na…', () => {
  test('pora posiłku na jutro: te same wpisy z godzinami, „Cofnij” w komunikacie; „Dziś” nie ma, gdy to dziś', async () => {
    await saveProfile(profile());
    await db.entries.bulkAdd([
      entry(TODAY, '08:00', 'Owsianka'),
      entry(TODAY, '08:20', 'Kawa z mlekiem', { kcal: 60 }),
      entry(TODAY, '13:00', 'Obiad'),
    ]);
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(within(eaten).getByRole('heading', { name: 'Śniadanie' })).toBeInTheDocument();
    expect(within(eaten).getByRole('heading', { name: 'Obiad' })).toBeInTheDocument();
    expect(within(eaten).queryByRole('heading', { name: 'Kolacja' })).not.toBeInTheDocument();

    await user.click(within(eaten).getByRole('button', { name: 'Kopiuj śniadanie na…' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Kopiuj śniadanie' }));
    expect(sheet.getByText('2 wpisy · 460 kcal')).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Dziś' })).not.toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Jutro' }));

    await waitFor(async () => expect(await db.entries.where('date').equals(TOMORROW).count()).toBe(2));
    const copies = await db.entries.where('date').equals(TOMORROW).sortBy('time');
    expect(copies.map((e) => [e.time, e.name, e.kcal])).toEqual([
      ['08:00', 'Owsianka', 400],
      ['08:20', 'Kawa z mlekiem', 60],
    ]);
    expect(bridge.toast).toHaveBeenCalledWith('Skopiowano 2 wpisy na jutro.', expect.objectContaining({ label: 'Cofnij' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    lastAction(bridge.toast).run();
    await waitFor(async () => expect(await db.entries.where('date').equals(TOMORROW).count()).toBe(0));
    expect(await db.entries.where('date').equals(TODAY).count()).toBe(3);
    await waitFor(() => expect(bridge.toast).toHaveBeenLastCalledWith('Kopia cofnięta.'));
  });

  test('cały wczorajszy dzień na dziś; inny dzień nie może być tym samym dniem', async () => {
    await saveProfile(profile());
    await db.entries.bulkAdd([entry(YESTERDAY, '08:00', 'Jajecznica'), entry(YESTERDAY, '19:00', 'Kolacja')]);
    at(`#/jedzenie?dzien=${YESTERDAY}`);
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    await user.click(within(eaten).getByRole('button', { name: 'Kopiuj dzień na…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kopiuj cały dzień' });
    const sheet = within(dialog);

    // Inny dzień: ten sam co źródło — powód pod polem, „Kopiuj” wyłączone.
    fireEvent.change(sheet.getByLabelText('Inny dzień'), { target: { value: YESTERDAY } });
    expect(sheet.getByText('To ten sam dzień — wybierz inny.')).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Kopiuj' })).toBeDisabled();

    await user.click(sheet.getByRole('button', { name: 'Dziś' }));
    await waitFor(async () => expect(await db.entries.where('date').equals(TODAY).count()).toBe(2));
    expect(bridge.toast).toHaveBeenCalledWith('Skopiowano 2 wpisy na dziś.', expect.anything());
  });

  test('inny dzień z pola daty', async () => {
    await saveProfile(profile());
    await db.entries.add(entry(TODAY, '13:00', 'Obiad'));
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    await user.click(within(eaten).getByRole('button', { name: 'Kopiuj obiad na…' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Kopiuj obiad' }));
    fireEvent.change(sheet.getByLabelText('Inny dzień'), { target: { value: '2026-10-20' } });
    await user.click(sheet.getByRole('button', { name: 'Kopiuj' }));
    await waitFor(async () => expect(await db.entries.where('date').equals('2026-10-20').count()).toBe(1));
    expect(bridge.toast).toHaveBeenCalledWith('Skopiowano 1 wpis na 20 października.', expect.anything());
  });

  test('„Jak wczoraj” na pustym dniu dzisiejszym, z „Cofnij”; dzień z wpisami go nie ma', async () => {
    await saveProfile(profile());
    await db.entries.bulkAdd([entry(YESTERDAY, '08:00', 'Owsianka'), entry(YESTERDAY, '13:00', 'Obiad')]);
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(eaten).toHaveTextContent('Kopiuje wczorajsze wpisy (2) z ich godzinami');
    await user.click(within(eaten).getByRole('button', { name: 'Jak wczoraj' }));
    expect(await within(eaten).findByText('Owsianka')).toBeInTheDocument();
    expect(within(eaten).queryByRole('button', { name: 'Jak wczoraj' })).not.toBeInTheDocument();
    expect(bridge.toast).toHaveBeenCalledWith('Skopiowano 2 wpisy na dziś.', expect.objectContaining({ label: 'Cofnij' }));

    lastAction(bridge.toast).run();
    expect(await within(eaten).findByRole('button', { name: 'Jak wczoraj' })).toBeInTheDocument();
    expect(await db.entries.where('date').equals(YESTERDAY).count()).toBe(2);
  });

  test('pusty wczoraj: bez „Jak wczoraj”', async () => {
    await saveProfile(profile());
    renderWithBridge(<DiaryPage />);
    const eaten = await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(within(eaten).queryByRole('button', { name: 'Jak wczoraj' })).not.toBeInTheDocument();
  });
});

describe('Nawodnienie', () => {
  beforeEach(() => localStorage.removeItem('produkty-pl:napoj'));

  test('karta pod zjedzonym: rodzaj napoju, +250 ml, „−” cofa ostatni; kofeina z kawy; cel z EFSA dla mężczyzny', async () => {
    await saveProfile(profile());
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Nawodnienie' });
    expect(card).toHaveTextContent('0 l z 2 l');
    expect(within(card).getByRole('button', { name: 'Cofnij' })).toBeDisabled();
    expect(within(card).getByRole('button', { name: 'Woda' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(card).getByRole('button', { name: 'Dodaj 250 ml — woda' }));
    await user.click(within(card).getByRole('button', { name: 'Kawa' }));
    expect(within(card).getByText(/Kawa w zwykłych ilościach nawadnia podobnie jak woda/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Dodaj 250 ml — kawa' }));
    expect(await within(card).findByText('0,5 l z 2 l')).toBeInTheDocument();
    expect(within(card).getByRole('meter', { name: 'Nawodnienie' })).toHaveAttribute('aria-valuetext', '0,5 l z 2 l');
    expect(within(card).getByText('Woda 0,25 l · Kawa 0,25 l')).toBeInTheDocument();
    expect(within(card).getByText(/^Kofeina z kawy i herbaty: ok\. 100 mg\. EFSA uznaje za bezpieczne do 400 mg dziennie u dorosłych/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Cofnij ostatnie: kawa, 250 ml' }));
    expect(await within(card).findByText('0,25 l z 2 l')).toBeInTheDocument();
    expect(within(card).queryByText(/^Kofeina/)).not.toBeInTheDocument();
    expect((await db.days.get(TODAY))!.drinks).toMatchObject([{ kind: 'water', ml: 250 }]);
  }, 15_000);

  test('napój słodzony dopisuje się do „Zjedzone” jako szacunek, z „Cofnij” w komunikacie; „−” zabiera oba', async () => {
    await saveProfile(profile());
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Nawodnienie' });
    await user.click(within(card).getByRole('button', { name: 'Napój słodzony' }));
    expect(within(card).getByText(/^Dopisze się też do „Zjedzone”: ok\. 105 kcal i 27 g cukru na 250 ml/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Dodaj 330 ml — napój słodzony' }));
    await waitFor(() =>
      expect(bridge.toast).toHaveBeenCalledWith('Napój słodzony 330 ml — dopisany do „Zjedzone”, ok. 139 kcal.', expect.objectContaining({ label: 'Cofnij' })),
    );
    expect(await screen.findByText('Napój słodzony (szacunek)')).toBeInTheDocument();
    expect(within(card).getByText(/Napój słodzony 0,33 l \(w tym ok\. 139 kcal w „Zjedzone”\)/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Cofnij ostatnie: napój słodzony, 330 ml' }));
    await waitFor(() => expect(screen.queryByText('Napój słodzony (szacunek)')).not.toBeInTheDocument());
    expect(await db.entries.count()).toBe(0);
  }, 15_000);

  test('wybrany rodzaj zostaje na tym urządzeniu', async () => {
    await saveProfile(profile());
    const user = userEvent.setup();
    const { unmount } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Nawodnienie' });
    await user.click(within(card).getByRole('button', { name: 'Herbata' }));
    unmount();
    renderWithBridge(<DiaryPage />);
    const again = await screen.findByRole('region', { name: 'Nawodnienie' });
    expect(within(again).getByRole('button', { name: 'Herbata' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('kobieta: 1,6 l; własny cel z profilu wygrywa; dawny zapis wody liczy się jako woda', async () => {
    await saveProfile(profile({ sex: 'K' }));
    await db.days.put({ date: TODAY, water: 750 });
    const { unmount } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: 'Nawodnienie' });
    expect(card).toHaveTextContent('0,75 l z 1,6 l');
    expect(card).toHaveTextContent('Woda 0,75 l');
    unmount();
    await saveProfile(profile({ sex: 'K', waterMl: 2500 }));
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('region', { name: 'Nawodnienie' })).toHaveTextContent('0,75 l z 2,5 l');
  });

  test('wyłączona w profilu albo dzień, który dopiero nadejdzie: bez karty', async () => {
    await saveProfile(profile({ showWater: false }));
    const { unmount } = renderWithBridge(<DiaryPage />);
    await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(screen.queryByRole('region', { name: 'Nawodnienie' })).not.toBeInTheDocument();
    unmount();
    await saveProfile(profile({ showWater: true }));
    at(`#/jedzenie?dzien=${TOMORROW}`);
    renderWithBridge(<DiaryPage />);
    await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(screen.queryByRole('region', { name: 'Nawodnienie' })).not.toBeInTheDocument();
  });
});

describe('Okno jedzenia', () => {
  test('domyślnie wyłączone: bez karty', async () => {
    await saveProfile(profile());
    renderWithBridge(<DiaryPage />);
    await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(screen.queryByRole('region', { name: /Okno jedzenia/ })).not.toBeInTheDocument();
  });

  test('start podpowiada ostatni wpis, zapisuje go człowiek; potem licznik i „Kończę post”; cel bez zmian', async () => {
    await saveProfile(profile({ fastPlan: '16:8' }));
    await db.entries.bulkAdd([entry(TODAY, '13:00', 'Obiad'), entry(TODAY, '19:40', 'Kolacja')]);
    const before = (await db.profile.get('me'))!.goals;
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /^Okno jedzenia/ });
    expect(within(card).getByLabelText('Początek postu')).toHaveValue('19:40');
    // Zastrzeżenie z jednego źródła, z odnośnikiem do strony zdrowia.
    expect(card).toHaveTextContent('Post przerywany nie jest dla osób w ciąży, karmiących piersią');
    expect(within(card).getByRole('link', { name: 'Więcej o zdrowiu i bezpieczeństwie' })).toHaveAttribute('href', '#/zdrowie');
    expect(card).toHaveTextContent('Okno nie zmienia celu dnia');

    await user.click(within(card).getByRole('button', { name: 'Zaczynam post' }));
    await waitFor(async () => expect((await db.profile.get('me'))!.fast).toEqual({ start: '2026-10-14T19:40', end: null }));
    expect(bridge.toast).toHaveBeenCalledWith('Post od 19:40.');
    // 21:00: od 19:40 minęło 1 h 20 min z 16 h.
    expect(await within(card).findByText('Post od 19:40 · zostało 14 h 40 min')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Kończę post' }));
    await waitFor(async () => expect((await db.profile.get('me'))!.fast).toEqual({ start: '2026-10-14T19:40', end: '2026-10-14T21:00' }));
    expect(bridge.toast).toHaveBeenLastCalledWith('Post zakończony po 1 h 20 min.');
    expect(await within(card).findByText('Okno jedzenia do 05:00 (jutro)')).toBeInTheDocument();
    expect((await db.profile.get('me'))!.goals).toEqual(before);
  });

  test('post z wczoraj: ile zostało; inny dzień niż dziś — bez karty', async () => {
    vi.setSystemTime(new Date('2026-10-14T08:35:00'));
    await saveProfile(profile({ fastPlan: '16:8', fast: { start: '2026-10-13T20:15', end: null } }));
    const { unmount } = renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /^Okno jedzenia/ });
    expect(card).toHaveTextContent('Post od 20:15 · zostało 3 h 40 min');
    unmount();
    at(`#/jedzenie?dzien=${YESTERDAY}`);
    renderWithBridge(<DiaryPage />);
    await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(screen.queryByRole('region', { name: /Okno jedzenia/ })).not.toBeInTheDocument();
  });

  test('w ciąży karta się nie pokazuje, nawet z zapisanym wcześniej podziałem', async () => {
    await saveProfile(profile({ sex: 'K', pregnancy: true, fastPlan: '16:8' }));
    renderWithBridge(<DiaryPage />);
    await screen.findByRole('region', { name: /^Zjedzone/ });
    expect(screen.queryByRole('region', { name: /Okno jedzenia/ })).not.toBeInTheDocument();
  });
});

describe('Błonnik, cukry, sól', () => {
  test('„Więcej: …” z błonnikiem do 25 g, cukrami bez celu i solą z górną granicą; wpisy bez danych — „co najmniej”', async () => {
    await saveProfile(profile());
    await db.entries.bulkAdd([
      entry(TODAY, '08:00', 'Owsianka', { fiber: 8, sugars: 12, salt: 0.4 }),
      entry(TODAY, '13:00', 'Obiad', { fiber: 10, sugars: 6, salt: 2.1 }),
      entry(TODAY, '16:00', 'Baton', { fiber: null, sugars: null, salt: null }),
      entry(TODAY, '18:00', 'Szybki wpis'),
    ]);
    renderWithBridge(<DiaryPage />);
    const balance = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(within(balance).getByText('Więcej: węglowodany, tłuszcz, błonnik, cukry, sól')).toBeInTheDocument();
    expect(balance).toHaveTextContent('Błonnikco najmniej 18 z 25 g (bez danych w 2 wpisach)');
    expect(balance).toHaveTextContent('Cukryco najmniej 18 g (bez danych w 2 wpisach)');
    expect(balance).toHaveTextContent('Sólco najmniej 2,5 z 5 g (górna granica; bez danych w 2 wpisach)');
    expect(within(balance).getByRole('meter', { name: 'Błonnik' })).toHaveAttribute('aria-valuemax', '25');
    expect(within(balance).getByRole('meter', { name: 'Sól' })).toHaveAttribute('aria-valuemax', '5');
    expect(within(balance).queryByRole('meter', { name: 'Cukry' })).not.toBeInTheDocument();
    expect(balance).toHaveTextContent('Błonnik: co najmniej 25 g dziennie (EFSA). Sól: najwyżej 5 g dziennie (WHO).');
  });

  test('wszystkie wpisy z danymi: bez „co najmniej”; same wpisy bez danych — „bez danych”', async () => {
    await saveProfile(profile());
    await db.entries.add(entry(TODAY, '08:00', 'Owsianka', { fiber: 8, sugars: 12, salt: 0.4 }));
    const { unmount } = renderWithBridge(<DiaryPage />);
    const balance = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(balance).toHaveTextContent('Błonnik8 z 25 g');
    expect(balance).toHaveTextContent('Sól0,4 z 5 g (górna granica)');
    unmount();
    await clearAll();
    await saveProfile(profile());
    await db.entries.add(entry(TODAY, '08:00', 'Szybki wpis'));
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('region', { name: 'Bilans dnia' })).toHaveTextContent('Błonnikbez danych we wpisach');
  });

  test('bez liczenia kalorii sekcji nie ma — jak węglowodanów i tłuszczu', async () => {
    await saveProfile(profile({ hideKcal: true }));
    await db.entries.add(entry(TODAY, '08:00', 'Owsianka', { fiber: 8, sugars: 12, salt: 0.4 }));
    renderWithBridge(<DiaryPage />);
    const balance = await screen.findByRole('region', { name: 'Bilans dnia' });
    expect(balance).not.toHaveTextContent(/Błonnik|Cukry|Sól/);
  });
});
