import { LoaderCircle } from 'lucide-react';
import { EmptyState } from '../../../components/ui';
import { MISSING_DATA_MESSAGE } from '../../data';
import './common.css';

type Props = { kind: 'loading' } | { kind: 'error'; message: string; onRetry?: () => void };

/**
 * Baza produktów jeszcze się wczytuje albo nie wczytała się wcale — w stroju pustego stanu
 * aplikacji (`.empty`). Strona woła go tak, jak Produkty PL, i podaje `retry` z `useDataset`:
 *
 *   if (data.status === 'loading') return <StatusScreen kind="loading" />;
 *   if (data.status === 'error') return <StatusScreen kind="error" message={data.message} onRetry={data.retry} />;
 */
export function StatusScreen(props: Props) {
  if (props.kind === 'loading') {
    return (
      <div className="empty fd-status" role="status">
        <LoaderCircle className="fd-spin" size={20} strokeWidth={2} aria-hidden />
        Wczytywanie produktów…
      </div>
    );
  }
  // Bez bazy w tej wersji aplikacji ponowna próba nic nie da — przycisk tylko przy błędzie sieci albo pliku.
  const retry = props.onRetry && props.message !== MISSING_DATA_MESSAGE ? props.onRetry : undefined;
  return (
    <div role="alert">
      <EmptyState
        title="Nie można wyświetlić produktów"
        text={props.message}
        action={
          retry && (
            <button type="button" className="btn sm" onClick={retry}>
              Spróbuj ponownie
            </button>
          )
        }
      />
    </div>
  );
}
