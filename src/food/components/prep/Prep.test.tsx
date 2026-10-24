// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { DIET_PROFILES } from '../../diet/profiles';
import { clearAll, saveProfile } from '../../diet/store';
import { planDates } from '../../prep/blocks';
import { generatePlan } from '../../prep/generate';
import { savePrepPlan } from '../../prep/store';
import { planTargets } from '../../prep/targets';
import type { PrepPlan, PrepSettings } from '../../prep/types';
import { renderWithBridge, testBridge } from '../../test/bridge';
import { PREP_DICT, prepIndex, prepProfile } from '../../test/prep';
import DiaryPage from '../diet/DiaryPage';
import DietPlanPage from '../diet/DietPlanPage';
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

// Tuesday morning: the form starts the plan today.
const TUESDAY = new Date('2026-10-20T09:00:00');
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
/** A plan without a name of its own: the style and the shop. */
const TITLE = `${DIET_PROFILES.redukcja.label} · Biedronka`;
const FROM_PROFILE = 'Cel z profilu diety. Dopasowuje się w poniedziałki — plan bierze dzisiejszy.';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

function makePlan(over: Partial<PrepSettings> = {}): PrepPlan {
  const profile = prepProfile();
  const settings: PrepSettings = {
    start: '2026-10-20',
    days: 7,
    meals: 4,
    cooking: 'lunch',
    store: 'biedronka',
    online: null,
    exclude: [],
    seed: 1,
    avoid: [],
    ...over,
  };
  const result = generatePlan({
    settings,
    index: prepIndex(),
    dict: PREP_DICT,
    dayTargets: planTargets({ profile, kcal: 2200, dates: planDates(settings.start, settings.days) }),
    goal: { kcal: 2200, source: 'profile', dietProfile: 'redukcja', styleLabel: DIET_PROFILES.redukcja.label, pace: 0.5, weightKg: 82 },
    createdAt: '2026-10-20T07:00:00.000Z',
  });
  if (!result.ok) throw new Error(result.message);
  return result.plan;
}

describe('plan posiłków: plan z zakupami', () => {
  test('bez planu formularz stoi od razu; „Ułóż plan” zapisuje plan na tydzień i pokazuje go', async () => {
    await saveProfile(prepProfile());
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DietPlanPage />);

    const form = await screen.findByRole('form', { name: 'Plan z listą zakupów' });
    expect(within(form).getByLabelText('Od kiedy')).toHaveDisplayValue(/^dziś, wt\., 20 paź$/);
    expect(within(form).getByLabelText('Na ile dni')).toHaveDisplayValue('7 dni (tydzień)');
    expect(within(form).getByLabelText('Sklep (jedna wizyta)')).toHaveDisplayValue('Biedronka');
    expect(within(form).getByRole('button', { name: '4', pressed: true })).toBeInTheDocument();
    // The plan's goal is the profile's target of today, said once.
    expect(within(form).getByText(FROM_PROFILE)).toBeInTheDocument();

    await user.click(within(form).getByRole('button', { name: 'Ułóż plan' }));
    expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(bridge.toast).toHaveBeenCalledWith('Plan na 7 dni gotowy — lista zakupów czeka.');
    const [stored] = await db.prep.toArray();
    expect(stored).toMatchObject({ settings: { start: '2026-10-20', days: 7, meals: 4, store: 'biedronka', online: null } });
    expect(stored!.meals).toHaveLength(28);
    expect(screen.getByRole('link', { name: /Lista zakupów/ })).toHaveAttribute('href', `#/jedzenie/zakupy?plan=${stored!.id}`);
    // Today's day is open; the cooking of today and of Saturday is listed.
    expect(screen.getByRole('heading', { name: 'Gotowanie na zapas' })).toBeInTheDocument();
    expect(screen.getAllByText(/^Dziś, wt\., 20 paź$/).length).toBeGreaterThan(0);
  }, 15_000);

  test('wykluczenia i zamówienie przez internet trafiają do planu', async () => {
    await saveProfile(prepProfile());
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    const form = await screen.findByRole('form', { name: 'Plan z listą zakupów' });
    await user.click(within(form).getByRole('button', { name: 'Bez mięsa' }));
    await user.selectOptions(within(form).getByLabelText('Zamówienie przez internet'), 'myprotein');
    expect(within(form).getByLabelText('Zamówienie przez internet')).toHaveDisplayValue(/^Myprotein · \+\d+ przepisów$/);
    await user.click(within(form).getByRole('button', { name: 'Ułóż plan' }));
    await screen.findByRole('heading', { name: TITLE });
    const [stored] = await db.prep.toArray();
    expect(stored!.settings).toMatchObject({ exclude: ['meat'], online: 'myprotein' });
    expect(stored!.shops.map((s) => s.name)).toEqual(['Biedronka', 'Myprotein']);
    expect(screen.getByText(/zakupy: Biedronka \+ Myprotein \(zamówienie\)/)).toBeInTheDocument();
  }, 15_000);

  test('cel planu to dzisiejszy cel z profilu, ten sam na każdy dzień — bez wyboru celu i bez zmiany profilu', async () => {
    await saveProfile(prepProfile({ dailyKcal: 2200 }));
    // Three weeks of weigh-ins standing still on 2200 kcal — the old check-in offered a lower goal —
    // and 600 over the target yesterday, which the old weekly spread took off the days ahead.
    const weights = Array.from({ length: 8 }, (_, i) => ({ day: planDates('2026-09-26', 22)[i * 3]!, kg: 82 }));
    for (const d of planDates('2026-09-26', 24)) await db.entries.add({ date: d, time: '12:00', name: 'Dzień', amountLabel: '', kcal: 2200, protein: 150, carbs: 200, fat: 70, source: 'quick' });
    await db.entries.add({ date: '2026-10-19', time: '19:00', name: 'Kolacja', amountLabel: '', kcal: 600, protein: 30, carbs: 60, fat: 25, source: 'quick' });
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DietPlanPage />, testBridge({ weights, heightCm: 180 }));
    const form = await screen.findByRole('form', { name: 'Plan z listą zakupów' });
    // Settled: nothing is left to work out before the plan can be made.
    const make = within(form).getByRole('button', { name: 'Ułóż plan' });
    await waitFor(() => expect(make).toBeEnabled());
    const goal = within(form).getByRole('region', { name: 'Cel planu' });
    expect(within(goal).queryAllByRole('radio')).toHaveLength(0);
    expect(goal).not.toHaveTextContent(/dopasowany do Twojego tempa|zalecane|Zapiszę ten cel/);
    expect(goal).toHaveTextContent(/^Cel planu\s?Redukcja · −0,5 kg\/tydz\. · 2200 kcal dziennie · .+ · białko 152 g\./);
    expect(within(goal).getByText(FROM_PROFILE)).toBeInTheDocument();

    await user.click(make);
    await screen.findByRole('heading', { name: TITLE });
    expect(bridge.toast).toHaveBeenCalledWith('Plan na 7 dni gotowy — lista zakupów czeka.');
    const [stored] = await db.prep.toArray();
    expect(stored!.goal).toMatchObject({ kcal: 2200, source: 'profile', pace: 0.5, weightKg: 82 });
    expect(stored!.checkIn).toBeNull();
    // Every day of the plan at the same targets: nothing spread over the days ahead.
    expect(stored!.dayTargets.map((d) => d.targets.kcal)).toEqual(Array(7).fill(2200));
    expect(new Set(stored!.dayTargets.map((d) => JSON.stringify(d.targets))).size).toBe(1);
    // The plan follows the profile; it never changes it.
    const profile = (await db.profile.get('me'))!;
    expect(profile.dailyKcal).toBe(2200);
    expect(profile.goals).toEqual([{ from: '2026-10-20', kcal: 2200, by: 'setup' }]);
  }, 15_000);

  test('nieaktualny plan: cel w profilu o 100 kcal niżej to wciąż ten plan, o 250 — już nie', async () => {
    await saveProfile(prepProfile({ dailyKcal: 2100 }));
    await savePrepPlan(makePlan());
    at('#/jedzenie/plan');
    const near = renderWithBridge(<DietPlanPage />);
    expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(screen.queryByText(/Od ułożenia planu zmienił się cel/)).not.toBeInTheDocument();
    near.unmount();

    await saveProfile(prepProfile({ dailyKcal: 1950 }));
    renderWithBridge(<DietPlanPage />);
    expect(
      await screen.findByText(/^Od ułożenia planu zmienił się cel w profilu diety \(1950 kcal, ten sam styl\)\./),
    ).toBeInTheDocument();
  }, 15_000);

  test('„Wymień” podmienia przepis w całym planie, „Usuń plan” wraca do formularza', async () => {
    await saveProfile(prepProfile());
    const id = await savePrepPlan(makePlan());
    const before = (await db.prep.get(id))!;
    const out = before.choices.breakfast![0]!;
    const name = before.meals.find((m) => m.recipeId === out)!.name;
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    await user.click(await screen.findByRole('button', { name: `Wymień: ${name}` }));
    // A list of what fits, the best for the plan first; the chosen one takes the place.
    const sheet = await screen.findByRole('dialog', { name: `Wymień: ${name}` });
    expect(within(sheet).getAllByText('najlepiej pasuje')).toHaveLength(1);
    const picks = within(sheet).getAllByRole('button', { name: /^Wybierz: / });
    expect(picks.length).toBeGreaterThan(1);
    const chosen = picks.at(-1)!.getAttribute('aria-label')!.replace('Wybierz: ', '');
    await user.click(picks.at(-1)!);
    await waitFor(async () => expect((await db.prep.get(id))!.choices.breakfast).not.toContain(out));
    const after = (await db.prep.get(id))!;
    expect(after.settings.avoid).toEqual([out]);
    expect(after.meals.some((m) => m.name === chosen)).toBe(true);

    await user.click(screen.getAllByRole('button', { name: /Usuń plan/ })[0]!);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń plan' }));
    expect(await screen.findByRole('form', { name: 'Plan z listą zakupów' })).toBeInTheDocument();
    expect(await db.prep.count()).toBe(0);
  }, 15_000);

  test('„Następny plan” otwiera formularz od dnia po końcu obecnego; Wstecz go zamyka', async () => {
    await saveProfile(prepProfile());
    await savePrepPlan(makePlan());
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    await user.click(await screen.findByRole('button', { name: 'Następny plan' }));
    const form = await screen.findByRole('form', { name: 'Następny plan z zakupami' });
    expect(within(form).getByLabelText('Od kiedy')).toHaveDisplayValue('wt., 27 paź');
    expect(window.location.hash).toBe('#/jedzenie/plan?nowy=1');
    await user.click(within(form).getByRole('button', { name: 'Anuluj' }));
    expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
  }, 15_000);
});

describe('dwa plany: ten tydzień i następny', () => {
  test('plan i lista pokazują plan, który trwa, a przełącznik prowadzi do następnego', async () => {
    await saveProfile(prepProfile());
    const now = await savePrepPlan(makePlan());
    const next = await savePrepPlan({ ...makePlan({ start: '2026-10-27' }), createdAt: '2026-10-20T08:00:00.000Z' });
    at('#/jedzenie/plan');
    const view = renderWithBridge(<DietPlanPage />);
    const tabs = await screen.findByRole('navigation', { name: 'Plany z zakupami' });
    expect(within(tabs).getByRole('link', { name: 'Teraz · 20–26 paź' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Następny · 27 paź – 2 lis' })).toHaveAttribute('href', `#/jedzenie/plan?plan=${next}`);
    expect(screen.getByText(/^20–26 paź · zakupy: Biedronka/)).toBeInTheDocument();
    view.unmount();

    at(`#/jedzenie/zakupy?plan=${next}`);
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('heading', { name: 'Zakupy na 27 paź – 2 lis' })).toBeInTheDocument();
    const listTabs = screen.getByRole('navigation', { name: 'Plany z zakupami' });
    expect(within(listTabs).getByRole('link', { name: 'Teraz · 20–26 paź' })).toHaveAttribute('href', `#/jedzenie/zakupy?plan=${now}`);
  });
});

describe('lista zakupów', () => {
  test('bez planu — zaproszenie do planu', async () => {
    at('#/jedzenie/zakupy');
    renderWithBridge(<ShoppingPage />);
    expect(await screen.findByText('Nie masz planu z listą zakupów.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ułóż plan' })).toHaveAttribute('href', '#/jedzenie/plan');
  });

  test('wizyta w sklepie dział po dziale, odhaczanie zostaje w planie, „Sprawdź w domu” osobno', async () => {
    const id = await savePrepPlan(makePlan());
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    renderWithBridge(<ShoppingPage />);
    const visit = await screen.findByRole('region', { name: 'Biedronka — wizyta w sklepie' });
    expect(within(visit).getByRole('heading', { name: 'Nabiał i jajka' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sprawdź w domu' })).toBeInTheDocument();

    const skyr = within(visit).getByRole('checkbox', { name: /Skyr naturalny/ });
    await user.click(skyr);
    await waitFor(async () => expect((await db.prep.get(id))!.bought).toEqual(['skyr']));
    expect(within(visit).getByRole('checkbox', { name: /Skyr naturalny/ })).toBeChecked();
    expect(screen.getByText(/^Kupione 1 z \d+/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odznacz wszystko' }));
    await waitFor(async () => expect((await db.prep.get(id))!.bought).toEqual([]));
  });

  test('„Udostępnij listę” wysyła tekst listy, a bez udostępniania kopiuje go', async () => {
    await savePrepPlan(makePlan());
    at('#/jedzenie/zakupy');
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderWithBridge(<ShoppingPage />);
    await user.click(await screen.findByRole('button', { name: 'Udostępnij listę' }));
    expect(share).toHaveBeenCalledWith({ title: 'Lista zakupów', text: expect.stringMatching(/^Lista zakupów · 20–26 paź\n\nBiedronka\n/) });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
});

describe('dziennik: plan na ten dzień', () => {
  test('posiłki dnia do odhaczenia, gotowanie dziś, lista zakupów; przycisk posiłku zapisuje porcję z dodatkami', async () => {
    await saveProfile(prepProfile());
    const plan = makePlan();
    await savePrepPlan(plan);
    at('#/jedzenie');
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const card = await screen.findByRole('region', { name: /Plan na ten dzień/ });
    expect(within(card).getByText('· dzień 1 z 7')).toBeInTheDocument();
    expect(within(card).getByText('Dziś gotujesz')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /Lista zakupów/ })).toHaveAttribute('href', expect.stringMatching(/^#\/jedzenie\/zakupy\?plan=\d+$/));
    expect(within(card).getByRole('link', { name: 'Ilości i przepis w planie' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^#\/jedzenie\/plan\?plan=\d+$/),
    );
    // No "Propozycja dnia" on a planned day.
    expect(screen.queryByRole('heading', { name: 'Propozycja dnia' })).not.toBeInTheDocument();

    const breakfast = plan.meals.find((m) => m.date === '2026-10-20' && m.slotName === 'Śniadanie')!;
    await user.click(within(card).getByRole('button', { name: `Zjedzone: ${breakfast.name}` }));
    await waitFor(async () => expect(await db.entries.count()).toBe(1));
    const [entry] = await db.entries.toArray();
    expect(entry).toMatchObject({ date: '2026-10-20', key: `recipe:${breakfast.recipeId}`, planIndex: 0, source: 'recipe', kcal: Math.round(breakfast.total.kcal) });
    await user.click(await within(card).findByRole('button', { name: `Cofnij: ${breakfast.name}` }));
    await waitFor(async () => expect(await db.entries.count()).toBe(0));
  }, 15_000);

  test('plan z zakupami ma pierwszeństwo przed planem z arkusza w swoje dni', async () => {
    await saveProfile(prepProfile());
    const excel: Plan = {
      id: 'active',
      name: 'Plan z Excela',
      startDate: '2026-10-01',
      days: ['1A'],
      templates: { '1A': [{ index: 1, items: [{ text: 'Owsianka', kcal: 400, protein: 20, carbs: 50, fat: 10, stores: [] }], totals: { kcal: 400, protein: 20, carbs: 50, fat: 10 } }] },
      foods: [],
      notes: [],
    };
    await db.plans.put(excel);
    await savePrepPlan(makePlan({ start: '2026-10-21', days: 5 }));
    at('#/jedzenie');
    const view = renderWithBridge(<DiaryPage />);
    // Today the prep plan has not started: the Excel plan's day.
    expect(await screen.findByRole('heading', { name: /Plan na ten dzień · dzień 1A/ })).toBeInTheDocument();
    view.unmount();
    at('#/jedzenie?dzien=2026-10-22');
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByText('· dzień 2 z 5')).toBeInTheDocument();
  }, 15_000);
});
