import { Component, type ReactNode } from 'react';
import { trail } from '../trail';
import { EmptyState } from './ui';

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
        title={`Nie udało się wczytać ${this.props.what}`}
        text="Sprawdź połączenie z internetem i odśwież stronę. Treningi działają bez zmian."
        cast={{ who: 'siwy', mood: 'calm' }}
        action={
          <button type="button" className="btn sm" onClick={() => window.location.reload()}>
            Odśwież
          </button>
        }
      />
    );
  }
}
