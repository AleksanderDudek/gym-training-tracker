import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { SETTINGS_PATH, goBack } from '../routing';
import { SupportStrip } from './Support';
import { ClockPill } from './SessionClock';

/**
 * Pasek aplikacji — przyklejony do góry, jak w każdej aplikacji mobilnej.
 *
 * Zastąpił wielki nagłówek „GYM TRACKER”, który na każdym ekranie zajmował ćwierć wysokości
 * telefonu, a nie mówił, gdzie się jest. Teraz pasek ma tytuł ekranu, na podstronach strzałkę
 * wstecz po lewej (hierarchia), a zakładki na dole zostają od nawigacji w bok. Po przewinięciu
 * pasek dostaje cień — tak Material 3 i iOS pokazują, że treść wjeżdża pod spód.
 *
 * Pod paskiem, w tym samym przyklejonym bloku, stoi cienki pasek wsparcia. Blok ma margines
 * na wycięcie ekranu (`safe-area-inset-top`), więc w trybie aplikacji nic nie wchodzi pod
 * zegar ani pod aparat.
 */

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return scrolled;
}

/** Znak aplikacji: ten sam co ikona na ekranie głównym telefonu. */
function Logo() {
  return (
    <svg className="appbar-logo" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--steel)" />
      <path
        d="M4.9 10.4v3.2M7.3 8.6v6.8M16.7 8.6v6.8M19.1 10.4v3.2M7.3 12h9.4"
        fill="none"
        stroke="var(--c-orange)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TopBar({
  title,
  subtitle,
  parent,
  strip,
  onSnooze,
  settings,
  onFeedback,
  onContact,
  clock,
}: {
  title: string;
  subtitle?: string | null | undefined;
  /** Dokąd wraca strzałka, gdy nie ma historii w aplikacji. Brak — ekran jest korzeniem zakładki. */
  parent: string | null;
  /** Czy pokazać pasek wsparcia. */
  strip: boolean;
  onSnooze: () => void;
  /** Czy w pasku stoi wejście do ustawień — tylko na korzeniach zakładek. */
  settings: boolean;
  /** Okno „Napisz do autora” — na każdym ekranie, bo liczy się, z którego ktoś pisze. Brak — bez serwera. */
  onFeedback?: (() => void) | undefined;
  /** Okno „Kontakt z autorem” (Instagram, Discord, wsparcie) — tuż przy „Napisz do autora”. Brak — w trakcie treningu. */
  onContact?: (() => void) | undefined;
  /** Start zegara trwającej sesji (ms) — w pasku stoi wtedy licznik czasu treningu. */
  clock?: number | null | undefined;
}) {
  const scrolled = useScrolled();

  return (
    <div className={`topbar${scrolled ? ' scrolled' : ''}${strip ? ' with-strip' : ''}`}>
      <header className="appbar">
        {parent ? (
          <button className="appbar-btn back-btn" onClick={() => goBack(parent)} aria-label="Wstecz">
            <Icon name="back" size={24} />
          </button>
        ) : (
          <Logo />
        )}
        <div className="appbar-titles">
          <h1 className="appbar-title">{title}</h1>
          {subtitle && <div className="appbar-sub">{subtitle}</div>}
        </div>
        {clock != null && <ClockPill begin={clock} />}
        {onContact && (
          <button className="appbar-btn" onClick={onContact} aria-label="Kontakt z autorem" aria-haspopup="dialog">
            <Icon name="contact" size={22} />
          </button>
        )}
        {onFeedback && (
          <button className="appbar-btn" onClick={onFeedback} aria-label="Napisz do autora — uwaga albo błąd">
            <Icon name="feedback" size={22} />
          </button>
        )}
        {settings && (
          <a className="appbar-btn" href={SETTINGS_PATH} aria-label="Ustawienia">
            <Icon name="settings" size={22} />
          </a>
        )}
      </header>
      {strip && <SupportStrip onSnooze={onSnooze} />}
    </div>
  );
}
