// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SessionHome } from '../components/SessionHome';
import { freshState } from '../engine/plan';
import { db } from './diet/db';
import { clearAll, completeProfile, logQuick, saveProfile } from './diet/store';
import TodayFoodCard from './TodayFoodCard';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
  await clearAll();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Karta jedzenia na ekranie Dziś', () => {
  test('kalorie i białko wobec celu dnia, ile zostało, i wejścia do dziennika', async () => {
    await saveProfile(
      completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, adaptWeekly: false, targetWeightKg: 75 }),
    );
    await logQuick('2026-10-14', 'Śniadanie', 650, { protein: 40, carbs: 60, fat: 20 });
    // Wczorajsze nie liczy się do dziś.
    await logQuick('2026-10-13', 'Kolacja', 900);
    render(<TodayFoodCard />);

    expect(await screen.findByRole('heading', { name: 'Dziś 650 z 2000 kcal' })).toBeInTheDocument();
    // Redukcja: białko 2 g na kilogram wagi docelowej — 150 g.
    expect(screen.getByText('40 / 150 g')).toBeInTheDocument();
    expect(screen.getByText('Zostało 1350 kcal i 110 g białka.')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Kalorie' })).toHaveAttribute('aria-valuenow', '650');
    expect(screen.getByRole('link', { name: 'Dodaj zjedzone' })).toHaveAttribute('href', '#/jedzenie?dodaj=1');
    expect(screen.getByRole('link', { name: /Jedzenie/ })).toHaveAttribute('href', '#/jedzenie');
  });

  test('ponad cel mówi, o ile', async () => {
    await saveProfile(
      completeProfile({ startDate: '2026-10-01', dailyKcal: 2000, adaptWeekly: false, targetWeightKg: 75 }),
    );
    await logQuick('2026-10-14', 'Wesele', 2300, { protein: 160, carbs: 200, fat: 90 });
    render(<TodayFoodCard />);
    expect(await screen.findByText('300 kcal ponad cel.')).toBeInTheDocument();
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
  });
});
