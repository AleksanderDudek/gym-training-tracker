/**
 * Udostępnianie wyników i wsparcie autora.
 *
 * Tekst i obrazek powstają tutaj, bez Reacta, więc da się je sprawdzić testem. Wysyłka idzie
 * przez systemowy arkusz udostępniania (`navigator.share`), bo to on zna aplikacje
 * zainstalowane na telefonie — własna lista przycisków zawsze będzie niepełna. Gdy arkusza
 * nie ma, zostaje kopiowanie i kilka bezpośrednich adresów.
 */

import {
  CHEERS,
  CTA,
  MOTTOS,
  PROGRESS_TITLES,
  SIGNATORIES,
  STAMPS,
  massJoke,
  pick,
  repsJoke,
} from './quips';
import { MOVES } from '../data/moves';
import { face, headAngle, sampleCycle, skeleton } from './pose';

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
  kind?: 'badge' | 'progress' | 'session';
  /** Ziarno tekstów. Wpis i blankiet mają wypaść w tym samym wariancie. */
  seed?: number;
}

/** Liczby dorobku w formie, którą da się wrzucić do cudzego kanału bez wyjaśnień. */
export function progressSubject(
  m: { workouts: number; reps: number; sets: number; tonnage: number; secs: number },
  rank: string,
  seed: number,
): ShareSubject {
  const n = (x: number): string => Math.round(x).toLocaleString('pl-PL');
  // Tonaż po polsku ma przecinek, nie kropkę — ręczne dzielenie przez sto dawało „99.2 t”.
  const tons = (kg: number): string =>
    kg >= 1000
      ? `${(Math.round(kg / 100) / 10).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} t`
      : `${n(kg)} kg`;
  return {
    kind: 'progress',
    seed,
    title: rank,
    band: pick(PROGRESS_TITLES, seed),
    lines: [
      `${n(m.workouts)} ${m.workouts === 1 ? 'trening' : 'treningów'} · ${n(m.reps)} powtórzeń`,
      `${n(m.sets)} serii · ${tons(m.tonnage)}`,
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
/**
 * Wpisy pisane pierwszą osobą i w czasie przeszłym, bo tak ludzie piszą o tym, co zrobili.
 * Poprzednia wersja składała nagłówek i listę pod spodem — czytało się to jak wydruk
 * z maszyny i w cudzym kanale wyglądało na wygenerowane, czyli dokładnie tak, jak wyglądało.
 *
 * Każdy szablon kończy się jednym zdaniem zaproszenia i adresem w osobnej linii: serwisy
 * robią podgląd z ostatniego adresu we wpisie, a wtrącony w zdanie bywa ucinany.
 */
type Template = (s: ShareSubject) => string;

const first = (s: ShareSubject): string => s.lines[0] ?? '';
const rest = (s: ShareSubject): string => s.lines.slice(1).join(' · ');
const punch = (s: ShareSubject): string => s.punch ?? '';

const BADGE: Template[] = [
  (s) => `Wpadła odznaka „${s.title}”${s.band ? ` — ${s.band}` : ''}. ${first(s)}. ${punch(s)}`,
  (s) => `Zdobyte: „${s.title}”${s.band ? ` (${s.band})` : ''}. ${punch(s)} Nikt nie bił braw, aplikacja tak.`,
  (s) => `Odznaka „${s.title}” zaliczona${s.band ? `, tworzywo: ${s.band}` : ''}. ${punch(s)} Na lodówkę się nie zmieści.`,
  (s) => `Mam „${s.title}”${s.band ? ` w ${s.band}` : ''}. Brzmi poważnie, w praktyce to ${first(s).toLowerCase()}. ${punch(s)}`,
  (s) => `Nowa odznaka: „${s.title}”. ${punch(s)} Wiem, że nikt nie pytał.`,
];

const SESSION: Template[] = [
  (s) => `${s.title}. ${first(s)}. ${punch(s)}`,
  (s) => `${s.title}. ${first(s)}, a licznik z całej historii mówi: ${punch(s)}`,
  (s) => `Trening odhaczony. ${first(s)}. ${punch(s)} Kanapa zasłużona.`,
  (s) => `${s.title}. ${punch(s)} Pot wyparował, dane zostały.`,
  (s) => `Zrobione. ${first(s)}. ${punch(s)} Nikt nie patrzył, aplikacja patrzyła.`,
];

const PROGRESS: Template[] = [
  (s) => `Stopień „${s.title}” osiągnięty. ${first(s)}. ${punch(s)}`,
  (s) => `Bilans po wszystkim: ${first(s)}${rest(s) ? `, ${rest(s)}` : ''}. ${punch(s)} Stopień: ${s.title.toLowerCase()}.`,
  (s) => `${first(s)}. ${punch(s)} Aplikacja mówi na mnie „${s.title.toLowerCase()}” i trudno się kłócić.`,
  (s) => `Licznik pokazuje ${first(s).toLowerCase()}. ${punch(s)} Formalnie jestem już „${s.title.toLowerCase()}”.`,
];

const SETS: Record<NonNullable<ShareSubject['kind']>, Template[]> = {
  badge: BADGE,
  session: SESSION,
  progress: PROGRESS,
};

/**
 * Sprzątanie po szablonach: podwójne spacje biorą się z pustych pól, a wstawiony fragment
 * zaczyna się małą literą, bo w danych jest „próg 4 z 6”, nie „Próg 4 z 6”.
 */
const tidy = (t: string): string =>
  t
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/([.!?]\s+|^)(\p{Ll})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase())
    .replace(/\.\s*\./g, '.')
    .trim();

export function shareText(s: ShareSubject): string {
  const seed = s.seed ?? s.lines.length + s.title.length;
  const body = tidy(pick(SETS[s.kind ?? 'badge'], seed)(s));
  return [body, '', `${pick(CTA, seed)}`, APP_URL].join('\n');
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

  // Głowa z konturem i miną. Na zdjęciu do legitymacji człowiek nie wyje z wysiłku, więc
  // wysiłek jest ustawiony nisko — wychodzi spokojne skupienie.
  ctx.globalAlpha = 1;
  const hr = 11 * k;
  ctx.beginPath();
  ctx.arc(X(s.head), Y(s.head), hr, 0, Math.PI * 2);
  ctx.fillStyle = '#EFF0EC';
  ctx.fill();
  ctx.strokeStyle = '#3C423D';
  ctx.lineWidth = 3.6 * k;
  ctx.stroke();
  drawFace(ctx, X(s.head), Y(s.head), k, headAngle(s), 0.25);

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

/** Ozdobniki w narożnikach. Dyplom bez zawijasów wygląda jak faktura. */
function flourish(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = '#C2C5BD';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.quadraticCurveTo(0, 0, 46, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.quadraticCurveTo(0, 0, 30, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(13, 13, 3.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Podpis pod dokumentem: zawijas i urząd, który nie istnieje. Dyplomy są podpisywane,
 * więc ten też — to najtańszy sposób, żeby blankiet wyglądał poważnie mimo treści.
 */
function signature(ctx: CanvasRenderingContext2D, cx: number, y: number, who: string): void {
  ctx.save();
  ctx.strokeStyle = '#3C423D';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(cx - 92, y + 10);
  ctx.bezierCurveTo(cx - 60, y - 22, cx - 34, y + 26, cx - 8, y - 4);
  ctx.bezierCurveTo(cx + 12, y - 24, cx + 26, y + 20, cx + 52, y - 2);
  ctx.bezierCurveTo(cx + 66, y - 12, cx + 76, y + 6, cx + 94, y - 6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 120, y + 26);
  ctx.lineTo(cx + 120, y + 26);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#C2C5BD';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#5E655D';
  ctx.font = '400 21px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(who, cx, y + 34);
}

/** Ta sama mimika, co w atlasie, tylko pociągnięta po płótnie zamiast po SVG. */
function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  k: number,
  angle: number,
  effort: number,
): void {
  const f = face(effort);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(k, k);
  ctx.strokeStyle = '#3C423D';
  ctx.fillStyle = '#3C423D';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(1.1, -5.4);
  ctx.lineTo(5.7, -5.4 + (f.brow / 26) * 2.5);
  ctx.stroke();

  if (f.eye > 0.45) {
    ctx.beginPath();
    ctx.arc(3.5, -2, 1.4 * f.eye, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(2.1, -2);
    ctx.lineTo(5, -2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0.8, 3.9);
  ctx.quadraticCurveTo(3.2, 3.9 + f.mouth, 5.6, 3.9);
  ctx.stroke();
  ctx.restore();
}

/** Pieczęć w rogu. Przechylona, bo pieczęcie nigdy nie są proste. */
function stamp(ctx: CanvasRenderingContext2D, words: readonly [string, string]): void {
  ctx.save();
  ctx.translate(CARD - 152, CARD - 170);
  ctx.rotate((-14 * Math.PI) / 180);
  ctx.strokeStyle = '#9A5B12';
  ctx.fillStyle = '#9A5B12';
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 61, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 27px "Oswald", system-ui, sans-serif';
  ctx.fillText(words[0], 0, -12);
  ctx.font = '400 15px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(words[1], 0, 15);
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
  const seed = s.seed ?? s.title.length + s.lines.length;

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
    // Krótszy adres wchodziłby pod pieczęć w prawym dolnym rogu.
    url: '500 25px "IBM Plex Sans", system-ui, sans-serif',
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
  ctx.fillText('GYM TRACKER', CARD / 2, 148);
  ctx.fillStyle = '#9BA298';
  ctx.font = '400 20px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(pick(MOTTOS, seed), CARD / 2, 190);

  flourish(ctx, 92, 92, 1, 1);
  flourish(ctx, CARD - 92, 92, -1, 1);
  flourish(ctx, 92, CARD - 92, 1, -1);
  flourish(ctx, CARD - 92, CARD - 92, -1, -1);

  ctx.font = FONT.url;
  ctx.fillStyle = '#3C423D';
  ctx.fillText(APP_URL.replace(/^https:\/\//, ''), CARD / 2, CARD - 152);

  // Numer wydania: wygląda urzędowo, nie znaczy nic. O to chodzi.
  ctx.font = '400 22px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = '#9BA298';
  ctx.fillText(serial(s), CARD / 2, CARD - 114);



  const img = medal ? await loadSvg(standaloneSvg(medal, 320)).catch(() => null) : null;
  const figure = !img && s.kind === 'progress';

  ctx.font = FONT.title;
  const titleLines = wrap(ctx, s.title, CARD - 220);
  ctx.font = FONT.line;
  const bodyLines = s.lines.flatMap((l) => wrap(ctx, l, CARD - 200));
  ctx.font = FONT.punch;
  const punchLines = s.punch ? wrap(ctx, s.punch, CARD - 220) : [];

  const MEDAL = 268;
  const FIGURE = 274;
  const MIN_ART = 150;
  // Wiersz nadpisu nad tytułem. Oswald ma wysoki wzrost liter, więc odstęp musi być
  // liczony z zapasem — inaczej wersaliki tytułu dotykają nadpisu.
  const BAND_ROW = 54;
  const text =
    (s.band ? BAND_ROW : 0) +
    titleLines.length * 84 +
    (bodyLines.length ? 16 + bodyLines.length * 46 : 0) +
    (punchLines.length ? 20 + punchLines.length * 44 : 0);

  // Blok treści jeździ pionowo między nagłówkiem a adresem, więc karta bez medalu nie
  // zostawia dziury na środku, a karta z medalem nie wypycha tekstu pod krawędź.
  const top = 224;
  const bottom = CARD - 268;
  const band = bottom - top;

  /*
   * Grafika ustępuje tekstowi. Dwuwierszowy tytuł i dwuwierszowa puenta potrafią zjeść
   * całe pole; gdyby medal trzymał stały rozmiar, treść zjechałaby na podpis i na pieczęć.
   * Poniżej pewnego progu grafika znika całkiem — lepiej dokument bez ozdoby niż nachodzące
   * na siebie napisy.
   */
  const wanted = img ? MEDAL : figure ? FIGURE : 0;
  const art = wanted ? Math.min(wanted, band - text - 26) : 0;
  const showArt = art >= MIN_ART;

  const height = (showArt ? art + 26 : 0) + text;
  let y = top + Math.max(0, (band - height) / 2);

  if (showArt && img) {
    ctx.drawImage(img, (CARD - art) / 2, y, art, art);
    y += art + 26;
  } else if (showArt && figure) {
    drawFigure(ctx, CARD / 2, y, art);
    y += art + 26;
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

  // Podpis idzie pod treść, a nie na sztywno: przy dwuwierszowym tytule albo długiej puencie
  // blok rósł w dół i zawijas lądował na tekście. Gdy miejsca zabraknie, podpisu nie ma —
  // lepiej dokument bez podpisu niż podpis w poprzek zdania.
  const signY = y + 26;
  if (signY < CARD - 238) signature(ctx, CARD / 2 - 86, signY, pick(SIGNATORIES, seed));
  stamp(ctx, pick(STAMPS, seed));

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
