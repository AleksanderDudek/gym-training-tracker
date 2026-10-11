import type { ReactNode } from 'react';
import { EmptyState } from '../../components/ui';
import { MISSING_DATA_MESSAGE } from '../data';
import { useDataset } from '../hooks/useDataset';

/**
 * Zaślepki stron jedzenia na czas, zanim przyjdą prawdziwe ekrany. Każda strona ma już własny
 * plik i własną paczkę, a ta pokazuje, że droga danych działa od początku do końca: most do
 * treningów, IndexedDB diety i baza produktów. Do usunięcia razem z ostatnią zaślepką.
 */

export function Placeholder({ children }: { children: ReactNode }) {
  return <div className="wrap">{children}</div>;
}

/** Stan bazy produktów: wczytywanie, błąd z ponowną próbą albo liczba produktów. */
export function DatasetStatus({ what }: { what: string }) {
  const data = useDataset();
  if (data.status === 'loading') return <div className="empty">Wczytuję bazę produktów…</div>;
  if (data.status === 'error')
    return (
      <EmptyState
        title="Baza produktów nie wczytała się"
        text={data.message}
        cast={{ who: 'gustaw', mood: 'longing' }}
        action={
          // Bez bazy w tej wersji ponowna próba nic nie da — przycisk tylko przy błędzie sieci albo pliku.
          data.message === MISSING_DATA_MESSAGE ? undefined : (
            <button type="button" className="btn sm" onClick={data.retry}>
              Spróbuj ponownie
            </button>
          )
        }
      />
    );
  return (
    <Placeholder>
      <p className="hint">
        Baza gotowa: {data.products.length.toLocaleString('pl-PL')} produktów. {what}
      </p>
    </Placeholder>
  );
}
