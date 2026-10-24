// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN } from '../data/exercises';
import { setBodyWeight } from '../engine/body';
import { addCardio } from '../engine/cardio';
import { freshState } from '../engine/plan';
import { dayKey } from '../engine/schedule';
import type { AppState } from '../types';
import { CardioPage } from './Cardio';
import { SessionHome } from './SessionHome';

/**
 * Kalorie siłowni u kogoś, kto prowadzi dziennik jedzenia (`gt:diet`): na ekranie Dziś jest wtedy
 * jeden rachunek kalorii — jedzenia. Karta treningu mówi sam czas, karta kroków same kroki,
 * a ekran kroków zostaje przy swoich kaloriach, ale mówi, że dziennik ich nie dolicza.
 * Bez dziennika wszystko jak dotąd.
 */

// Karta jedzenia ma własne testy; tu tylko jej miejsce na ekranie.
vi.mock('../food/TodayFoodCard', () => ({ default: () => null }));

const A = BUILTIN.find((w) => w.id === 'A')!;
const today = dayKey(Date.now());

/** 80 kg dziś i 7200 kroków — jest z czego liczyć kalorie treningu i kroków. */
const withMove = (): AppState => {
  const s = freshState();
  setBodyWeight(s, 80, today);
  addCardio(s, { kind: 'steps', steps: 7200 }, today, Date.now());
  return s;
};

const home = () =>
  render(
    <SessionHome
      state={withMove()}
      today={{ kind: 'due', workout: A, late: 0, points: 10 }}
      statsLine=""
      onStart={vi.fn()}
      onWeigh={vi.fn()}
      onWeighSkip={vi.fn()}
    />,
  );

const trainingCard = () => screen.getByText('Dziś według planu').closest('.grp') as HTMLElement;
const cardioCard = () => screen.getByText('Kroki i cardio').closest('.grp') as HTMLElement;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('ekran Dziś z dziennikiem jedzenia', () => {
  it('karta treningu mówi sam czas, a karta kroków „Dziś 7200 kroków” — bez kalorii', () => {
    localStorage.setItem('gt:diet', '1');
    home();
    expect(screen.getByText(/^Na Twoim poziomie to ok\. \d+ min serii z przerwami\.$/)).toBeInTheDocument();
    expect(trainingCard()).not.toHaveTextContent('kcal');
    expect(trainingCard()).not.toHaveTextContent('ponad spoczynek');
    expect(screen.getByRole('heading', { name: 'Dziś 7200 kroków' })).toBeInTheDocument();
    expect(cardioCard()).not.toHaveTextContent('kcal');
    expect(cardioCard()).not.toHaveTextContent('Kalorie ponad spoczynek');
    // Minuty ruchu i doświadczenie zostają: to nie kalorie.
    expect(cardioCard()).toHaveTextContent(/Minuty ruchu: \d+|Minut ruchu jeszcze nie ma/);
  });

  it('bez dziennika jedzenia jak dotąd: kalorie przy treningu i przy krokach', () => {
    home();
    expect(
      screen.getByText(/^Na twoim poziomie to ok\. \d+ min serii z przerwami i ≈ \d+ kcal ponad spoczynek\.$/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Dziś 7200 kroków · ≈ \d+ kcal$/ })).toBeInTheDocument();
    expect(cardioCard()).toHaveTextContent('Kalorie ponad spoczynek.');
  });
});

describe('ekran kroków i cardio', () => {
  it('z dziennikiem jedzenia: pod wstępem zdanie, że dziennik tych kalorii nie dolicza', () => {
    localStorage.setItem('gt:diet', '1');
    render(<CardioPage state={withMove()} onDelete={vi.fn()} />);
    expect(
      screen.getByText(
        'Te kalorie to szacunek (±20–30%). Dziennik jedzenia ich nie dolicza — cel jedzenia dopasowuje się co tydzień do Twojej wagi.',
      ),
    ).toBeInTheDocument();
    // Ekran kroków zostaje przy swoich kaloriach.
    expect(screen.getAllByText(/Z kroków i cardio ≈ \d+ kcal/).length).toBeGreaterThan(0);
  });

  it('bez dziennika jedzenia tego zdania nie ma', () => {
    render(<CardioPage state={withMove()} onDelete={vi.fn()} />);
    expect(screen.queryByText(/Dziennik jedzenia ich nie dolicza/)).not.toBeInTheDocument();
  });

  it('„Jak liczymy”: kalorie nie są zaleceniem żywieniowym, a dziennik nie dolicza ich do celu', () => {
    render(<CardioPage state={withMove()} onDelete={vi.fn()} />);
    const how = screen.getByRole('heading', { name: 'Jak liczymy kalorie i minuty ruchu' }).closest('.grp')!;
    expect(how).toHaveTextContent(
      'Kalorie nie są zaleceniem żywieniowym. Dziennik jedzenia nie dolicza ich do celu — cel jedzenia dopasowuje się co tydzień do wagi i zapisów.',
    );
    expect(how).not.toHaveTextContent('ustala się z dietetykiem');
  });
});
