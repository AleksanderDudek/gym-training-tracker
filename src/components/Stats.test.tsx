// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({ API_URL: 'https://api.test', apiConfigured: () => true }));

import { consent } from '../stats';
import { freshState } from '../engine/plan';
import { StatsAsk, StatsCard } from './Stats';

beforeEach(() => localStorage.clear());

describe('pytanie o statystyki', () => {
  it('nie pyta przed pierwszym treningiem', () => {
    render(<StatsAsk state={freshState()} />);
    expect(screen.queryByText('Pomożesz ulepszać aplikację?')).toBeNull();
  });

  it('po pierwszym treningu pyta raz; odpowiedź znika i zostaje zapamiętana', () => {
    const s = freshState();
    s.log = [{} as never];
    const view = render(<StatsAsk state={s} />);
    expect(screen.getByText('Pomożesz ulepszać aplikację?')).toBeInTheDocument();
    expect(screen.getByText('Co dokładnie wysyłam')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nie, dziękuję' }));
    expect(consent()).toBe('off');
    expect(screen.queryByText('Pomożesz ulepszać aplikację?')).toBeNull();
    view.unmount();
    render(<StatsAsk state={s} />);
    expect(screen.queryByText('Pomożesz ulepszać aplikację?')).toBeNull();
  });
});

describe('karta w Ustawieniach', () => {
  it('włącza i wyłącza', () => {
    render(<StatsCard />);
    expect(screen.getByText('Jeszcze nie wybrano — nic nie jest wysyłane.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Włącz' }));
    expect(consent()).toBe('on');
    fireEvent.click(screen.getByRole('button', { name: 'Wyłącz' }));
    expect(consent()).toBe('off');
    expect(screen.getByText('Wyłączone. Nic nie jest wysyłane.')).toBeInTheDocument();
  });
});
