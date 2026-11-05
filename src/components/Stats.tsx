import { useState } from 'react';
import { consent, gpc, setConsent, statsAvailable } from '../stats';
import type { Consent } from '../stats';
import { apiConfigured } from '../api';
import type { AppState } from '../types';
import { text } from '../i18n';

const T = text({
  pl: {
    title: 'Anonimowe statystyki',
    askTitle: 'Pomożesz ulepszać aplikację?',
    ask: 'Mogę liczyć, których ekranów i funkcji używasz — bez twoich danych, bez konta i bez identyfikatora. Wpisane wagi, posiłki, badania i notatki nigdy nie wychodzą z telefonu.',
    yes: 'Tak, włącz',
    no: 'Nie, dziękuję',
    details: 'Co dokładnie wysyłam',
    on: 'Włączone. Dziękuję — to pomaga zdecydować, co poprawiać.',
    off: 'Wyłączone. Nic nie jest wysyłane.',
    unset: 'Jeszcze nie wybrano — nic nie jest wysyłane.',
    turnOn: 'Włącz',
    turnOff: 'Wyłącz',
    gpc: 'Twoja przeglądarka ma włączone „Global Privacy Control”, więc statystyki są wyłączone i nie da się ich włączyć.',
    sentTitle: 'Wysyłam tylko liczniki z tej listy:',
    sent: [
      'otwarcie aplikacji (raz dziennie): zainstalowana czy w przeglądarce, język;',
      'w ilu dniach tygodnia aplikacja była otwarta — jako przedział (1, 2, 3–4, 5–7), raz w tygodniu;',
      'czy działa plan, zegarek, telefon, przypomnienia, ćwiczenia z katalogu — tak/nie, raz dziennie;',
      'nazwa otwartego ekranu (np. „dziennik jedzenia”, „atlas”) — bez adresu i bez tego, co na nim jest;',
      'trening rozpoczęty i zamknięty (prowadzony czy lista), otwarte „Jak to zrobić?”, katalog ćwiczeń i dodanie z niego ćwiczenia.',
    ] as readonly string[],
    neverTitle: 'Nigdy nie wysyłam:',
    never: [
      'niczego, co wpisujesz: wag, obwodów, posiłków, kalorii, wyników badań, notatek, zdjęć, nazw treningów;',
      'identyfikatora urządzenia ani ciasteczek — serwer nie wie, które zdarzenia są twoje;',
      'adresu IP (serwer go nie zapisuje), nagrań ekranu ani tego, gdzie stukasz.',
    ] as readonly string[],
    server: 'Serwer dolicza każde zdarzenie do licznika dnia i nic więcej nie przechowuje. Szczegóły w polityce prywatności.',
    privacy: 'Polityka prywatności',
  },
  en: {
    title: 'Anonymous statistics',
    askTitle: 'Will you help improve the app?',
    ask: 'I can count which screens and features you use — without your data, without an account and without an identifier. The weights, meals, lab results and notes you enter never leave your phone.',
    yes: 'Yes, turn it on',
    no: 'No, thanks',
    details: 'What exactly is sent',
    on: 'On. Thank you — it helps decide what to improve.',
    off: 'Off. Nothing is sent.',
    unset: 'Not chosen yet — nothing is sent.',
    turnOn: 'Turn on',
    turnOff: 'Turn off',
    gpc: 'Your browser has “Global Privacy Control” on, so statistics are off and can’t be turned on.',
    sentTitle: 'Only counters from this list are sent:',
    sent: [
      'app opened (once a day): installed or in the browser, language;',
      'how many days a week the app was opened — as a range (1, 2, 3–4, 5–7), once a week;',
      'whether a plan, watch, phone, reminders or catalogue exercises are in use — yes/no, once a day;',
      'the name of the screen you open (e.g. “food diary”, “atlas”) — not its address or what’s on it;',
      'workout started and finished (guided or list), “How do I do it?” opened, the exercise catalogue opened and an exercise added from it.',
    ] as readonly string[],
    neverTitle: 'Never sent:',
    never: [
      'anything you enter: weights, measurements, meals, calories, lab results, notes, photos, workout names;',
      'a device identifier or cookies — the server can’t tell which events are yours;',
      'your IP address (the server doesn’t store it), screen recordings or where you tap.',
    ] as readonly string[],
    server: 'The server adds each event to a daily counter and stores nothing else. Details in the privacy policy.',
    privacy: 'Privacy policy',
  },
});

function Details() {
  return (
    <details className="stats-more">
      <summary>{T.details}</summary>
      <p className="tight">{T.sentTitle}</p>
      <ul>
        {T.sent.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="tight">{T.neverTitle}</p>
      <ul>
        {T.never.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="tight">
        {T.server}{' '}
        <a href="privacy.html" target="_blank" rel="noopener">
          {T.privacy}
        </a>
      </p>
    </details>
  );
}

/**
 * Jednorazowe pytanie na ekranie Dziś — dopiero po pierwszym zamkniętym treningu, nigdy w trakcie.
 * Zgoda na wejściu (opt-in): bez odpowiedzi nic nie jest wysyłane.
 */
export function StatsAsk({ state }: { state: AppState }) {
  const [answer, setAnswer] = useState<Consent>(consent);
  if (!statsAvailable() || answer !== null || !state.log.length || state.session) return null;
  const choose = (v: 'on' | 'off') => {
    setConsent(v);
    setAnswer(v);
  };
  return (
    <div className="grp stats-ask">
      <h2>{T.askTitle}</h2>
      <p className="tight">{T.ask}</p>
      <Details />
      <div className="btnrow">
        <button className="btn sm" onClick={() => choose('on')}>
          {T.yes}
        </button>
        <button className="btn ghost sm" onClick={() => choose('off')}>
          {T.no}
        </button>
      </div>
    </div>
  );
}

/** Karta w Ustawieniach: stan, przełącznik i pełna lista tego, co wychodzi. */
export function StatsCard() {
  const [now, setNow] = useState<Consent>(consent);
  if (!apiConfigured()) return null;
  const blocked = gpc();
  const flip = (v: 'on' | 'off') => {
    setConsent(v);
    setNow(v);
  };
  return (
    <div className="grp" id="statystyki">
      <h2>{T.title}</h2>
      <p className="tight" aria-live="polite">
        {blocked ? T.gpc : now === 'on' ? T.on : now === 'off' ? T.off : T.unset}
      </p>
      {!blocked && (
        <div className="btnrow">
          {now === 'on' ? (
            <button className="btn ghost sm" onClick={() => flip('off')}>
              {T.turnOff}
            </button>
          ) : (
            <button className="btn sm" onClick={() => flip('on')}>
              {T.turnOn}
            </button>
          )}
        </div>
      )}
      <Details />
    </div>
  );
}
