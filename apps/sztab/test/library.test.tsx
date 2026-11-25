import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibraryItem } from '../src/lib/data';

/** Biblioteka: podsumowania z odmianą liczebników i „Uruchom program” tylko dla zapisanej wersji. */

vi.hoisted(() => {
  (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
});

const db = vi.hoisted(() => ({ library: [] as unknown[] }));

vi.mock('../src/session', () => ({
  useReady: () => ({ coach: { id: 'c1', display_name: 'Anna', profession: 'trainer' }, user: { id: 'c1' }, key: {} as CryptoKey }),
}));

vi.mock('../src/lib/data', async (orig) => ({
  ...(await orig<typeof import('../src/lib/data')>()),
  listLibrary: vi.fn(async () => db.library),
}));

const meal = (name: string) => ({ slot: '', name, recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' });
const q = (id: string) => ({ id, type: 'text' as const, label: id, help: '', required: false, unit: '', min: null, max: null, options: [] });
const form = (n: number) => ({ kind: 'form' as const, title: 'F', intro: '', repeat: 'weekly' as const, weekday: 1, intake: false, questions: Array.from({ length: n }, (_, i) => q(`q${i + 1}`)) });
const habits = (n: number) => ({
  kind: 'habits' as const,
  title: 'H',
  note: '',
  until: null,
  items: Array.from({ length: n }, (_, i) => ({ label: `h${i}`, dose: '', when: 'any' as const, days: [1, 2, 3] })),
});
const meals = (days: number, perDay: number) => ({
  kind: 'meals' as const,
  title: 'M',
  note: '',
  start: null,
  days: Array.from({ length: days }, (_, d) => ({ label: `D${d}`, meals: Array.from({ length: perDay }, (_, i) => meal(`m${i}`)) })),
});

describe('Podsumowania w bibliotece', () => {
  it('po polsku: liczebniki odmienione (1 pytanie, 2 pytania, 5 pytań…)', async () => {
    const { summary } = await import('../src/pages/Library');
    expect(summary(form(1))).toBe('1 pytanie · co tydzień');
    expect(summary(form(2))).toBe('2 pytania · co tydzień');
    expect(summary(form(5))).toBe('5 pytań · co tydzień');
    expect(summary(form(22))).toBe('22 pytania · co tydzień');
    expect(summary(habits(1))).toBe('1 nawyk');
    expect(summary(habits(3))).toBe('3 nawyki');
    expect(summary(habits(12))).toBe('12 nawyków');
    expect(summary(meals(1, 2))).toBe('1 dzień · 2 posiłki');
    expect(summary(meals(7, 5))).toBe('7 dni · 35 posiłków');
    expect(summary(meals(1, 1))).toBe('1 dzień · 1 posiłek');
    expect(summary({ kind: 'program', note: '', steps: [{ day: 0, time: '07:00', itemId: 'x' }] })).toBe('1 element · 1 dzień');
    expect(summary({ kind: 'program', note: '', steps: [0, 1, 2].map((day) => ({ day, time: '07:00', itemId: 'x' })) })).toBe('3 elementy · 3 dni');
    expect(summary({ kind: 'targets', kcal: null, protein: null, steps: 1, workoutsPerWeek: null, weightGoal: null, weeklyRate: null, note: '' })).toBe('1 krok');
  });

  it('po angielsku: liczba pojedyncza dla 1', async () => {
    vi.resetModules();
    (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'en';
    try {
      const { summary } = await import('../src/pages/Library');
      expect(summary(form(1))).toBe('1 question · weekly');
      expect(summary(form(3))).toBe('3 questions · weekly');
      expect(summary(habits(1))).toBe('1 habit');
      expect(summary(meals(1, 1))).toBe('1 day · 1 meal');
      expect(summary({ kind: 'program', note: '', steps: [{ day: 0, time: '07:00', itemId: 'x' }] })).toBe('1 item · 1 day');
    } finally {
      (globalThis as { __KB_LANG__?: string }).__KB_LANG__ = 'pl';
      vi.resetModules();
    }
  });
});

describe('Program w bibliotece', () => {
  it('„Uruchom program” nieaktywne, póki są niezapisane zmiany — z podpowiedzią; ta sama treść w innej kolejności kluczy to nie zmiana', async () => {
    const program: LibraryItem = {
      id: 'p1',
      kind: 'program',
      title: 'Start',
      // Baza (jsonb) oddaje klucze w swojej kolejności.
      body: { steps: [{ itemId: 'x', time: '07:00', day: 0 }], note: '', kind: 'program' } as LibraryItem['body'],
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };
    db.library = [program];
    const { LibraryEditor, sameContent } = await import('../src/pages/Library');
    expect(sameContent({ a: 1, b: [{ c: 2, d: undefined }] }, { b: [{ c: 2 }], a: 1 })).toBe(true);
    expect(sameContent({ a: 1 }, { a: 2 })).toBe(false);

    render(<LibraryEditor id="p1" />);
    const launch = await screen.findByRole('button', { name: 'Uruchom program…' });
    await waitFor(() => expect(launch).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Notatka do programu (tylko dla ciebie)'), { target: { value: 'nowa notatka' } });
    expect(launch).toBeDisabled();
    expect(launch).toHaveAccessibleDescription(/Zapisz zmiany, zanim uruchomisz program/);
    fireEvent.change(screen.getByLabelText('Notatka do programu (tylko dla ciebie)'), { target: { value: '' } });
    expect(launch).toBeEnabled();
  });
});
