// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeContext, type GymBridge } from '../bridge';
import { db, type ProfileRow } from '../diet/db';
import { logQuick } from '../diet/store';
import { newProfile } from '../diet/validate';
import { useHistory, useMergedDay, useMergedHistory, useProfile } from './useDiet';

const bridge = (over: Partial<GymBridge> = {}): GymBridge => ({
  weights: [],
  setWeight: vi.fn(),
  heightCm: null,
  setHeight: vi.fn(),
  stepsOn: () => null,
  setSteps: vi.fn(),
  moveOn: () => ({
    trained: false,
    workoutKcal: null,
    cardioKcal: null,
    otherKcal: null,
    planned: null,
    planActive: false,
    typicalWorkoutKcal: null,
    workouts: 0,
    snacks: 0,
    outings: 0,
    activeMin: 0,
    stepsWorth: null,
  }),
  toast: vi.fn(),
  ...over,
});

const under =
  (b: GymBridge) =>
  ({ children }: { children: ReactNode }) => <BridgeContext.Provider value={b}>{children}</BridgeContext.Provider>;

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await db.days.clear();
  await db.entries.clear();
  await db.profile.clear();
});

/** The owner's row as the old model stored it. */
const LEGACY = {
  sex: 'M',
  age: 35,
  heightCm: 175,
  startWeightKg: 84,
  targetWeightKg: 75,
  startDate: '2026-09-01',
  activityMultiplier: 1.28,
  baseSteps: 4000,
  targetSteps: 10_000,
  kcalPer1000StepsPerKg: 0.4,
  extraWeeklyKcal: 0,
  kcalPerKg: 7500,
  dailyKcal: 1860,
  kcalCorrection: 0,
  goalSince: '2026-09-20',
  dietProfile: 'redukcja',
  adaptWeekly: true,
  preferredStore: null,
};

describe('profil diety czytany zawsze przez normalizację', () => {
  it('A21 stary wiersz od razu wraca jako wersja 2, a w bazie zmienia się w nią dokładnie raz — ze starymi kluczami', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T12:00:00'));
    await db.profile.put({ ...LEGACY, id: 'me', later: 1 } as unknown as ProfileRow);
    const put = vi.spyOn(db.profile, 'put');
    const seen: (ProfileRow | null | undefined)[] = [];
    // Dwa ekrany naraz (karta Dziś i dziennik): jeden zapis.
    renderHook(
      () => {
        const first = useProfile();
        const second = useProfile();
        seen.push(first);
        return [first, second];
      },
      { wrapper: under(bridge({ weights: [{ day: '2026-10-22', kg: 80 }, { day: '2026-10-01', kg: 83 }] })) },
    );
    await waitFor(async () => expect((await db.profile.get('me'))?.version).toBe(2));
    await waitFor(() => expect(seen.at(-1)).toMatchObject({ version: 2 }));
    // Pierwszy profil, jaki dostał ekran, był już po przejściu — z wagą z ostatniego ważenia (80 kg).
    expect(seen.find((p) => p !== undefined)).toMatchObject({ version: 2, dailyKcal: 1860, burnOffset: -241, goalPace: 0.5, notice: 'show' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(put).toHaveBeenCalledTimes(1);
    expect(await db.profile.get('me')).toMatchObject({
      ...LEGACY,
      later: 1,
      version: 2,
      burnOffset: -241,
      goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }],
      lastCheck: { week: '2026-10-26', status: 'migrated' },
    });
    expect(seen.at(-1)).toEqual(expect.objectContaining({ id: 'me', burnOffset: -241 }));
  });

  it('bez mostu (strony restauracji) przejście liczy z wagi na starcie', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T12:00:00'));
    await db.profile.put({ ...LEGACY, startWeightKg: 80, id: 'me' } as unknown as ProfileRow);
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current).toMatchObject({ version: 2, burnOffset: -241 }));
    await waitFor(async () => expect((await db.profile.get('me'))?.burnOffset).toBe(-241));
  });

  it('dzień po zaplanowanym końcu przerwy cel dnia jest już powrotny — bez zapisu', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T08:00:00'));
    const row = {
      ...newProfile(
        {
          startDate: '2026-09-01',
          dailyKcal: 2650,
          goals: [
            { from: '2026-09-01', kcal: 1860, by: 'migration' },
            { from: '2026-10-12', kcal: 2650, by: 'break' },
            { from: '2026-10-19', kcal: 1860, by: 'break' },
          ],
          pauses: [{ from: '2026-10-12', to: '2026-10-18', kcal: 1860 }],
        },
        '2026-09-01',
      ),
      id: 'me' as const,
    };
    await db.profile.put(row);
    const { result } = renderHook(() => useProfile(), { wrapper: under(bridge()) });
    await waitFor(() => expect(result.current?.dailyKcal).toBe(1860));
    expect(result.current?.goals).toEqual(row.goals);
    expect((await db.profile.get('me'))?.dailyKcal).toBe(2650);
  });

  it('brak profilu to null, nie „wczytuję”', async () => {
    const { result } = renderHook(() => useProfile(), { wrapper: under(bridge()) });
    await waitFor(() => expect(result.current).toBeNull());
  });
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
