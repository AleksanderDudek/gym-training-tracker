// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Ten plik biegnie po angielsku: język ustala się przy pierwszym imporcie modułu języka.
vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import type { DayRow } from '../../diet/db';
import { db } from '../../diet/db';
import { addDays } from '../../diet/model';
import { clearAll, saveProfile } from '../../diet/store';
import { AISLE_LABELS } from '../../prep/aisles';
import { EXCLUSION_LABELS } from '../../prep/candidates';
import { checkIn } from '../../prep/checkin';
import { goalName, portionLabel } from '../../prep/format';
import { noSwapMessage } from '../../prep/generate';
import { PLAN_WORDS } from '../../prep/meals';
import { amountText, shoppingText } from '../../prep/shopping';
import { SIDES } from '../../prep/sides';
import { slotsFor } from '../../prep/slots';
import type { PrepPlan } from '../../prep/types';
import { renderWithBridge } from '../../test/bridge';
import { prepProfile } from '../../test/prep';
import PlansPage from './PlansPage';
import { PrepDayCard } from './PrepDayCard';
import { PrepSection } from './PrepSection';
import ShoppingPage from './ShoppingPage';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const { PREP_DICT } = await import('../../test/prep');
  const loaded = { dataset: { ...DATASET, dictionaries: { ...DATASET.dictionaries, stores: PREP_DICT.stores } }, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Product data is not included in this version of the app.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

vi.mock('../../recipes/resolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../recipes/resolve')>();
  const { prepIndex } = await import('../../test/prep');
  const index = prepIndex();
  return { ...actual, recipeIndex: () => index };
});

const POLISH = /[ąćęłńóśźż]/i;
const TUESDAY = new Date('2026-10-20T09:00:00');
const TODAY = '2026-10-20';
const at = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const noop = () => {};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TUESDAY);
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

function absent(...texts: (string | RegExp)[]) {
  for (const t of texts) expect(screen.queryByText(t)).not.toBeInTheDocument();
}

/** The form makes a plan; it is read back from the device. */
async function makePlan(): Promise<PrepPlan & { id: number }> {
  const profile = prepProfile();
  await saveProfile(profile);
  at('#/jedzenie/plan');
  const user = userEvent.setup();
  const { bridge, unmount } = renderWithBridge(
    <PrepSection profile={profile} plans={[]} today={TODAY} wanted={null} formOpen onOpenForm={noop} onCloseForm={noop} />,
  );
  const form = await screen.findByRole('form', { name: 'Plan with a shopping list' });
  expect(within(form).getByLabelText('Starting')).toHaveDisplayValue('today, Tue, 20 Oct');
  expect(within(form).getByLabelText('How many days')).toHaveDisplayValue('7 days (a week)');
  expect(within(form).getByLabelText('Shop (one visit)')).toHaveDisplayValue('Biedronka');
  expect(within(form).getByLabelText('Online order')).toHaveDisplayValue('no order');
  expect(within(form).getByRole('group', { name: 'Meals a day' })).toBeInTheDocument();
  expect(within(form).getByRole('button', { name: 'Lunch from a box' })).toBeInTheDocument();
  expect(within(form).getByRole('button', { name: 'No meat' })).toBeInTheDocument();
  expect(
    await within(form).findByText(
      'To fit your goal I need at least 5 weigh-ins over 14 days and full food logs on ¾ of those days (now: 0 weigh-ins). The plan uses the goal from your profile.',
    ),
  ).toBeInTheDocument();
  absent('Od kiedy', 'Ułóż plan', 'Bez mięsa', /Do dopasowania/, 'Cel planu');
  await user.click(within(form).getByRole('button', { name: 'Make the plan' }));
  await vi.waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Your 7-day plan is ready — the shopping list is waiting.'));
  unmount();
  const [stored] = await db.prep.toArray();
  return stored as PrepPlan & { id: number };
}

describe('Plan & shopping in English', () => {
  test('the form, the plan, the day card, the list and my plans', async () => {
    const plan = await makePlan();
    // A plan made in English stores English slot names and side amounts.
    expect(plan.meals.slice(0, 4).map((m) => m.slotName)).toEqual(['Breakfast', 'Lunch', 'Afternoon snack', 'Dinner']);
    for (const m of plan.meals) for (const s of m.sides) expect(s.amount).not.toMatch(POLISH);
    for (const i of plan.shopping) expect(amountText(i)).not.toMatch(POLISH);

    const profile = prepProfile();
    const { unmount } = renderWithBridge(
      <PrepSection profile={profile} plans={[plan]} today={TODAY} wanted={null} formOpen={false} onOpenForm={noop} onCloseForm={noop} />,
    );
    expect(await screen.findByText('Plan for 7 days')).toBeInTheDocument();
    expect(screen.getByText(/· shopping: Biedronka · 4 meals a day$/)).toBeInTheDocument();
    for (const name of ['Recipes in the plan', 'Batch cooking', 'Day by day'])
      expect(screen.getByRole('heading', { name: new RegExp(name) })).toBeInTheDocument();
    for (const name of ['Rename', 'Change dates', 'Another plan', 'Next plan', 'Delete plan'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shopping list/ })).toBeInTheDocument();
    expect(screen.getAllByText(/^Day goal /).length).toBe(7);
    expect(screen.getAllByText(/^Today, Tue, 20 Oct$/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'My plans (1)' })).toBeInTheDocument();
    absent('Przepisy w planie', 'Dzień po dniu', 'Gotowanie na zapas', 'Zmień daty', /^Plan na \d/, /Cel dnia/, /zakupy:/);
    unmount();

    const day = renderWithBridge(<PrepDayCard plan={plan} date={TODAY} entries={[]} />);
    expect(screen.getByRole('heading', { name: /^Plan for this day/ })).toHaveTextContent('· day 1 of 7');
    expect(screen.getAllByRole('button', { name: /^Eaten: / }).length).toBe(4);
    expect(screen.getByText('Cooking today')).toBeInTheDocument();
    absent('Zjadłem', 'Dziś gotujesz', 'Plan na ten dzień');
    day.unmount();

    at(`#/jedzenie/zakupy?plan=${plan.id}`);
    const list = renderWithBridge(<ShoppingPage />);
    expect(await screen.findByRole('heading', { name: 'Shopping for 20–26 Oct' })).toBeInTheDocument();
    expect(screen.getByText(/^Bought 0 of \d+$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Share list/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Biedronka — shop visit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check at home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: AISLE_LABELS.warzywa })).toBeInTheDocument();
    absent('Udostępnij listę', 'Sprawdź w domu', /opak\./, /Kupione/, /wizyta w sklepie/);
    list.unmount();

    renderWithBridge(<PlansPage />);
    expect(await screen.findByRole('heading', { name: '1 plan with shopping' })).toBeInTheDocument();
    expect(screen.getByText('running · day 1 of 7')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New plan/ })).toBeInTheDocument();
    absent('Nowy plan', /z zakupami/, /trwa/);

    const text = shoppingText(plan);
    expect(text).toMatch(/^Shopping list · 20–26 Oct\n/);
    expect(text).toContain('\nCheck at home\n');
    expect(noSwapMessage(plan, 'breakfast')).not.toMatch(POLISH);
  }, 30_000);
});

describe('check-in and planner labels in English', () => {
  test('reasons with numbers, aisles, exclusions, slots, sides and words', () => {
    const profile = prepProfile({ dailyKcal: 2200, startWeightKg: 84, targetWeightKg: 76 });
    const few = checkIn({ profile, days: [{ date: '2026-10-18', weightKg: 82 }], eaten: new Map(), today: TODAY });
    expect(few.reason).toBe(
      'To fit your goal I need at least 5 weigh-ins over 14 days and full food logs on ¾ of those days (now: 1 weigh-in). The plan uses the goal from your profile.',
    );

    // Four weeks standing still on 2200 kcal: the model expected a loss, so the goal comes down.
    const days: DayRow[] = [];
    const eaten = new Map<string, number>();
    for (let i = 28; i >= 1; i--) {
      const date = addDays(TODAY, -i);
      if ((28 - i) % 3 === 0) days.push({ date, weightKg: 82 });
      eaten.set(date, 2200);
    }
    const lower = checkIn({ profile, days, eaten, today: TODAY });
    expect(lower.status).toBe('korekta');
    expect(lower.reason).toContain(`I suggest ${lower.suggestedKcal.toLocaleString('en-GB')} kcal instead of 2,200 kcal`);
    expect(lower.reason).toMatch(/^Over the last \d+ days your weight moved at .+; the plan assumed .+\. Your diary and weight say/);

    const texts = [
      few.reason,
      lower.reason,
      ...Object.values(AISLE_LABELS),
      ...Object.values(EXCLUSION_LABELS),
      ...Object.values(PLAN_WORDS),
      ...slotsFor(5).map((s) => s.name),
      ...Object.values(SIDES).flatMap((s) => [s.name, s.amount(1), s.amount(2)]),
      portionLabel(1),
      portionLabel(1.5),
      goalName(0),
    ];
    for (const t of texts) expect(t).not.toMatch(POLISH);
    expect(SIDES.oil.amount(4)).toBe('1 tablespoon and 1 teaspoon of olive oil');
    expect(portionLabel(1.5)).toBe('1½ servings');
    expect(PLAN_WORDS['za mało']).toBe('too little');
  });
});
