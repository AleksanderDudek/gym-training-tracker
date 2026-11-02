// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN, ex } from '../data/exercises';
import { NOTE_MAX } from '../engine/notes';
import { freshState } from '../engine/plan';
import type { LogEntry, Session } from '../types';
import { GuidedSession } from './Guided';
import { LastNote, LogNotesEditor, NoteEditor, WorkoutNote } from './Notes';

vi.mock('../food/TodayFoodCard', () => ({ default: () => null }));

const A = BUILTIN.find((w) => w.id === 'A')!;
const noop = () => {};

const entry = (extra: Partial<LogEntry> = {}): LogEntry => ({
  date: '2026-10-12T18:00:00.000Z',
  workout: A.name,
  wid: A.id,
  ready: 'ok',
  items: A.items.map((i) => ({ id: i.ex, sets: [{ reps: 10, w: 16 }], effort: 'solid' as const })),
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Notatki', () => {
  it('„Ostatnio” pokazuje datę i treść, a bez notatki nic', () => {
    const { container, rerender } = render(<LastNote note={{ note: 'wyżej siodełko', date: '2026-10-12T18:00:00.000Z' }} />);
    expect(screen.getByText('wyżej siodełko').closest('p')).toHaveTextContent('Ostatnio (12.10): wyżej siodełko');
    rerender(<LastNote note={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ołówek otwiera pole; „Zapisz notatkę” oddaje oczyszczony tekst, „Anuluj” niczego', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NoteEditor value="" name="Goblet squat" onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Notatka do ćwiczenia: Goblet squat' }));
    const area = screen.getByRole('textbox', { name: 'Notatka do ćwiczenia: Goblet squat' });
    expect(area).toHaveAttribute('maxLength', String(NOTE_MAX));
    await user.type(area, '  pięty niżej ');
    expect(screen.getByText(`14 z ${NOTE_MAX} znaków`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Notatka do ćwiczenia: Goblet squat' }));
    await user.type(screen.getByRole('textbox'), '  pięty niżej ');
    await user.click(screen.getByRole('button', { name: 'Zapisz notatkę' }));
    expect(onSave).toHaveBeenCalledWith('pięty niżej');
  });

  it('istniejąca notatka stoi przy ołówku, który mówi „Zmień notatkę”', () => {
    render(<NoteEditor value="chwyt szerzej" name="Wiosłowanie" onSave={noop} />);
    expect(screen.getByText('chwyt szerzej')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zmień notatkę: Wiosłowanie' })).toHaveTextContent('Zmień notatkę');
  });

  it('notatka treningu zapisuje się przy wyjściu z pola i nie zapisuje drugi raz przy zamknięciu', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { unmount } = render(
      <>
        <WorkoutNote onSave={onSave} />
        <button type="button">OK</button>
      </>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Notatka do treningu' }), 'po nocce ');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('po nocce');
    expect(screen.getByText(/· Zapisane$/)).toBeInTheDocument();
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('notatka treningu zapisuje się przy zamknięciu okna bez wyjścia z pola', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { unmount } = render(<WorkoutNote onSave={onSave} />);
    await user.type(screen.getByRole('textbox', { name: 'Notatka do treningu' }), 'siłownia pełna');
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledWith('siłownia pełna');
  });

  it('pusta notatka treningu bez zmian niczego nie zapisuje', () => {
    const onSave = vi.fn();
    render(<WorkoutNote onSave={onSave} />).unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('w historii: notatki całości i ćwiczeń naraz, zapis dopiero po „Zapisz notatki”', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const first = A.items[0]!.ex;
    const e = entry({ note: 'po nocce' });
    e.items[0]!.note = 'wyżej siodełko';
    render(<LogNotesEditor entry={e} name={A.name} onSave={onSave} />);
    const open = screen.getByRole('button', { name: `Notatki treningu ${A.name} z 12.10` });
    expect(open).toHaveTextContent('Zmień notatki');
    await user.click(open);
    expect(screen.getByRole('textbox', { name: 'Notatka do treningu' })).toHaveValue('po nocce');
    const exArea = screen.getAllByRole('textbox', { name: `Notatka do ćwiczenia: ${ex(first).name}` })[0]!;
    expect(exArea).toHaveValue('wyżej siodełko');
    await user.clear(exArea);
    await user.type(exArea, 'chwyt szerzej');
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Zapisz notatki' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].note).toBe('po nocce');
    expect(onSave.mock.calls[0]![0].items[first]).toBe('chwyt szerzej');
  });

  it('w sesji z przewodnikiem „Ostatnio” stoi przy serii, a ołówek pod „Zrobione”', () => {
    const state = freshState();
    const e = entry();
    e.items.forEach((i) => (i.note = `notatka ${i.id}`));
    state.log = [e];
    const now = Date.now();
    state.session = {
      workout: A.id,
      started: new Date(now).toISOString(),
      ready: 'ok',
      res: {},
      done: {},
      skip: {},
      clock: { begin: now, parts: { 1: { start: now } } },
    } as Session;
    render(
      <GuidedSession
        state={state}
        workout={A}
        onReady={noop}
        onBegin={noop}
        onStartPart={noop}
        onSkipPart={noop}
        onClockPref={noop}
        onLogSet={noop}
        onUndo={noop}
        onEffort={noop}
        onRest={noop}
        onSkip={noop}
        onNote={noop}
        onFinish={noop}
        onList={noop}
        onToast={noop}
      />,
    );
    const last = screen.getByText(/^Ostatnio \(12\.10\):/).closest('p')!;
    expect(last).toHaveClass('clamp');
    expect(last.textContent).toMatch(/: notatka /);
    const done = screen.getByRole('button', { name: 'Zrobione' });
    const pencil = screen.getByRole('button', { name: /^Notatka do ćwiczenia: / });
    // Ołówek idzie w dokumencie po „Zrobione”, nigdy przed nim.
    expect(done.compareDocumentPosition(pencil) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
