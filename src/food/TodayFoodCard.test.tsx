// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SessionHome } from '../components/SessionHome';
import { freshState } from '../engine/plan';
import { db } from './diet/db';
import { clearAll, completeProfile, logQuick, planCheat, saveProfile } from './diet/store';
import type { Profile } from './diet/types';
import { renderWithBridge, testBridge, testMove } from './test/bridge';
import TodayFoodCard from './TodayFoodCard';

/**
 * The Monday check as the card sees it: `pending` while it may still change today's target, then
 * `ready`. Package A's hook is a stub here (always `ready`), so the test drives the state itself.
 */
const weekly = vi.hoisted(() => ({ state: 'ready' as 'ready' | 'pending', listeners: new Set<() => void>() }));
vi.mock('./hooks/useWeeklyCheck', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => {
    weekly.listeners.add(listener);
    return () => void weekly.listeners.delete(listener);
  };
  return { useWeeklyCheck: () => useSyncExternalStore(subscribe, () => weekly.state) };
});
const setWeekly = (state: 'ready' | 'pending') => {
  weekly.state = state;
  weekly.listeners.forEach((listener) => listener());
};

const TODAY = '2026-10-14';

/** Target 2000 kcal from the start; redukcja at a 75 kg target weight: 150 g protein. */
const profile = (over: Partial<Profile> = {}) =>
  completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, targetWeightKg: 75, ...over });

/** Everything a person can read or hear on the card: text and the accessible attributes. */
const said = (root: HTMLElement) =>
  [
    root.textContent ?? '',
    ...[...root.querySelectorAll('[aria-label],[aria-valuetext],[title]')].flatMap((el) =>
      ['aria-label', 'aria-valuetext', 'title'].map((a) => el.getAttribute(a) ?? ''),
    ),
  ].join('\n');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
  setWeekly('ready');
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Karta jedzenia na ekranie Dziś', () => {
  test('jedno zdanie nad dwoma paskami: zostało ok. 1350 kcal i 110 g białka (★)', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Śniadanie', 650, { protein: 40, carbs: 60, fat: 20 });
    // Wczorajsze nie liczy się do dziś.
    await logQuick('2026-10-13', 'Kolacja', 900);
    render(<TodayFoodCard />);

    expect(await screen.findByRole('heading', { name: 'Zostało ok. 1350 kcal i 110 g białka' })).toBeInTheDocument();
    // Białko najpierw, potem kalorie; liczby tylko dla czytnika ekranu.
    const [protein, kcal] = screen.getAllByRole('meter');
    expect(protein).toHaveAccessibleName('Białko');
    expect(protein).toHaveAttribute('aria-valuetext', '40 z 150 g');
    expect(kcal).toHaveAccessibleName('Kalorie');
    expect(kcal).toHaveAttribute('aria-valuetext', '650 z 2000 kcal');
    expect(kcal).toHaveAttribute('aria-valuenow', '650');
    expect(screen.queryByText(/^Dziś 650 z 2000/)).not.toBeInTheDocument();
    expect(screen.queryByText('40 / 150 g')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dodaj zjedzone' })).toHaveAttribute('href', '#/jedzenie?dodaj=1');
    expect(screen.getByRole('link', { name: /Jedzenie/ })).toHaveAttribute('href', '#/jedzenie');
    // Nic nie czeka w dzienniku — bez linijki pod kartą.
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  test('kroki i trening nie zmieniają dnia: bez jedzenia „Na dziś: 2000 kcal i 150 g białka” (★)', async () => {
    await saveProfile(profile());
    const bridge = testBridge({
      weights: [{ day: '2026-10-10', kg: 80 }],
      stepsOn: (day) => (day === TODAY ? 15_000 : null),
      moveOn: (day) =>
        testMove(day === TODAY ? { trained: true, workoutKcal: 300, workouts: 1, stepsWorth: 15_000, planActive: true } : {}),
    });
    renderWithBridge(<TodayFoodCard />, bridge);
    expect(await screen.findByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
    expect(screen.getAllByRole('meter')[1]).toHaveAttribute('aria-valuetext', '0 z 2000 kcal');
  });

  test('±100 kcal to wciąż cel; ponad nim spokojne zdanie bez koloru oceny (★)', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Obiad', 2080, { protein: 100, carbs: 200, fat: 80 });
    const first = render(<TodayFoodCard />);
    expect(await screen.findByRole('heading', { name: 'Kalorie na dziś w zakresie celu, białka jeszcze 50 g' })).toBeInTheDocument();
    expect(first.container).not.toHaveTextContent(/ponad cel/);
    first.unmount();

    await db.entries.clear();
    await logQuick(TODAY, 'Wesele', 2300, { protein: 160, carbs: 200, fat: 90 });
    const { container } = render(<TodayFoodCard />);
    expect(await screen.findByRole('heading', { name: 'Na dziś kalorii i białka już wystarczy' })).toBeInTheDocument();
    expect(screen.getByText('To ok. 300 kcal ponad cel — jeden dzień nie zmienia trendu.')).toBeInTheDocument();
    expect(container.querySelector('.fd-diet-nadmiar, .fd-diet-brak, .fd-diet-ok')).toBeNull();
  });

  test('zaplanowany większy posiłek jest już odłożony (★)', async () => {
    await saveProfile(profile());
    await logQuick(TODAY, 'Śniadanie', 650, { protein: 40, carbs: 60, fat: 20 });
    await planCheat(TODAY, { name: 'Pizza', kcal: 900, protein: 30, carbs: null, fat: null });
    render(<TodayFoodCard />);
    expect(await screen.findByRole('heading', { name: 'Zostało ok. 450 kcal i 80 g białka' })).toBeInTheDocument();
    expect(screen.getByText('Liczę już z zaplanowanym większym posiłkiem (900 kcal).')).toBeInTheDocument();
  });

  test('bez liczenia kalorii: zdanie i pasek białka, nigdzie „kcal” (★)', async () => {
    await saveProfile(profile({ hideKcal: true }));
    await logQuick(TODAY, 'Śniadanie', 650, { protein: 40, carbs: 60, fat: 20 });
    await planCheat(TODAY, { name: 'Pizza', kcal: 900, protein: 30, carbs: null, fat: null });
    const { container } = render(<TodayFoodCard />);
    expect(await screen.findByRole('heading', { name: 'Białka jeszcze 80 g' })).toBeInTheDocument();
    expect(screen.getAllByRole('meter')).toHaveLength(1);
    expect(said(container)).not.toMatch(/kcal|kalori/i);
  });

  test('poniedziałkowe sprawdzenie w toku: zaślepka, aż się skończy; potem zapisany cel', async () => {
    setWeekly('pending');
    await saveProfile(profile());
    const { container } = render(<TodayFoodCard />);
    // IndexedDB już odpowiedziała, a karta wciąż czeka na sprawdzenie (albo na jego 3 s zapasu).
    await waitFor(async () => expect(await db.profile.count()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    act(() => setWeekly('ready'));
    expect(await screen.findByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
  });

  test('jedna linijka, gdy dziennik na coś czeka: przerwa w liczeniu', async () => {
    await saveProfile(profile({ pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 2000 }] }));
    render(<TodayFoodCard />);
    const link = await screen.findByRole('link', { name: 'Przerwa w liczeniu do 18 października.' });
    expect(link).toHaveAttribute('href', '#/jedzenie');
  });

  test('bez profilu diety karty nie ma', async () => {
    const { container } = render(<TodayFoodCard />);
    await waitFor(async () => expect(await db.profile.count()).toBe(0));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  test('póki IndexedDB odpowiada, miejsce karty trzyma zaślepka tej samej wysokości', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    const { container } = render(<TodayFoodCard />);
    const slot = container.firstElementChild as HTMLElement;
    expect(slot).toHaveAttribute('aria-hidden', 'true');
    expect(slot).toHaveClass('grp', 'snackcard');
    expect(slot).toBeEmptyDOMElement();
    const card = (await screen.findByRole('link', { name: 'Dodaj zjedzone' })).closest('.grp') as HTMLElement;
    expect(card).not.toHaveAttribute('aria-hidden');
    expect(card.style.minHeight).toBe(slot.style.minHeight);
  });
});

describe('Ekran Dziś', () => {
  const home = () => (
    <SessionHome
      state={freshState()}
      today={{ kind: 'none' }}
      statsLine=""
      onStart={() => undefined}
      onWeigh={() => undefined}
      onWeighSkip={() => undefined}
    />
  );

  test('bez znacznika diety nie wczytuje karty jedzenia', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    render(home());
    expect(await screen.findByRole('heading', { name: 'Nikt nie pilnuje terminów' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dodaj zjedzone' })).not.toBeInTheDocument();
  });

  test('ze znacznikiem karta staje pod ważeniem, przed przekąską', async () => {
    await saveProfile(completeProfile({ startDate: '2026-10-01' }));
    window.localStorage.setItem('gt:diet', '1');
    const { container } = render(home());
    // Paczka karty jeszcze idzie: jej miejsce już stoi zajęte, ukryte przed czytnikiem ekranu.
    const slot = container.querySelector('.grp.snackcard[aria-hidden="true"]');
    expect(slot).toBeInTheDocument();
    const snackTag = screen.getByText('Przekąska ruchowa');
    expect(slot!.compareDocumentPosition(snackTag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const add = await screen.findByRole('link', { name: 'Dodaj zjedzone' });
    const card = add.closest('.grp')!;
    const weigh = screen.getByRole('heading', { name: 'Waga z dziś' }).closest('.grp')!;
    const snack = screen.getByText('Przekąska ruchowa').closest('.grp')!;
    expect(weigh.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.compareDocumentPosition(snack) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(card as HTMLElement).getByRole('heading', { name: 'Na dziś: 2000 kcal i 150 g białka' })).toBeInTheDocument();
  });
});
