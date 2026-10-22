import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { APP_URL, FREE_NOTE, TAGLINE, download, promoCard, promoText, shareRaw } from '../engine/share';
import { daySeed } from '../engine/quips';
import { text } from '../i18n';
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

const T = text({
  pl: {
    copiedPost: 'Wpis z adresem skopiowany. Pobierz plakat i wklej oba tam, gdzie chcesz.',
    cantShare: 'Ta przeglądarka nie udostępnia sama — pobierz plakat i skopiuj link.',
    linkCopied: 'Link skopiowany.',
    copyFailed: 'Nie udało się skopiować — adres stoi na plakacie.',
    lead: (
      <>
        Plakat od Trenera Siwego dla znajomych — do wiadomości, relacji albo na grupę z siłowni.
        Aplikacja jest na razie za darmo, bez konta i bez reklam, a im więcej osób trenuje, tym
        więcej Siwy ma do roboty.
      </>
    ) as ReactNode,
    alt: (tagline: string, free: string) =>
      `Plakat: Trener Siwy szuka podopiecznych. ${tagline} ${free} Adres aplikacji na wstędze.`,
    failed: 'Plakat się nie narysował — wpis z linkiem i tak da się wysłać.',
    drawing: 'Siwy przygotowuje plakat…',
    preparing: 'Przygotowuję…',
    share: 'Udostępnij plakat',
    download: 'Pobierz plakat',
    file: 'gym-tracker-plakat.png',
    copyLink: 'Kopiuj link',
    peek: 'Co pójdzie w świat',
    title: 'Poleć znajomym',
    card: 'Plakat od Trenera Siwego z tym hasłem i adresem aplikacji — do wysłania jednym stuknięciem.',
    see: 'Zobacz plakat',
  },
  en: {
    copiedPost: 'Post with the link copied. Download the poster and paste both wherever you like.',
    cantShare: 'This browser can’t share by itself — download the poster and copy the link.',
    linkCopied: 'Link copied.',
    copyFailed: 'Couldn’t copy — the address is on the poster.',
    lead: (
      <>
        A poster from Coach Siwy for your friends — for a message, a story or your gym group. The app is free for
        now, with no account and no ads, and the more people train, the more work Siwy has.
      </>
    ),
    alt: (tagline: string, free: string) =>
      `Poster: Coach Siwy is looking for trainees. ${tagline} ${free} The app’s address on the ribbon.`,
    failed: 'The poster didn’t draw — you can still send the post with the link.',
    drawing: 'Siwy is preparing the poster…',
    preparing: 'Preparing…',
    share: 'Share poster',
    download: 'Download poster',
    file: 'gym-tracker-poster.png',
    copyLink: 'Copy link',
    peek: 'What gets shared',
    title: 'Recommend to friends',
    card: 'A poster from Coach Siwy with this slogan and the app’s address — ready to send in one tap.',
    see: 'See the poster',
  },
});

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
      if (res === 'copied') onToast(T.copiedPost);
      if (res === 'unsupported') onToast(T.cantShare);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(APP_URL);
      onToast(T.linkCopied);
    } catch {
      onToast(T.copyFailed);
    }
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">{T.lead}</p>
      </div>
      <div className="grp promo">
        {src ? (
          <img
            className="promo-img"
            src={src}
            alt={T.alt(TAGLINE, FREE_NOTE)}
          />
        ) : (
          <div className="promo-img promo-wait" role="status">
            {failed ? T.failed : T.drawing}
          </div>
        )}
        {/* Czeka na plakat — stuknięcie w pierwszej sekundzie wysłałoby sam tekst bez obrazka. */}
        <button
          className="btn wide"
          style={{ marginTop: 12 }}
          onClick={() => void send()}
          disabled={busy || (!src && !failed)}
        >
          {busy ? T.preparing : T.share}
        </button>
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button className="btn ghost sm" disabled={!src} onClick={() => blob.current && download(blob.current, T.file)}>
            {T.download}
          </button>
          <button className="btn ghost sm" onClick={() => void copy()}>
            {T.copyLink}
          </button>
        </div>
        <details className="share-peek">
          <summary>{T.peek}</summary>
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
      <h2>{T.title}</h2>
      <p className="tight">
        {TAGLINE} {T.card} {FREE_NOTE}
      </p>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go(PROMO_PATH)}>
        {T.see}
      </button>
    </div>
  );
}
