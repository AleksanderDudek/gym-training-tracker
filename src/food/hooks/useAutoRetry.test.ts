// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AUTO_RETRY_MS, useAutoRetry } from './useNearbyShops';

const PLACE = '52.23,21.012,1000';

let online = true;
let visibility: DocumentVisibilityState = 'visible';
/** How many times a wrapped `online` listener ran, in this file: one left on `window` by an earlier test shows here. */
let wrapperRuns = 0;

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * A browser runs microtasks after each listener of an event it fires, so the connection store's own
 * (sync) render comes before the next `online` listener has run; jsdom calls them back to back.
 * Each `online` listener added from here on is followed by that render.
 */
function renderAfterEachOnlineListener() {
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  const wrapped = new Map<EventListenerOrEventListenerObject, EventListener>();
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type !== 'online' || !listener) return add(type, listener, options);
    const wrapper: EventListener = (event) => {
      wrapperRuns++;
      if (typeof listener === 'function') listener.call(window, event);
      else listener.handleEvent(event);
      flushSync(() => {});
    };
    wrapped.set(listener, wrapper);
    add(type, wrapper, options);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) =>
    remove(type, (listener && wrapped.get(listener)) ?? listener, options),
  );
}

/**
 * The connection comes back: `online` dispatched outside `act`, which would batch every render it
 * causes into one (a browser renders the store's change at once), and without act's warnings.
 */
async function comeOnline() {
  online = true;
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = false;
  window.dispatchEvent(new Event('online'));
  env.IS_REACT_ACT_ENVIRONMENT = true;
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Lets `ms` pass in steps, each a turn for React and the timers it sets. */
async function pass(ms: number, step = 1000) {
  for (let passed = 0; passed < ms; passed += step) await act(() => vi.advanceTimersByTimeAsync(Math.min(step, ms - passed)));
}

beforeEach(() => {
  vi.useFakeTimers();
  online = true;
  visibility = 'visible';
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  // Unmounted while the spies still map each `online` listener to its wrapper, so React's unsubscribe
  // takes the wrapper off `window`. Restored first (Testing Library's own cleanup runs after this
  // hook), the bare listener was removed instead and the wrappers heard every later `online`.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Back to jsdom's own getters.
  delete (navigator as { onLine?: boolean }).onLine;
  delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
});

describe('useAutoRetry', () => {
  test('one automatic try per failure: nothing more while it is on its way, the next pause after it fails, then none', async () => {
    const retry = vi.fn();
    const first = Date.now();
    const { result, rerender } = renderHook(({ failedAt }) => useAutoRetry(failedAt, PLACE, retry), {
      initialProps: { failedAt: first },
    });
    expect(result.current).toBe(first + AUTO_RETRY_MS[0]!);
    await pass(AUTO_RETRY_MS[0]! - 1000);
    expect(retry).not.toHaveBeenCalled();
    await pass(1000);
    expect(retry).toHaveBeenCalledTimes(1);
    // The try has not failed yet — the index keeps its old failure while a new request runs: no
    // countdown and no second try, however long it takes.
    expect(result.current).toBeNull();
    await pass(10 * 60_000, 5000);
    expect(retry).toHaveBeenCalledTimes(1);
    // Each new failure waits the next pause, counted from it.
    for (let i = 1; i < AUTO_RETRY_MS.length; i++) {
      const failedAt = Date.now();
      rerender({ failedAt });
      expect(result.current).toBe(failedAt + AUTO_RETRY_MS[i]!);
      await pass(AUTO_RETRY_MS[i]! - 1000);
      expect(retry).toHaveBeenCalledTimes(i);
      await pass(1000);
      expect(retry).toHaveBeenCalledTimes(i + 1);
    }
    // Out of automatic tries: the button's turn.
    rerender({ failedAt: Date.now() });
    expect(result.current).toBeNull();
    await pass(10 * 60_000, 5000);
    expect(retry).toHaveBeenCalledTimes(AUTO_RETRY_MS.length);
  });

  test('a page hidden past several due times asks once when it is looked at again', async () => {
    const retry = vi.fn();
    const failedAt = Date.now();
    renderHook(() => useAutoRetry(failedAt, PLACE, retry));
    act(() => setVisibility('hidden'));
    // The phone stays locked past the 30 s, 1 min and 2 min marks.
    await pass(5 * 60_000, 5000);
    expect(retry).not.toHaveBeenCalled();
    act(() => setVisibility('visible'));
    // Small steps: the tries already due used to fire one after another within milliseconds.
    await pass(1000, 5);
    expect(retry).toHaveBeenCalledTimes(1);
    await pass(10 * 60_000, 5000);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('offline: no countdown and no tries; back online: one try at once, and the first pause again after it fails', async () => {
    online = false;
    renderAfterEachOnlineListener();
    const retry = vi.fn();
    const { result, rerender } = renderHook(({ failedAt }) => useAutoRetry(failedAt, PLACE, retry), {
      initialProps: { failedAt: Date.now() },
    });
    for (let passed = 0; passed < 10 * 60_000; passed += 30_000) {
      expect(result.current).toBeNull();
      await pass(30_000, 5000);
    }
    expect(retry).not.toHaveBeenCalled();
    await comeOnline();
    expect(retry).toHaveBeenCalledTimes(1);
    // While that try runs, the countdown waits from the comeback, not from the old failure.
    expect(result.current).toBe(Date.now() + AUTO_RETRY_MS[0]!);
    // That try fails a second later: the coming back used no automatic try, so 30 s from this failure.
    await pass(1000);
    const failedAt = Date.now();
    rerender({ failedAt });
    expect(result.current).toBe(failedAt + AUTO_RETRY_MS[0]!);
    await pass(AUTO_RETRY_MS[0]! - 1000);
    expect(retry).toHaveBeenCalledTimes(1);
    await pass(1000);
    expect(retry).toHaveBeenCalledTimes(2);
  });

  // Right after the test that wraps `online` listeners: its hook is gone, so is every wrapper.
  test('the wrapped `online` listeners leave with their test: a later comeback runs none of them', () => {
    const before = wrapperRuns;
    window.dispatchEvent(new Event('online'));
    expect(wrapperRuns).toBe(before);
  });

  test('a comeback from before the hook was mounted does not count, even with the clock set back since', () => {
    window.dispatchEvent(new Event('online'));
    // The device's clock is corrected an hour back (or a test starts its own clock afresh).
    vi.setSystemTime(Date.now() - 60 * 60_000);
    const failedAt = Date.now();
    const { result } = renderHook(() => useAutoRetry(failedAt, PLACE, vi.fn()));
    expect(result.current).toBe(failedAt + AUTO_RETRY_MS[0]!);
  });
});
