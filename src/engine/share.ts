/**
 * Udostępnianie wyników i wsparcie autora.
 *
 * Tekst i obrazek powstają tutaj, bez Reacta, więc da się je sprawdzić testem. Wysyłka idzie
 * przez systemowy arkusz udostępniania (`navigator.share`), bo to on zna aplikacje
 * zainstalowane na telefonie — własna lista przycisków zawsze będzie niepełna. Gdy arkusza
 * nie ma, zostaje kopiowanie i kilka bezpośrednich adresów.
 */

export const APP_URL = 'https://aleksanderdudek.github.io/gym-training-tracker/';
export const SUPPORT_URL = 'https://buycoffee.to/uriel';

export interface ShareSubject {
  /** Nagłówek: nazwa odznaki albo nazwa treningu. */
  title: string;
  /** Tworzywo odznaki — tylko dla odznak. */
  band?: string | undefined;
  /** Wiersze z liczbami, od najważniejszego. */
  lines: string[];
}

/**
 * Treść wpisu. Adres na końcu i w osobnej linii, bo serwisy społecznościowe zamieniają
 * na podgląd wyłącznie ostatni adres we wpisie, a wtrącony w zdanie bywa ucinany.
 */
export function shareText(s: ShareSubject): string {
  const head = s.band ? `${s.title} — ${s.band}` : s.title;
  return [head, ...s.lines, '', 'Prowadzę trening w GYM TRACKER:', APP_URL]
    .filter((x, i, all) => !(x === '' && all[i - 1] === ''))
    .join('\n');
}

/** Adresy „udostępnij” dla serwisów, które nie trafiają do systemowego arkusza. */
export function shareLinks(s: ShareSubject): { name: string; url: string }[] {
  const text = shareText(s);
  const enc = encodeURIComponent;
  return [
    { name: 'X', url: `https://twitter.com/intent/tweet?text=${enc(text)}` },
    { name: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${enc(APP_URL)}` },
    { name: 'WhatsApp', url: `https://wa.me/?text=${enc(text)}` },
  ];
}

/* ---------------- Obrazek do wpisu ---------------- */

const CARD = 1080;

/**
 * Zmienne CSS nie rozwiązują się w samodzielnym pliku SVG — obrazek ładowany przez
 * `Image` nie ma dostępu do arkusza strony. Przed rasteryzacją podmieniamy je na wartości.
 */
const INLINE_VARS: Record<string, string> = {
  'var(--display)': '"Oswald", "Arial Narrow", system-ui, sans-serif',
  'var(--surface-2)': '#EFF0EC',
  'var(--line)': '#C2C5BD',
  'var(--ink)': '#1E2320',
  'var(--ink-soft)': '#5E655D',
  'var(--steel)': '#3C423D',
};

const inlineVars = (markup: string): string =>
  Object.entries(INLINE_VARS).reduce((out, [k, v]) => out.split(k).join(v), markup);

/**
 * Kopia medalu jako samodzielny obrazek. Gradienty leżą w osobnym bloku `defs` na stronie
 * i giną przy zwykłym klonowaniu, więc wszystkie użyte `url(#…)` wędrują razem z kopią.
 */
export function standaloneSvg(source: SVGSVGElement, size: number): string {
  const clone = source.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const ids = new Set<string>();
  clone.querySelectorAll('*').forEach((el) => {
    ['fill', 'stroke'].forEach((attr) => {
      const m = /^url\(#([^)]+)\)$/.exec(el.getAttribute(attr) ?? '');
      if (m) ids.add(m[1]!);
    });
  });

  if (ids.size) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ids.forEach((id) => {
      const node = document.getElementById(id);
      if (node) defs.appendChild(node.cloneNode(true));
    });
    clone.insertBefore(defs, clone.firstChild);
  }

  return inlineVars(new XMLSerializer().serializeToString(clone));
}

const loadSvg = (markup: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się wczytać grafiki odznaki.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  words.forEach((w) => {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  });
  if (line) out.push(line);
  return out;
}

/**
 * Kwadratowa karta do wpisu. Kwadrat, bo mieści się bez przycięcia w każdym serwisie,
 * w którym prostokąt bywa kadrowany inaczej niż autor zakładał.
 */
export async function shareCard(s: ShareSubject, medal?: SVGSVGElement | null): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = CARD;
  c.height = CARD;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Przeglądarka nie udostępnia rysowania na płótnie.');

  // Czekamy na kroje pisma: `fillText` przed ich załadowaniem rysuje zapasowym fontem.
  if (document.fonts?.ready) await document.fonts.ready;

  ctx.fillStyle = '#D7D9D3';
  ctx.fillRect(0, 0, CARD, CARD);
  ctx.fillStyle = '#FAFAF8';
  ctx.fillRect(64, 64, CARD - 128, CARD - 128);

  ctx.textAlign = 'center';
  // Linia bazowa u góry: przy domyślnej („alphabetic”) wysokość wiersza zależy od kroju
  // i wersaliki tytułu wchodziły na wiersz nad nim.
  ctx.textBaseline = 'top';

  const FONT = {
    brand: '600 34px "Oswald", system-ui, sans-serif',
    band: '600 30px "IBM Plex Sans", system-ui, sans-serif',
    title: '600 72px "Oswald", system-ui, sans-serif',
    line: '400 34px "IBM Plex Sans", system-ui, sans-serif',
    url: '500 28px "IBM Plex Sans", system-ui, sans-serif',
  };

  ctx.fillStyle = '#5E655D';
  ctx.font = FONT.brand;
  ctx.fillText('GYM TRACKER', CARD / 2, 132);

  ctx.font = FONT.url;
  ctx.fillStyle = '#3C423D';
  ctx.fillText(APP_URL.replace(/^https:\/\//, ''), CARD / 2, CARD - 140);

  const img = medal ? await loadSvg(standaloneSvg(medal, 320)).catch(() => null) : null;

  ctx.font = FONT.title;
  const titleLines = wrap(ctx, s.title, CARD - 220);
  ctx.font = FONT.line;
  const bodyLines = s.lines.flatMap((l) => wrap(ctx, l, CARD - 200));

  const MEDAL = 300;
  // Wiersz nadpisu nad tytułem. Oswald ma wysoki wzrost liter, więc odstęp musi być
  // liczony z zapasem — inaczej wersaliki tytułu dotykają nadpisu.
  const BAND_ROW = 54;
  const height =
    (img ? MEDAL + 34 : 0) +
    (s.band ? BAND_ROW : 0) +
    titleLines.length * 84 +
    (bodyLines.length ? 16 + bodyLines.length * 46 : 0);

  // Blok treści jeździ pionowo między nagłówkiem a adresem, więc karta bez medalu nie
  // zostawia dziury na środku, a karta z medalem nie wypycha tekstu pod krawędź.
  const top = 210;
  const bottom = CARD - 190;
  let y = top + Math.max(0, (bottom - top - height) / 2);

  if (img) {
    ctx.drawImage(img, (CARD - MEDAL) / 2, y, MEDAL, MEDAL);
    y += MEDAL + 34;
  }

  if (s.band) {
    ctx.fillStyle = '#5E655D';
    ctx.font = FONT.band;
    ctx.fillText(s.band.toUpperCase(), CARD / 2, y);
    y += BAND_ROW;
  }

  ctx.fillStyle = '#1E2320';
  ctx.font = FONT.title;
  titleLines.forEach((l) => {
    ctx.fillText(l, CARD / 2, y);
    y += 84;
  });

  if (bodyLines.length) {
    y += 16;
    ctx.fillStyle = '#5E655D';
    ctx.font = FONT.line;
    bodyLines.forEach((l) => {
      ctx.fillText(l, CARD / 2, y);
      y += 46;
    });
  }

  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Nie udało się zapisać obrazka.'))), 'image/png');
  });
}

/* ---------------- Wysyłka ---------------- */

export type ShareResult = 'shared' | 'copied' | 'unsupported' | 'cancelled';

/**
 * Arkusz udostępniania bywa zamknięty gestem, którego przeglądarka nie zgłasza — obietnica
 * potrafi wtedy nigdy się nie rozstrzygnąć. Bez tego limitu przycisk zostawałby na zawsze
 * w stanie „przygotowuję”.
 */
const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

export const canShareFiles = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

/**
 * Najpierw systemowy arkusz z obrazkiem, potem sam tekst, na końcu schowek. Anulowanie
 * arkusza przez użytkownika nie jest błędem i nie może kończyć się komunikatem o awarii.
 */
export async function share(s: ShareSubject, file?: Blob | null): Promise<ShareResult> {
  const text = shareText(s);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav?.share) {
    try {
      // `canShare` bywa nieobecne w starszych przeglądarkach, mimo że typy DOM deklarują je
      // jako zawsze istniejące — stąd sprawdzenie po typie, a nie po prawdziwości.
      const hasCanShare = typeof nav.canShare === 'function';
      const png =
        file && hasCanShare ? new File([file], 'gym-tracker.png', { type: 'image/png' }) : null;
      const payload =
        png && hasCanShare && nav.canShare({ files: [png] })
          ? { files: [png], text }
          : { title: s.title, text, url: APP_URL };
      const done = await withTimeout(nav.share(payload).then(() => true), 20_000, false);
      if (done) return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    await withTimeout(navigator.clipboard.writeText(text), 3_000, undefined);
    return 'copied';
  } catch {
    return 'unsupported';
  }
}

/** Zapis karty na dysk — dla przeglądarek bez arkusza udostępniania. */
export function download(blob: Blob, name = 'gym-tracker.png'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
