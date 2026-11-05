import { useEffect, useState } from 'react';
import { LANG } from '../../i18n';
import type { CatalogRow } from './derive';

/**
 * Leniwe ładowanie katalogu: spis (~220 kB, 31 kB gzip) i kroki w języku strony (~650 kB,
 * 93 kB gzip) to osobne kawałki, ściągane dopiero, gdy ktoś otworzy katalog, stronę ćwiczenia
 * z katalogu albo arkusz techniki. Obietnice są wspólne, więc plik idzie przez sieć raz.
 */

let rows: Promise<CatalogRow[]> | null = null;
let steps: Promise<Record<string, string[]>> | null = null;

export function loadCatalog(): Promise<CatalogRow[]> {
  rows ??= import('./index.json').then((m) => m.default as CatalogRow[]);
  rows.catch(() => {
    rows = null;
  });
  return rows;
}

export function loadSteps(): Promise<Record<string, string[]>> {
  steps ??= (LANG === 'pl' ? import('./steps.pl.json') : import('./steps.en.json')).then(
    (m) => m.default as Record<string, string[]>,
  );
  steps.catch(() => {
    steps = null;
  });
  return steps;
}

export type Loaded<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error' };

/** Hook na jedną z obietnic wyżej; `retry` ponawia po błędzie sieci. */
export function useLoaded<T>(load: () => Promise<T>, enabled = true): Loaded<T> & { retry: () => void } {
  const [res, setRes] = useState<Loaded<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then(
      (value) => live && setRes({ state: 'ready', value }),
      () => live && setRes({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [load, enabled, attempt]);
  return {
    ...res,
    retry: () => {
      setRes({ state: 'loading' });
      setAttempt((a) => a + 1);
    },
  };
}
