// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { DIET_PROFILES } from '../../diet/profiles';
import { clearAll, saveProfile } from '../../diet/store';
import { planDates } from '../../prep/blocks';
import { generatePlan } from '../../prep/generate';
import { planCovering, savePrepPlan } from '../../prep/store';
import { planTargets } from '../../prep/targets';
import type { PrepPlan, PrepSettings } from '../../prep/types';
import { renderWithBridge } from '../../test/bridge';
import { PREP_DICT, prepIndex, prepProfile } from '../../test/prep';
import DietPlanPage from '../diet/DietPlanPage';
import PlansPage from './PlansPage';

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

const TUESDAY = new Date('2026-10-20T09:00:00');
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const TITLE = `${DIET_PROFILES.redukcja.label} · Biedronka`;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

function makePlan(over: Partial<PrepSettings> = {}, createdAt = '2026-10-20T07:00:00.000Z'): PrepPlan {
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
    dayTargets: planTargets({ profile, kcal: 2200, eaten: new Map(), today: '2026-10-20', dates: planDates(settings.start, settings.days) }),
    goal: { kcal: 2200, source: 'profile', dietProfile: 'redukcja', styleLabel: DIET_PROFILES.redukcja.label, pace: 0.5, weightKg: 82 },
    checkIn: null,
    createdAt,
  });
  if (!result.ok) throw new Error(result.message);
  return result.plan;
}

describe('nazwa i daty planu', () => {
  test('„Zmień nazwę” nadaje planowi własną nazwę; puste pole wraca do nazwy ze stylu i sklepu', async () => {
    await saveProfile(prepProfile());
    const id = await savePrepPlan(makePlan());
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<DietPlanPage />);
    await screen.findByRole('heading', { name: TITLE });

    await user.click(screen.getByRole('button', { name: 'Zmień nazwę' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nazwa planu' });
    const field = within(sheet).getByLabelText('Nazwa');
    expect(field).toHaveAttribute('placeholder', TITLE);
    await user.type(field, '  Masa   do pracy ');
    await user.click(within(sheet).getByRole('button', { name: 'Zapisz nazwę' }));
    expect(await screen.findByRole('heading', { name: 'Masa do pracy' })).toBeInTheDocument();
    expect((await db.prep.get(id))!.name).toBe('Masa do pracy');
    expect(bridge.toast).toHaveBeenCalledWith('Plan nazywa się teraz „Masa do pracy”.');

    await user.click(screen.getByRole('button', { name: 'Zmień nazwę' }));
    const again = await screen.findByRole('dialog', { name: 'Nazwa planu' });
    await user.clear(within(again).getByLabelText('Nazwa'));
    await user.click(within(again).getByRole('button', { name: 'Zapisz nazwę' }));
    expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(await db.prep.get(id)).not.toHaveProperty('name');
  }, 15_000);

  test('„Zmień daty” przesuwa cały plan; użyty po swoim końcu dostaje czystą listę', async () => {
    await saveProfile(prepProfile());
    const id = await savePrepPlan({ ...makePlan(), bought: ['skyr'] });
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    await screen.findByRole('heading', { name: TITLE });

    await user.click(screen.getByRole('button', { name: 'Zmień daty' }));
    const sheet = await screen.findByRole('dialog', { name: 'Daty planu' });
    const move = within(sheet).getByRole('button', { name: 'Przesuń plan' });
    expect(move).toBeDisabled();
    const ticks = within(sheet).getByRole('checkbox', { name: /Wyczyść odhaczone/ });
    // Two days later: the shopping is still the shopping.
    fireEvent.change(within(sheet).getByLabelText('Pierwszy dzień (zakupy)'), { target: { value: '2026-10-22' } });
    expect(within(sheet).getByText(/^Nowe daty: 22–28 paź · 7 dni, później o 2 dni\.$/)).toBeInTheDocument();
    expect(ticks).not.toBeChecked();
    // After the old end: a reuse, the list starts clean.
    fireEvent.change(within(sheet).getByLabelText('Pierwszy dzień (zakupy)'), { target: { value: '2026-11-03' } });
    expect(ticks).toBeChecked();
    await user.click(move);

    await waitFor(async () => expect((await db.prep.get(id))!.settings.start).toBe('2026-11-03'));
    const moved = (await db.prep.get(id))!;
    expect(moved.bought).toEqual([]);
    expect(moved.meals[0]!.date).toBe('2026-11-03');
    expect(moved.setAt).toBeDefined();
    expect(await screen.findByText(/^3–9 lis · zakupy: Biedronka/)).toBeInTheDocument();
  }, 15_000);

  test('nazwa z formularza zostaje przy planie', async () => {
    await saveProfile(prepProfile());
    at('#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    const form = await screen.findByRole('form', { name: 'Plan z listą zakupów' });
    await user.type(within(form).getByLabelText('Nazwa planu (nieobowiązkowa)'), 'Keto na wyjazd');
    await user.click(within(form).getByRole('button', { name: 'Ułóż plan' }));
    expect(await screen.findByRole('heading', { name: 'Keto na wyjazd' })).toBeInTheDocument();
    expect((await db.prep.toArray())[0]!.name).toBe('Keto na wyjazd');
  }, 15_000);
});

describe('Moje plany', () => {
  test('wszystkie plany: najpóźniejsze na górze, ze stanem; zakończony otwiera się i da się powtórzyć', async () => {
    await saveProfile(prepProfile());
    const old = await savePrepPlan({ ...makePlan({ start: '2026-10-06' }, '2026-10-05T07:00:00.000Z'), name: 'Pierwszy tydzień' });
    await savePrepPlan(makePlan());
    await savePrepPlan(makePlan({ start: '2026-10-27' }, '2026-10-20T08:00:00.000Z'));
    at('#/jedzenie/plany');
    renderWithBridge(<PlansPage />);
    expect(await screen.findByRole('heading', { name: '3 plany z zakupami' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      `${TITLE}27 paź – 2 lis · 7 dni · Biedronkaod wt., 27 paź`,
      `${TITLE}20–26 paź · 7 dni · Biedronkatrwa · dzień 1 z 7`,
      'Pierwszy tydzień6–12 paź · 7 dni · Biedronkazakończony',
    ]);
    expect(within(rows[2]!).getByRole('link')).toHaveAttribute('href', `#/jedzenie/plan?plan=${old}`);
    expect(screen.getByRole('link', { name: /Nowy plan/ })).toHaveAttribute('href', '#/jedzenie/plan?nowy=1');
  });

  test('plan zasłonięty przez inny: „Ustaw w dzienniku” oddaje mu jego dni', async () => {
    await saveProfile(prepProfile());
    const week = await savePrepPlan({ ...makePlan({}, '2026-10-20T05:00:00.000Z'), name: 'Tydzień' });
    // Made later (still before „now”) for the 23rd on: the diary follows it on those days.
    await savePrepPlan({ ...makePlan({ start: '2026-10-23', days: 5 }, '2026-10-20T06:00:00.000Z'), name: 'Od piątku' });
    at('#/jedzenie/plany');
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(<PlansPage />);
    const row = (await screen.findByText('Tydzień')).closest('li')!;
    expect(within(row).getByText('W 4 dni dziennik pokazuje „Od piątku”.')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Ustaw w dzienniku: Tydzień' }));
    await waitFor(async () => expect(planCovering(await db.prep.toArray(), '2026-10-24')?.id).toBe(week));
    expect(bridge.toast).toHaveBeenCalledWith('Dziennik idzie za planem „Tydzień” w jego dni.');
  });

  test('na stronie planu: w których dniach dziennik idzie za innym planem i „Ustaw w dzienniku”', async () => {
    await saveProfile(prepProfile());
    const week = await savePrepPlan({ ...makePlan({}, '2026-10-20T05:00:00.000Z'), name: 'Tydzień' });
    await savePrepPlan({ ...makePlan({ start: '2026-10-23', days: 5 }, '2026-10-20T06:00:00.000Z'), name: 'Od piątku' });
    at(`#/jedzenie/plan?plan=${week}`);
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);
    expect(await screen.findByText(/^W 4 z 7 dni tego planu dziennik pokazuje plan/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '„Od piątku”' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ustaw w dzienniku' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ustaw w dzienniku' })).not.toBeInTheDocument());
    expect(planCovering(await db.prep.toArray(), '2026-10-25')?.id).toBe(week);
  }, 15_000);

  test('plan zakończony otwarty z listy mówi, jak go powtórzyć; na stronie planu jest wejście do listy', async () => {
    await saveProfile(prepProfile());
    const old = await savePrepPlan(makePlan({ start: '2026-10-06' }, '2026-10-05T07:00:00.000Z'));
    at(`#/jedzenie/plan?plan=${old}`);
    renderWithBridge(<DietPlanPage />);
    expect(await screen.findByText(/^Ten plan się skończył\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inny plan/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Moje plany (1)' })).toHaveAttribute('href', '#/jedzenie/plany');
  });
});
