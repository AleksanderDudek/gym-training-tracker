// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeContext, type GymBridge } from '../bridge';
import { db } from '../diet/db';
import { logQuick } from '../diet/store';
import { useHistory, useMergedDay, useMergedHistory } from './useDiet';

const bridge = (over: Partial<GymBridge> = {}): GymBridge => ({
  weights: [],
  setWeight: vi.fn(),
  heightCm: null,
  setHeight: vi.fn(),
  stepsOn: () => null,
  setSteps: vi.fn(),
  moveOn: () => ({ trained: false, workoutKcal: null, cardioKcal: null }),
  toast: vi.fn(),
  ...over,
});

const under =
  (b: GymBridge) =>
  ({ children }: { children: ReactNode }) => <BridgeContext.Provider value={b}>{children}</BridgeContext.Provider>;

afterEach(async () => {
  vi.restoreAllMocks();
  await db.days.clear();
  await db.entries.clear();
});

describe('historia zapisów', () => {
  it('pusty wynik sprzed profilu (bez zakresu) nie udaje historii, gdy zakres się pojawi', async () => {
    await logQuick('2026-10-12', 'Obiad', 700);
    const { result, rerender } = renderHook(({ from }: { from: string | null }) => useHistory(from), {
      initialProps: { from: null as string | null },
    });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current!.entries).toEqual([]);

    // Profil się wczytał: `useLiveQuery` oddaje jeszcze pusty wynik z `from = null`. To „wczytuję”,
    // a nie tydzień bez zapisów — inaczej cel dnia mignąłby bez korekty tygodnia.
    rerender({ from: '2026-10-12' });
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current?.eaten.get('2026-10-12')).toBe(700));
  });

  it('inny zakres może chwilę postać na poprzednim wyniku, zamiast mrugać „wczytuję”', async () => {
    await logQuick('2026-10-12', 'Obiad', 700);
    await logQuick('2026-10-19', 'Kolacja', 500);
    const { result, rerender } = renderHook(({ from }: { from: string | null }) => useHistory(from), {
      initialProps: { from: '2026-10-12' },
    });
    await waitFor(() => expect(result.current?.eaten.size).toBe(2));
    rerender({ from: '2026-10-19' });
    expect(result.current).toBeDefined();
    await waitFor(() => expect([...result.current!.eaten.keys()]).toEqual(['2026-10-19']));
  });
});

describe('dni diety czytane razem z danymi treningowymi', () => {
  it('historia: ważenia z treningów od początku diety i kroki z treningów nad wartościami diety', async () => {
    await db.days.bulkPut([
      { date: '2026-10-01', weightKg: 82, steps: 3000 },
      { date: '2026-10-03', steps: 4000, note: 'wesele' },
    ]);
    const b = bridge({
      weights: [
        { day: '2026-09-20', kg: 84 },
        { day: '2026-10-01', kg: 81.5 },
        { day: '2026-10-02', kg: 81.2 },
      ],
      stepsOn: (day) => (day === '2026-10-03' ? 11000 : null),
    });
    const { result } = renderHook(() => useMergedHistory('2026-10-01'), { wrapper: under(b) });
    await waitFor(() => expect(result.current).toBeDefined());
    expect([...result.current!.days.values()]).toEqual([
      { date: '2026-10-01', weightKg: 81.5, steps: 3000 },
      { date: '2026-10-02', weightKg: 81.2 },
      { date: '2026-10-03', steps: 11000, note: 'wesele' },
    ]);
  });

  it('dzień: waga i kroki z treningów, choć dieta nie ma jeszcze wiersza', async () => {
    const b = bridge({ weights: [{ day: '2026-10-05', kg: 80 }], stepsOn: () => 7000 });
    const { result } = renderHook(() => useMergedDay('2026-10-05'), { wrapper: under(b) });
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual({ date: '2026-10-05', weightKg: 80, steps: 7000 });
  });

  it('bez mostu ekran diety mówi wprost, czego brakuje', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useMergedDay('2026-10-05'))).toThrow(/BridgeContext/);
  });
});
