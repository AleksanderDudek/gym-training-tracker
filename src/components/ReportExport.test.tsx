// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBodyWeight } from '../engine/body';
import { freshState } from '../engine/plan';
import { db } from '../food/diet/db';
import { readWorkbook } from '../food/diet/xlsx';
import type { AppState } from '../types';
import { ReportExportCard } from './ReportExport';

/**
 * Ustawienia → „Raport dla dietetyka lub lekarza (Excel)”: wybór zakresu i jeden plik .xlsx.
 * Plik łapiemy, zanim przeglądarka by go zapisała, i czytamy z powrotem czytnikiem arkuszy.
 */

let files: { name: string; blob: Blob }[] = [];
let last: Blob | null = null;

beforeEach(() => {
  files = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = (b: Blob) => ((last = b), 'blob:xlsx');
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

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const withData = (): AppState => {
  const s = freshState();
  s.log = [
    {
      date: new Date().toISOString(),
      workout: 'Trening A',
      ready: 'ok',
      items: [{ id: 'goblet', sets: [{ reps: 8, w: 16 }], effort: 'solid' }],
      time: { secs: 2400, parts: [] },
    },
  ];
  setBodyWeight(s, 85.4, today());
  return s;
};

describe('raport Excel w ustawieniach', () => {
  it('bez profilu diety: plik .xlsx z treningami i pomiarami, nazwa z datą, komunikat z liczbą arkuszy', async () => {
    const toasts: string[] = [];
    await db.entries.add({ date: today(), time: '08:00', name: 'Skyr', amountLabel: '150 g', kcal: 95, protein: 16, carbs: 6, fat: 0, source: 'quick' });
    render(<ReportExportCard state={withData()} onToast={(m) => toasts.push(m)} />);
    expect(screen.getByRole('heading', { name: 'Raport dla dietetyka lub lekarza (Excel)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wszystko' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '30 dni' }));
    expect(screen.getByRole('button', { name: '30 dni' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz plik .xlsx' }));
    await waitFor(() => expect(files).toHaveLength(1), { timeout: 8000 });
    expect(files[0]!.name).toBe(`gym-tracker-raport-${today()}.xlsx`);
    expect(files[0]!.blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const wb = readWorkbook(new Uint8Array(await files[0]!.blob.arrayBuffer()));
    expect([...wb.keys()]).toEqual(['Informacje', 'Dni', 'Jedzenie', 'Treningi', 'Serie', 'Pomiary']);
    expect(wb.get('Jedzenie')!.get('D2')).toBe('Skyr');
    await waitFor(() => expect(toasts).toEqual([expect.stringMatching(/^Raport gotowy: 6 arkuszy, \d+ wierszy danych\.$/)]));
  }, 15_000);

  it('pusty zapis: bez pliku, z wyjaśnieniem', async () => {
    const toasts: string[] = [];
    render(<ReportExportCard state={freshState()} onToast={(m) => toasts.push(m)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pobierz plik .xlsx' }));
    await waitFor(() => expect(toasts).toHaveLength(1), { timeout: 8000 });
    expect(toasts[0]).toContain('nie ma jeszcze żadnych zapisanych danych');
    expect(files).toHaveLength(0);
  }, 15_000);
});
