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

/**
 * Świeży moduł z paczką menu, która się nie wczytuje — od razu (jak przeglądarka, która trzyma
 * nieudany import) albo po `after` ms (prawdziwa próba przez sieć).
 */
async function withFailingCatalog(after = 0) {
  vi.resetModules();
  vi.doMock('../restaurants/catalog', async () => {
    if (after) await new Promise((wait) => setTimeout(wait, after));
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
  test('próbuje na miejscu; gdy przeglądarka odmawia od ręki (trzyma nieudany import), a serwer odpowiada — przeładowuje stronę', async () => {
    const reload = spyReload();
    const head = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', head);
    const { useRestaurants } = await withFailingCatalog();
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // Strona spoza service workera przeładowuje się dopiero, gdy serwer odpowiada.
    expect(head).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'HEAD', cache: 'no-store' }));
  });

  test('serwer nie odpowiada (łącze martwe, choć przeglądarka mówi, że jest sieć): bez przeładowania, które skończyłoby na stronie błędu', async () => {
    const reload = spyReload();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { useRestaurants } = await withFailingCatalog();
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('error'));
    await new Promise((settled) => setTimeout(settled, 20));
    expect(reload).not.toHaveBeenCalled();
  });

  test('serwer przyjmuje połączenie, ale milczy: po chwili przycisk wraca, bez przeładowania — nie „Wczytuję…” bez końca', async () => {
    const reload = spyReload();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      ),
    );
    const { useRestaurants } = await withFailingCatalog();
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'));
    vi.useFakeTimers();
    try {
      act(() => result.current.retry());
      await act(() => vi.advanceTimersByTimeAsync(4000));
      expect(result.current.status).toBe('loading');
      await act(() => vi.advanceTimersByTimeAsync(1500));
      expect(result.current.status).toBe('error');
      expect(reload).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('prawdziwa, nieudana próba przez sieć (nie od ręki): błąd na miejscu, bez przeładowania — Firefox pyta naprawdę', async () => {
    const reload = spyReload();
    const { useRestaurants } = await withFailingCatalog(400);
    const { result } = renderHook(() => useRestaurants());
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 2000 });
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 2000 });
    expect(reload).not.toHaveBeenCalled();
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
