import { useEffect, useMemo, useRef, useState } from 'react';
import { APP_URL, FREE_NOTE, TAGLINE, download, promoCard, promoText, shareRaw } from '../engine/share';
import { daySeed } from '../engine/quips';
import { PROMO_PATH, go } from '../routing';
import { Gorilla } from './Gorilla';
import { svgOf } from './Share';

/**
 * Polecenie aplikacji: plakat „Trener Siwy szuka podopiecznych” i wpis do niego.
 *
 * Plakat wydaje ten sam urząd, co certyfikaty — ta sama kartka, ramka, pieczęć i wstęga
 * z adresem — więc kto zobaczy jedno i drugie, rozpozna tę samą aplikację. Na ekranie stoi
 * podgląd dokładnie tego obrazka, który pójdzie w świat: nic nie wychodzi bez pokazania.
 */

/** Plakat z obsadą: Siwy wskazuje palcem, Gustaw z telefonem, Gosia z bicepsem. */
export function posterFor(): Promise<Blob> {
  return promoCard({
    coach: svgOf(<Gorilla who="siwy" mood="wise" crop="bust" size={600} />),
    left: svgOf(<Gorilla who="gustaw" mood="share" crop="bust" size={600} />),
    right: svgOf(<Gorilla who="gosia" mood="happy" crop="bust" size={600} />),
  });
}

export function PromoPage({ onToast }: { onToast: (m: string) => void }) {
  const seed = useMemo(() => daySeed(), []);
  const text = promoText(seed);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const blob = useRef<Blob | null>(null);

  // Plakat rysuje się raz, po wejściu — płótno 1080 × 1080 i trzy goryle to nie jest coś,
  // co warto robić przy każdym otwarciu ustawień.
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    // Poza cyklem Reacta: obsada rysuje się przez `flushSync`, a ten wołany w trakcie efektu
    // nic nie renderuje — plakat wychodził bez goryli.
    const t = window.setTimeout(() => {
      posterFor()
        .then((b) => {
          if (!live) return;
          blob.current = b;
          url = URL.createObjectURL(b);
          setSrc(url);
        })
        .catch(() => live && setFailed(true));
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(t);
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const send = async () => {
    setBusy(true);
    try {
      const res = await shareRaw({ title: 'GYM TRACKER', text, file: blob.current });
      if (res === 'copied') onToast('Wpis z adresem skopiowany. Pobierz plakat i wklej oba tam, gdzie chcesz.');
      if (res === 'unsupported') onToast('Ta przeglądarka nie udostępnia sama — pobierz plakat i skopiuj link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      onToast('Link skopiowany.');
    } catch {
      onToast('Nie udało się skopiować — adres stoi na plakacie.');
    }
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">
          Plakat od Trenera Siwego dla znajomych — do wiadomości, relacji albo na grupę z siłowni.
          Aplikacja jest na razie za darmo, bez konta i bez reklam, a im więcej osób trenuje, tym
          więcej Siwy ma do roboty.
        </p>
      </div>
      <div className="grp promo">
        {src ? (
          <img
            className="promo-img"
            src={src}
            alt={`Plakat: Trener Siwy szuka podopiecznych. ${TAGLINE} ${FREE_NOTE} Adres aplikacji na wstędze.`}
          />
        ) : (
          <div className="promo-img promo-wait" role="status">
            {failed ? 'Plakat się nie narysował — wpis z linkiem i tak da się wysłać.' : 'Siwy przygotowuje plakat…'}
          </div>
        )}
        {/* Czeka na plakat — stuknięcie w pierwszej sekundzie wysłałoby sam tekst bez obrazka. */}
        <button
          className="btn wide"
          style={{ marginTop: 12 }}
          onClick={() => void send()}
          disabled={busy || (!src && !failed)}
        >
          {busy ? 'Przygotowuję…' : 'Udostępnij plakat'}
        </button>
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button className="btn ghost sm" disabled={!src} onClick={() => blob.current && download(blob.current, 'gym-tracker-plakat.png')}>
            Pobierz plakat
          </button>
          <button className="btn ghost sm" onClick={() => void copy()}>
            Kopiuj link
          </button>
        </div>
        <details className="share-peek">
          <summary>Co pójdzie w świat</summary>
          <p>{text}</p>
        </details>
      </div>
    </>
  );
}

/** Wejście do plakatu z ustawień i z profilu. */
export function PromoCard() {
  return (
    <div className="grp">
      <h2>Poleć znajomym</h2>
      <p className="tight">
        {TAGLINE} Plakat od Trenera Siwego z tym hasłem i adresem aplikacji — do wysłania jednym
        stuknięciem. {FREE_NOTE}
      </p>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go(PROMO_PATH)}>
        Zobacz plakat
      </button>
    </div>
  );
}
