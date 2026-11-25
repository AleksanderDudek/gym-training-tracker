// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CoachMeals } from '../../../components/CoachMeals';
import { clearLink, linkState } from '../../../link/store';
import { linkAssignmentPath } from '../../../routing';
import { MEALS, assignment, connection, seedLink } from '../../../test/coachSeed';
import { db } from '../../diet/db';
import { clearAll, completeProfile, saveProfile } from '../../diet/store';
import { renderWithBridge } from '../../test/bridge';
import DiaryPage from './DiaryPage';

/**
 * „Jadłospis od prowadzącego” na górze dziennika: dzisiejsze posiłki z odhaczaniem na miejscu,
 * odnośnik do całego jadłospisu i „Dodaj do dziennika” (szybki wpis z kaloriami i makro).
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

const WEDNESDAY = new Date('2026-10-14T12:00:00');
const TODAY = '2026-10-14';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  await clearAll();
  window.localStorage.clear();
  clearLink();
  window.history.replaceState(null, '', '/#/jedzenie');
  vi.stubEnv('VITE_SZTAB_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('VITE_SZTAB_ANON_KEY', 'anon-key');
  vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('pasek jadłospisu', () => {
  test('bez jadłospisu na dziś albo po końcu współpracy — nic', () => {
    seedLink({ connections: [connection()], assignments: [] });
    const { container, unmount } = render(<CoachMeals entries={[]} showKcal />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    seedLink({ connections: [connection({ status: 'ended' })], assignments: [assignment(MEALS)] });
    const ended = render(<CoachMeals entries={[]} showKcal />);
    expect(ended.container).toBeEmptyDOMElement();
  });

  test('dzisiejsze posiłki z odhaczaniem; dodany do dziennika ma „W dzienniku”, bez kalorii — bez przycisku', async () => {
    const meals = assignment(MEALS);
    seedLink({ connections: [connection()], assignments: [meals] });
    const user = userEvent.setup();
    const onAdd = vi.fn(async () => undefined);
    render(<CoachMeals entries={[{ name: 'Kurczak z ryżem', source: 'quick' }]} showKcal onAdd={onAdd} />);
    const strip = screen.getByRole('region', { name: 'Jadłospis od prowadzącego Redukcja 2000' });
    expect(within(strip).getByRole('link', { name: 'Redukcja 2000' })).toHaveAttribute('href', linkAssignmentPath(meals.id));
    expect(within(strip).getByText('Ola Nowak · Dzień 1 · zjedzone 0 z 3')).toBeInTheDocument();
    expect(within(strip).getByRole('checkbox', { name: 'Owsianka z jagodami Śniadanie · 450 kcal' })).not.toBeChecked();
    expect(within(strip).getByText('W dzienniku')).toBeInTheDocument();
    expect(within(strip).queryByRole('button', { name: /Coś lekkiego/ })).not.toBeInTheDocument();

    await user.click(within(strip).getByRole('checkbox', { name: /Kurczak z ryżem/ }));
    await waitFor(() => expect(linkState().ticks[meals.id]?.[TODAY]).toEqual([1]));
    expect(within(strip).getByText('Ola Nowak · Dzień 1 · zjedzone 1 z 3')).toBeInTheDocument();
    await waitFor(() => expect(linkState().assignments[0]!.status).toBe('started'));

    await user.click(within(strip).getByRole('button', { name: 'Dodaj do dziennika: Owsianka z jagodami' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Owsianka z jagodami', kcal: 450, protein: 20, carbs: 60, fat: 12 }));
    await waitFor(() => expect(linkState().ticks[meals.id]?.[TODAY]).toEqual([0, 1]));
    expect(within(strip).getByRole('checkbox', { name: /Owsianka z jagodami/ })).toHaveFocus();
  });

  test('dwa szybkie stuknięcia, zanim wczyta się synchronizacja: oba odhaczenia zostają', async () => {
    const meals = assignment(MEALS);
    seedLink({ connections: [connection()], assignments: [meals] });
    render(<CoachMeals entries={[]} showKcal />);
    // Oba w tym samym renderze — lista liczona w chwili stuknięcia zgubiłaby pierwsze.
    fireEvent.click(screen.getByRole('checkbox', { name: /Owsianka z jagodami/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Kurczak z ryżem/ }));
    await waitFor(() => expect(linkState().ticks[meals.id]?.[TODAY]).toEqual([0, 1]));
    expect(screen.getByText('Ola Nowak · Dzień 1 · zjedzone 2 z 3')).toBeInTheDocument();
  });

  test('bez liczenia kalorii — bez liczb przy posiłkach', () => {
    seedLink({ connections: [connection()], assignments: [assignment(MEALS)] });
    render(<CoachMeals entries={[]} showKcal={false} />);
    expect(screen.getByRole('checkbox', { name: 'Owsianka z jagodami Śniadanie' })).toBeInTheDocument();
    expect(screen.queryByText(/kcal/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('dziennik', () => {
  test('pasek stoi na górze dnia (dziś), a „Dodaj do dziennika” zapisuje szybki wpis z makro', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000 }));
    seedLink({ connections: [connection()], assignments: [assignment(MEALS)] });
    const user = userEvent.setup();
    renderWithBridge(<DiaryPage />);
    const day = await screen.findByRole('heading', { name: 'Dziś' });
    const strip = screen.getByRole('region', { name: 'Jadłospis od prowadzącego Redukcja 2000' });
    const weigh = screen.getByRole('region', { name: 'Ile dziś ważysz?' });
    expect(day.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.compareDocumentPosition(weigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(within(strip).getByRole('button', { name: 'Dodaj do dziennika: Owsianka z jagodami' }));
    await waitFor(() => expect(within(strip).getByText('W dzienniku')).toBeInTheDocument());
    const [entry] = await db.entries.where('date').equals(TODAY).toArray();
    expect(entry).toMatchObject({ name: 'Owsianka z jagodami', kcal: 450, protein: 20, carbs: 60, fat: 12, source: 'quick' });
    expect(screen.getByRole('region', { name: /^Zjedzone/ })).toHaveTextContent('Owsianka z jagodami');
  }, 15_000);

  test('inny dzień niż dziś — bez paska', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', dailyKcal: 2000 }));
    seedLink({ connections: [connection()], assignments: [assignment(MEALS)] });
    window.history.replaceState(null, '', '/#/jedzenie?dzien=2026-10-13');
    renderWithBridge(<DiaryPage />);
    expect(await screen.findByRole('region', { name: 'Bilans dnia' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dziś' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Jadłospis od prowadzącego/ })).not.toBeInTheDocument();
  }, 15_000);
});
