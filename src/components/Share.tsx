import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { canShareFiles, download, share, shareCard, shareLinks, shareText } from '../engine/share';
import type { ShareSubject } from '../engine/share';
import { pick } from '../engine/quips';
import { BAND_MOOD, BAND_NAME } from './BadgeArt';
import type { Band } from './BadgeArt';
import { Gorilla } from './Gorilla';
import type { CoachMood, TraineeMood } from './Gorilla';
import type { Cast } from './ui';

/**
 * Kto stoi w narożnikach blankietu. Po lewej podopieczny, który reaguje na wynik, po prawej
 * Trener Siwy jako komisja, która go zatwierdza — i na jego portret wchodzi pieczęć.
 *
 * Miny są wybrane pod twarz, bo na karcie widać tylko głowę: ręce, iskry i żarówka
 * zostają poza kadrem. Odznaka bierze minę z pasma, więc radość rośnie razem z tworzywem
 * tak samo jak w oknie zdobycia. Po treningu podopieczny ledwie żyje — to najzabawniejsza
 * mina w obsadzie i jedyna uczciwa po serii przysiadów. Tęsknoty i opuszczonego treningu
 * nie ma: nikt nie udostępnia dokumentu, na którym ktoś jest smutny.
 */
const AFTER: Record<'session' | 'progress', readonly TraineeMood[]> = {
  // Zmęczenie dwa razy: to mina po treningu, pozostałe są tylko odmianą.
  session: ['tired', 'happy', 'tired', 'record'],
  progress: ['proud', 'amazed', 'euphoric'],
};
const COMMISSION: readonly CoachMood[] = ['approve', 'wink'];

const bandOf = (name: string | undefined): Band | null => {
  const hit = Object.entries(BAND_NAME).find(([, n]) => n === name);
  return hit ? (Number(hit[0]) as Band) : null;
};

export function certificateCast(s: ShareSubject): [Cast, Cast] {
  const seed = s.seed ?? s.title.length;
  const kind = s.kind ?? 'badge';
  const band = kind === 'badge' ? bandOf(s.band) : null;
  const mood: TraineeMood =
    kind === 'badge' ? (band ? BAND_MOOD[band] : 'happy') : pick(AFTER[kind], seed);
  return [
    { who: seed % 2 ? 'gosia' : 'gustaw', mood },
    { who: 'siwy', mood: pick(COMMISSION, seed) },
  ];
}

/**
 * Rysunek Reacta jako element SVG poza stroną. Karta powstaje na płótnie, a obsada jest
 * komponentem — kopiowanie jej z ekranu nie wchodzi w grę, bo na ekranie jest akurat inna
 * mina albo nie ma jej wcale. Render idzie synchronicznie do odłączonego węzła i dopiero
 * po kliknięciu, jak cała karta.
 */
export function svgOf(el: ReactElement): SVGSVGElement | null {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() => root.render(el));
    return (host.querySelector('svg')?.cloneNode(true) as SVGSVGElement | undefined) ?? null;
  } catch {
    // Portret jest ozdobą: bez niego karta nadal jest kompletna, tak jak bez medalu.
    return null;
  } finally {
    root.unmount();
  }
}

/** Karta z medalem i obsadą — to, co ląduje w arkuszu udostępniania. */
export function cardFor(subject: ShareSubject, medal?: SVGSVGElement | null): Promise<Blob> {
  const faces = certificateCast(subject).map((c) =>
    svgOf(<Gorilla who={c.who} mood={c.mood} crop="face" size={320} />),
  );
  return shareCard(subject, { medal, faces });
}

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
      blob.current = await cardFor(subject, svg);
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

      {/* Podgląd wpisu: nic nie wychodzi w świat bez pokazania, co dokładnie wychodzi. */}
      <details className="share-peek">
        <summary>Co pójdzie w świat</summary>
        <p>{shareText(subject)}</p>
      </details>

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
