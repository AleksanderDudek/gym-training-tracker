// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, cleanCoaching, localDay, newIdSecret } from '@gymtracker/link';
import type { AssignmentBody, SnapshotV1 } from '@gymtracker/link';
import { freshState } from '../../engine/plan';
import { fakeSztab } from '../../test/linkServer';
import type { FakeSztab } from '../../test/linkServer';
import { acceptInvite } from '../../link/accept';
import { invitePreview } from '../../link/rpc';
import { clearLink, linkState } from '../../link/store';
import type { LinkConnection } from '../../link/store';
import { forgetKeys, pushOne, syncAll } from '../../link/sync';
import LinkPages from '../Link';
import { recentDays } from './DayStrip';
import { daysText } from './HabitsDay';
import { shopAmount, sumMeals } from './MealsDay';
import { portion, recipeHref, recipeOf, shoppingFor } from './mealRecipes';

/**
 * Nawyki i jadłospis od prowadzącego na telefonie, przeciw Sztabowi w pamięci: zalecenie przychodzi
 * zaszyfrowane, ekran pokazuje dzień, odhaczenie idzie w paczce — prowadzący czyta je swoim kluczem.
 */

const DAY = 86_400_000;
const state = freshState();
const from = { name: 'Anna Kowalska', profession: 'dietitian' as const };
let server: FakeSztab;
let conn: LinkConnection;

beforeEach(async () => {
  localStorage.clear();
  clearLink();
  forgetKeys();
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  server = await fakeSztab();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  const inv = await server.invite(['training', 'nutrition'], ['training']);
  const r = await acceptInvite({
    preview: (await invitePreview(inv.id))!,
    fingerprint: inv.fingerprint,
    chosen: ['training', 'nutrition'],
    replace: [],
    scopes: ['training'],
    secret: newIdSecret(),
  });
  if (!r.ok) throw new Error(r.reason);
  conn = r.connection;
});

afterEach(() => {
  forgetKeys();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function open(body: AssignmentBody, sentAt = Date.now()) {
  const id = await server.send(conn.id, { area: 'nutrition', sentAt, from, body });
  await syncAll(() => state);
  render(<LinkPages route={{ kind: 'linkAssignment', id }} state={state} ensureSecret={(c) => c} apply={vi.fn()} onToast={vi.fn()} />);
  return id;
}

async function coachSees(): Promise<ReturnType<typeof cleanCoaching>> {
  await pushOne(linkState().connections[0]!, state, { force: true });
  return cleanCoaching(((await server.readSnapshot(conn.id)) as SnapshotV1).coaching);
}

const ALL = [1, 2, 3, 4, 5, 6, 7];

describe('nawyki', () => {
  const body: AssignmentBody = {
    kind: 'habits',
    title: 'Codzienne',
    note: 'Kreatynę popijaj wodą.',
    until: null,
    items: [
      { label: 'Kreatyna', dose: '5 g', when: 'morning', days: ALL },
      { label: 'Sen', dose: '7–9 h', when: 'evening', days: ALL },
      { label: 'Woda', dose: '2 l', when: 'any', days: ALL },
    ],
  };

  it('dzisiejsze punkty po porach; odhaczenie idzie do prowadzącego i robi z listy „w trakcie”', async () => {
    const user = userEvent.setup();
    const id = await open(body);
    const today = localDay();
    expect(screen.getByRole('heading', { level: 2, name: /^Dziś, / })).toBeInTheDocument();
    const morning = screen.getByRole('group', { name: 'Rano' });
    expect(within(morning).getByRole('checkbox', { name: 'Kreatyna 5 g' })).not.toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Wieczorem' })).getByRole('checkbox', { name: 'Sen 7–9 h' })).toBeInTheDocument();
    expect(screen.getByText('Kreatynę popijaj wodą.')).toBeInTheDocument();
    // Lista przyszła dziś — pasek dni nie ma czego pokazać.
    expect(screen.queryByRole('group', { name: 'Dni' })).not.toBeInTheDocument();

    await user.click(within(morning).getByRole('checkbox', { name: 'Kreatyna 5 g' }));
    await user.click(screen.getByRole('checkbox', { name: 'Woda 2 l' }));
    expect(within(morning).getByRole('checkbox', { name: 'Kreatyna 5 g' })).toBeChecked();
    expect(screen.getByText(/Zrobione 2 z 3/)).toBeInTheDocument();
    expect(linkState().ticks[id]).toEqual({ [today]: [0, 2] });
    await waitFor(() => expect(linkState().assignments[0]!.sent).toBe('started'));
    expect(await server.readReceipt(conn.id, id)).toMatchObject({ status: 'started' });

    // Odznaczenie też dochodzi.
    await user.click(screen.getByRole('checkbox', { name: 'Woda 2 l' }));
    expect((await coachSees()).habits).toEqual([{ assignmentId: id, days: { [today]: [0] } }]);
  });

  it('zapomniane wczoraj da się dopisać; dalej niż tydzień wstecz nie', async () => {
    const user = userEvent.setup();
    const id = await open(body, Date.now() - 10 * DAY);
    const today = localDay();
    const yesterday = addDays(today, -1);
    const strip = screen.getByRole('group', { name: 'Dni' });
    const buttons = within(strip).getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(buttons.at(-1)).toHaveAttribute('aria-pressed', 'true');
    await user.click(buttons.at(-2)!);
    expect(screen.getByText(/Odhaczasz za wcześniejszy dzień/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Sen 7–9 h' }));
    expect(within(strip).getAllByRole('button').at(-2)).toHaveAccessibleName(/: 1 z 3$/);
    await user.click(screen.getByRole('button', { name: 'Wróć do dziś' }));
    expect(screen.getByRole('checkbox', { name: 'Sen 7–9 h' })).not.toBeChecked();
    expect((await coachSees()).habits).toEqual([{ assignmentId: id, days: { [yesterday]: [1] } }]);
  });

  it('dzień poza dniami punktu i lista po dacie końca', async () => {
    const today = localDay();
    await open({ ...body, until: addDays(today, -1) } as AssignmentBody, Date.now() - 3 * DAY);
    expect(screen.getByText('Ten dzień jest już po końcu listy.')).toBeInTheDocument();
    expect(screen.getByText(/Lista skończyła się/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('dni punktu słowami', () => {
    expect(daysText(ALL)).toBe('codziennie');
    expect(daysText([5, 4, 3, 2, 1])).toBe('w dni robocze');
    expect(daysText([6, 7])).toBe('w weekendy');
    expect(daysText([1, 3, 5])).toBe('pn, śr, pt');
  });

  it('pasek dni: od wysłania, najwyżej tydzień', () => {
    expect(recentDays('2026-11-25', '2026-11-25')).toEqual(['2026-11-25']);
    expect(recentDays('2026-11-25', '2026-11-23')).toEqual(['2026-11-23', '2026-11-24', '2026-11-25']);
    expect(recentDays('2026-11-25', '2026-10-01')).toHaveLength(7);
    // Zegar telefonu za zegarem wysyłki — i tak dziś.
    expect(recentDays('2026-11-25', '2026-11-26')).toEqual(['2026-11-25']);
  });
});

describe('jadłospis', () => {
  const meal = (slot: string, name: string, recipe: string | null, kcal: number | null, protein: number | null) => ({
    slot,
    name,
    recipe,
    kcal,
    protein,
    carbs: kcal === null ? null : 40,
    fat: kcal === null ? null : 10,
    note: '',
  });
  const body: AssignmentBody = {
    kind: 'meals',
    title: 'Redukcja',
    note: 'Posiłki możesz zamieniać w obrębie dnia.',
    start: null,
    days: [
      { label: '', meals: [meal('Śniadanie', 'Skyr z malinami', 'skyr-maliny', 300, 30), meal('Obiad', 'Kurczak z ryżem', null, 600, 45)] },
      { label: 'Dzień rybny', meals: [meal('Obiad', 'Pyry z gzikiem', 'pyry-z-gzikiem', 550, 40)] },
    ],
  };

  it('dzień cyklu na dziś, zjedzone do prowadzącego, wcześniejszy dzień i suma dnia', async () => {
    const user = userEvent.setup();
    // Wysłany wczoraj: wczoraj dzień 1, dziś „Dzień rybny”.
    const id = await open(body, Date.now() - DAY);
    const today = localDay();
    const yesterday = addDays(today, -1);
    expect(screen.getByRole('heading', { level: 2, name: 'Dziś: Dzień rybny' })).toBeInTheDocument();
    expect(screen.getByText(/Dzień 2 z 2 w cyklu/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Zjedzone: Obiad — Pyry z gzikiem' }));
    expect(screen.getByText(/Zjedzone 1 z 1\. Cały dzień zjedzony\./)).toBeInTheDocument();

    const strip = screen.getByRole('group', { name: 'Dni' });
    await user.click(within(strip).getAllByRole('button')[0]!);
    expect(screen.getByRole('heading', { level: 2, name: /: Dzień 1$/ })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Zjedzone: Śniadanie — Skyr z malinami' }));
    const totals = screen.getByText('Plan dnia').closest('dl')!;
    expect(totals).toHaveTextContent('Plan dnia900 kcal · B 75 g · W 80 g · T 20 g');
    expect(totals).toHaveTextContent('Zjedzone300 kcal · B 30 g · W 40 g · T 10 g');
    await waitFor(() => expect(linkState().assignments[0]!.sent).toBe('started'));
    expect((await coachSees()).meals).toEqual([{ assignmentId: id, days: { [today]: [0], [yesterday]: [0] } }]);
  });

  it('przepis z katalogu na miejscu i odnośnik do Przepisów; podgląd innego dnia bez odhaczania', async () => {
    const user = userEvent.setup();
    await open(body);
    // Dziś dzień 1 — przepis wczytuje się osobno.
    await user.click(await screen.findByText('Przepis · 3 min'));
    expect(screen.getByText(/Skyr naturalny — duży kubek \(200 g\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otwórz w Przepisach' })).toHaveAttribute('href', '#/przepisy?przepis=skyr-maliny');
    await user.click(screen.getByRole('button', { name: 'Dzień rybny' }));
    expect(screen.getByText(/Podgląd: Dzień rybny/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wróć do: Dzień 1' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('lista zakupów ze składników przepisów, posiłki bez przepisu osobno', async () => {
    const user = userEvent.setup();
    await open(body);
    await user.click(screen.getByRole('button', { name: 'Na cały jadłospis' }));
    expect(await screen.findByRole('heading', { name: 'Do kupienia' })).toBeInTheDocument();
    // Skyr: 200 g z miski + 150 g gziku na dwie porcje (75 g).
    const skyr = screen.getByText('Skyr naturalny').closest('li')!;
    expect(skyr).toHaveTextContent('275 g');
    expect(screen.getByRole('heading', { name: 'Sprawdź w domu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bez przepisu — kupujesz według nazwy' }).nextElementSibling).toHaveTextContent('Kurczak z ryżem');
    await user.click(screen.getByRole('button', { name: 'Na ten dzień' }));
    expect(screen.getByText('Skyr naturalny').closest('li')).toHaveTextContent('200 g');
  });

  it('przed startem cyklu: data startu i podgląd, bez odhaczania', async () => {
    const start = addDays(localDay(), 3);
    await open({ ...body, start } as AssignmentBody);
    expect(screen.getByRole('heading', { level: 2, name: /^Jadłospis zaczyna się / })).toBeInTheDocument();
    expect(screen.getByText('Skyr z malinami')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('przepisy i zakupy bez bazy produktów', () => {
  const m = (recipe: string | null, name = 'x') => ({ slot: '', name, recipe, kcal: null, protein: null, carbs: null, fat: null, note: '' });

  it('porcja przepisu na kilka osób i miary tylko dla przepisu na jedną', () => {
    const gzik = portion(recipeOf('pyry-z-gzikiem')!);
    expect(gzik.find((p) => p.id === 'quark')).toEqual({ id: 'quark', label: 'Twaróg chudy', grams: 200, measure: null });
    expect(portion(recipeOf('bialko-woda')!)[0]).toMatchObject({ grams: 30, measure: '1 miarka' });
    expect(recipeOf('nie-ma')).toBeUndefined();
    expect(recipeHref('bialko-woda')).toBe('#/przepisy?przepis=bialko-woda');
  });

  it('sumuje składniki, liczy opakowania, pomija wodę, zbiera posiłki bez przepisu', () => {
    const list = shoppingFor([m('banan-baton'), m('banan-baton'), m('bialko-woda'), m(null, 'Kanapka'), m(null, 'Kanapka'), m('nie-ma', 'Zupa')]);
    expect(list.buy.find((l) => l.id === 'proteinBar')).toMatchObject({ packs: 2, grams: 90 });
    expect(list.buy.find((l) => l.id === 'banana')).toMatchObject({ grams: 240, packs: null });
    expect(list.home.map((l) => l.id)).toEqual(['whey']);
    expect([...list.buy, ...list.home].some((l) => l.id === 'water')).toBe(false);
    expect(list.loose).toEqual(['Kanapka', 'Zupa']);
  });

  it('ilości po ludzku i suma posiłków', () => {
    expect(shopAmount({ grams: 237.5, packs: null })).toBe('240 g');
    expect(shopAmount({ grams: 1250, packs: null })).toBe('1,3 kg');
    expect(shopAmount({ grams: 2, packs: null })).toBe('2 g');
    expect(shopAmount({ grams: 90, packs: 2 })).toBe('2 opak.');
    expect(sumMeals([{ ...m(null), kcal: 100, protein: 10 }, { ...m(null), kcal: 50 }])).toEqual({ kcal: 150, protein: 10, carbs: null, fat: null, any: true });
    expect(sumMeals([m(null)]).any).toBe(false);
  });
});
