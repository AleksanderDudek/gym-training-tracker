import type { ReactNode } from 'react';
import { Icon } from './icons';
import { text } from '../i18n';
import type { InstallPlace } from '../install';

const T = text({
  pl: {
    strip: 'Dodaj do ekranu początkowego — dane będą bezpieczne.',
    how: 'Jak?',
    hide: 'Schowaj podpowiedź o ekranie początkowym',
    never: 'Nie pokazuj więcej',
    first: {
      safari: 'Stuknij Udostępnij (w nowszym iOS najpierw „⋯” przy pasku adresu).',
      browser: 'Stuknij Udostępnij — w pasku adresu albo w menu „⋯”.',
      'in-app': 'Otwórz tę stronę w Safari (menu „⋯” w rogu) — z wnętrza innej aplikacji nie da się jej dodać. Tam stuknij Udostępnij.',
    } as Record<InstallPlace, string>,
    choose: (
      <>
        Wybierz <b>Do ekranu początkowego</b> (niżej na liście) i <b>Dodaj</b>.
      </>
    ) as ReactNode,
    open: 'Otwieraj GYM TRACKER z nowej ikony.',
    why: (reminders: boolean): ReactNode => (
      <>
        <b>Po co:</b> Safari może skasować dane strony, której nie otwierasz przez tydzień — także treningi
        i dziennik jedzenia. Z ikony nic nie znika{reminders ? ', a aplikacja może przypominać o treningu' : ''}.
      </>
    ),
    move: (
      <>
        <b>Masz już tu zapisy?</b> Aplikacja z ikony zaczyna od zera. Ustawienia → Kopia danych: tu{' '}
        <b>Eksportuj plik</b>, tam <b>Importuj plik</b>.
      </>
    ) as ReactNode,
  },
  en: {
    strip: 'Add to your Home Screen — your data will be safe.',
    how: 'How?',
    hide: 'Hide the Home Screen tip',
    never: 'Don’t show again',
    first: {
      safari: 'Tap Share (on newer iOS, tap “⋯” next to the address bar first).',
      browser: 'Tap Share — in the address bar or in the “⋯” menu.',
      'in-app': 'Open this page in Safari (the “⋯” menu in the corner) — it can’t be added from inside another app. Then tap Share there.',
    },
    choose: (
      <>
        Choose <b>Add to Home Screen</b> (further down the list), then <b>Add</b>.
      </>
    ),
    open: 'Open GYM TRACKER from the new icon from now on.',
    why: (reminders: boolean): ReactNode => (
      <>
        <b>Why:</b> Safari may delete the data of a site you haven’t opened for a week — your workouts and food diary
        included. Nothing disappears from the icon app{reminders ? ', and the app can remind you to train' : ''}.
      </>
    ),
    move: (
      <>
        <b>Already have data here?</b> The icon app starts from scratch. Settings → Data backup: tap{' '}
        <b>Export file</b> here, then <b>Import file</b> there.
      </>
    ),
  },
});

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
        <span className="strip-text">{T.strip}</span>
        <span className="strip-cta">{T.how}</span>
      </button>
      <button
        className="strip-close"
        onClick={onHide}
        aria-label={T.hide}
        title={T.never}
      >
        ×
      </button>
    </div>
  );
}

/** Pierwszy krok zależy od tego, gdzie strona jest otwarta. */
const FIRST: Record<InstallPlace, string> = T.first;

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
        <li>{T.choose}</li>
        <li>{T.open}</li>
      </ol>
      <p>{T.why(reminders)}</p>
      <p>{T.move}</p>
    </div>
  );
}
