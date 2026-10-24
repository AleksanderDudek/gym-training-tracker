// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeContext, type GymBridge } from '../bridge';
import { db } from '../diet/db';
import { addDays } from '../diet/model';
import { logQuick } from '../diet/store';
import type { Profile } from '../diet/types';
import { newProfile } from '../diet/validate';
import { testBridge } from '../test/bridge';
import type { Clock } from './useDiet';
import { CHECK_WAIT_MS, forgetWeeklyChecks, useWeeklyCheck } from './useWeeklyCheck';

// The real check, counted, or a stand-in when a test needs it to fail or hang.
const control = vi.hoisted(() => ({ calls: 0, impl: null as null | (() => Promise<unknown>) }));
vi.mock('../diet/store', async (importOriginal) => {
  const real = await importOriginal<typeof import('../diet/store')>();
  return {
    ...real,
    runWeeklyCheck: (...args: Parameters<typeof real.runWeeklyCheck>) => {
      control.calls++;
      return control.impl ? control.impl() : real.runWeeklyCheck(...args);
    },
  };
});

const M = '2026-10-26'; // a Monday
const at = (offset: number) => addDays(M, offset);
const clock = (date: string, hour: number): Clock => ({ date, hour, ms: Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00`) });

/** A profile whose last check was last week's: this week's is due. */
const profile: Profile = newProfile(
  { startDate: '2026-08-03', startWeightKg: 80, targetWeightKg: 70, goalPace: 0.5, dailyKcal: 2000 },
  '2026-08-03',
);

/** Four weeks of losing 0,5 kg a week on 2450 kcal: the check raises 2000 to 2100. */
const weights = Array.from({ length: 28 }, (_, i) => ({ day: at(-28 + i), kg: 79.3 + (0.5 / 7) * (27 - i) }));

const under =
  (b: GymBridge | null) =>
  ({ children }: { children: ReactNode }) => <BridgeContext.Provider value={b}>{children}</BridgeContext.Provider>;

beforeEach(async () => {
  forgetWeeklyChecks();
  control.calls = 0;
  control.impl = null;
  await db.profile.put({ ...profile, id: 'me' });
  for (let d = -28; d <= -1; d++) await logQuick(at(d), 'Obiad', 2450);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await db.profile.clear();
  await db.entries.clear();
});

describe('A22 — the Monday check from the screens', () => {
  it('Monday 09:00: pending until this week’s check is stored, then ready', async () => {
    const { result } = renderHook(() => useWeeklyCheck(profile, clock(M, 9)), { wrapper: under(testBridge({ weights })) });
    expect(result.current).toBe('pending');
    await waitFor(() => expect(result.current).toBe('ready'));
    expect(control.calls).toBe(1);
    expect(await db.profile.get('me')).toMatchObject({ dailyKcal: 2100, lastCheck: { week: M, status: 'changed' } });
  });

  it('Monday 03:00: ready at once, nothing runs (Sunday’s dinner may still be logged)', async () => {
    const { result } = renderHook(() => useWeeklyCheck(profile, clock(M, 3)), { wrapper: under(testBridge({ weights })) });
    expect(result.current).toBe('ready');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(control.calls).toBe(0);
    expect((await db.profile.get('me'))?.dailyKcal).toBe(2000);
  });

  it('a missed Monday runs on Tuesday at 01:00 — once for every screen in the tab', async () => {
    const wrapper = under(testBridge({ weights }));
    const today = renderHook(() => useWeeklyCheck(profile, clock(at(1), 1)), { wrapper });
    const diary = renderHook(() => useWeeklyCheck(profile, clock(at(1), 1)), { wrapper });
    await waitFor(() => expect([today.result.current, diary.result.current]).toEqual(['ready', 'ready']));
    expect(control.calls).toBe(1);
    expect(await db.profile.get('me')).toMatchObject({ lastCheck: { week: M } });
    // Mounted again later in the tab: the week's run is done, nothing runs again.
    const later = renderHook(() => useWeeklyCheck(profile, clock(at(1), 2)), { wrapper });
    await waitFor(() => expect(later.result.current).toBe('ready'));
    expect(control.calls).toBe(1);
  });

  it('a check that throws: logged, and the screens get the stored target', async () => {
    control.impl = () => Promise.reject(new Error('IndexedDB zablokowana'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWeeklyCheck(profile, clock(M, 9)), { wrapper: under(testBridge({ weights })) });
    await waitFor(() => expect(result.current).toBe('ready'));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: 'IndexedDB zablokowana' }));
  });

  it(`a check that hangs: ready after ${CHECK_WAIT_MS / 1000} s anyway`, async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    control.impl = () => new Promise(() => {});
    const { result } = renderHook(() => useWeeklyCheck(profile, clock(M, 9)), { wrapper: under(testBridge({ weights })) });
    expect(result.current).toBe('pending');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHECK_WAIT_MS - 100);
    });
    expect(result.current).toBe('pending');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current).toBe('ready');
  });

  it('no bridge (no weigh-ins to read), no profile or not due: ready, nothing runs', async () => {
    expect(renderHook(() => useWeeklyCheck(profile, clock(M, 9)), { wrapper: under(null) }).result.current).toBe('ready');
    expect(renderHook(() => useWeeklyCheck(null, clock(M, 9)), { wrapper: under(testBridge()) }).result.current).toBe('ready');
    const checked = { ...profile, lastCheck: { ...profile.lastCheck!, week: M } };
    expect(renderHook(() => useWeeklyCheck(checked, clock(M, 9)), { wrapper: under(testBridge()) }).result.current).toBe('ready');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(control.calls).toBe(0);
  });
});
