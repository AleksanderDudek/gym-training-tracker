// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../../diet/db';
import type { Plan } from '../../diet/plan';
import { clearAll, completeProfile, logQuick, saveProfile } from '../../diet/store';
import { renderWithBridge, testBridge } from '../../test/bridge';
import DietPlanPage from './DietPlanPage';
import DietProgressPage from './DietProgressPage';

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

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(await screen.findByRole('heading', { name: 'Nie masz jeszcze planu' })).toBeInTheDocument();
    expect(screen.getByLabelText('Wczytaj plan z Excela')).toHaveAttribute('type', 'file');
  });

  test('tydzień planu: dzień prowadzi do dziennika, przejście o tydzień zostaje w adresie, plan da się usunąć', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', adaptWeekly: false }));
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
    expect(rows[1]).toHaveTextContent(/2500.*ponad cel/);
    // Dziś bez zapytania: dziennik i tak otwiera się na dziś.
    expect(within(rows[3]!).getByRole('link')).toHaveAttribute('href', '#/jedzenie');
    expect(screen.getByText('Warianty można mieszać w obrębie tygodnia.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Następny tydzień' }));
    expect(await screen.findByRole('heading', { name: /Tydzień od 19 paź/ })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/jedzenie/plan?dzien=2026-10-21');

    await user.click(screen.getByRole('button', { name: 'Usuń plan' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń plan' }));
    expect(await screen.findByRole('heading', { name: 'Nie masz jeszcze planu' })).toBeInTheDocument();
    expect(await db.plans.count()).toBe(0);
  });
});

describe('Postęp', () => {
  test('waga z dziennika wagi treningów, dwa tygodnie kalorii i makro z tygodnia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01', startWeightKg: 84, targetWeightKg: 78 }));
    await logQuick('2026-10-13', 'Obiad', 1800, { protein: 120, carbs: 150, fat: 60 });
    window.history.replaceState(null, '', '/#/jedzenie/postep');
    const bridge = testBridge({
      weights: [
        { day: '2026-10-02', kg: 83.6 },
        { day: '2026-10-12', kg: 82.4 },
      ],
      stepsOn: vi.fn(() => null),
    });
    renderWithBridge(<DietProgressPage />, bridge);

    expect(await screen.findByText('82,4 kg')).toBeInTheDocument();
    expect(screen.getByText(/Teraz · ważenie/)).toBeInTheDocument();
    expect(screen.getByText('1,6 kg')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Wykres wagi.*2 pomiarów.*82,4 kg/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Zjedzone kalorie dzień po dniu' })).getAllByRole('listitem'),
    ).toHaveLength(14);
    expect(screen.getByText('1800 / 2000')).toBeInTheDocument();
    // Prognoza pyta treningi o kroki każdego dnia — także dni bez wiersza diety.
    await waitFor(() => expect(bridge.stepsOn).toHaveBeenCalledWith('2026-10-05'));
  });
});
