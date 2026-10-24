// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

/** `location.reload` jako szpieg (jsdom strony nie przeładowuje); reszta adresu jak była. */
function spyReload() {
  const reload = vi.fn();
  const real = window.location;
  vi.stubGlobal(
    'location',
    new Proxy(
      {},
      {
        get: (_, key) => {
          if (key === 'reload') return reload;
          const value: unknown = Reflect.get(real, key);
          return typeof value === 'function' ? value.bind(real) : value;
        },
      },
    ),
  );
  return reload;
}

/** Świeży moduł z paczką menu, która się nie wczytuje (jak offline przed pierwszym zapisaniem). */
async function withFailingCatalog() {
  vi.resetModules();
  vi.doMock('../restaurants/catalog', () => {
    throw new TypeError('Failed to fetch dynamically imported module');
  });
  return import('./useRestaurants');
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
}

afterEach(() => {
  vi.doUnmock('../restaurants/catalog');
  vi.unstubAllGlobals();
  setOnline(true);
});

describe('useRestaurants: „Spróbuj ponownie” po nieudanej paczce menu', () => {
  test('z siecią przeładowuje stronę: Chromium i WebKit trzymają nieudany import do końca jej życia', async () => {
    const reload = spyReload();
    const { useRestaurants } = await withFailingCatalog();
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('bez sieci nie przeładowuje (strona spoza service workera skończyłaby na stronie błędu przeglądarki): próbuje na miejscu', async () => {
    const reload = spyReload();
    setOnline(false);
    const { useRestaurants } = await withFailingCatalog();
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(reload).not.toHaveBeenCalled();
  });
});
