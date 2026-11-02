// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MUSCLE_NAME } from '../data/muscles';
import { freshState } from '../engine/plan';
import type { AppState, LogEntry, Snack } from '../types';
import { MuscleWeekCard } from './MuscleWeek';

// Środa, 14 października 2026.
const NOW = Date.parse('2026-10-14T12:00:00.000Z');

const withLog = (log: LogEntry[], snacks: Snack[] = []): AppState => {
  const s = freshState();
  s.log = log;
  s.snacks = snacks;
  return s;
};

const goblet: LogEntry = {
  date: '2026-10-13T18:00:00.000Z',
  workout: 'Trening A',
  ready: 'ok',
  items: [{ id: 'goblet', sets: [10, 10, 10].map((reps) => ({ reps, w: 16 })), effort: 'solid' }],
};

describe('Mięśnie w tym tygodniu', () => {
  it('pusty tydzień: zakres dat, zachęta bez oceny i dwa rysunki', () => {
    render(<MuscleWeekCard state={withLog([])} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Mięśnie w tym tygodniu' })).toBeInTheDocument();
    expect(screen.getByText('12.10 – 18.10 · 0 treningów')).toBeInTheDocument();
    expect(screen.getByText(/jeszcze bez zamkniętego treningu/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Rysunek ciała — przód\./ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Rysunek ciała — tył\./ })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Serie w tym tygodniu na partię mięśni' })).not.toBeInTheDocument();
  });

  it('lista liczbowa pod rysunkiem: partie od najmocniej pracujących, pół serii dla pomocniczych', () => {
    const { container } = render(<MuscleWeekCard state={withLog([goblet])} now={NOW} />);
    expect(screen.getByText('12.10 – 18.10 · 1 trening')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Serie w tym tygodniu na partię mięśni' });
    const rows = within(list).getAllByRole('listitem').map((r) => r.textContent);
    // Przy równej liczbie serii kolejność z `MUSCLES`.
    expect(rows).toEqual([
      `${MUSCLE_NAME.posladki}3`,
      `${MUSCLE_NAME.czworoglowe}3`,
      `${MUSCLE_NAME.brzuch}1,5`,
      `${MUSCLE_NAME.przywodziciele}1,5`,
    ]);
    expect(screen.getByText(new RegExp(`^Bez serii: ${MUSCLE_NAME.klatka}`))).toBeInTheDocument();
    // Rysunek: zabarwienie stopniem, z tytułem dla najechania kursorem.
    const quads = container.querySelector('[data-muscle="czworoglowe"]')!;
    expect(quads).toHaveClass('mw-l1');
    expect(quads.querySelector('title')).toHaveTextContent(`${MUSCLE_NAME.czworoglowe}: 3 serii`);
    expect(container.querySelector('[data-muscle="klatka"]')).toHaveClass('mw-l0');
  });

  it('skala ma podpisy liczbowe, a odniesienie z badań stoi jako podpis bez ocen', () => {
    render(<MuscleWeekCard state={withLog([goblet])} now={NOW} />);
    const legend = screen.getByRole('list', { name: 'Skala kolorów: serie w tygodniu' });
    expect(within(legend).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['0', 'poniżej 4', '4–10', '10–20', 'ponad 20']);
    expect(screen.getByText(/^Odniesienie z badań: 10–20 serii na partię tygodniowo \(Schoenfeld/)).toBeInTheDocument();
    const body = document.body.textContent ?? '';
    for (const word of ['za mało', 'za dużo', 'brawo', 'uwaga']) expect(body.toLowerCase()).not.toContain(word);
  });

  it('przekąski są policzone osobno i nie barwią rysunku', () => {
    const snack = { key: 'k', at: '2026-10-13T08:00:00.000Z', ex: 'goblet', reps: 10, w: null } as Snack;
    const { container } = render(<MuscleWeekCard state={withLog([], [snack])} now={NOW} />);
    expect(screen.getByText(/^1 przekąska ruchowa w tym tygodniu — nie wchodzi do serii/)).toBeInTheDocument();
    expect(container.querySelector('[data-muscle="czworoglowe"]')).toHaveClass('mw-l0');
  });
});
