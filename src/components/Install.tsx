import { Icon } from './icons';
import type { InstallPlace } from '../install';

/**
 * Pasek pod paskiem aplikacji: „dodaj do ekranu początkowego” — tylko na iPhonie i iPadzie poza
 * aplikacją z ikony (`src/install.ts`). Stoi w miejscu paska wsparcia i wygląda jak on, tylko
 * w kolorze informacji, nie prośby: ochrona danych idzie przed kawą. Cały otwiera instrukcję,
 * a × chowa go na stałe — instrukcja zostaje w Ustawieniach. Nie w trakcie treningu i nie pod
 * wprowadzeniem.
 */
export function InstallStrip({ onOpen, onHide }: { onOpen: () => void; onHide: () => void }) {
  return (
    <div className="strip install">
      <button className="strip-link" onClick={onOpen} aria-haspopup="dialog">
        <span className="strip-face" aria-hidden="true">
          <Icon name="share" size={24} />
        </span>
        <span className="strip-text">Dodaj do ekranu początkowego — dane będą bezpieczne.</span>
        <span className="strip-cta">Jak?</span>
      </button>
      <button
        className="strip-close"
        onClick={onHide}
        aria-label="Schowaj podpowiedź o ekranie początkowym"
        title="Nie pokazuj więcej"
      >
        ×
      </button>
    </div>
  );
}

/** Pierwszy krok zależy od tego, gdzie strona jest otwarta. */
const FIRST: Record<InstallPlace, string> = {
  safari: 'Stuknij Udostępnij (w nowszym iOS najpierw „⋯” przy pasku adresu).',
  browser: 'Stuknij Udostępnij — w pasku adresu albo w menu „⋯”.',
  'in-app': 'Otwórz tę stronę w Safari (menu „⋯” w rogu) — z wnętrza innej aplikacji nie da się jej dodać. Tam stuknij Udostępnij.',
};

/**
 * Instrukcja w oknie: trzy kroki, po co to jest i jak zabrać zapisy z karty — aplikacja z ikony
 * ma własne miejsce na dane i zaczyna od zera.
 */
export function InstallSteps({ place, reminders }: { place: InstallPlace; reminders: boolean }) {
  return (
    <div className="install-steps">
      <ol>
        <li>
          <span className="install-share" aria-hidden="true">
            <Icon name="share" size={20} />
          </span>
          {FIRST[place]}
        </li>
        <li>
          Wybierz <b>Do ekranu początkowego</b> (niżej na liście) i <b>Dodaj</b>.
        </li>
        <li>Otwieraj GYM TRACKER z nowej ikony.</li>
      </ol>
      <p>
        <b>Po co:</b> Safari może skasować dane strony, której nie otwierasz przez tydzień — także treningi
        i dziennik jedzenia. Z ikony nic nie znika{reminders ? ', a aplikacja może przypominać o treningu' : ''}.
      </p>
      <p>
        <b>Masz już tu zapisy?</b> Aplikacja z ikony zaczyna od zera. Ustawienia → Kopia danych: tu{' '}
        <b>Eksportuj plik</b>, tam <b>Importuj plik</b>.
      </p>
    </div>
  );
}
