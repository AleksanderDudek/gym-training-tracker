import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cleanHabits, cleanMeals } from '@gymtracker/link';
import type { HabitsBody, MealsBody, SnapshotV1 } from '@gymtracker/link';
import type { Connection, SentAssignment } from '../src/lib/data';

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const { HabitsForm, emptyHabits, habitsProblems, habitsReady, newHabit } = await import('../src/components/editors/HabitsEditor');
const { MealsForm, dayTotals, emptyMeals, findRecipes, mealsProblems, mealsReady, newMeal, planAverage } = await import('../src/components/editors/MealsEditor');
const { AdherenceTab } = await import('../src/pages/client/AdherenceTab');

/** Kreatory nawyków i jadłospisu (to samo sprawdzenie co telefon) i zakładka „Realizacja”. */

const habits = (over: Partial<HabitsBody> = {}): HabitsBody => ({
  ...emptyHabits(),
  title: 'Codzienne',
  items: [{ label: 'Woda', dose: '2 l', when: 'any', days: [1, 2, 3, 4, 5, 6, 7] }],
  ...over,
});

const meals = (over: Partial<MealsBody> = {}): MealsBody => ({
  ...emptyMeals(),
  title: 'Redukcja',
  days: [{ label: '', meals: [{ ...newMeal('Śniadanie'), name: 'Owsianka', kcal: 450, protein: 30, carbs: 55, fat: 12 }] }],
  ...over,
});

const clean = (b: HabitsBody | MealsBody) => (b.kind === 'habits' ? cleanHabits : cleanMeals)(b as unknown as Record<string, unknown>);

describe('nawyki: sprawdzenie przed zapisem', () => {
  it('pusta lista mówi, czego brakuje', () => {
    expect(habitsProblems(emptyHabits()).errors).toEqual(['Nazwij listę.', 'Dodaj co najmniej jeden punkt.']);
    expect(habitsReady(emptyHabits())).toBe(false);
  });

  it('błędy dokładnie wtedy, gdy telefon by listę odrzucił', () => {
    const cases: HabitsBody[] = [
      habits(),
      habits({ title: '   ' }),
      habits({ items: [] }),
      habits({ items: [{ ...newHabit(), label: '' }] }),
      habits({ items: [{ ...newHabit(), label: 'Sen', days: [] }] }),
      habits({ items: [{ ...newHabit(), label: 'Sen' }, { ...newHabit(), label: '  ' }] }),
      habits({ until: '2026-12-31' }),
    ];
    for (const b of cases) expect(habitsProblems(b, '2026-11-25').errors.length === 0).toBe(clean(b) !== null);
    expect(habitsProblems(habits({ items: [{ ...newHabit(), label: 'Sen', days: [] }] })).errors).toEqual(['Punkt 1: zaznacz co najmniej jeden dzień.']);
  });

  it('minięta data końca tylko ostrzega', () => {
    const p = habitsProblems(habits({ until: '2026-11-01' }), '2026-11-25');
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual(['Data końca już minęła — telefon nie pokaże z tej listy nic na dziś.']);
  });
});

describe('jadłospis: sprawdzenie, sumy i przepisy', () => {
  it('błędy dokładnie wtedy, gdy telefon by jadłospis odrzucił', () => {
    const cases: MealsBody[] = [
      meals(),
      meals({ title: '' }),
      meals({ days: [] }),
      meals({ days: [{ label: 'Pn', meals: [] }] }),
      meals({ days: [{ label: '', meals: [newMeal('Obiad')] }] }),
      meals({ days: [{ label: '', meals: [{ ...newMeal(), name: 'Zupa', kcal: 9000 }] }] }),
    ];
    for (const b of cases) expect(mealsProblems(b).errors.length === 0).toBe(clean(b) !== null);
    expect(mealsReady(meals())).toBe(true);
    expect(mealsProblems(meals({ days: [{ label: '', meals: [newMeal('Obiad')] }] })).errors).toEqual(['Dzień 1, posiłek 1: wpisz nazwę albo wybierz przepis.']);
  });

  it('wartość spoza zakresu i nieznany przepis ostrzegają, bo telefon je pominie', () => {
    const p = mealsProblems(meals({ days: [{ label: '', meals: [{ ...newMeal(), name: 'Zupa', kcal: 9000, recipe: 'nie-ma-takiego' }] }] }));
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual([
      'Dzień 1, posiłek 1: kcal poza zakresem 0–5000 — telefon pominie tę wartość.',
      'Dzień 1, posiłek 1: przepisu nie ma już w katalogu — telefon pokaże samą nazwę.',
    ]);
  });

  it('suma dnia i średnia na dzień z wpisanych wartości', () => {
    const day = {
      label: '',
      meals: [
        { ...newMeal(), name: 'a', kcal: 500, protein: 30, carbs: 50, fat: 15 },
        { ...newMeal(), name: 'b', kcal: 700, protein: 45, carbs: null, fat: 20 },
        { ...newMeal(), name: 'c' },
      ],
    };
    expect(dayTotals(day)).toEqual({ kcal: 1200, protein: 75, carbs: 50, fat: 35, missing: 1 });
    expect(planAverage([day, { label: '', meals: [{ ...newMeal(), name: 'd', kcal: 1800, protein: 125, carbs: 150, fat: 65 }] }])).toEqual({
      kcal: 1500,
      protein: 100,
      carbs: 100,
      fat: 50,
      missing: 1,
    });
    expect(planAverage([])).toBeNull();
  });

  it('przepis szuka się bez ogonków i po kilku słowach', () => {
    const hits = findRecipes('skyr malin');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((r) => /skyr/i.test(r.name) && /malin/i.test(r.name))).toBe(true);
    expect(findRecipes('bialko').some((r) => /Białko/.test(r.name))).toBe(true);
    expect(findRecipes('   ')).toEqual([]);
  });
});

function Habits({ initial }: { initial: HabitsBody }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <HabitsForm value={v} onChange={setV} />
      <pre data-testid="json">{JSON.stringify(v)}</pre>
    </>
  );
}

function Meals({ initial }: { initial: MealsBody }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <MealsForm value={v} onChange={setV} />
      <pre data-testid="json">{JSON.stringify(v)}</pre>
    </>
  );
}

const json = <B,>() => JSON.parse(screen.getByTestId('json').textContent!) as B;

describe('kreator nawyków', () => {
  it('gotowy nawyk, dni robocze, kolejność i usuwanie', async () => {
    const user = userEvent.setup();
    render(<Habits initial={emptyHabits()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Nazwij listę.');
    await user.type(screen.getByLabelText('Nazwa listy nawyków'), 'Suplementy');
    await user.click(screen.getByRole('button', { name: 'Dodaj: Kreatyna 5 g' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj: Woda 2 l' }));
    // Już na liście — drugi raz się nie doda.
    expect(screen.getByRole('button', { name: 'Dodaj: Kreatyna 5 g' })).toBeDisabled();
    const second = screen.getByRole('group', { name: 'Punkt 2' });
    await user.click(within(second).getByRole('button', { name: 'dni robocze' }));
    expect(within(second).getByRole('checkbox', { name: 'sobota' })).not.toBeChecked();
    await user.selectOptions(within(second).getByLabelText('Pora'), 'rano');
    await user.click(screen.getByRole('button', { name: 'Punkt 2 wyżej' }));
    let b = json<HabitsBody>();
    expect(b.items.map((i) => [i.label, i.when, i.days])).toEqual([
      ['Woda', 'morning', [1, 2, 3, 4, 5]],
      ['Kreatyna', 'any', [1, 2, 3, 4, 5, 6, 7]],
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(habitsReady(b)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Usuń punkt 1' }));
    b = json<HabitsBody>();
    expect(b.items.map((i) => i.label)).toEqual(['Kreatyna']);
  });
});

describe('kreator jadłospisu', () => {
  it('dzień, posiłek z przepisem z katalogu, wartości i suma dnia', async () => {
    const user = userEvent.setup();
    render(<Meals initial={{ ...emptyMeals(), title: 'Tydzień' }} />);
    await user.click(screen.getByRole('button', { name: 'Dodaj dzień' }));
    const meal = screen.getByRole('group', { name: 'Dzień 1, posiłek 1' });
    expect(within(meal).getByLabelText('Pora posiłku')).toHaveValue('Śniadanie');
    await user.type(within(meal).getByRole('combobox', { name: 'Posiłek albo przepis z GYM TRACKERa' }), 'skyr malin');
    const options = within(await screen.findByRole('listbox', { name: 'Przepisy GYM TRACKERa' })).getAllByRole('option');
    await user.click(options[0]!);
    const b = json<MealsBody>();
    expect(b.days[0]!.meals[0]!.recipe).toBeTruthy();
    expect(b.days[0]!.meals[0]!.name).toMatch(/Skyr/);
    expect(within(meal).getByText(/^Przepis:/)).toBeInTheDocument();
    await user.type(within(meal).getByLabelText('kcal'), '420');
    await user.type(within(meal).getByLabelText('Białko, g'), '35');
    expect(screen.getByText(/^Razem:/).parentElement).toHaveTextContent(/^Razem: 420 kcal · B 35 g$/);
    await user.click(screen.getByRole('button', { name: 'Dodaj posiłek' }));
    expect(within(screen.getByRole('group', { name: 'Dzień 1, posiłek 2' })).getByLabelText('Pora posiłku')).toHaveValue('II śniadanie');
    await user.click(screen.getByRole('button', { name: 'Duplikuj dzień 1' }));
    expect(json<MealsBody>().days).toHaveLength(2);
    await user.click(within(screen.getByRole('group', { name: 'Dzień 1, posiłek 1' })).getByRole('button', { name: 'Odłącz przepis' }));
    expect(json<MealsBody>().days[0]!.meals[0]!.recipe).toBeNull();
  }, 15_000);

  it('własna pora posiłku', async () => {
    const user = userEvent.setup();
    render(<Meals initial={meals()} />);
    const meal = screen.getByRole('group', { name: 'Dzień 1, posiłek 1' });
    await user.selectOptions(within(meal).getByLabelText('Pora posiłku'), 'Własna…');
    await user.type(within(meal).getByLabelText('Własna pora'), 'Obiad');
    // Pole zostaje, choć wpis zgadza się z typową porą.
    expect(within(meal).getByLabelText('Własna pora')).toHaveValue('Obiad');
    expect(json<MealsBody>().days[0]!.meals[0]!.slot).toBe('Obiad');
  });
});

describe('zakładka Realizacja', () => {
  const from = { name: 'Anna', profession: 'dietitian' as const };
  const sentRow = (id: string, body: HabitsBody | MealsBody, at: string): SentAssignment => ({
    id,
    kind: body.kind,
    area: 'nutrition',
    createdAt: at,
    withdrawnAt: null,
    visibleFrom: null,
    envelope: { v: 1, id, area: 'nutrition', sentAt: Date.parse(at), from, body },
    receipt: null,
  });

  it('bez nawyków i jadłospisu — zachęta zamiast pustej siatki', () => {
    const s: SnapshotV1 = { v: 1, at: Date.now(), tz: 'Europe/Warsaw', lang: 'pl', app: 't', scopes: [] };
    render(<AdherenceTab c={{} as Connection} s={s} sent={[]} />);
    expect(screen.getByText('Nic tu jeszcze nie ma')).toBeInTheDocument();
  });

  it('telefon bez części „coaching”: „brak danych z tej wersji aplikacji”, a nie 0% i czerwone światła', () => {
    const s: SnapshotV1 = { v: 1, at: Date.now() - 3600_000, tz: 'Europe/Warsaw', lang: 'pl', app: 't', scopes: [] };
    render(<AdherenceTab c={{} as Connection} s={s} sent={[sentRow('h1', habits(), new Date(Date.now() - 20 * 86_400_000).toISOString())]} />);
    expect(screen.getByText(/starszą wersję GYM TRACKERa.*brak danych z tej wersji aplikacji/)).toBeInTheDocument();
    expect(screen.getAllByText('brak danych z tej wersji aplikacji')).toHaveLength(2);
    const grid = screen.getByRole('table', { name: 'Codzienne: ostatnie 14 dni' });
    expect(within(grid).queryByText('pominięte')).not.toBeInTheDocument();
    expect(within(grid).getAllByText('brak danych').length).toBeGreaterThan(0);
    expect(screen.queryByText('słabo')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument();
  });

  it('zaplanowane i odrzucone: tylko wzmianka, bez siatki', () => {
    const s: SnapshotV1 = { v: 1, at: Date.now(), tz: 'Europe/Warsaw', lang: 'pl', app: 't', scopes: [], coaching: { answers: [], habits: [], meals: [] } };
    const later = { ...sentRow('h2', habits({ title: 'Na grudzień' }), new Date(Date.now() + 5 * 86_400_000).toISOString()), visibleFrom: new Date(Date.now() + 5 * 86_400_000).toISOString() };
    const declined = { ...sentRow('m3', meals({ title: 'Nie dla mnie' }), new Date(Date.now() - 86_400_000).toISOString()), receipt: { v: 1 as const, assignmentId: 'm3', status: 'declined' as const, at: 0, ticked: [], comment: '', updatedAt: '' } };
    render(<AdherenceTab c={{} as Connection} s={s} sent={[later, declined]} />);
    expect(screen.getByText('Nic tu jeszcze nie ma')).toBeInTheDocument();
    expect(screen.getByText(/Nawyki: „Na grudzień” — od /)).toBeInTheDocument();
    expect(screen.getByText('Jadłospis: „Nie dla mnie” — odrzucone przez podopiecznego')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('siatka nawyków ze znakami i światła dni jadłospisu z podpisem', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
    try {
      const m = meals({
        days: [
          { label: 'Poniedziałek', meals: [{ ...newMeal('Śniadanie'), name: 'Owsianka' }, { ...newMeal('Kolacja'), name: 'Łosoś' }] },
        ],
      });
      const s: SnapshotV1 = {
        v: 1,
        at: Date.parse('2026-11-25T20:00:00Z'),
        tz: 'Europe/Warsaw',
        lang: 'pl',
        app: 't',
        scopes: [],
        coaching: {
          answers: [],
          habits: [{ assignmentId: 'h1', days: { '2026-11-23': [0], '2026-11-25': [0] } }],
          meals: [{ assignmentId: 'm1', days: { '2026-11-23': [0, 1], '2026-11-24': [0] } }],
        },
      };
      render(<AdherenceTab c={{} as Connection} s={s} sent={[sentRow('h1', habits(), '2026-11-22T08:00:00Z'), sentRow('m1', m, '2026-11-22T08:00:00Z')]} />);
      const grid = screen.getByRole('table', { name: 'Codzienne: ostatnie 14 dni' });
      const row = within(grid).getByRole('row', { name: /Woda/ });
      expect(within(row).getAllByText('zrobione')).toHaveLength(2);
      expect(within(row).getAllByText('pominięte')).toHaveLength(2);
      expect(within(row).getAllByText('brak danych')).toHaveLength(1);
      const table = screen.getByRole('table', { name: 'Redukcja: ostatnie 14 dni, od najnowszego' });
      expect(within(table).getByRole('row', { name: /23 lis.*2 z 2.*dobrze/ })).toBeInTheDocument();
      expect(within(table).getByRole('row', { name: /24 lis.*1 z 2.*średnio.*Kolacja \(Łosoś\)/ })).toBeInTheDocument();
      expect(screen.getByText(/Ostatnia paczka z telefonu jest z 25 listopada/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
