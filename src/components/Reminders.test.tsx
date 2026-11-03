// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshState } from '../engine/plan';
import { DIET_FLAG } from '../food/dietFlag';
import type { ReminderPrefs } from '../types';

/**
 * Karta przypomnień z włączonymi powiadomieniami: przypomnienie o jedzeniu jest tylko przy profilu
 * diety, domyślnie wyłączone, z godziną do wyboru — a przy włączonych krokach mówi, że oba przyjdą
 * jednym powiadomieniem.
 */

vi.mock('../push', () => ({
  pushConfigured: () => true,
  currentPushState: async () => 'on',
  enablePush: async () => 'on',
  disablePush: async () => 'off',
}));

const { RemindersCard } = await import('./Reminders');

afterEach(() => localStorage.clear());

function Harness({ start, onPrefs }: { start?: ReminderPrefs; onPrefs?: (p: ReminderPrefs) => void }) {
  const [state, setState] = useState(() => {
    const s = freshState();
    if (start) s.cfg.reminders = start;
    return s;
  });
  return (
    <RemindersCard
      state={state}
      onToast={() => undefined}
      onPrefs={(p) => {
        onPrefs?.(p);
        setState((s) => ({ ...s, cfg: { ...s.cfg, reminders: p } }));
      }}
    />
  );
}

describe('przypomnienie o jedzeniu', () => {
  it('bez profilu diety go nie ma', async () => {
    render(<Harness />);
    expect(await screen.findByRole('group', { name: 'Przypomnienie wieczorem o 19:30 o krokach i ruchu' })).toBeInTheDocument();
    expect(screen.queryByText(/jedzenie z dziś/i)).toBeNull();
  });

  it('przy profilu diety domyślnie wyłączone; po włączeniu godzina 20:00 do zmiany i wspólne powiadomienie z krokami', async () => {
    localStorage.setItem(DIET_FLAG, '1');
    const seen: ReminderPrefs[] = [];
    render(<Harness onPrefs={(p) => seen.push(p)} />);
    const group = await screen.findByRole('group', { name: 'Przypomnienie o 20:00 o jedzeniu z dziś' });
    expect(within(group).getByRole('button', { name: 'Wył.' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Przy profilu diety także „Jedzenie z dziś” — domyślnie o 20:00/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Godzina przypomnienia o jedzeniu' })).toBeNull();

    fireEvent.click(within(group).getByRole('button', { name: 'Wł.' }));
    expect(seen.at(-1)).toMatchObject({ food: true, foodAt: '20:00', evening: true });
    expect(screen.getByText(/w jednym powiadomieniu o 20:00: „Wpisz kroki i jedzenie z dziś”/)).toBeInTheDocument();

    const time = screen.getByRole('combobox', { name: 'Godzina przypomnienia o jedzeniu' });
    expect(time).toHaveValue('20:00');
    fireEvent.change(time, { target: { value: '21:30' } });
    expect(seen.at(-1)).toMatchObject({ food: true, foodAt: '21:30' });
    expect(screen.getByRole('group', { name: 'Przypomnienie o 21:30 o jedzeniu z dziś' })).toBeInTheDocument();
    expect(screen.getByText(/w jednym powiadomieniu o 21:30/)).toBeInTheDocument();
  });

  it('kroki wyłączone — jedzenie idzie samo, bez dopisku o wspólnym powiadomieniu', async () => {
    localStorage.setItem(DIET_FLAG, '1');
    render(<Harness start={{ morning: true, evening: false, food: true, foodAt: '19:00' }} />);
    expect(await screen.findByRole('combobox', { name: 'Godzina przypomnienia o jedzeniu' })).toHaveValue('19:00');
    expect(screen.queryByText(/w jednym powiadomieniu/)).toBeNull();
  });

  it('godzina spoza listy (z importu) też jest na liście, zamiast zniknąć', async () => {
    localStorage.setItem(DIET_FLAG, '1');
    render(<Harness start={{ morning: true, evening: true, food: true, foodAt: '20:15' }} />);
    const time = await screen.findByRole('combobox', { name: 'Godzina przypomnienia o jedzeniu' });
    expect(time).toHaveValue('20:15');
    expect(within(time).getAllByRole('option').map((o) => o.textContent)).toContain('20:15');
  });
});

describe('przypomnienia o zakupach i badaniu oraz kalendarz', () => {
  it('przy profilu diety: zakupy i badanie, oba domyślnie wyłączone', async () => {
    localStorage.setItem(DIET_FLAG, '1');
    const seen: ReminderPrefs[] = [];
    render(<Harness onPrefs={(p) => seen.push(p)} />);
    const shop = await screen.findByRole('group', { name: 'Przypomnienie o zakupach 30 minut przed wyjściem' });
    const labs = screen.getByRole('group', { name: 'Przypomnienie o badaniu kontrolnym dzień przed o 19:00' });
    expect(within(shop).getByRole('button', { name: 'Wył.' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(labs).getByRole('button', { name: 'Wył.' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(shop).getByRole('button', { name: 'Wł.' }));
    expect(seen.at(-1)).toMatchObject({ shop: true });
    fireEvent.click(within(labs).getByRole('button', { name: 'Wł.' }));
    expect(seen.at(-1)).toMatchObject({ shop: true, labs: true });
  });

  it('bez profilu diety ich nie ma, a odnośnik do kalendarza jest zawsze', async () => {
    render(<Harness />);
    expect(await screen.findByRole('link', { name: 'Kalendarz' })).toHaveAttribute('href', '#/kalendarz');
    expect(screen.queryByRole('group', { name: /o zakupach/ })).toBeNull();
  });
});
