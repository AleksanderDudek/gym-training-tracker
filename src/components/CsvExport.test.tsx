// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBodyWeight } from '../engine/body';
import { freshState } from '../engine/plan';
import { db } from '../food/diet/db';
import type { AppState } from '../types';
import { CsvExportCard } from './CsvExport';

/**
 * Ustawienia → „Eksport do arkusza (CSV)”: trzy przyciski, trzy pliki. Plik powstaje
 * w przeglądarce — tu łapiemy go, zanim przeglądarka by go zapisała.
 */

let files: { name: string; blob: Blob }[] = [];
let last: Blob | null = null;

beforeEach(() => {
  files = [];
  // Podklasa, nie `{ ...URL }`: bez konstruktora `URL` pada dynamiczny import modułu jedzenia.
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
  await db.entries.clear();
});

const withData = (): AppState => {
  const s = freshState();
  s.log = [
    {
      date: '2026-10-05T08:00:00.000Z',
      workout: 'Trening A',
      wid: 'A',
      ready: 'ok',
      items: [{ id: 'goblet', sets: [{ reps: 8, w: 16 }], effort: 'solid' }],
    },
  ];
  setBodyWeight(s, 85.4, '2026-10-05');
  return s;
};

const read = async (b: Blob): Promise<string> => new TextDecoder().decode(await b.arrayBuffer());

describe('eksport do arkusza', () => {
  it('treningi i ciało — pliki CSV z BOM, średnikiem i przecinkiem, nazwy z datą', async () => {
    const toasts: string[] = [];
    render(<CsvExportCard state={withData()} onToast={(m) => toasts.push(m)} />);
    expect(screen.getByRole('heading', { name: 'Eksport do arkusza (CSV)' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Pliki CSV do pobrania' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Treningi' }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toMatch(/^gym-tracker-treningi-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(files[0]!.blob.type).toBe('text/csv;charset=utf-8');
    const bytes = new Uint8Array(await files[0]!.blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const workouts = await read(files[0]!.blob);
    expect(workouts).toContain('Data;Trening;Ćwiczenie;Seria');
    expect(workouts).toContain('2026-10-05;Trening A;Goblet squat;1;8;;16;Solidnie;1–2;');
    expect(toasts.at(-1)).toBe('Plik gotowy: 1 wiersz.');

    fireEvent.click(screen.getByRole('button', { name: 'Ciało' }));
    await waitFor(() => expect(files).toHaveLength(2));
    expect(files[1]!.name).toMatch(/^gym-tracker-cialo-/);
    expect(await read(files[1]!.blob)).toContain('2026-10-05;85,40');
  });

  it('jedzenie z dziennika w IndexedDB; pusty dziennik — komunikat zamiast pustego pliku', async () => {
    const toasts: string[] = [];
    render(<CsvExportCard state={freshState()} onToast={(m) => toasts.push(m)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jedzenie' }));
    await waitFor(() => expect(toasts).toEqual(['Dziennik jedzenia jest pusty — plik byłby pusty.']));
    expect(files).toHaveLength(0);

    await db.entries.bulkAdd([
      { date: '2026-10-05', time: '08:00', name: 'Jajecznica', amountLabel: '3 jaja', kcal: 270, protein: 19, carbs: 1, fat: 21, source: 'quick' },
      { date: '2026-10-05', time: '13:00', name: 'Zupa', amountLabel: '1 talerz', kcal: 150, protein: null, carbs: null, fat: null, source: 'quick' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Jedzenie' }));
    await waitFor(() => expect(files).toHaveLength(1));
    expect(files[0]!.name).toMatch(/^gym-tracker-jedzenie-/);
    const food = await read(files[0]!.blob);
    expect(food).toContain('2026-10-05;08:00;Jajecznica;3 jaja;270;19;1;21\r\n');
    expect(toasts.at(-1)).toBe('Plik gotowy: 2 wiersze.');
  }, 15_000);

  it('pusty zapis treningów i ciała — komunikat, nie plik', async () => {
    const toasts: string[] = [];
    render(<CsvExportCard state={freshState()} onToast={(m) => toasts.push(m)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Treningi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ciało' }));
    await waitFor(() => expect(toasts).toHaveLength(2));
    expect(toasts[0]).toMatch(/nie ma jeszcze treningów/);
    expect(toasts[1]).toMatch(/nie ma jeszcze ważeń ani obwodów/);
    expect(files).toHaveLength(0);
  });
});
