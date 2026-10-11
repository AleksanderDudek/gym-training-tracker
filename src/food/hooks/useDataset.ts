import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadDataset, loadedDataset } from '../data';
import type { Dataset, IndexedProduct } from '../lib/types';

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dataset: Dataset; products: IndexedProduct[] };

/** Stan bazy produktów i ponowna próba po błędzie. */
export type DatasetResult = DatasetState & { retry: () => void };

function initial(): DatasetState {
  const ready = loadedDataset();
  return ready ? { status: 'ready', ...ready } : { status: 'loading' };
}

/**
 * Baza produktów dla ekranu jedzenia. Pobiera ją `loadDataset` — raz na życie strony, więc
 * przejście z Produktów do Przepisów nie pobiera niczego drugi raz, a już wczytana baza jest
 * gotowa od pierwszego renderu.
 */
export function useDataset(): DatasetResult {
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadDataset().then(
      ({ dataset, products }) => {
        if (live) setState({ status: 'ready', dataset, products });
      },
      (error: unknown) => {
        if (live) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
