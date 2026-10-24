// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DATASET, INDEXED } from '../test/fixtures';
import { loadDataset, loadedDataset } from '../data';
import { useDataset } from './useDataset';

vi.mock('../data', () => ({ loadDataset: vi.fn(), loadedDataset: vi.fn(() => null) }));

const LOADED = { dataset: DATASET, products: INDEXED };

afterEach(() => {
  vi.mocked(loadDataset).mockReset();
  vi.mocked(loadedDataset).mockReset().mockReturnValue(null);
});

test('najpierw wczytywanie, potem baza z produktami gotowymi do wyszukiwania', async () => {
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  const { result } = renderHook(() => useDataset());
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current).toMatchObject({ dataset: DATASET, products: INDEXED });
});

test('błąd pokazuje komunikat z ładowania, a „Spróbuj ponownie” pobiera jeszcze raz', async () => {
  vi.mocked(loadDataset)
    .mockRejectedValueOnce(new Error('Nie udało się pobrać danych produktów (HTTP 404).'))
    .mockResolvedValueOnce(LOADED);
  const { result } = renderHook(() => useDataset());
  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current).toMatchObject({ message: 'Nie udało się pobrać danych produktów (HTTP 404).' });
  act(() => result.current.retry());
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(loadDataset).toHaveBeenCalledTimes(2);
});

test('baza wczytana wcześniej jest gotowa od pierwszego renderu', () => {
  vi.mocked(loadedDataset).mockReturnValue(LOADED);
  vi.mocked(loadDataset).mockResolvedValue(LOADED);
  const { result } = renderHook(() => useDataset());
  expect(result.current).toMatchObject({ status: 'ready', products: INDEXED });
});

describe('wstrzymana (`enabled: false`)', () => {
  test('nie pobiera, póki wstrzymana; pobiera, gdy przestaje', async () => {
    vi.mocked(loadDataset).mockResolvedValue(LOADED);
    const { result, rerender } = renderHook(({ enabled }) => useDataset(enabled), { initialProps: { enabled: false } });
    await act(() => Promise.resolve());
    expect(loadDataset).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(loadDataset).toHaveBeenCalledTimes(1);
  });

  test('baza wczytana wcześniej jest od razu, także wstrzymana — bez pytania o nią', () => {
    vi.mocked(loadedDataset).mockReturnValue(LOADED);
    const { result } = renderHook(() => useDataset(false));
    expect(result.current).toMatchObject({ status: 'ready', products: INDEXED });
    expect(loadDataset).not.toHaveBeenCalled();
  });

  test('raz ruszona nie przepada, gdy znów wstrzymana: przychodzi i jest', async () => {
    let arrive!: (loaded: typeof LOADED) => void;
    vi.mocked(loadDataset).mockReturnValue(new Promise((resolve) => (arrive = resolve)));
    const { result, rerender } = renderHook(({ enabled }) => useDataset(enabled), { initialProps: { enabled: true } });
    rerender({ enabled: false });
    await act(async () => arrive(LOADED));
    expect(result.current).toMatchObject({ status: 'ready', products: INDEXED });
    expect(loadDataset).toHaveBeenCalledTimes(1);
  });
});
