// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The Excel report in English: English sheet names and headers, the English file name. */

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

const { ReportExportCard } = await import('./ReportExport');
const { freshState } = await import('../engine/plan');
const { setBodyWeight } = await import('../engine/body');
const { readWorkbook } = await import('../food/diet/xlsx');

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Excel report (English)', () => {
  it('downloads an English workbook', async () => {
    const s = freshState();
    s.log = [{ date: new Date().toISOString(), workout: 'Trening A', ready: 'high', items: [{ id: 'goblet', sets: [{ reps: 8, w: 16 }], effort: 'easy' }] }];
    setBodyWeight(s, 80, today());
    const toasts: string[] = [];
    render(<ReportExportCard state={s} onToast={(m) => toasts.push(m)} />);
    expect(screen.getByRole('heading', { name: 'Report for a dietitian or doctor (Excel)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '90 days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download the .xlsx file' }));
    await waitFor(() => expect(files).toHaveLength(1), { timeout: 8000 });
    expect(files[0]!.name).toBe(`gym-tracker-report-${today()}.xlsx`);
    const wb = readWorkbook(new Uint8Array(await files[0]!.blob.arrayBuffer()));
    expect([...wb.keys()]).toEqual(['About', 'Days', 'Workouts', 'Sets', 'Measurements']);
    expect(wb.get('About')!.get('A1')).toBe('Item');
    expect(wb.get('Workouts')!.get('B1')).toBe('Start');
    expect(wb.get('Workouts')!.get('G2')).toBe('Fresh');
    expect(wb.get('Sets')!.get('J2')).toBe('Easy');
    expect([...wb.get('About')!.values()].map(String)).toContain('An empty cell means “unknown” or “not logged” — never zero.');
    await waitFor(() => expect(toasts).toEqual(['Report ready: 5 sheets, 4 rows of data.']));
  }, 15_000);
});
