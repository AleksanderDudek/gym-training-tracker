import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { captureScreen, feedbackContext, imageFromFile, sendFeedback } from '../feedback';
import type { SendResult } from '../feedback';
import { text } from '../i18n';
import type { AppState } from '../types';

/**
 * Okno „Napisz do autora”: e-mail, wiadomość i zrzut ekranu.
 *
 * Zrzut robi się sam, w tle, z ekranu pod oknem — okno ma `data-capture="off"`, więc go na
 * zdjęciu nie ma. Można go odznaczyć albo podmienić obrazem z galerii. Informacje techniczne
 * jadą razem z wiadomością; jedna linijka mówi o tym od razu, a szczegóły są pod rozwinięciem —
 * bez tego wiadomość nie byłaby uczciwa wobec obietnicy „bez śledzenia” z wprowadzenia.
 * Samo okno nie trafia do śladu (`data-trail="off"`): wpisywanie wiadomości to nie krok
 * do odtworzenia.
 */

const T = text({
  pl: {
    fail: {
      offline: 'Brak połączenia. Wiadomość została w okienku — wyślij, gdy wróci zasięg.',
      limit: 'Za dużo wiadomości w ciągu godziny. Spróbuj za chwilę — ta poczeka w okienku.',
      invalid: 'Sprawdź adres e-mail i treść — coś się nie zgadza.',
      error: 'Nie udało się wysłać. Spróbuj jeszcze raz za chwilę.',
    } as Record<Exclude<SendResult, 'ok'>, string>,
    notImage: 'Tego pliku nie da się odczytać jako obrazu.',
    tooShort: 'Napisz choć kilka słów.',
    title: 'Napisz do autora',
    lead: 'Uwaga, pomysł albo błąd — wiadomość trafia prosto do autora.',
    email: 'e-mail — jeśli chcesz odpowiedzi',
    message: 'wiadomość',
    shooting: 'Robię zrzut tego ekranu…',
    noShot: 'Zrzutu nie udało się zrobić — możesz dołączyć obraz z galerii.',
    preview: 'Podgląd dołączanego obrazu',
    attachShot: 'Dołącz zrzut ekranu, z którego piszesz',
    attachFile: 'Dołącz wybrany obraz',
    otherImage: 'Inny obraz z galerii',
    image: 'Obraz z galerii',
    tech: 'Razem z wiadomością wysyłam informacje techniczne, które pomagają odtworzyć problem.',
    what: 'Co dokładnie',
    details:
      'Ekran, z którego piszesz; czas tej wizyty; kolejne ekrany, stuknięcia i błędy aplikacji (liczby zamienione na #); przeglądarkę, rozmiar ekranu i strefę czasową; liczbę zapisanych treningów i nazwę planu. Bez wyników, wag i historii. Ślad istnieje tylko w pamięci tej karty i wychodzi wyłącznie z wiadomością. Adres e-mail służy tylko do odpowiedzi.',
    cancel: 'Anuluj',
    sending: 'Wysyłam…',
    send: 'Wyślij',
  },
  en: {
    fail: {
      offline: 'No connection. Your message is still in the box — send it when you’re back online.',
      limit: 'Too many messages in an hour. Try again in a moment — this one will wait in the box.',
      invalid: 'Check the email address and the message — something isn’t right.',
      error: 'Couldn’t send. Try again in a moment.',
    },
    notImage: 'This file can’t be read as an image.',
    tooShort: 'Write at least a few words.',
    title: 'Write to the author',
    lead: 'Feedback, an idea or a bug — your message goes straight to the author.',
    email: 'email — if you’d like a reply',
    message: 'message',
    shooting: 'Taking a screenshot of this screen…',
    noShot: 'Couldn’t take a screenshot — you can attach an image from your gallery.',
    preview: 'Preview of the attached image',
    attachShot: 'Attach a screenshot of the screen you’re writing from',
    attachFile: 'Attach the chosen image',
    otherImage: 'Another image from the gallery',
    image: 'Image from the gallery',
    tech: 'Along with your message I send technical details that help reproduce the problem.',
    what: 'What exactly',
    details:
      'The screen you’re writing from; how long this visit has lasted; the screens, taps and app errors along the way (numbers replaced with #); your browser, screen size and time zone; the number of logged workouts and the plan’s name. No results, weights or history. The trace exists only in this tab’s memory and leaves only with your message. Your email address is used only to reply.',
    cancel: 'Cancel',
    sending: 'Sending…',
    send: 'Send',
  },
});

const FAIL: Record<Exclude<SendResult, 'ok'>, string> = T.fail;

type Shot = { state: 'pending' } | { state: 'none' } | { state: 'ready'; url: string; source: 'screen' | 'file' };

export function FeedbackDialog({
  state,
  onClose,
  onSent,
}: {
  state: AppState;
  onClose: () => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [website, setWebsite] = useState('');
  const [shot, setShot] = useState<Shot>({ state: 'pending' });
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kontekst z chwili otwarcia: ekran, z którego ktoś pisze, a nie okno wiadomości.
  const context = useRef(feedbackContext(state));
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    void captureScreen().then((url) => live && setShot(url ? { state: 'ready', url, source: 'screen' } : { state: 'none' }));
    area.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => {
      live = false;
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const url = await imageFromFile(f);
    if (url) {
      setShot({ state: 'ready', url, source: 'file' });
      setAttach(true);
    } else setError(T.notImage);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 3) {
      setError(T.tooShort);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await sendFeedback({
      email: email.trim(),
      text: text.trim(),
      screenshot: attach && shot.state === 'ready' ? shot.url : null,
      context: context.current,
      website,
    });
    setBusy(false);
    if (res === 'ok') onSent();
    else setError(FAIL[res]);
  };

  return (
    <div className="fb" role="dialog" aria-modal="true" aria-labelledby="fb-title" data-capture="off" data-trail="off">
      <form className="fb-box" onSubmit={submit} noValidate>
        <h2 id="fb-title">{T.title}</h2>
        <p className="tight">{T.lead}</p>

        <label className="fld">
          <span>{T.email}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="fld">
          <span>{T.message}</span>
          <textarea ref={area} rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="fb-shot">
          {shot.state === 'pending' && <p className="tight">{T.shooting}</p>}
          {shot.state === 'none' && <p className="tight">{T.noShot}</p>}
          {shot.state === 'ready' && (
            <label className="fb-shot-row">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
              <img src={shot.url} alt={T.preview} />
              <span>{shot.source === 'screen' ? T.attachShot : T.attachFile}</span>
            </label>
          )}
          <label className="btn ghost sm fb-file">
            {shot.state === 'ready' ? T.otherImage : T.image}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </div>

        {/* Pułapka na boty: człowiek tego pola nie widzi i go nie wypełni. */}
        <input
          className="fb-hp"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />

        <div className="hint fb-note">
          {T.tech}
          <details>
            <summary>{T.what}</summary>
            {T.details}
          </details>
        </div>

        {error && <p className="tight warnline">{error}</p>}

        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={onClose}>
            {T.cancel}
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? T.sending : T.send}
          </button>
        </div>
      </form>
    </div>
  );
}
