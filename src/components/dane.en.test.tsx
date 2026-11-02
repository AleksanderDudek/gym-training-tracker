// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Pakiet „dane i przypomnienia” po angielsku: eksport CSV z przecinkiem i kropką, przypomnienie o jedzeniu. */

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

vi.mock('../push', () => ({
  pushConfigured: () => true,
  currentPushState: async () => 'on',
  enablePush: async () => 'on',
  disablePush: async () => 'off',
}));

const { CsvExportCard } = await import('./CsvExport');
const { RemindersCard } = await import('./Reminders');
const { freshState } = await import('../engine/plan');
const { setBodyWeight } = await import('../engine/body');
const { DIET_FLAG } = await import('../food/dietFlag');
const { db } = await import('../food/diet/db');

let files: { name: string; blob: Blob }[] = [];
let last: Blob | null = null;

beforeEach(() => {
  files = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = (b: Blob) => ((last = b), 'blob:csv');
      static revokeObjectURL = () => undefined;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    files.push({ name: this.download, blob: last! });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  await db.entries.clear();
});

const read = async (b: Blob): Promise<string> => new TextDecoder().decode(await b.arrayBuffer());

describe('spreadsheet export (English)', () => {
  it('commas and decimal points, English headers and file names', async () => {
    const s = freshState();
    setBodyWeight(s, 85.4, '2026-10-05');
    const toasts: string[] = [];
    render(<CsvExportCard state={s} onToast={(m) => toasts.push(m)} />);
    expect(screen.getByRole('heading', { name: 'Export to a spreadsheet (CSV)' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'CSV files to download' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toMatch(/^gym-tracker-body-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(await read(files[0]!.blob)).toContain('2026-10-05,85.40');
    expect(toasts.at(-1)).toBe('File ready: 1 row.');

    await db.entries.add({ date: '2026-10-05', time: '08:00', name: 'Eggs, scrambled', amountLabel: '3 eggs', kcal: 270, protein: 19, carbs: 1.5, fat: 21, source: 'quick' });
    fireEvent.click(screen.getByRole('button', { name: 'Food' }));
    await waitFor(() => expect(files).toHaveLength(2));
    const food = await read(files[1]!.blob);
    expect(food).toContain('Date,Time,Meal,Name,Amount,kcal,Protein (g),Carbs (g),Fat (g)\r\n');
    expect(food).toContain('2026-10-05,08:00,Breakfast,"Eggs, scrambled",3 eggs,270,19,1.5,21\r\n');

    fireEvent.click(screen.getByRole('button', { name: 'Workouts' }));
    await waitFor(() => expect(toasts.at(-1)).toBe('There are no workouts saved yet — the file would be empty.'));
  }, 15_000);
});

describe('food reminder (English)', () => {
  it('with a diet profile: off by default, then a time to choose and one shared evening notification', async () => {
    localStorage.setItem(DIET_FLAG, '1');
    let state = freshState();
    const { rerender } = render(<RemindersCard state={state} onToast={() => undefined} onPrefs={() => undefined} />);
    const group = await screen.findByRole('group', { name: 'Reminder at 20:00 about today’s food' });
    expect(within(group).getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/With a diet profile, also “Today’s food” — at 20:00 by default/)).toBeInTheDocument();

    state = { ...state, cfg: { ...state.cfg, reminders: { morning: true, evening: true, food: true, foodAt: '20:00' } } };
    rerender(<RemindersCard state={state} onToast={() => undefined} onPrefs={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Time of the food reminder' })).toHaveValue('20:00');
    expect(screen.getByText(/one notification at 20:00: “Log today’s steps and food”/)).toBeInTheDocument();
  });
});
