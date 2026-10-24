// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GymBridge } from '../../bridge';
import { db } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import type { Profile } from '../../diet/types';
import { renderWithBridge, testBridge, testMove } from '../../test/bridge';
import { addDays } from '../../diet/model';
import DietPlanPage from './DietPlanPage';
import DietProgressPage from './DietProgressPage';

// Plan z zakupami nad planem z arkusza czyta bazę produktów: tu mała baza z testów.
vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

const item = (text: string, kcal: number) => ({ text, kcal, protein: 30, carbs: 40, fat: 20, stores: [] });
const PLAN: Plan = {
  id: 'active',
  name: 'Plan testowy',
  startDate: '2026-10-12',
  days: ['1A', '2A'],
  templates: {
    '1A': [
      {
        index: 1,
        items: [item('Owsianka', 450), item('Kurczak z ryżem', 700)],
        totals: { kcal: 1150, protein: 60, carbs: 80, fat: 40 },
      },
    ],
    '2A': [{ index: 1, items: [item('Jajecznica', 400)], totals: { kcal: 400, protein: 30, carbs: 40, fat: 20 } }],
  },
  foods: [item('Owsianka', 450), item('Kurczak z ryżem', 700), item('Jajecznica', 400)],
  notes: ['Warianty można mieszać w obrębie tygodnia.'],
};

/** Wednesday: the week from Monday 12 Oct is unfinished. */
const TODAY = '2026-10-14';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Every text on the page, the screen-reader-only and the tooltips too, for the absence checks. */
function pageText(): string {
  const titles = [...document.querySelectorAll('[title],[aria-label]')].flatMap((el) => [
    el.getAttribute('title') ?? '',
    el.getAttribute('aria-label') ?? '',
  ]);
  return [document.body.textContent ?? '', ...titles].join('\n');
}

describe('Plan posiłków', () => {
  test('bez profilu — ten sam pierwszy krok co w dzienniku', async () => {
    window.history.replaceState(null, '', '/#/jedzenie/plan');
    renderWithBridge(<DietPlanPage />);
    expect(await screen.findByRole('heading', { name: 'Plan posiłków' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ustaw profil diety' })).toBeInTheDocument();
  });

  test('bez planu zaprasza do wczytania arkusza', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    window.history.replaceState(null, '', '/#/jedzenie/plan');
    renderWithBridge(<DietPlanPage />);
    expect(await screen.findByRole('heading', { name: 'Plan z arkusza' })).toBeInTheDocument();
    expect(screen.getByLabelText('Wczytaj plan z Excela')).toHaveAttribute('type', 'file');
    // Nad nim plan z zakupami: bez planu — od razu jego formularz.
    expect(screen.getByRole('heading', { name: 'Plan z listą zakupów' })).toBeInTheDocument();
  });

  test('tydzień planu: dzień prowadzi do dziennika, przejście o tydzień zostaje w adresie, plan da się usunąć', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    await db.plans.put(PLAN);
    await logQuick('2026-10-12', 'Obiad', 2500);
    window.history.replaceState(null, '', '/#/jedzenie/plan');
    const user = userEvent.setup();
    renderWithBridge(<DietPlanPage />);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    // Nagłówek i siedem dni.
    expect(rows).toHaveLength(8);
    expect(within(rows[1]!).getByRole('link')).toHaveAttribute('href', '#/jedzenie?dzien=2026-10-12');
    expect(rows[1]).toHaveTextContent('1A · wariant 1');
    // Zjedzone bez ocen: żadnego „ponad cel” przy dniu nad celem.
    expect(rows[1]).toHaveTextContent('2500');
    expect(pageText()).not.toContain('ponad cel');
    // Dziś bez zapytania: dziennik i tak otwiera się na dziś.
    expect(within(rows[3]!).getByRole('link')).toHaveAttribute('href', '#/jedzenie');
    expect(screen.getByText('Warianty można mieszać w obrębie tygodnia.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Następny tydzień' }));
    expect(await screen.findByRole('heading', { name: /Tydzień od 19 paź/ })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/jedzenie/plan?dzien=2026-10-21');

    await user.click(screen.getByRole('button', { name: 'Usuń plan' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń plan' }));
    expect(await screen.findByRole('heading', { name: 'Plan z arkusza' })).toBeInTheDocument();
    expect(await db.plans.count()).toBe(0);
  });

  test('cel dnia w tygodniu planu to cel z historii — nadwyżka z poniedziałku go nie zmniejsza, koniec przerwy go zmienia', async () => {
    // A break from Monday to Friday: maintenance now, the old target back on Saturday.
    await saveProfile(
      completeProfile({
        startDate: '2026-10-01',
        dailyKcal: 2600,
        goals: [
          { from: '2026-10-01', kcal: 1900, by: 'setup' },
          { from: '2026-10-12', kcal: 2600, by: 'break' },
          { from: '2026-10-17', kcal: 1900, by: 'break' },
        ],
        pauses: [{ from: '2026-10-12', to: '2026-10-16', kcal: 1900 }],
      }),
    );
    await db.plans.put(PLAN);
    // 800 over the target on Monday: the old weekly spread took it off every day left.
    await logQuick('2026-10-12', 'Obiad', 3400);
    window.history.replaceState(null, '', '/#/jedzenie/plan');
    renderWithBridge(<DietPlanPage />);

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Cel' })).toBeInTheDocument();
    // Columns: day (row header), template, plan, target, eaten — the target only from today.
    const goals = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[2]!.textContent);
    expect(goals).toEqual(['', '', '2600', '2600', '2600', '1900', '1900']);
  });

  test('bez liczenia kalorii tydzień planu nie ma kolumny celu', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', hideKcal: true }));
    await db.plans.put(PLAN);
    window.history.replaceState(null, '', '/#/jedzenie/plan');
    renderWithBridge(<DietPlanPage />);
    const table = await screen.findByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Cel' })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Zjedzone' })).toBeInTheDocument();
  });
});

/** A profile on the way from 84 to 78 kg (−0,5 kg a week by default), 2000 kcal a day. */
const loser = (over: Partial<Profile> = {}) =>
  completeProfile({ startDate: '2026-10-01', startWeightKg: 84, targetWeightKg: 78, dailyKcal: 2000, ...over });

async function openProgress(bridge: GymBridge) {
  window.history.replaceState(null, '', '/#/jedzenie/postep');
  return renderWithBridge(<DietProgressPage />, bridge);
}

/** 28 daily weigh-ins losing 0,5 kg a week, ±0,1 kg of water day to day, ending today. */
const losingDaily = Array.from({ length: 28 }, (_, i) => ({
  day: addDays(TODAY, i - 27),
  kg: 84 - (0.5 / 7) * i + (i % 2 ? -0.1 : 0.1),
}));

/**
 * Finished weeks ending last week, oldest first, weighed on Monday, Wednesday and Friday on the
 * week's line: three trainings lose 0,6 kg, one loses 0,1.
 */
function trainingWeeks(trainings: number[]) {
  const thisMonday = '2026-10-12';
  const weights: { day: string; kg: number }[] = [];
  const trainedOn = new Set<string>();
  let kg = 86;
  trainings.forEach((n, i) => {
    const monday = addDays(thisMonday, -7 * (trainings.length - i));
    const change = n === 3 ? -0.6 : -0.1;
    for (const d of [0, 2, 4]) weights.push({ day: addDays(monday, d), kg: kg + (change * d) / 7 });
    for (let d = 0; d < n; d++) trainedOn.add(addDays(monday, d));
    kg += change;
  });
  weights.push({ day: thisMonday, kg });
  return testBridge({
    weights,
    moveOn: (day) => testMove({ workouts: trainedOn.has(day) ? 1 : 0 }),
  });
}

describe('Postęp', () => {
  test('„Teraz (trend)” to trend z ważeń, nie ostatnie ważenie; bez „Z zapisów jedzenia wynikałoby” i bez „ponad cel”', async () => {
    await saveProfile(loser());
    await logQuick('2026-10-13', 'Obiad', 2500, { protein: 120, carbs: 150, fat: 60 });
    await openProgress(
      testBridge({
        weights: [
          { day: '2026-10-02', kg: 83.6 },
          { day: '2026-10-12', kg: 82.4 },
        ],
      }),
    );

    // 83,6 then 82,4 ten days later: the trend has moved about two thirds of the way — 82,8, not 82,4.
    await screen.findByRole('heading', { name: 'Waga' });
    const now = screen.getByText('82,8 kg').closest('.tile')!;
    expect(now).toHaveTextContent('Teraz (trend) · ostatnie ważenie 12.10');
    expect(screen.queryByText('82,4 kg')).not.toBeInTheDocument();
    expect(screen.getByText('−1,2 kg')).toBeInTheDocument();
    expect(screen.getByText(/^Od startu · od 1 paź 2026$/)).toBeInTheDocument();
    expect(screen.getByText('4,8 kg')).toBeInTheDocument();
    expect(screen.getByText('Do celu · waga docelowa 78 kg')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Wykres wagi: 2 pomiary, trend, prognoza i waga docelowa 78 kg.' })).toBeInTheDocument();
    expect(screen.getByText(/^Za mało ważeń, żeby policzyć tempo/)).toBeInTheDocument();
    // 2500 against 2000 is a bar like any other: no verdict.
    const days = within(screen.getByRole('list', { name: 'Zjedzone kalorie dzień po dniu' })).getAllByRole('listitem');
    expect(days).toHaveLength(14);
    expect(days[12]).toHaveTextContent(/: 2500 kcal, cel 2000$/);
    const text = pageText();
    expect(text).not.toContain('Z zapisów jedzenia wynikałoby');
    expect(text).not.toContain('ponad cel');
    expect(text).not.toContain('Według planu');
    // Protein from the complete day with full macros.
    expect(screen.getByText('Średnio 120 g dziennie (cel 156 g), z 1 dnia z pełnymi danymi.')).toBeInTheDocument();
  });

  test('kiedy waga docelowa: przed pierwszym dopasowaniem z zakładanego tempa, po nim zakres miesięcy z tempa ± niepewność', async () => {
    await saveProfile(loser({ startDate: '2026-09-01', targetWeightKg: 77.7 }));
    const plain = await openProgress(testBridge({ weights: losingDaily }));
    // The trend is 82,68 kg: 4,98 kg to go at the planned 0,5 kg a week.
    expect(
      await screen.findByText(
        'Przy zakładanym tempie (−0,5 kg na tydzień) to ok. 10 tygodni. Prognozę z Twoich danych pokażę po pierwszym dopasowaniu celu.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Tempo z ostatnich 4 tygodni: −0,5 kg na tydzień (±0,1).')).toBeInTheDocument();
    plain.unmount();

    await saveProfile(loser({ startDate: '2026-09-01', targetWeightKg: 77.7, anchored: true }));
    await openProgress(testBridge({ weights: losingDaily }));
    // 4,98 kg at 0,5 ± 0,11: between 8 and 13 weeks — December to January, not a day.
    expect(await screen.findByText('W tym tempie waga docelowa: ok. grudzień 2026 – styczeń 2027.')).toBeInTheDocument();
    expect(screen.queryByText(/Przy zakładanym tempie/)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Wykres wagi: 28 pomiarów, trend, prognoza i waga docelowa 77,7 kg\./ })).toBeInTheDocument();
  });

  test('cel kalorii zmieniony w połowie dwóch tygodni: każdy dzień ma swój cel, a historia celu mówi kiedy i dlaczego', async () => {
    await saveProfile(
      loser({
        dailyKcal: 1850,
        goals: [
          { from: '2026-10-01', kcal: 1950, by: 'setup' },
          { from: '2026-10-07', kcal: 1850, by: 'check' },
        ],
      }),
    );
    await openProgress(testBridge());
    const days = within(await screen.findByRole('list', { name: 'Zjedzone kalorie dzień po dniu' })).getAllByRole('listitem');
    // 1–14 Oct: the change of 7 Oct is the seventh day.
    expect(days[5]).toHaveTextContent(/6\.10: brak zapisów, cel 1950$/);
    expect(days[6]).toHaveTextContent(/7\.10: brak zapisów, cel 1850$/);
    expect(days[13]).toHaveTextContent(/cel 1850$/);
    const history = screen.getByRole('region', { name: 'Cel kalorii — zmiany' });
    expect(within(history).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '7.10 · 1850 kcal · dopasowanie z wagi i zapisów',
      '1.10 · 1950 kcal · start',
    ]);
  });

  test('tydzień po tygodniu: dzień zapisany w części nie liczy się do jedzenia, a tydzień z dwoma ważeniami nie ma zmiany wagi', async () => {
    await saveProfile(loser());
    for (let d = 0; d < 7; d++) await logQuick(addDays('2026-10-05', d), 'Dzień', d === 2 ? 400 : 2000);
    await openProgress(
      testBridge({
        weights: [
          { day: '2026-10-05', kg: 84 },
          { day: '2026-10-09', kg: 83.6 },
        ],
      }),
    );
    // The page's one table: the weeks.
    const table = await screen.findByRole('table');
    const week = within(table).getAllByRole('row').find((r) => within(r).queryByRole('rowheader', { name: /^5–11\.10/ }))!;
    const [weight, food] = within(week).getAllByRole('cell');
    // Two weigh-ins four days apart: no change, and why.
    expect(weight).toHaveTextContent(/^–/);
    expect(within(weight!).getByTitle('Za mało ważeń w tym tygodniu (potrzeba 3)')).toBeInTheDocument();
    // The 400 kcal day is not a whole day: six days of 2000.
    expect(food).toHaveTextContent('20006 dni');
    expect(screen.getByRole('region', { name: 'Tydzień po tygodniu' })).toContainElement(table);
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Tydzień',
      'Waga',
      'Jedzenie',
      'Kroki',
      'Treningi',
    ]);
  });

  test('tylko siedem pełnych tygodni: tabela jest, wniosków jeszcze nie ma', async () => {
    await saveProfile(loser({ startDate: '2026-08-01', startWeightKg: 88 }));
    await openProgress(trainingWeeks([3, 1, 3, 1, 3, 1, 3]));
    // The current week and seven finished ones — and no finding from them yet.
    expect(within(await screen.findByRole('table')).getAllByRole('row').slice(1)).toHaveLength(8);
    expect(screen.queryByText(/co najmniej 3 treningi/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Co idzie w parze z postępem' })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Tydzień po tygodniu' });
    expect(section).toHaveTextContent('Wnioski pokażę, gdy różnica między tygodniami będzie wyraźnie większa niż szum wagi.');
  });

  test('dziewięć pełnych tygodni z wyraźną różnicą: jeden wniosek, bez słów o sile związku', async () => {
    await saveProfile(loser({ startDate: '2026-08-01', startWeightKg: 88 }));
    await openProgress(trainingWeeks([3, 1, 3, 1, 3, 1, 3, 1, 3]));
    const section = await screen.findByRole('region', { name: 'Tydzień po tygodniu' });
    expect(within(section).getByRole('heading', { name: 'Co idzie w parze z postępem' })).toBeInTheDocument();
    const findings = within(section).getAllByRole('listitem');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toHaveTextContent('co najmniej 3 treningi w tygodniu');
    expect(findings[0]).toHaveTextContent(
      'Średnio −0,6 kg/tydz. (5 tygodni) · w pozostałych −0,1 kg/tydz. (4 tygodnie). W tych tygodniach waga szła wyraźnie szybciej w stronę celu.',
    );
    expect(section).not.toHaveTextContent(/Związek|słaby|wyraźny|umiarkowany|sprzyja/);
    expect(section).toHaveTextContent('To skojarzenia z Twoich tygodni, nie dowód.');
    expect(section).not.toHaveTextContent('Wnioski pokażę');
    const lastWeek = within(within(section).getByRole('table')).getAllByRole('row')[2]!;
    expect(within(lastWeek).getByRole('rowheader')).toHaveTextContent('5–11.10');
    expect(within(lastWeek).getAllByRole('cell')[0]).toHaveTextContent('−0,6 kg');
  });

  test('cel w górę: do celu liczy się w górę; utrzymanie wagi to jedno zdanie', async () => {
    await saveProfile(loser({ startWeightKg: 70, targetWeightKg: 74, dailyKcal: 3200 }));
    const gaining = await openProgress(testBridge({ weights: [{ day: '2026-10-12', kg: 71 }] }));
    expect(await screen.findByText('3 kg')).toBeInTheDocument();
    expect(screen.getByText('Do celu · waga docelowa 74 kg')).toBeInTheDocument();
    // −0,25 kg a week planned: 3 kg is 12 weeks.
    expect(screen.getByText(/^Przy zakładanym tempie \(\+0,25 kg na tydzień\) to ok\. 12 tygodni\./)).toBeInTheDocument();
    gaining.unmount();

    await saveProfile(loser({ startWeightKg: 75, targetWeightKg: 75 }));
    await openProgress(testBridge({ weights: [{ day: '2026-10-12', kg: 75.2 }] }));
    expect(await screen.findByText('Cel to utrzymanie wagi.')).toBeInTheDocument();
    expect(screen.getByText('utrzymanie')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Wykres wagi: 1 pomiar, trend i waga docelowa 75 kg.' })).toBeInTheDocument();
  });

  test('bez liczenia kalorii: bez historii celu, bez kalorii z 14 dni i bez kolumny jedzenia — waga, tempo i białko zostają', async () => {
    await saveProfile(loser({ hideKcal: true }));
    await logQuick('2026-10-13', 'Obiad', 1900, { protein: 120, carbs: 150, fat: 60 });
    await openProgress(testBridge({ weights: [{ day: '2026-10-12', kg: 82.4 }] }));
    expect(await screen.findByText(/^Teraz \(trend\)/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cel kalorii — zmiany' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Kalorie – ostatnie 14 dni' })).not.toBeInTheDocument();
    const table = within(screen.getByRole('region', { name: 'Tydzień po tygodniu' })).getByRole('table');
    expect(within(table).queryByRole('columnheader', { name: 'Jedzenie' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Białko – ostatnie 7 dni' })).toHaveTextContent('Średnio 120 g dziennie');
    expect(pageText()).not.toMatch(/kcal/);
  });
});
