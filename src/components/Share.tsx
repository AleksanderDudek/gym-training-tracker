import { useRef, useState } from 'react';
import { canShareFiles, download, share, shareCard, shareLinks } from '../engine/share';
import type { ShareSubject } from '../engine/share';

/**
 * Przycisk udostępniania. Obrazek składa się dopiero po kliknięciu — składanie go z góry
 * dla każdej zdobytej odznaki kosztowałoby płótno 1080×1080 za każdym razem, gdy ktoś
 * tylko zamyka okno.
 *
 * Lista serwisów pokazuje się wyłącznie tam, gdzie nie ma systemowego arkusza: na telefonie
 * arkusz zna zainstalowane aplikacje lepiej niż jakakolwiek wpisana na sztywno lista.
 */
export function ShareButton({
  subject,
  medalRef,
  label = 'Udostępnij',
}: {
  subject: ShareSubject;
  /** Medal do wklejenia w kartę. Brak oznacza kartę z samym tytułem i liczbami. */
  medalRef?: React.RefObject<HTMLElement | null> | undefined;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const blob = useRef<Blob | null>(null);

  const build = async (): Promise<Blob | null> => {
    if (blob.current) return blob.current;
    try {
      const svg = medalRef?.current?.querySelector('svg') as SVGSVGElement | null;
      blob.current = await shareCard(subject, svg);
      return blob.current;
    } catch {
      return null;
    }
  };

  const go = async () => {
    setBusy(true);
    setNote(null);
    let res: Awaited<ReturnType<typeof share>>;
    try {
      const png = canShareFiles() ? await build() : null;
      res = await share(subject, png);
    } catch {
      res = 'unsupported';
    } finally {
      // Przycisk wraca do gry niezależnie od tego, co odpowie przeglądarka.
      setBusy(false);
    }

    if (res === 'shared' || res === 'cancelled') return;
    if (res === 'copied') {
      setNote('Skopiowane do schowka.');
      setFallback(true);
      return;
    }
    setNote('Ta przeglądarka nie udostępnia sama — wybierz serwis albo pobierz obrazek.');
    setFallback(true);
  };

  return (
    <div className="share">
      <button className="btn ghost sm" onClick={() => void go()} disabled={busy}>
        {busy ? 'Przygotowuję…' : label}
      </button>

      {note && <p className="share-note">{note}</p>}

      {fallback && (
        <div className="share-more">
          {shareLinks(subject).map((l) => (
            <a key={l.name} className="btn ghost sm" href={l.url} target="_blank" rel="noopener noreferrer">
              {l.name}
            </a>
          ))}
          <button
            className="btn ghost sm"
            onClick={() => void build().then((b) => b && download(b))}
          >
            Pobierz obrazek
          </button>
        </div>
      )}
    </div>
  );
}
