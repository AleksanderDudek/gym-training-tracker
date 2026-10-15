import { useEffect, useMemo, useRef } from 'react';
import { contactLinks, inPoland, shortUrl } from '../contact';

/**
 * Odnośniki kontaktowe: Instagram, Discord (w Polsce) i wsparcie (polskie albo międzynarodowe).
 * Ta sama lista stoi w oknie z paska aplikacji i w Ustawieniach. Każdy odnośnik pokazuje adres,
 * dokąd prowadzi, i otwiera się w nowej karcie.
 */
export function ContactLinks({ pl }: { /** Polska albo nie; brak — według przeglądarki. */ pl?: boolean }) {
  const here = pl ?? inPoland();
  const links = useMemo(() => contactLinks(here), [here]);
  return (
    <ul className="contact-list">
      {links.map((l) => (
        <li key={l.id}>
          <a className={`contact-link ${l.id}`} href={l.href} target="_blank" rel="noopener noreferrer">
            <span className="contact-name">{l.name}</span>
            <span className="contact-note">{l.note}</span>
            <span className="contact-url">
              {shortUrl(l.href)}
              <span className="sr-only"> (otwiera się w nowej karcie)</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Okno „Kontakt z autorem” — druga droga obok „Napisz do autora”: na telefonie od dołu, jak arkusz,
 * wyżej wyśrodkowane, tak jak okno wiadomości. Escape i stuknięcie w tło zamykają, fokus wraca
 * na przycisk w pasku. Gdy działa serwer wiadomości, okno podaje też wiadomość w aplikacji.
 */
export function ContactDialog({
  onClose,
  onFeedback,
  pl,
}: {
  onClose: () => void;
  /** Przejście do „Napisz do autora”. Brak — aplikacja działa bez serwera wiadomości. */
  onFeedback?: (() => void) | undefined;
  pl?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box.current?.querySelector<HTMLElement>('a[href], button')?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('keydown', esc);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fb"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fb-box" ref={box}>
        <h2 id="ct-title">Kontakt z autorem</h2>
        <p className="tight">Poza aplikacją — tam, gdzie wygodniej.</p>
        <ContactLinks {...(pl === undefined ? {} : { pl })} />
        <div className="btnrow">
          <button type="button" className="btn ghost" onClick={onClose}>
            Zamknij
          </button>
          {onFeedback && (
            <button type="button" className="btn" onClick={onFeedback}>
              Napisz w aplikacji
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
