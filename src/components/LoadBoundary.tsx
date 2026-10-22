import { Component, type ReactNode } from 'react';
import { text } from '../i18n';
import { trail } from '../trail';
import { EmptyState } from './ui';

const T = text({
  pl: {
    title: (what: string) => `Nie udało się wczytać ${what}`,
    text: 'Sprawdź połączenie z internetem i odśwież stronę. Treningi działają bez zmian.',
    refresh: 'Odśwież',
  },
  en: {
    title: (what: string) => `Couldn’t load ${what}`,
    text: 'Check your internet connection and refresh the page. Training works as usual.',
    refresh: 'Refresh',
  },
});

/**
 * Granica błędu wokół części ładowanej leniwie (zakładka Jedzenie). Paczka, która nie przyszła
 * (zerwane połączenie przed pierwszym wejściem), albo błąd w jednym z jej ekranów zamyka tylko
 * ten ekran — pasek zakładek i reszta aplikacji zostają. `React.lazy` pamięta nieudany import,
 * więc ponowna próba to przeładowanie strony. Klucz strony w App (`main key`) zakłada nową
 * granicę przy każdym przejściu, więc inny ekran zaczyna bez błędu.
 */
export class LoadBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    // Złapany błąd nie dociera do `window.onerror` — ślad do uwag dostaje go stąd.
    trail.error(error instanceof Error ? error.message : String(error));
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <EmptyState
        title={T.title(this.props.what)}
        text={T.text}
        cast={{ who: 'siwy', mood: 'calm' }}
        action={
          <button type="button" className="btn sm" onClick={() => window.location.reload()}>
            {T.refresh}
          </button>
        }
      />
    );
  }
}
