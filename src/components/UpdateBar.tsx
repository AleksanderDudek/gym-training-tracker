import { useState, useSyncExternalStore } from 'react';
import { applyUpdate, needRefresh, subscribe } from '../pwa';
import { text } from '../i18n';

const T = text({
  pl: { text: 'Nowa wersja aplikacji.', refresh: 'Odśwież', later: 'Później' },
  en: { text: 'A new version of the app is ready.', refresh: 'Refresh', later: 'Later' },
});

/**
 * Pasek „Nowa wersja aplikacji”. Service worker rejestruje `main.tsx` (`src/pwa.ts`), zanim cokolwiek
 * się wyrenderuje; pasek tylko czyta, czy nowa wersja czeka — w trybie deweloperskim nigdy.
 *
 * Nowa wersja nie wchodzi sama: czeka na „Odśwież”, a do tego czasu działa stara, ze swoimi
 * plikami. `hold` chowa pasek na czas treningu — przeładowanie w środku serii zgubiłoby miejsce,
 * a przycisk pod kciukiem łatwo trącić. Po zamknięciu sesji pasek wraca sam.
 */
export function UpdateBar({ hold }: { hold: boolean }) {
  // „Później” chowa pasek do następnego uruchomienia aplikacji.
  const [later, setLater] = useState(false);
  const waiting = useSyncExternalStore(subscribe, needRefresh, () => false);

  if (!waiting || hold || later) return null;
  return (
    <div className="updatebar" role="status">
      <span className="updatebar-text">{T.text}</span>
      <button className="btn sm" onClick={() => void applyUpdate()}>
        {T.refresh}
      </button>
      <button className="btn sm ghost" onClick={() => setLater(true)}>
        {T.later}
      </button>
    </div>
  );
}
