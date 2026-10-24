// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import { addDays } from '../../diet/model';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import type { CheckFacts, Profile, WeekCheck } from '../../diet/types';
import { renderWithBridge } from '../../test/bridge';
import TodayFoodCard from '../../TodayFoodCard';
import { KcalShown } from './kcalShown';
import DiaryPage from './DiaryPage';
import { WeekCheckCard } from './WeekCheckCard';

vi.mock('../../data', async () => {
  const { DATASET, INDEXED } = await import('../../test/fixtures');
  const loaded = { dataset: DATASET, products: INDEXED };
  return {
    MISSING_DATA_MESSAGE: 'Dane produktów nie są dołączone do tej wersji aplikacji.',
    loadedDataset: () => loaded,
    loadDataset: () => Promise.resolve(loaded),
  };
});

const TODAY = '2026-10-14';
const MONDAY = '2026-10-12';

const FACTS: CheckFacts = {
  from: '2026-09-14',
  to: '2026-10-11',
  weeks: 4,
  weighIns: 20,
  completeDays: 25,
  spanDays: 27,
  pace: 0.6,
  paceSe: 0.08,
  intake: 1960,
  burn: 2700,
  burnSe: 100,
  before: 2550,
  after: 2650,
  trendKg: 80.2,
};

const check = (over: Partial<WeekCheck>): WeekCheck => ({
  week: MONDAY,
  status: 'changed',
  from: 1950,
  to: 2050,
  reason: 'burn',
  note: null,
  settle: null,
  facts: FACTS,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace: 0.5,
  answer: null,
  ...over,
});

/** M 35, 175 cm, 80 kg, inactive, offset 0: burn 2639,5, floor 1750; pace 0,5. */
const profile = (over: Partial<Profile>): Profile =>
  completeProfile({ startDate: '2026-08-01', targetWeightKg: 75, goalPace: 0.5, ...over });

/** A raise the check applied on Monday: 1950 until Sunday, 2050 from Monday. */
const raised = (over: Partial<Profile> = {}) =>
  profile({
    dailyKcal: 2050,
    goals: [
      { from: '2026-08-01', kcal: 1950, by: 'setup' },
      { from: MONDAY, kcal: 2050, by: 'check' },
    ],
    lastCheck: check({}),
    hold: { dir: -1, until: addDays(MONDAY, 28) },
    ...over,
  });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  await clearAll();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/jedzenie');
});

afterEach(() => {
  vi.useRealTimers();
});

/** The card alone, under a bridge, for a profile given in memory. */
function card(p: Profile, { shown = true, today = TODAY, kgNow = 80 } = {}) {
  return renderWithBridge(
    <KcalShown.Provider value={shown}>
      <WeekCheckCard profile={p} today={today} kgNow={kgNow} />
    </KcalShown.Provider>,
  );
}

describe('poniedziałkowa karta w dzienniku', () => {
  test('cel podniesiony: tytuł, fakty i powód; „Zostaw 1950 kcal” zostawia cel, a linijka na ekranie Dziś znika (★)', async () => {
    await saveProfile(raised());
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(
      <>
        <DiaryPage />
        <TodayFoodCard />
      </>,
    );
    const week = await screen.findByRole('region', { name: 'Od dziś cel: 2050 kcal (było 1950)' });
    expect(week).toHaveTextContent(
      'Ostatnie 4 tygodnie: waga −0,6 kg na tydzień (plan: −0,5 kg), średnio zapisane 1960 kcal dziennie.',
    );
    expect(week).toHaveTextContent('Z zapisów i wagi wychodzi, że spalasz więcej, niż zakładał szacunek — stąd 100 kcal więcej.');
    expect(within(week).getByRole('link', { name: 'Jak liczę cel' })).toHaveAttribute('href', '#/jedzenie/profil?jak=1');
    // Ekran Dziś ma jedną linijkę do dziennika.
    expect(await screen.findByRole('link', { name: 'Od dziś cel: 2050 kcal (było 1950)' })).toHaveAttribute('href', '#/jedzenie');
    // Karta stoi nad wagą.
    const weigh = screen.getByRole('region', { name: 'Ile dziś ważysz?' });
    expect(week.compareDocumentPosition(weigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(within(week).getByRole('button', { name: 'Zostaw 1950 kcal' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith(expect.stringMatching(/^Cel zostaje: 1950 kcal\./)));
    expect(bridge.toast).toHaveBeenCalledWith('Cel zostaje: 1950 kcal. Przy nim tempo wyjdzie ok. −0,65 kg na tydzień.');
    // The store's answer at today's weight (80 kg): the kept target from today, its pace, a hold upwards.
    const row = await db.profile.get('me');
    expect(row?.dailyKcal).toBe(1950);
    expect(row?.goals.at(-1)).toEqual({ from: TODAY, kcal: 1950, by: 'user' });
    expect(row).toMatchObject({ goalPace: 0.65, hold: { dir: 1, until: addDays(TODAY, 28) }, lastCheck: { answer: 'keep' } });
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Od dziś cel/ })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /^Od dziś cel/ })).not.toBeInTheDocument();
  }, 15_000);

  test('propozycja obniżenia: pytanie i dwie odpowiedzi; „Nie zawsze — zostaw 1950 kcal” zostawia cel', async () => {
    await saveProfile(
      profile({
        dailyKcal: 1950,
        goals: [{ from: '2026-08-01', kcal: 1950, by: 'setup' }],
        lastCheck: check({ status: 'ask', from: 1950, to: 1850, offsetAfter: -150 }),
      }),
    );
    const user = userEvent.setup();
    const { bridge } = renderWithBridge(
      <>
        <DiaryPage />
        <TodayFoodCard />
      </>,
    );
    const week = await screen.findByRole('region', { name: 'Propozycja: 1850 kcal zamiast 1950' });
    expect(week).toHaveTextContent('Z zapisów i wagi wychodzi, że spalasz trochę mniej, niż zakładał szacunek.');
    expect(week).toHaveTextContent('Czy zapisujesz prawie wszystko, co jesz?');
    expect(week).toHaveTextContent(
      'Dni zapisane tylko w części możesz oznaczyć w „Zjedzone” jako niepełne — wtedy nie liczą się do dopasowania.',
    );
    expect(within(week).getByRole('button', { name: 'Tak — ustaw 1850 kcal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Propozycja nowego celu czeka w dzienniku' })).toBeInTheDocument();

    await user.click(within(week).getByRole('button', { name: 'Nie zawsze — zostaw 1950 kcal' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Cel zostaje: 1950 kcal.'));
    // Nothing learned, no cut for 4 weeks from Monday.
    expect(await db.profile.get('me')).toMatchObject({
      dailyKcal: 1950,
      burnOffset: 0,
      hold: { dir: -1, until: addDays(MONDAY, 28) },
      lastCheck: { answer: 'no' },
    });
    await waitFor(() => expect(screen.queryByRole('region', { name: /^Propozycja: / })).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Propozycja nowego celu czeka w dzienniku' })).not.toBeInTheDocument();
  }, 15_000);

  test('na inny dzień karty nie ma', async () => {
    await saveProfile(raised());
    window.history.replaceState(null, '', '/#/jedzenie?dzien=2026-10-13');
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('heading', { name: 'Wczoraj' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Od dziś cel/ })).not.toBeInTheDocument();
  });
});

describe('karta: każdy stan swoje odpowiedzi', () => {
  test('„Szczegóły”: zamknięte, bez strzałek — spalanie, szacunek, dane i okres', () => {
    card(raised());
    const details = screen.getByText('Szczegóły').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    const rows = [...details.querySelectorAll('dl > div')].map((row) => row.textContent);
    expect(rows).toEqual([
      'Spalanie z zapisów i wagi: ok. 2700 kcal (±100)',
      'Szacunek w celu: przed 2550 kcal, po 2650 kcal',
      'Dane: 20 ważeń, pełne zapisy z 25 z 27 dni',
      'Okres: 14.09–11.10',
    ]);
    expect(details.querySelector('dl')!.textContent).not.toMatch(/→/);
  });

  test('„Zostaw” tylko wtedy, gdy zostawiony cel jest bezpieczny: nie szybciej niż 1% masy ciała na tydzień', () => {
    card(raised({ lastCheck: check({ from: 1800, to: 1900 }), dailyKcal: 1900 }));
    expect(screen.getByRole('button', { name: 'Zostaw 1800 kcal' })).toBeInTheDocument();
    cleanup();
    // 1300 kcal przy 2639,5 spalania to ok. 1,25 kg na tydzień — więcej niż 0,8 przy 80 kg.
    card(raised({ lastCheck: check({ from: 1300, to: 1400 }), dailyKcal: 1400, belowFloorOk: true, sex: 'K' }));
    expect(screen.getByRole('button', { name: 'Dobrze' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Zostaw/ })).not.toBeInTheDocument();
  });

  test('cel podniesiony do bezpiecznego minimum: powód i „Zostaw — ustalony z lekarzem…”', () => {
    card(raised({ lastCheck: check({ reason: 'floor-up', from: 1650, to: 1750, floor: 1750, facts: null }), dailyKcal: 1750 }));
    expect(screen.getByRole('region', { name: 'Od dziś cel: 1750 kcal (było 1650)' })).toHaveTextContent(
      'Cel był poniżej Twojego bezpiecznego minimum (1750 kcal), więc podnoszę go do minimum.',
    );
    expect(screen.getByRole('button', { name: 'Zostaw — ustalony z lekarzem albo dietetykiem' })).toBeInTheDocument();
    cleanup();
    card(raised({ lastCheck: check({ reason: 'floor-up', from: 1500, to: 1600, floor: 1750, facts: null }), dailyKcal: 1600 }));
    expect(screen.getByText('Cel był poniżej Twojego bezpiecznego minimum (1750 kcal), więc podnoszę go o 100 kcal.')).toBeInTheDocument();
  });

  test('cel zmieniony z wagi: w dół i w górę', () => {
    card(raised({ lastCheck: check({ reason: 'weight', from: 2050, to: 1950 }), dailyKcal: 1950 }));
    expect(screen.getByText('Ważysz mniej, więc spalasz trochę mniej — 100 kcal mniej utrzyma tempo.')).toBeInTheDocument();
    cleanup();
    card(raised({ lastCheck: check({ reason: 'weight' }) }));
    expect(screen.getByText('Ważysz więcej, więc spalasz trochę więcej — 100 kcal więcej utrzyma tempo.')).toBeInTheDocument();
  });

  test('propozycja przy wyłączonym dopasowywaniu: „Ustaw” i „Nie teraz”', async () => {
    const p = profile({ dailyKcal: 1950, autoAdjust: false, lastCheck: check({ status: 'suggested' }) });
    await saveProfile(p);
    const user = userEvent.setup();
    const { bridge } = card(p);
    const week = screen.getByRole('region', { name: 'Propozycja: 2050 kcal zamiast 1950' });
    expect(within(week).getByRole('button', { name: 'Nie teraz' })).toBeInTheDocument();
    await user.click(within(week).getByRole('button', { name: 'Ustaw 2050 kcal' }));
    await waitFor(() => expect(bridge.toast).toHaveBeenCalledWith('Nowy cel: 2050 kcal.'));
    expect(await db.profile.get('me')).toMatchObject({ dailyKcal: 2050, lastCheck: { answer: 'set' } });
  });

  test('waga docelowa osiągnięta: utrzymanie od dziś albo „Chcę dalej chudnąć”', async () => {
    const reached = { at: MONDAY, kg: 74.9, prevPace: 0.5, prevKcal: 1860, askAgain: null };
    const p = profile({
      dailyKcal: 2550,
      goalPace: 0,
      reached,
      lastCheck: check({ status: 'reached', reason: 'reached', from: 1860, to: 2550, facts: null, goalPace: 0 }),
    });
    await saveProfile(p);
    const user = userEvent.setup();
    const { bridge } = card(p);
    const week = screen.getByRole('region', { name: 'Waga docelowa osiągnięta' });
    expect(week).toHaveTextContent(
      'Trend wagi: 74,9 kg, waga docelowa: 75 kg. Od dziś cel to utrzymanie: 2550 kcal dziennie. Przez pierwsze dni waga może pokazać trochę więcej — to woda i glikogen, nie tłuszcz.',
    );
    expect(within(week).getByRole('button', { name: 'Dobrze' })).toBeInTheDocument();
    await user.click(within(week).getByRole('button', { name: 'Chcę dalej chudnąć' }));
    await waitFor(() =>
      expect(bridge.toast).toHaveBeenCalledWith('Wracam do poprzedniego celu: 1860 kcal. Zapytam znowu za 4 tygodnie.'),
    );
    // The previous pace and target back, asked again 4 weeks after the check's Monday.
    expect(await db.profile.get('me')).toMatchObject({
      dailyKcal: 1860,
      goalPace: 0.5,
      reached: { askAgain: addDays(MONDAY, 28) },
      lastCheck: { answer: 'continue' },
    });
  });

  test('osiągnięta przy wyłączonym dopasowywaniu: propozycja utrzymania; bez liczenia kalorii — bez liczb', () => {
    const reached = { at: MONDAY, kg: 74.9, prevPace: -0.25, prevKcal: 1860, askAgain: null };
    const proposal = profile({
      dailyKcal: 1860,
      autoAdjust: false,
      reached,
      lastCheck: check({ status: 'reached', reason: 'reached', from: 1860, to: 2550, facts: null }),
    });
    card(proposal);
    expect(screen.getByText('Trend wagi: 74,9 kg, waga docelowa: 75 kg. Na utrzymanie wystarczy ok. 2550 kcal dziennie.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przejdź na utrzymanie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jeszcze nie' })).toBeInTheDocument();
    cleanup();

    // Applied by the check (autoAdjust on): maintenance from Monday, the pace 0.
    const applied = { ...proposal, autoAdjust: true, dailyKcal: 2550, goalPace: 0, lastCheck: { ...proposal.lastCheck!, goalPace: 0 } };
    const { container } = card(applied, { shown: false });
    expect(screen.getByRole('region', { name: 'Waga docelowa osiągnięta' })).toHaveTextContent(
      'Od dziś dziennik podpowiada posiłki na utrzymanie wagi.',
    );
    expect(screen.getByRole('button', { name: 'Chcę dalej przybierać' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/kcal/);
  });

  test('bez liczenia kalorii karta zmiany się nie pokazuje; cel zmieniony inaczej też ją chowa', () => {
    expect(card(raised(), { shown: false }).container).toBeEmptyDOMElement();
    cleanup();
    // Profil zmieniony po sprawdzeniu: karta nie mówi już prawdy.
    expect(card(raised({ dailyKcal: 2200 })).container).toBeEmptyDOMElement();
  });
});

describe('cicha linijka w poniedziałek i wtorek', () => {
  const same = (over: Partial<WeekCheck> = {}) =>
    profile({ dailyKcal: 2050, lastCheck: check({ status: 'same', from: 2050, to: 2050, ...over }) });
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  test('cel bez zmian z tym, co widać w danych, i „Szczegóły”', () => {
    card(same(), { today: MONDAY });
    expect(
      screen.getByText(
        'Ten tydzień: cel bez zmian (2050 kcal). Ostatnie 4 tygodnie: waga −0,6 kg na tydzień (plan: −0,5 kg), średnio zapisane 1960 kcal dziennie.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Szczegóły')).toBeInTheDocument();
  });

  test('od środy nic; bez liczenia kalorii nic; za mało danych nic', () => {
    expect(card(same(), { today: TODAY }).container).toBeEmptyDOMElement();
    cleanup();
    expect(card(same(), { today: MONDAY, shown: false }).container).toBeEmptyDOMElement();
    cleanup();
    expect(
      card(same({ status: 'data', facts: null, missing: { weighIns: 2, completeDays: 10 } }), { today: MONDAY }).container,
    ).toBeEmptyDOMElement();
  });

  test('uwagi: waga skacze, cel zmieniony niedawno, bezpieczne minimum, tempo', () => {
    const cases: [Partial<WeekCheck>, string][] = [
      [{ note: 'noisy' }, 'Waga mocno skacze z dnia na dzień — ważenie codziennie rano da pewniejszy wynik.'],
      [{ note: 'held' }, 'Cel zmienił się niedawno — z kolejną zmianą poczekam kilka tygodni.'],
      [
        { note: 'floor', floor: 1750 },
        'Niżej niż 1750 kcal nie schodzę — to bezpieczne minimum. Tempo może być trochę wolniejsze i to jest w porządku.',
      ],
      [{ note: 'pace', facts: { ...FACTS, pace: 0.75 } }, 'Chudniesz szybciej, niż zakłada plan — celu nie obniżam.'],
      [{ note: 'pace', facts: { ...FACTS, pace: 0.3 } }, 'Chudniesz wolniej, niż zakłada plan — celu nie podnoszę.'],
      [{ note: 'pace', goalPace: -0.25, facts: { ...FACTS, pace: -0.1 } }, 'Przybierasz wolniej, niż zakłada plan — celu nie obniżam.'],
      [{ note: 'pace', goalPace: -0.25, facts: { ...FACTS, pace: -0.4 } }, 'Przybierasz szybciej, niż zakłada plan — celu nie podnoszę.'],
      [{ note: 'pace', goalPace: 0, facts: { ...FACTS, pace: 0.2 } }, 'Waga spada — celu nie obniżam.'],
      [{ note: 'pace', goalPace: 0, facts: { ...FACTS, pace: -0.2 } }, 'Waga rośnie — celu nie podnoszę.'],
    ];
    for (const [over, note] of cases) {
      const { container } = card(same(over), { today: '2026-10-13' });
      expect(container.querySelector('p')!.textContent, note).toMatch(new RegExp(`^Ten tydzień: cel bez zmian.* ${escape(note)}$`));
      cleanup();
    }
  });

  test('czego brakuje do dopasowania, dlaczego czeka, kiedy dane się nie zgadzają', () => {
    const cases: [Partial<WeekCheck>, string][] = [
      [
        { status: 'data', facts: null, missing: { weighIns: 4, completeDays: 9 } },
        'Ten tydzień: cel bez zmian (2050 kcal). Do dopasowania potrzebuję co najmniej 5 ważeń z 2 tygodni i pełnych zapisów z ¾ dni — teraz 4 ważenia i pełne zapisy z 9 dni.',
      ],
      [
        { status: 'settling', settle: 'start', facts: null, missing: { weighIns: 6, completeDays: 9 } },
        'Ten tydzień: cel bez zmian (2050 kcal). Dopasowanie zacznę po ok. 4–5 tygodniach ważenia i zapisów — pierwsze 2 tygodnie to głównie woda.',
      ],
      [
        { status: 'settling', settle: 'change', facts: null, missing: { weighIns: 6, completeDays: 9 } },
        'Ten tydzień: cel bez zmian (2050 kcal). Po zmianie celu pierwsze 2 tygodnie to głównie woda — dopasowanie wróci za 2–3 tygodnie.',
      ],
      [
        { status: 'settling', settle: 'pause', facts: null, missing: { weighIns: 6, completeDays: 9 } },
        'Ten tydzień: cel bez zmian (2050 kcal). Po przerwie dopasowanie wróci, gdy zbiorą się 2 tygodnie nowych danych.',
      ],
      [
        { status: 'implausible', facts: null },
        'Ten tydzień: cel bez zmian (2050 kcal). Zapisy i waga tym razem do siebie nie pasują — to się zdarza przy wahaniach wody albo dniach zapisanych w części. Sprawdzę znowu za tydzień.',
      ],
    ];
    for (const [over, line] of cases) {
      card(same(over), { today: MONDAY });
      expect(screen.getByText(line)).toBeInTheDocument();
      expect(screen.queryByText('Szczegóły')).not.toBeInTheDocument();
      cleanup();
    }
  });
});
