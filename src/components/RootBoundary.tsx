import { Component, type ReactNode } from 'react';
import { lookForFix, reloadFresh } from '../pwa';
import { text } from '../i18n';

const T = text({
  pl: {
    title: 'Coś poszło nie tak',
    text: 'Aplikacja natknęła się na błąd. Zapisane treningi i dziennik jedzenia zostają w przeglądarce — odświeżenie ich nie rusza. „Odśwież” wczyta aplikację od nowa, a jeśli jest już poprawiona wersja — od razu ją.',
    refreshing: 'Odświeżam…',
    refresh: 'Odśwież',
  },
  en: {
    title: 'Something went wrong',
    text: 'The app ran into an error. Your saved workouts and food diary stay in the browser — refreshing doesn’t touch them. “Refresh” reloads the app, and if a fixed version is already out, it loads that straight away.',
    refreshing: 'Refreshing…',
    refresh: 'Refresh',
  },
});

/**
 * Granica błędu wokół całej aplikacji — ostatnia linia, gdy wywróci się coś poza zakładką Jedzenie
 * (ta ma własną, `LoadBoundary`). Bez niej błąd w renderze zostawiałby białą stronę, a nowa wersja
 * z poprawką czekałaby na całkowite zamknięcie aplikacji: zapisana strona wczytywałaby wciąż tę
 * samą, zepsutą.
 *
 * Ekran jest celowo goły: zwykły znacznik i klasy z arkusza, bez stanu aplikacji, kontekstu i jej
 * komponentów — każdy z nich mógłby być tym, co się wywróciło. Po błędzie od razu pyta o nowszą
 * wersję (`lookForFix`), a „Odśwież” ją wpuszcza (`reloadFresh`). Danych nie rusza: trening
 * i dziennik jedzenia leżą w przeglądarce i czekają na wersję, która je otworzy.
 */
export class RootBoundary extends Component<{ children: ReactNode }, { failed: boolean; busy: boolean }> {
  override state = { failed: false, busy: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    // Poprawka mogła już wyjść — niech instaluje się w tle, zanim ktoś przeczyta komunikat.
    lookForFix();
  }

  private refresh = () => {
    this.setState({ busy: true });
    void reloadFresh();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="wrap" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top))' }}>
        <div className="empty with-cast" role="alert">
          <b className="empty-title">{T.title}</b>
          <span className="empty-text">{T.text}</span>
          <span className="empty-action">
            <button type="button" className="btn" onClick={this.refresh} disabled={this.state.busy}>
              {this.state.busy ? T.refreshing : T.refresh}
            </button>
          </span>
        </div>
      </main>
    );
  }
}
