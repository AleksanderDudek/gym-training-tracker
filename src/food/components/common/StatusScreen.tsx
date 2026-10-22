import { LoaderCircle } from 'lucide-react';
import { text } from '../../../i18n';
import { EmptyState } from '../../../components/ui';
import { MISSING_DATA_MESSAGE } from '../../data';
import './common.css';

const T = text({
  pl: { loading: 'Wczytywanie produktów…', error: 'Nie można wyświetlić produktów', retry: 'Spróbuj ponownie' },
  en: { loading: 'Loading products…', error: 'Can’t show the products', retry: 'Try again' },
});

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
        {T.loading}
      </div>
    );
  }
  // Bez bazy w tej wersji aplikacji ponowna próba nic nie da — przycisk tylko przy błędzie sieci albo pliku.
  const retry = props.onRetry && props.message !== MISSING_DATA_MESSAGE ? props.onRetry : undefined;
  return (
    <div role="alert">
      <EmptyState
        title={T.error}
        text={props.message}
        action={
          retry && (
            <button type="button" className="btn sm" onClick={retry}>
              {T.retry}
            </button>
          )
        }
      />
    </div>
  );
}
