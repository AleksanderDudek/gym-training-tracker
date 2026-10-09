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

/**
 * Adres w postaci, w jakiej stoi na blankiecie: bez protokołu i końcowego ukośnika. Z obrazka
 * nikt go nie kliknie, tylko przepisze — każdy zbędny znak to miejsce na większy krój.
 */
export const APP_HOST = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/* ---------------- Hasło i polecenie ---------------- */

/**
 * Hasło aplikacji — na certyfikatach i na plakacie. Ma powiedzieć obcemu człowiekowi, co ta
 * aplikacja robi, zanim zdąży przewinąć dalej: korzyść, nie lista funkcji. „Sam wie, kiedy
 * dołożyć” to dokładnie to, czego nie robi zwykły notes z treningiem — progresja dzieje się
 * bez liczenia, kiedy i o ile podnieść.
 */
export const TAGLINE = 'Twój trening sam wie, kiedy dołożyć.';

/** Uczciwie: na razie — bez obietnicy, że zawsze. */
export const FREE_NOTE = 'Na razie za darmo.';

/** Co jeszcze jest w środku — jedna linijka pod wyjaśnieniem na plakacie. */
export const PROMO_EXTRAS = 'Plany, przerwy z odliczaniem, odznaki i goryle. W telefonie, bez instalacji.';

/** Jedno zdanie dla tych, którym hasło nie wystarczy. */
export const PITCH = 'Wpisujesz serie, a aplikacja sama decyduje, kiedy dołożyć powtórzenie albo ciężar.';

/**
 * Wpis do plakatu z polecenia. Pierwsza osoba i czas teraźniejszy — ani „polecałem”, ani
 * „polecałam”, bo wysyła go i Gustaw, i Gosia. Każdy mówi, co aplikacja robi i że jest za darmo.
 */
export const PROMO_TEXTS: readonly string[] = [
  'Polecam GYM TRACKER: wpisujesz serie, a aplikacja sama decyduje, kiedy dołożyć powtórzenie albo ciężar. Do tego plany, przerwy z odliczaniem i odznaki. Na razie za darmo, bez konta:',
  'Trener Siwy szuka podopiecznych. GYM TRACKER prowadzi trening siłowy: pilnuje serii, przerw i postępów. Na razie za darmo:',
  'Ćwiczę z aplikacją, która sama wie, kiedy dołożyć ciężar. Goryle w zestawie. Na razie za darmo, bez reklam i bez konta:',
  'Jak ktoś szuka trenera, który nie bierze pieniędzy: GYM TRACKER prowadzi trening, liczy serie i pilnuje postępów. Na razie za darmo:',
];

export const promoText = (seed: number): string => [pick(PROMO_TEXTS, seed), APP_URL].join('\n');

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
  ctx.strokeStyle = INK.dark;
  ctx.fillStyle = INK.dark;
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
  ctx.fillStyle = '#EFEEE7';
  ctx.fill();
  ctx.strokeStyle = INK.dark;
  ctx.lineWidth = 3.6 * k;
  ctx.stroke();
  drawFace(ctx, X(s.head), Y(s.head), k, headAngle(s), 0.25);

  // Kettlebell w dłoni — bez niego sylwetka po prostu stoi.
  ctx.strokeStyle = INK.stamp;
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
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 2.6;
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
  ctx.strokeStyle = INK.dark;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;
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
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK.rule;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = INK.soft;
  ctx.font = '400 25px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(who, cx, y + 36);
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
  ctx.strokeStyle = INK.dark;
  ctx.fillStyle = INK.dark;
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

/**
 * Ustawia krój w największym stopniu, w którym tekst mieści się w danej szerokości.
 * Stopień schodzi co piksel, ale nie niżej niż `min` — poniżej tekst i tak przestaje być
 * czytelny w miniaturze, więc lepiej, żeby wystawał, niż żeby zniknął.
 */
function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  max: number,
  width: number,
  min = Math.round(max * 0.6),
): number {
  let px = max;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > width) ctx.font = font(--px);
  return px;
}

/**
 * Pieczęć. Przechylona, bo pieczęcie nigdy nie są proste.
 *
 * Duże słowo dopasowuje się do pierścienia: „POTWIERDZONE” w stałym stopniu wychodziło
 * poza obwódkę i wyglądało jak napis obok pieczęci, a nie w niej.
 */
function stamp(
  ctx: CanvasRenderingContext2D,
  words: readonly [string, string],
  x: number,
  y: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-14 * Math.PI) / 180);
  // Pieczęć była ledwie widoczna przy 62% krycia. Mocniejszy kolor i grubsze pierścienie.
  // Bez krycia tła pod spodem: stempel wchodzi na to, co już leży na papierze, a nie
  // zamiast tego — tak jak prawdziwa pieczęć na zdjęciu w legitymacji.
  ctx.strokeStyle = INK.stamp;
  ctx.fillStyle = INK.stamp;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 61, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fit(ctx, words[0], (px) => `600 ${px}px "Oswald", system-ui, sans-serif`, 32, 102, 16);
  ctx.fillText(words[0], 0, -13);
  fit(ctx, words[1], (px) => `600 ${px}px "IBM Plex Sans", system-ui, sans-serif`, 16, 96, 12);
  ctx.fillText(words[1], 0, 16);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
}

/**
 * Portret w narożniku nagłówka: goryl w okrągłym medalionie, jak popiersia założycieli
 * na starych dyplomach. Głowa jest większa niż medalion i wystaje nad obwódkę — portret
 * zamknięty w kółku wyglądał jak awatar z komunikatora, a nie jak postać z dokumentu.
 */
function portrait(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number): void {
  const r = PORTRAIT.r;
  ctx.save();
  ctx.fillStyle = INK.sand;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, 0, Math.PI * 2);
  ctx.stroke();

  // Dolna połowa głowy zostaje w medalionie, górna może z niego wyjść. Przycięcie od dołu
  // chowa krawędź rysunku, która inaczej wisiałaby pod medalionem jak ucięta szyja.
  const size = PORTRAIT.face;
  ctx.beginPath();
  ctx.rect(cx - size, cy - size * 2, size * 2, size * 2);
  ctx.moveTo(cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.clip();
  ctx.drawImage(img, cx - size / 2, cy - size / 2 - PORTRAIT.lift, size, size);
  ctx.restore();
}

/**
 * Wstęga z adresem. Pełna szerokość karty i jasne litery na stali, bo adres ma być pierwszą
 * rzeczą, którą widać w stopce — wcześniej stał drobnym drukiem pod pieczęcią i ginął.
 * Stal nie jest przypadkowa: w aplikacji to kolor akcji, a adres jest jedyną akcją,
 * jaką obrazek w cudzym kanale może komuś zaproponować. Końce wychodzą poza kartkę
 * i mają wcięcia jak wstęga na dyplomie.
 */
function ribbon(ctx: CanvasRenderingContext2D, text: string, y: number): void {
  const { h, edge, tail, drop, notch, pad } = RIBBON;
  const a = edge + tail / 2;
  const b = CARD - edge - tail / 2;

  ctx.save();
  // Końce pod spodem: ciemniejsze, niżej i z wcięciem — to one robią z pasa wstęgę.
  ctx.fillStyle = INK.fold;
  ([
    [edge, 1],
    [CARD - edge, -1],
  ] as const).forEach(([out, dir]) => {
    const inn = out + tail * dir;
    ctx.beginPath();
    ctx.moveTo(out, y + drop);
    ctx.lineTo(inn, y + drop);
    ctx.lineTo(inn, y + h + drop);
    ctx.lineTo(out, y + h + drop);
    ctx.lineTo(out + notch * dir, y + h / 2 + drop);
    ctx.closePath();
    ctx.fill();
  });

  ctx.fillStyle = INK.steel;
  ctx.fillRect(a, y, b - a, h);

  // Przeszycia wzdłuż krawędzi — bez nich pas czyta się jak pasek przeglądarki.
  ctx.strokeStyle = INK.paper;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 7]);
  [y + 7, y + h - 7].forEach((ly) => {
    ctx.beginPath();
    ctx.moveTo(a + 12, ly);
    ctx.lineTo(b - 12, ly);
    ctx.stroke();
  });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = INK.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fit(ctx, text, (px) => `600 ${px}px "IBM Plex Sans", system-ui, sans-serif`, 40, b - a - 2 * pad);
  ctx.fillText(text, CARD / 2, y + h / 2 + 1);
  ctx.restore();
}

/**
 * Zmienne CSS nie rozwiązują się w samodzielnym pliku SVG — obrazek ładowany przez
 * `Image` nie ma dostępu do arkusza strony. Przed rasteryzacją podmieniamy je na wartości.
 */
const INLINE_VARS: Record<string, string> = {
  // Apostrofy, nie cudzysłowy: wartość ląduje w atrybucie `style="…"` i cudzysłów by go
  // zamknął — obrazek przestawał się wczytywać, a medal z napisem znikał z karty.
  'var(--display)': "'Oswald', 'Arial Narrow', system-ui, sans-serif",
  'var(--surface-2)': '#EFF0EC',
  'var(--line)': '#C2C5BD',
  'var(--ink)': '#1E2320',
  'var(--ink-soft)': '#5E655D',
  'var(--steel)': '#3C423D',
};

/** Kolory blankietu. Te same akcenty, co w aplikacji — karta ma wyglądać na jej część. */
const INK = {
  dark: '#141413',
  soft: '#4E5249',
  faint: '#6E7268',
  rule: '#C2C5BD',
  accent: '#94452C',
  stamp: '#C9724F',
  paper: '#FAF9F5',
  board: '#D7D9D3',
  sand: '#E8E6DC',
  steel: '#3C423D',
  fold: '#23272A',
} as const;

/** Medaliony z obsadą w narożnikach nagłówka. */
const PORTRAIT = {
  r: 70,
  /** Bok kwadratu, w który wpisana jest głowa. Czubek wystaje nad obwódkę, reszta w niej siedzi. */
  face: 152,
  /** O ile głowa siedzi wyżej niż środek medalionu. */
  lift: 14,
  x: 178,
  y: 166,
} as const;

/** Pieczęć: środek pierścienia. Zahacza o prawy medalion, ale nie o twarz w nim. */
const STAMP = { x: CARD - 136, y: 278 } as const;

/** Wstęga z adresem w stopce. */
const RIBBON = { y: 884, h: 70, edge: 24, tail: 60, drop: 12, notch: 20, pad: 30 } as const;

/** Wiersz hasła tuż nad wstęgą: najpierw co, potem gdzie — jak w każdej reklamie. */
const SLOGAN_Y = RIBBON.y - 52;

/**
 * Hasło i „na razie za darmo” w jednym wierszu: hasło atramentem, bezpłatność kolorem pieczęci.
 * Rozmiar dopasowuje się do szerokości, a oba kawałki stoją razem na środku.
 */
function slogan(ctx: CanvasRenderingContext2D, y: number, width = CARD - 200): void {
  const main = TAGLINE;
  const free = ` ${FREE_NOTE}`;
  const font = (px: number) => `600 ${px}px "Oswald", system-ui, sans-serif`;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  fit(ctx, main + free, font, 34, width, 22);
  const a = ctx.measureText(main).width;
  const b = ctx.measureText(free).width;
  const x = (CARD - a - b) / 2;
  ctx.fillStyle = INK.dark;
  ctx.fillText(main, x, y);
  ctx.fillStyle = INK.accent;
  ctx.fillText(free, x + a, y);
  ctx.restore();
}

/**
 * Najpierw zmienne znane z nazwy, potem wszystko, co ma w `var()` wartość zapasową — tak
 * rysuje obsada (`var(--fur, #3f3c44)`), a samodzielny obrazek żadnej zmiennej nie zna.
 * Zapasowe wartości obsady są wartościami tokenów, więc wynik wygląda jak na ekranie.
 */
export const inlineVars = (markup: string): string =>
  Object.entries(INLINE_VARS)
    .reduce((out, [k, v]) => out.split(k).join(v), markup)
    .replace(/var\(--[\w-]+\s*,\s*([^()]+)\)/g, (_, fallback: string) => fallback.trim());

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

/** Grafiki do wklejenia w kartę — kopie żywych rysunków ze strony. */
export interface CardArt {
  /** Medal odznaki. Brak oznacza kartę z samym tytułem i liczbami albo z sylwetką. */
  medal?: SVGSVGElement | null | undefined;
  /** Twarze obsady do narożników nagłówka: pierwsza stoi po lewej, druga po prawej. */
  faces?: readonly (SVGSVGElement | null | undefined)[] | undefined;
}

/**
 * Papier blankietu: tło, kartka i podwójna ramka z zawijasami. Karta ma wyglądać jak
 * świadectwo wydane przez urząd, który nie istnieje — powaga formy przy błahości treści jest
 * tu całym żartem. Zawijasy tylko u góry: dolne narożniki zajmuje wstęga i spod niej
 * wystawały ich końcówki.
 */
function paper(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = INK.board;
  ctx.fillRect(0, 0, CARD, CARD);
  ctx.fillStyle = INK.paper;
  ctx.fillRect(56, 56, CARD - 112, CARD - 112);
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, CARD - 112, CARD - 112);
  ctx.lineWidth = 1;
  ctx.strokeRect(74, 74, CARD - 148, CARD - 148);
  flourish(ctx, 92, 92, 1, 1);
  flourish(ctx, CARD - 92, 92, -1, 1);
}

const toPng = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Nie udało się zapisać obrazka.'))), 'image/png');
  });

/**
 * Kwadratowa karta do wpisu. Kwadrat, bo mieści się bez przycięcia w każdym serwisie,
 * w którym prostokąt bywa kadrowany inaczej niż autor zakładał.
 */
export async function shareCard(s: ShareSubject, { medal, faces = [] }: CardArt = {}): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = CARD;
  c.height = CARD;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Przeglądarka nie udostępnia rysowania na płótnie.');
  const seed = s.seed ?? s.title.length + s.lines.length;

  // Czekamy na kroje pisma: `fillText` przed ich załadowaniem rysuje zapasowym fontem.
  if (document.fonts?.ready) await document.fonts.ready;

  paper(ctx);

  ctx.textAlign = 'center';
  // Linia bazowa u góry: przy domyślnej („alphabetic”) wysokość wiersza zależy od kroju
  // i wersaliki tytułu wchodziły na wiersz nad nim.
  ctx.textBaseline = 'top';

  const FONT = {
    kind: '600 30px "IBM Plex Sans", system-ui, sans-serif',
    brand: '600 40px "Oswald", system-ui, sans-serif',
    band: '600 34px "IBM Plex Sans", system-ui, sans-serif',
    title: '600 76px "Oswald", system-ui, sans-serif',
    line: '400 37px "IBM Plex Sans", system-ui, sans-serif',
    punch: '600 38px "Oswald", system-ui, sans-serif',
    sign: '400 25px "IBM Plex Sans", system-ui, sans-serif',
    serial: '400 23px "IBM Plex Sans", system-ui, sans-serif',
  };

  // Obsada w narożnikach nagłówka, jak herbowe postacie po bokach godła. Nagłówek jest
  // wąski, więc medaliony nie zabierają treści ani piksela w pionie — a karta bez nich
  // wyglądała jak wydruk z urzędu, nie z aplikacji z gorylami.
  const [left, right] = await Promise.all(
    [0, 1].map((i) => {
      const f = faces[i];
      return f ? loadSvg(standaloneSvg(f, 320)).catch(() => null) : Promise.resolve(null);
    }),
  );
  if (left) portrait(ctx, left, PORTRAIT.x, PORTRAIT.y);
  if (right) portrait(ctx, right, CARD - PORTRAIT.x, PORTRAIT.y);

  // Pieczęć wchodzi na prawy medalion, jak na zdjęcie w legitymacji. W stopce przykrywała
  // adres; przy prawej krawędzi pod nagłówkiem jest miejsce, którego treść nie zajmuje —
  // medal i sylwetka stoją pośrodku, a tytuł karty bez grafiki zaczyna się niżej. Idzie
  // przed napisami: gdy długi tytuł jednak do niej dosięgnie, wydrukuje się na niej.
  stamp(ctx, pick(STAMPS, seed), STAMP.x, STAMP.y);

  // Napisy nagłówka mieszczą się między medalionami. Najdłuższa sentencja dziś się
  // mieści; dopasowanie jest dla tej, którą ktoś dopisze jutro.
  const between = CARD - 2 * (PORTRAIT.x + PORTRAIT.r + 24);
  ctx.fillStyle = INK.accent;
  ctx.font = FONT.kind;
  ctx.fillText(
    s.kind === 'progress' ? 'LEGITYMACJA SIŁOWA' : 'ŚWIADECTWO POCIĘŻAROWE',
    CARD / 2,
    108,
  );
  ctx.fillStyle = INK.dark;
  ctx.font = FONT.brand;
  ctx.fillText('GYM TRACKER', CARD / 2, 146);
  ctx.fillStyle = INK.faint;
  const motto = pick(MOTTOS, seed);
  fit(ctx, motto, (px) => `500 ${px}px "IBM Plex Sans", system-ui, sans-serif`, 23, between, 17);
  ctx.fillText(motto, CARD / 2, 196);

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
  const BAND_ROW = 58;
  const text =
    (s.band ? BAND_ROW : 0) +
    titleLines.length * 88 +
    (bodyLines.length ? 16 + bodyLines.length * 50 : 0) +
    (punchLines.length ? 22 + punchLines.length * 48 : 0);

  // Blok treści jeździ pionowo między nagłówkiem a wstęgą, więc karta bez medalu nie
  // zostawia dziury na środku, a karta z medalem nie wypycha tekstu pod krawędź.
  const top = 238;
  // Pole treści kończy się nad wierszem hasła, a nie nad samą wstęgą.
  const bottom = SLOGAN_Y - 24;
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
    ctx.fillStyle = INK.soft;
    ctx.font = FONT.band;
    ctx.fillText(s.band.toUpperCase(), CARD / 2, y);
    y += BAND_ROW;
  }

  ctx.fillStyle = INK.dark;
  ctx.font = FONT.title;
  titleLines.forEach((l) => {
    ctx.fillText(l, CARD / 2, y);
    y += 88;
  });

  if (bodyLines.length) {
    y += 16;
    ctx.fillStyle = INK.soft;
    ctx.font = FONT.line;
    bodyLines.forEach((l) => {
      ctx.fillText(l, CARD / 2, y);
      y += 50;
    });
  }

  if (punchLines.length) {
    y += 22;
    ctx.fillStyle = INK.accent;
    ctx.font = FONT.punch;
    punchLines.forEach((l) => {
      ctx.fillText(l, CARD / 2, y);
      y += 48;
    });
  }

  // Podpis idzie pod treść, a nie na sztywno: przy dwuwierszowym tytule albo długiej puencie
  // blok rósł w dół i zawijas lądował na tekście. Gdy miejsca zabraknie, podpisu nie ma —
  // lepiej dokument bez podpisu niż podpis w poprzek zdania albo na wstędze.
  const signY = y + 26;
  if (signY + 62 < SLOGAN_Y - 8) signature(ctx, CARD / 2, signY, pick(SIGNATORIES, seed));

  // Kto zobaczy kartę w cudzym kanale, nie wie, co to GYM TRACKER — hasło mówi to jednym
  // zdaniem, zanim wzrok zjedzie na adres.
  slogan(ctx, SLOGAN_Y);
  ribbon(ctx, APP_HOST, RIBBON.y);

  // Numer wydania: wygląda urzędowo, nie znaczy nic. O to chodzi.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = FONT.serial;
  ctx.fillStyle = INK.faint;
  ctx.fillText(serial(s), CARD / 2, RIBBON.y + RIBBON.h + RIBBON.drop + 8);

  return toPng(c);
}

/* ---------------- Plakat polecający ---------------- */

/** Obsada plakatu: Siwy pośrodku, podopieczni po bokach. Kopie żywych rysunków, jak portrety na karcie. */
export interface PromoArt {
  coach?: SVGSVGElement | null | undefined;
  left?: SVGSVGElement | null | undefined;
  right?: SVGSVGElement | null | undefined;
}

/** Proporcje popiersia goryla (viewBox 312 × 280). */
const BUST = 280 / 312;

/**
 * Plakat do polecenia aplikacji: ogłoszenie naboru, które wydaje ten sam urząd, co certyfikaty.
 * „Trener Siwy szuka podopiecznych”, Siwy wskazuje palcem jak na starym plakacie werbunkowym,
 * podopieczni po bokach — jeden z telefonem, druga z bicepsem. Pod obsadą hasło, jedno zdanie
 * o tym, co aplikacja robi, pieczęć „za darmo” i wstęga z adresem. Drobny druk zamiast numeru
 * wydania, bo ogłoszenie ma regulamin.
 */
export async function promoCard({ coach, left, right }: PromoArt = {}): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = CARD;
  c.height = CARD;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Przeglądarka nie udostępnia rysowania na płótnie.');
  if (document.fonts?.ready) await document.fonts.ready;

  paper(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = INK.accent;
  ctx.font = '600 30px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText('OGŁOSZENIE · NABÓR OTWARTY', CARD / 2, 104);
  ctx.fillStyle = INK.dark;
  ctx.font = '600 76px "Oswald", system-ui, sans-serif';
  ctx.fillText('Trener Siwy', CARD / 2, 146);
  ctx.fillText('szuka podopiecznych', CARD / 2, 228);

  // Obsada: Siwy większy i wyżej, podopieczni niżej po bokach — stopy (tu: dół popiersia)
  // na jednej linii, jak na zdjęciu grupowym.
  const [imgCoach, imgLeft, imgRight] = await Promise.all(
    [coach, left, right].map((svg) => (svg ? loadSvg(standaloneSvg(svg, 600)).catch(() => null) : Promise.resolve(null))),
  );
  const floor = 652;
  const side = 256;
  const mid = 340;
  if (imgLeft) ctx.drawImage(imgLeft, 120, floor - side * BUST, side, side * BUST);
  if (imgRight) ctx.drawImage(imgRight, CARD - 120 - side, floor - side * BUST, side, side * BUST);
  if (imgCoach) ctx.drawImage(imgCoach, (CARD - mid) / 2, floor - mid * BUST, mid, mid * BUST);
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, floor);
  ctx.lineTo(CARD - 110, floor);
  ctx.stroke();

  // Pieczęć obok uniesionego palca Siwego — ta sama, co na certyfikatach, z innym wyrokiem.
  // Na obsadzie zakrywała twarze; tu stoi w pustym polu, w które i tak patrzy się po palcu.
  stamp(ctx, ['ZA DARMO', 'na razie'], CARD - 168, 388);

  ctx.fillStyle = INK.dark;
  fit(ctx, TAGLINE, (px) => `600 ${px}px "Oswald", system-ui, sans-serif`, 50, CARD - 200, 34);
  ctx.fillText(TAGLINE, CARD / 2, floor + 22);

  ctx.fillStyle = INK.soft;
  ctx.font = '400 29px "IBM Plex Sans", system-ui, sans-serif';
  const pitch = wrap(ctx, PITCH, CARD - 220);
  pitch.forEach((l, i) => ctx.fillText(l, CARD / 2, floor + 86 + i * 38));
  ctx.fillStyle = INK.faint;
  ctx.font = '500 25px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(PROMO_EXTRAS, CARD / 2, floor + 98 + pitch.length * 38);

  ribbon(ctx, APP_HOST, RIBBON.y);

  ctx.font = '400 23px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = INK.faint;
  ctx.fillText('Opłata wpisowa: 0 zł · bez konta i bez reklam · zakwasy wliczone', CARD / 2, RIBBON.y + RIBBON.h + RIBBON.drop + 8);

  return toPng(c);
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
export function share(s: ShareSubject, file?: Blob | null): Promise<ShareResult> {
  return shareRaw({ title: s.title, text: shareText(s), file });
}

/** Wysyłka dowolnego wpisu z obrazkiem — certyfikatu albo plakatu polecającego. */
export async function shareRaw({
  title,
  text,
  file,
}: {
  title: string;
  text: string;
  file?: Blob | null | undefined;
}): Promise<ShareResult> {
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
          : { title, text, url: APP_URL };
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
