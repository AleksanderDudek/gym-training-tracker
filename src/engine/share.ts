/**
 * Udostępnianie wyników i wsparcie autora.
 *
 * Tekst i obrazek powstają tutaj, bez Reacta, więc da się je sprawdzić testem. Wysyłka idzie
 * przez systemowy arkusz udostępniania (`navigator.share`), bo to on zna aplikacje
 * zainstalowane na telefonie — własna lista przycisków zawsze będzie niepełna. Gdy arkusza
 * nie ma, zostaje kopiowanie i kilka bezpośrednich adresów.
 */

import { CHEERS, PROGRESS_TITLES, massJoke, pick, repsJoke } from './quips';
import { MOVES } from '../data/moves';
import { sampleCycle, skeleton } from './pose';

export const APP_URL = 'https://aleksanderdudek.github.io/gym-training-tracker/';
export const SUPPORT_URL = 'https://buycoffee.to/uriel';

export interface ShareSubject {
  /** Nagłówek: nazwa odznaki albo nazwa treningu. */
  title: string;
  /** Tworzywo odznaki — tylko dla odznak. */
  band?: string | undefined;
  /** Wiersze z liczbami, od najważniejszego. */
  lines: string[];
  /** Puenta pod liczbami. Wpis bez niej ląduje w cudzym kanale jako sucha statystyka. */
  punch?: string | undefined;
  /**
   * Rodzaj dokumentu. Odznaka dostaje świadectwo z medalem, dorobek — legitymację
   * z sylwetką. Dwa różne żarty, więc i dwa różne blankiety.
   */
  kind?: 'badge' | 'progress';
}

/** Liczby dorobku w formie, którą da się wrzucić do cudzego kanału bez wyjaśnień. */
export function progressSubject(
  m: { workouts: number; reps: number; sets: number; tonnage: number; secs: number },
  rank: string,
  seed: number,
): ShareSubject {
  const n = (x: number): string => Math.round(x).toLocaleString('pl-PL');
  return {
    kind: 'progress',
    title: rank,
    band: pick(PROGRESS_TITLES, seed),
    lines: [
      `${n(m.workouts)} ${m.workouts === 1 ? 'trening' : 'treningów'} · ${n(m.reps)} powtórzeń`,
      `${n(m.sets)} serii · ${m.tonnage >= 1000 ? `${Math.round(m.tonnage / 100) / 10} t` : `${n(m.tonnage)} kg`}`,
    ],
    punch: punchline(m.tonnage, m.reps, seed),
  };
}

/**
 * Puenta z dorobku: tonaż i powtórzenia przełożone na rzeczy, które da się sobie wyobrazić.
 * Wpis „12 483 powtórzenia” nikogo nie zatrzyma; „to sześć fortepianów” zatrzyma.
 */
export function punchline(kg: number, reps: number, seed: number): string {
  const mass = massJoke(kg);
  const time = repsJoke(reps);
  if (mass && time) return seed % 2 ? `W sumie ${mass}.` : `Powtórzenia: ${time}.`;
  if (mass) return `W sumie ${mass}.`;
  if (time) return `Powtórzenia: ${time}.`;
  return pick(CHEERS, seed);
}

/**
 * Treść wpisu. Adres na końcu i w osobnej linii, bo serwisy społecznościowe zamieniają
 * na podgląd wyłącznie ostatni adres we wpisie, a wtrącony w zdanie bywa ucinany.
 */
export function shareText(s: ShareSubject): string {
  const head = s.band ? `${s.title} — ${s.band}` : s.title;
  return [head, ...s.lines, s.punch ?? '', '', 'Prowadzę trening w GYM TRACKER:', APP_URL]
    .filter((x, i, all) => x !== '' || (all[i - 1] !== '' && i > 0))
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

/** Numer wydania — wyliczany z treści, żeby ta sama odznaka zawsze miała ten sam. */
function serial(s: ShareSubject): string {
  const base = `${s.title}${s.band ?? ''}${s.lines.join('')}`;
  let h = 7;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 900_000;
  return `nr ${String(h + 100_000).padStart(6, '0')} · wydano bez trybu odwoławczego`;
}

/**
 * Sylwetka rysowana wprost na płótnie z tego samego silnika póz, co manekin w atlasie.
 * Kopiowanie jego SVG nic by nie dało: kolory kresek siedzą w arkuszu strony, a samodzielny
 * obrazek nie ma do niego dostępu i wyszłaby czarna plama.
 */
function drawFigure(ctx: CanvasRenderingContext2D, cx: number, top: number, h: number): void {
  // Pełny wykrok, nie moment mijania nóg: postać w połowie kroku wygląda jak kreska.
  // Bliższa ręka odchylona kilkanaście stopni, żeby nie zlewała się z tułowiem — to
  // pozowane zdjęcie do legitymacji, nie klatka z animacji.
  const s = skeleton({
    ...sampleCycle(MOVES.carry.frames, 0),
    armA: 166,
    armB: 170,
    farArmA: 191,
    farArmB: 191,
  });
  const pts = Object.values(s);

  // Skala liczona z obwiedni postaci, a nie z rozmiaru sceny. Scena ma 160 na 150 jednostek,
  // a człowiek zajmuje z niej może jedną czwartą — skalowanie do sceny dawało figurkę
  // wielkości znaczka pocztowego pośrodku pustej karty.
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const k = h / (maxY - minY + 20);
  const X = (p: { x: number }): number => cx + (p.x - (minX + maxX) / 2) * k;
  const Y = (p: { y: number }): number => top + (p.y - minY + 10) * k;

  const chain = (list: { x: number; y: number }[], width: number, alpha: number): void => {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width * k;
    ctx.beginPath();
    list.forEach((p, i) => (i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))));
    ctx.stroke();
  };

  ctx.save();
  ctx.strokeStyle = '#3C423D';
  ctx.fillStyle = '#3C423D';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  chain([s.neck, s.elbowF, s.wristF], 6, 0.34);
  chain([s.hip, s.kneeF, s.ankleF, s.toeF], 6, 0.34);
  chain([s.hip, s.neck], 9, 1);
  chain([s.hip, s.kneeN, s.ankleN, s.toeN], 7, 1);
  chain([s.neck, s.elbowN, s.wristN], 7, 1);

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(X(s.head), Y(s.head), 8.5 * k, 0, Math.PI * 2);
  ctx.fill();

  // Kettlebell w dłoni — bez niego sylwetka po prostu stoi.
  ctx.strokeStyle = '#9A5B12';
  ctx.lineWidth = 2.6 * k;
  ctx.beginPath();
  ctx.arc(X(s.wristN), Y({ y: s.wristN.y + 9 }), 6.4 * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(s.wristN), Y({ y: s.wristN.y + 2 }), 4 * k, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Pieczęć w rogu. Przechylona, bo pieczęcie nigdy nie są proste. */
function stamp(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(CARD - 196, CARD - 214);
  ctx.rotate((-14 * Math.PI) / 180);
  ctx.strokeStyle = '#9A5B12';
  ctx.fillStyle = '#9A5B12';
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 76, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 30px "Oswald", system-ui, sans-serif';
  ctx.fillText('ZROBIONE', 0, -12);
  ctx.font = '400 17px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText('bez świadków', 0, 16);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
}

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
  ctx.fillRect(56, 56, CARD - 112, CARD - 112);

  // Podwójna ramka i pieczęć: karta ma wyglądać jak świadectwo wydane przez urząd,
  // który nie istnieje. Powaga formy przy błahości treści jest tu całym żartem.
  ctx.strokeStyle = '#C2C5BD';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, CARD - 112, CARD - 112);
  ctx.lineWidth = 1;
  ctx.strokeRect(74, 74, CARD - 148, CARD - 148);

  ctx.textAlign = 'center';
  // Linia bazowa u góry: przy domyślnej („alphabetic”) wysokość wiersza zależy od kroju
  // i wersaliki tytułu wchodziły na wiersz nad nim.
  ctx.textBaseline = 'top';

  const FONT = {
    brand: '600 34px "Oswald", system-ui, sans-serif',
    band: '600 30px "IBM Plex Sans", system-ui, sans-serif',
    title: '600 72px "Oswald", system-ui, sans-serif',
    line: '400 34px "IBM Plex Sans", system-ui, sans-serif',
    punch: '600 34px "Oswald", system-ui, sans-serif',
    url: '500 28px "IBM Plex Sans", system-ui, sans-serif',
  };

  ctx.fillStyle = '#5E655D';
  ctx.font = '600 26px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(
    s.kind === 'progress' ? 'LEGITYMACJA SIŁOWA' : 'ŚWIADECTWO POCIĘŻAROWE',
    CARD / 2,
    116,
  );
  ctx.fillStyle = '#1E2320';
  ctx.font = FONT.brand;
  ctx.fillText('GYM TRACKER', CARD / 2, 152);

  ctx.font = FONT.url;
  ctx.fillStyle = '#3C423D';
  ctx.fillText(APP_URL.replace(/^https:\/\//, ''), CARD / 2, CARD - 146);

  // Numer wydania: wygląda urzędowo, nie znaczy nic. O to chodzi.
  ctx.font = '400 22px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#9BA298';
  ctx.fillText(serial(s), CARD / 2, CARD - 108);

  stamp(ctx);

  const img = medal ? await loadSvg(standaloneSvg(medal, 320)).catch(() => null) : null;
  const figure = !img && s.kind === 'progress';

  ctx.font = FONT.title;
  const titleLines = wrap(ctx, s.title, CARD - 220);
  ctx.font = FONT.line;
  const bodyLines = s.lines.flatMap((l) => wrap(ctx, l, CARD - 200));
  ctx.font = FONT.punch;
  const punchLines = s.punch ? wrap(ctx, s.punch, CARD - 220) : [];

  const MEDAL = 300;
  const FIGURE = 300;
  // Wiersz nadpisu nad tytułem. Oswald ma wysoki wzrost liter, więc odstęp musi być
  // liczony z zapasem — inaczej wersaliki tytułu dotykają nadpisu.
  const BAND_ROW = 54;
  const height =
    (img ? MEDAL + 34 : 0) +
    (figure ? FIGURE + 30 : 0) +
    (s.band ? BAND_ROW : 0) +
    titleLines.length * 84 +
    (bodyLines.length ? 16 + bodyLines.length * 46 : 0) +
    (punchLines.length ? 20 + punchLines.length * 44 : 0);

  // Blok treści jeździ pionowo między nagłówkiem a adresem, więc karta bez medalu nie
  // zostawia dziury na środku, a karta z medalem nie wypycha tekstu pod krawędź.
  const top = 208;
  const bottom = CARD - 200;
  let y = top + Math.max(0, (bottom - top - height) / 2);

  if (img) {
    ctx.drawImage(img, (CARD - MEDAL) / 2, y, MEDAL, MEDAL);
    y += MEDAL + 34;
  } else if (figure) {
    drawFigure(ctx, CARD / 2, y, FIGURE);
    y += FIGURE + 30;
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

  if (punchLines.length) {
    y += 20;
    ctx.fillStyle = '#9A5B12';
    ctx.font = FONT.punch;
    punchLines.forEach((l) => {
      ctx.fillText(l, CARD / 2, y);
      y += 44;
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
