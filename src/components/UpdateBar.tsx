import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Co ile pytać o nową wersję, gdy aplikacja wisi otwarta godzinami (telefon na stojaku przy ławce). */
const HOUR = 60 * 60 * 1000;

/**
 * Pytanie o nową wersję ustawia się raz na życie strony. Rejestracja żyje dłużej niż komponent,
 * więc ponowne zamontowanie paska dokładałoby kolejny interwał i kolejnego słuchacza.
 */
let watching = false;

/**
 * Pasek „Nowa wersja aplikacji”. Rejestruje też service worker (`src/sw.ts`) — tylko w wersji
 * zbudowanej; w trybie deweloperskim hook jest pusty. O nową wersję pyta przy starcie, po powrocie
 * do aplikacji i co godzinę.
 *
 * Nowa wersja nie wchodzi sama: czeka na „Odśwież”, a do tego czasu działa stara, ze swoimi
 * plikami. `hold` chowa pasek na czas treningu — przeładowanie w środku serii zgubiłoby miejsce,
 * a przycisk pod kciukiem łatwo trącić. Po zamknięciu sesji pasek wraca sam.
 */
export function UpdateBar({ hold }: { hold: boolean }) {
  // „Później” chowa pasek do następnego uruchomienia aplikacji.
  const [later, setLater] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Rejestracja po wczytaniu strony, jak dotąd: zapisywanie powłoki nie konkuruje z pierwszym ekranem.
    immediate: false,
    onRegisteredSW(_url, r) {
      if (!r || watching) return;
      watching = true;
      // Bez sieci pytanie i tak się nie uda — nowa wersja poczeka do następnego razu.
      const check = () => {
        if (navigator.onLine) r.update().catch(() => undefined);
      };
      window.setInterval(check, HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh || hold || later) return null;
  return (
    <div className="updatebar" role="status">
      <span className="updatebar-text">Nowa wersja aplikacji.</span>
      <button className="btn sm" onClick={() => void updateServiceWorker(true)}>
        Odśwież
      </button>
      <button className="btn sm ghost" onClick={() => setLater(true)}>
        Później
      </button>
    </div>
  );
}
