/**
 * Ekipa GYM TRACKERA: goryle — zwierzę, które rośnie siłą przez całe życie, a srebrny
 * grzbiet dostaje dopiero z wiekiem i doświadczeniem. Idealna metafora progresji.
 *
 *  - Gustaw — podopieczny, młody samiec (niewielki grzebień strzałkowy, pomarańczowa opaska).
 *  - Gosia  — podopieczna, samica (okrągła głowa bez grzebienia, kitka z gumką, top sportowy).
 *  - Siwy   — trener, stary srebrnogrzbiety (duży grzebień, srebrne barki, okulary do
 *             czytania, gwizdek). Spokój, wiedza, motywacja.
 *
 * Źródłem prawdy dla tych postaci jest system projektowy GYM TRACKER (artefakt „Design
 * System”, grupy zasobów Gustaw, Gosia i Trener Siwy). Zmiany w wyglądzie obsady idą
 * najpierw tam, a dopiero potem tutaj — inaczej grafiki poza aplikacją rozjadą się z tym,
 * co widać na ekranie.
 *
 * Budowa na referencji goryla: masywne barki i kaptury, prawie brak szyi, ręce grubsze niż
 * u człowieka (przedramię niemal jak ramię), duże dłonie, wysunięty pysk z płaskim, szerokim
 * nosem, łuk brwiowy nad głęboko osadzonymi oczami. Kreska komiksowa: jeden kontur `ink`,
 * płaskie wypełnienia, emocja w brwiach, oczach i ustach.
 */

import type { ReactNode } from 'react';

export type Who = 'gustaw' | 'gosia' | 'siwy';
export type TraineeMood =
  | 'longing' | 'content' | 'proud' | 'happy' | 'amazed' | 'euphoric'
  | 'tired' | 'sore' | 'record' | 'missed' | 'comeback' | 'share';
export type CoachMood = 'coffee' | 'wise' | 'approve' | 'calm' | 'wink';
export type GorillaMood = TraineeMood | CoachMood;

type Arm = 'down' | 'flex' | 'up' | 'thumb' | 'head' | 'shoulder' | 'point' | 'phone' | 'fist' | 'hang' | 'peace' | 'hip' | 'cross' | 'sip';
type Eyes = 'open' | 'side' | 'happy' | 'wide' | 'droopy' | 'wince' | 'wink' | 'focus' | 'calm' | 'over';
type Brows = 'neutral' | 'up' | 'sad' | 'angry' | 'one' | 'relaxed';
type Mouth = 'smile' | 'grin' | 'o' | 'laugh' | 'pout' | 'grit' | 'tongue' | 'wavy' | 'smirk';
type Extra = 'sweat' | 'blush' | 'tears' | 'sparkle' | 'pain' | 'lines' | 'drop' | 'stars' | 'bulb';

interface Spec { l: Arm; r: Arm; eyes: Eyes; brows: Brows; mouth: Mouth; x?: Extra[]; label: string }

export const TRAINEE_MOODS: Record<TraineeMood, Spec> = {
  longing:  { l: 'down',  r: 'down',     eyes: 'side',   brows: 'sad',     mouth: 'pout',   x: ['drop'],                      label: 'Tęsknota — odznaka jeszcze nie zdobyta' },
  content:  { l: 'down',  r: 'thumb',    eyes: 'open',   brows: 'relaxed', mouth: 'smile',                                    label: 'Zadowolenie — brąz' },
  proud:    { l: 'hip',   r: 'flex',     eyes: 'open',   brows: 'one',     mouth: 'smirk',                                    label: 'Duma — srebro' },
  happy:    { l: 'flex',  r: 'flex',     eyes: 'happy',  brows: 'relaxed', mouth: 'grin',   x: ['blush'],                     label: 'Radość — złoto' },
  amazed:   { l: 'up',    r: 'up',       eyes: 'wide',   brows: 'up',      mouth: 'o',      x: ['sparkle'],                   label: 'Zachwyt — platyna' },
  euphoric: { l: 'up',    r: 'up',       eyes: 'happy',  brows: 'up',      mouth: 'laugh',  x: ['tears', 'sparkle', 'blush'], label: 'Euforia — szmaragd' },
  tired:    { l: 'hang',  r: 'hang',     eyes: 'droopy', brows: 'sad',     mouth: 'tongue', x: ['sweat', 'lines'],            label: 'Zmęczenie' },
  sore:     { l: 'down',  r: 'shoulder', eyes: 'wince',  brows: 'angry',   mouth: 'grit',   x: ['pain', 'sweat'],             label: 'Zakwasy' },
  record:   { l: 'fist',  r: 'point',    eyes: 'wide',   brows: 'up',      mouth: 'laugh',  x: ['stars'],                     label: 'Nowy rekord' },
  missed:   { l: 'down',  r: 'head',     eyes: 'open',   brows: 'sad',     mouth: 'wavy',   x: ['drop', 'blush'],             label: 'Opuszczony trening' },
  comeback: { l: 'fist',  r: 'hip',      eyes: 'focus',  brows: 'angry',   mouth: 'smirk',  x: ['lines'],                     label: 'Powrót po przerwie' },
  share:    { l: 'peace', r: 'phone',    eyes: 'wink',   brows: 'one',     mouth: 'grin',                                     label: 'Chwalę się' },
};

export const COACH_MOODS: Record<CoachMood, Spec> = {
  coffee:  { l: 'sip',   r: 'down',  eyes: 'calm',  brows: 'relaxed', mouth: 'smile',                  label: 'Espresso na spokojnie' },
  wise:    { l: 'down',  r: 'point', eyes: 'over',  brows: 'one',     mouth: 'smirk', x: ['bulb'],     label: 'Rada trenera' },
  approve: { l: 'down',  r: 'thumb', eyes: 'happy', brows: 'relaxed', mouth: 'grin',                   label: 'Aprobata' },
  calm:    { l: 'cross', r: 'cross', eyes: 'calm',  brows: 'relaxed', mouth: 'smile',                  label: 'Pewność i spokój' },
  wink:    { l: 'sip',   r: 'thumb', eyes: 'wink',  brows: 'one',     mouth: 'smirk', x: ['sparkle'],  label: 'Porozumiewawcze mrugnięcie' },
};

export const WHO_NAME: Record<Who, string> = { gustaw: 'Gustaw', gosia: 'Gosia', siwy: 'Trener Siwy' };

/* ---------------- Wygląd ---------------- */

const INK = 'var(--ink, #1e2320)';
const ORANGE = 'var(--c-orange, #d97757)';
const MOUTH = '#5c2320';
const TONGUE = '#d9776a';
const W = 3.2;

interface Look {
  fur: string; // sierść ciała
  arm: string; // sierść rąk
  head: string; // sierść głowy
  crown?: string; // srebrna czapa (Siwy)
  skin: string; // naga skóra twarzy i dłoni
  muzzle: string; // jaśniejszy pysk
  brow: string; // kolor brwi
  line: string; // rysunek mięśni i sierści (jaśniejszy od sierści)
  crest: number; // wysokość grzebienia strzałkowego
  body: number; // skala tułowia i rąk (samica mniejsza)
  band: boolean; // opaski na nadgarstkach
}

// Kolory obsady płyną z tokenów systemu (fallback = wartości tokenów), więc postacie
// i interfejs zawsze mają tę samą paletę.
const FUR = 'var(--fur, #3f3c44)', HIDE = 'var(--hide, #7f7589)', MUZ = 'var(--muzzle, #a69bab)', FLINE = 'var(--fur-line, #5f5b66)';
const LOOK: Record<Who, Look> = {
  gustaw: { fur: FUR, arm: FUR, head: FUR, skin: HIDE, muzzle: MUZ, brow: '#1b181d', line: FLINE, crest: 8, body: 1, band: true },
  gosia:  { fur: FUR, arm: FUR, head: FUR, skin: HIDE, muzzle: MUZ, brow: '#1b181d', line: FLINE, crest: 0, body: 0.92, band: true },
  siwy:   { fur: 'var(--silver-fur, #a4a7ae)', arm: FUR, head: FUR, crown: 'var(--silver, #b9bcc2)', skin: HIDE, muzzle: MUZ, brow: 'var(--silver, #b9bcc2)', line: 'var(--silver, #b9bcc2)', crest: 16, body: 1.04, band: false },
};

/* ---------------- Ręce ---------------- */

type P = [number, number];
type HandKind = 'fist' | 'thumb' | 'open' | 'point' | 'peace' | 'none' | 'phone' | 'bigfist' | 'cup';
// Lewa strona obrazka; prawa to lustro x → 240 − x. Ręce goryla: ramię ≈ przedramię, oba grube.
const SH: P = [42, 150];
const ARMS: Record<Arm, { e: P; h: P; hand: HandKind; flex?: boolean; behind?: boolean }> = {
  down:     { e: [24, 222], h: [32, 292], hand: 'none' },
  hang:     { e: [28, 226], h: [42, 296], hand: 'none' },
  flex:     { e: [-18, 136], h: [0, 72],   hand: 'fist', flex: true },
  up:       { e: [6, 90],    h: [14, 26],  hand: 'fist' },
  thumb:    { e: [24, 224], h: [88, 204],  hand: 'thumb' },
  head:     { e: [-6, 98],   h: [62, 50],  hand: 'open', behind: true },
  shoulder: { e: [80, 232],  h: [166, 158], hand: 'open' },
  point:    { e: [4, 96],    h: [12, 34],  hand: 'point' },
  phone:    { e: [-20, 108], h: [-14, 44], hand: 'phone' },
  peace:    { e: [2, 210],   h: [60, 170], hand: 'peace' },
  fist:     { e: [48, 232],  h: [92, 188], hand: 'bigfist' },
  hip:      { e: [-12, 204], h: [32, 236], hand: 'fist' },
  cross:    { e: [30, 236],  h: [150, 214], hand: 'fist' },
  sip:      { e: [26, 222],  h: [92, 150], hand: 'cup' },
};

const mir = (p: P, m: boolean): P => (m ? [240 - p[0], p[1]] : p);

function cone(a: P, ra: number, b: P, rb: number): string {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const f = (v: number) => v.toFixed(1);
  return `M${f(a[0] + nx * ra)} ${f(a[1] + ny * ra)} L${f(b[0] + nx * rb)} ${f(b[1] + ny * rb)} L${f(b[0] - nx * rb)} ${f(b[1] - ny * rb)} L${f(a[0] - nx * ra)} ${f(a[1] - ny * ra)} Z`;
}

function Silhouette({ parts, pad, fill }: { parts: [P, number, P, number][]; pad: number; fill: string }) {
  return (
    <g fill={fill}>
      {parts.map(([a, ra, b, rb], i) => (
        <g key={i}>
          <path d={cone(a, ra + pad, b, rb + pad)} />
          <circle cx={a[0]} cy={a[1]} r={ra + pad} />
          <circle cx={b[0]} cy={b[1]} r={rb + pad} />
        </g>
      ))}
    </g>
  );
}

function Hand({ kind, at, m, from, lk }: { kind: HandKind; at: P; m: boolean; from: P; lk: Look }) {
  const [x, y] = at;
  const s = m ? -1 : 1;
  const SK = lk.skin;
  const o = { stroke: INK, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const ang = (Math.atan2(y - from[1], x - from[0]) * 180) / Math.PI;
  const kn = { fill: 'none', stroke: lk.muzzle, strokeWidth: 2.4, strokeLinecap: 'round' as const };
  const knuckles = <path d={`M${-10 * s} -4 q ${7 * s} -3 ${14 * s} 0 M${-10 * s} 3 q ${7 * s} -3 ${14 * s} 0`} {...kn} />;
  const T = (c: ReactNode, sc = 1.25) => <g transform={`translate(${x} ${y}) scale(${sc})`}>{c}</g>;
  switch (kind) {
    case 'none':
      return null;
    case 'fist':
      return T(<><rect x={-14} y={-13} width={28} height={26} rx={10} fill={SK} {...o} strokeWidth={W / 1.25} />{knuckles}</>);
    case 'bigfist':
      return T(<><rect x={-14} y={-13} width={28} height={26} rx={10} fill={SK} {...o} strokeWidth={W / 1.6} />{knuckles}<path d={`M${-12 * s} 7 q ${11 * s} 5 ${20 * s} -2`} {...kn} /></>, 1.6);
    case 'thumb':
      return T(<><rect x={-6} y={-32} width={12} height={26} rx={6} fill={SK} {...o} strokeWidth={W / 1.25} /><rect x={-15} y={-12} width={30} height={25} rx={10} fill={SK} {...o} strokeWidth={W / 1.25} /><path d="M-10 -1 h16 M-10 6 h15" {...kn} /></>);
    case 'point':
      return T(<><rect x={-5.5} y={-36} width={11} height={28} rx={5.5} fill={SK} {...o} strokeWidth={W / 1.25} /><rect x={-14} y={-12} width={28} height={25} rx={10} fill={SK} {...o} strokeWidth={W / 1.25} /><path d={`M${-8 * s} 0 h ${14 * s} M${-8 * s} 6 h ${13 * s}`} {...kn} /></>);
    case 'peace':
      return T(<><rect x={-11} y={-36} width={10} height={28} rx={5} fill={SK} {...o} strokeWidth={W / 1.25} transform="rotate(-14)" /><rect x={1} y={-36} width={10} height={28} rx={5} fill={SK} {...o} strokeWidth={W / 1.25} transform="rotate(14)" /><rect x={-14} y={-12} width={28} height={25} rx={10} fill={SK} {...o} strokeWidth={W / 1.25} /><path d="M-8 2 h14" {...kn} /></>);
    case 'open':
      return (
        <g transform={`translate(${x} ${y}) rotate(${ang - 90}) scale(1.25)`}>
          <path d="M-13 -6 C-13 -16 13 -16 13 -6 L13 12 C13 18 -13 18 -13 12 Z" fill={SK} {...o} strokeWidth={W / 1.25} />
          <path d="M-6 14 v10 M0 15 v11 M6 14 v10" fill="none" stroke={INK} strokeWidth={W / 1.25} strokeLinecap="round" />
        </g>
      );
    case 'phone':
      return T(<><rect x={-13} y={-38} width={26} height={44} rx={4} fill="var(--steel, #3c423d)" {...o} strokeWidth={W / 1.25} /><rect x={-9} y={-33} width={18} height={31} rx={2} fill="var(--c-light, #faf9f5)" /><circle cx={0} cy={-27} r={2.2} fill={ORANGE} /><rect x={-14} y={-4} width={28} height={22} rx={9} fill={SK} {...o} strokeWidth={W / 1.25} /></>);
    case 'cup':
      // Filiżanka espresso w wielkiej łapie, mały palec w górze — cała elegancja trenera.
      return T(
        <>
          <g fill="none" stroke="var(--ink-soft, #595f58)" strokeWidth={1.8} strokeLinecap="round">
            <path d={`M${10 * s} -22 q-3 -5 0 -9 t0 -9`} />
            <path d={`M${17 * s} -21 q-3 -5 0 -9 t0 -9`} />
          </g>
          <path d={`M${4 * s} -14 h${22 * s} l${-2 * s} 12 a4 4 0 0 1 ${-4 * s} 3 h${-10 * s} a4 4 0 0 1 ${-4 * s} -3 Z`} fill="#fff" {...o} strokeWidth={2.2} />
          <path d={`M${26 * s} -11 a4 4 0 0 1 0 7`} fill="none" stroke={INK} strokeWidth={2.2} />
          <rect x={s > 0 ? 0 : -30} y={1} width={30} height={4} rx={2} fill="#fff" {...o} strokeWidth={1.8} />
          <rect x={-15} y={-6} width={24} height={22} rx={9} fill={SK} {...o} strokeWidth={W / 1.25} />
          <rect x={s > 0 ? -18 : 12} y={-18} width={7} height={16} rx={3.5} fill={SK} {...o} strokeWidth={W / 1.25} transform={`rotate(${-18 * s} ${s > 0 ? -14 : 15} -2)`} />
        </>,
        1.2,
      );
  }
}

function ArmG({ kind, m, lk, part = 'all' }: { kind: Arm; m: boolean; lk: Look; part?: 'all' | 'arm' | 'hand' }) {
  const a = ARMS[kind];
  const sh = mir(SH, m);
  const e = mir(a.e, m);
  const h = mir(a.h, m);
  const mid: P = [(sh[0] + e[0]) / 2, (sh[1] + e[1]) / 2];
  const dx = e[0] - sh[0], dy = e[1] - sh[1], L = Math.hypot(dx, dy);
  const side = m ? -1 : 1;
  const bulge: P = [mid[0] + (dy / L) * 13 * side, mid[1] - (dx / L) * 13 * side];
  const parts: [P, number, P, number][] = [
    [sh, 28, e, 19], // potężny naramienny → łokieć
    [e, 20, h, 15], // przedramię goryla prawie tak grube jak ramię
  ];
  if (a.flex) parts.push([bulge, 18, mid, 15]);
  const at = (t: number): P => [e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t];
  const w1 = at(0.7), w2 = at(0.84);
  const fore = (t: number): P => [e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t];
  const f1 = fore(0.25), f2 = fore(0.55);
  const arm = (
    <g>
      <Silhouette parts={parts} pad={W} fill={INK} />
      <Silhouette parts={parts} pad={0} fill={lk.arm} />
      {/* rysunek sierści: bruzda naramiennego i pasmo na przedramieniu */}
      <g fill="none" stroke={lk.line} strokeWidth={2.4} strokeLinecap="round">
        <path d={`M${sh[0] + 16 * side} ${sh[1] + 10} q ${-8 * side} 12 ${-3 * side} 24`} />
        <path d={`M${f1[0] + 6 * side} ${f1[1]} L${f2[0] + 7 * side} ${f2[1]}`} />
      </g>
      {lk.band && a.hand !== 'none' && (
        <>
          <path d={`M${w1[0]} ${w1[1]} L${w2[0]} ${w2[1]}`} stroke={INK} strokeWidth={31 + W * 2} />
          <path d={`M${w1[0]} ${w1[1]} L${w2[0]} ${w2[1]}`} stroke={ORANGE} strokeWidth={31} />
        </>
      )}
    </g>
  );
  const hand = <Hand kind={a.hand} at={h} m={m} from={e} lk={lk} />;
  if (part === 'arm') return arm;
  if (part === 'hand') return hand;
  return <g>{arm}{hand}</g>;
}

/* ---------------- Twarz ---------------- */

function EyesG({ k, lk }: { k: Eyes; lk: Look }) {
  const o = { stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const white = '#fff';
  const iris = '#4a2a14';
  const one = (c: P, kind: Eyes, i: number): ReactNode => {
    const [x, y] = c;
    switch (kind) {
      case 'happy':
        return <path key={i} d={`M${x - 6} ${y + 2} Q${x} ${y - 6} ${x + 6} ${y + 2}`} {...o} stroke="#fff" strokeWidth={3.2} />;
      case 'wince':
        return <path key={i} d={i ? `M${x + 6} ${y - 4} L${x - 5} ${y} L${x + 6} ${y + 4}` : `M${x - 6} ${y - 4} L${x + 5} ${y} L${x - 6} ${y + 4}`} {...o} stroke="#fff" strokeWidth={3.2} />;
      case 'wink':
        return i ? one(c, 'happy', i) : one(c, 'open', i);
      case 'wide':
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={7} ry={7.5} fill={white} stroke={INK} strokeWidth={2.4} />
            <circle cx={x} cy={y} r={3} fill={iris} />
            <circle cx={x} cy={y} r={1.5} fill={INK} />
          </g>
        );
      case 'droopy':
      case 'calm':
        // Półprzymknięta powieka: u trenera spokój, u podopiecznego zmęczenie.
        return (
          <g key={i}>
            <ellipse cx={x} cy={y + 1} rx={5.8} ry={4.6} fill={white} stroke={INK} strokeWidth={2.4} />
            <circle cx={x} cy={y + (kind === 'calm' ? 2 : 3)} r={3} fill={iris} />
            <path d={`M${x - 7} ${y} Q${x} ${y - 5} ${x + 7} ${y} L${x + 7} ${y + 1.5} L${x - 7} ${y + 1.5} Z`} fill={lk.skin} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          </g>
        );
      case 'focus':
        return (
          <g key={i}>
            <ellipse cx={x} cy={y + 1} rx={5.8} ry={3.8} fill={white} stroke={INK} strokeWidth={2.4} />
            <circle cx={x} cy={y + 1} r={2.6} fill={iris} />
          </g>
        );
      default: {
        const dx = kind === 'side' ? 2.4 : 0;
        const dy = kind === 'side' || kind === 'over' ? -2 : 0;
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={5.8} ry={5.2} fill={white} stroke={INK} strokeWidth={2.4} />
            <circle cx={x + dx} cy={y + dy} r={3} fill={iris} />
            <circle cx={x + dx} cy={y + dy} r={1.4} fill={INK} />
            <circle cx={x + dx - 1.2} cy={y + dy - 1.3} r={0.9} fill="#fff" />
          </g>
        );
      }
    }
  };
  return <g>{[one([106, 86], k, 0), one([134, 86], k, 1)]}</g>;
}

function BrowsG({ k, lk }: { k: Brows; lk: Look }) {
  const o = { stroke: lk.brow, strokeWidth: 6.5, strokeLinecap: 'round' as const, fill: 'none' };
  const b: Record<Brows, [string, string]> = {
    neutral: ['M95 77 Q106 73 115 76', 'M125 76 Q134 73 145 77'],
    relaxed: ['M95 78 Q106 73 115 76', 'M125 76 Q134 73 145 78'],
    up:      ['M95 73 Q106 66 115 70', 'M125 70 Q134 66 145 73'],
    sad:     ['M95 78 Q106 76 115 71', 'M125 71 Q134 76 145 78'],
    angry:   ['M95 73 Q106 75 115 79', 'M125 79 Q134 75 145 73'],
    one:     ['M95 78 Q106 75 115 77', 'M125 73 Q134 67 145 72'],
  };
  return <g><path d={b[k][0]} {...o} /><path d={b[k][1]} {...o} /></g>;
}

function MouthG({ k }: { k: Mouth }) {
  const o = { stroke: INK, strokeWidth: 2.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const g = (c: ReactNode) => <g transform="translate(0 8)">{c}</g>;
  switch (k) {
    case 'smile':
      return g(<path d="M106 110 Q120 119 134 110" fill="none" {...o} />);
    case 'smirk':
      return g(<path d="M107 112 Q122 117 134 106" fill="none" {...o} />);
    case 'grin':
      return g(<><path d="M103 107 Q120 109 137 107 Q135 121 120 121 Q105 121 103 107 Z" fill={MOUTH} {...o} /><path d="M105.5 108.5 Q120 110.5 134.5 108.5 L134 112 Q120 114 106 112 Z" fill="#fff" /></>);
    case 'laugh':
      return g(<><path d="M101 105 Q120 107 139 105 Q137 125 120 125 Q103 125 101 105 Z" fill={MOUTH} {...o} /><path d="M104 106.5 Q120 108.5 136 106.5 L135.5 110 Q120 112 104.5 110 Z" fill="#fff" /><path d="M110 121 Q120 114 130 121 Q125 124 120 124 Q115 124 110 121 Z" fill={TONGUE} /></>);
    case 'o':
      return g(<ellipse cx={120} cy={114} rx={6.5} ry={8} fill={MOUTH} {...o} />);
    case 'pout':
      return g(<path d="M111 115 Q120 108 129 115" fill="none" {...o} />);
    case 'grit':
      return g(<><rect x={104} y={106} width={32} height={11} rx={4} fill="#fff" {...o} /><path d="M104 111.5 H136 M112 106 V117 M120 106 V117 M128 106 V117" stroke={INK} strokeWidth={1.6} /></>);
    case 'tongue':
      return g(<><path d="M106 107 Q120 104 134 107 Q132 118 120 118 Q108 118 106 107 Z" fill={MOUTH} {...o} /><path d="M114 113 Q114 126 121 126 Q128 126 128 113 Z" fill={TONGUE} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" /></>);
    case 'wavy':
      return g(<path d="M105 112 q3.75 -3 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none" {...o} />);
  }
}

/* ---------------- Dodatki ---------------- */

function Drop({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -10 C4 -4 7 0 7 4 A7 7 0 0 1 -7 4 C-7 0 -4 -4 0 -10 Z" fill="var(--c-blue, #6a9bcc)" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />;
}

function Spark({ x, y, s = 1, c = ORANGE }: { x: number; y: number; s?: number; c?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill={c} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />;
}

const FACE_EXTRAS: Extra[] = ['blush', 'sweat', 'drop', 'tears'];

function Extras({ x = [], only }: { x?: Extra[]; only: 'face' | 'body' }) {
  const has = (e: Extra) => x.includes(e) && FACE_EXTRAS.includes(e) === (only === 'face');
  return (
    <g>
      {has('blush') && (
        <g fill="var(--c-orange, #d97757)" opacity={0.55}>
          <ellipse cx={95} cy={104} rx={7} ry={4} />
          <ellipse cx={145} cy={104} rx={7} ry={4} />
        </g>
      )}
      {has('sweat') && <><Drop x={168} y={64} /><Drop x={72} y={58} s={0.75} /></>}
      {has('drop') && <Drop x={166} y={52} s={1.1} />}
      {has('tears') && (
        <g stroke={INK} strokeWidth={2} fill="var(--c-blue, #6a9bcc)" strokeLinejoin="round">
          <path d="M98 92 C92 100 90 108 94 112 C98 110 99 100 98 92 Z" />
          <path d="M142 92 C148 100 150 108 146 112 C142 110 141 100 142 92 Z" />
        </g>
      )}
      {has('sparkle') && <><Spark x={34} y={14} s={1.2} /><Spark x={210} y={20} c="var(--c-green, #788c5d)" /><Spark x={200} y={80} s={0.7} c="var(--c-blue, #6a9bcc)" /></>}
      {has('stars') && <><Spark x={176} y={10} s={1.1} /><Spark x={236} y={70} s={0.8} c="var(--c-green, #788c5d)" /><Spark x={56} y={24} s={0.7} c="var(--c-blue, #6a9bcc)" /></>}
      {has('pain') && (
        <g fill="none" stroke="var(--c-orange-ink, #94452c)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M196 116 l8 -8 l-2 8 l8 -8" /><path d="M206 136 l10 -2" /><path d="M198 100 l4 -9" />
        </g>
      )}
      {has('lines') && (
        <g fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" opacity={0.7}>
          <path d="M70 18 l-8 -8 M56 32 l-11 -3 M170 18 l8 -8 M184 32 l11 -3" />
        </g>
      )}
      {has('bulb') && (
        // Pomysł nad głową trenera: żarówka w kolorze akcentu.
        <g transform="translate(176 16)" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
          <path d="M0 -14 a11 11 0 0 1 7 19.5 v4 h-14 v-4 A11 11 0 0 1 0 -14 Z" fill="var(--c-orange-bg, #f7e8e0)" />
          <path d="M-6 12.5 h12 M-4 16 h8" fill="none" />
          <path d="M-16 -16 l-5 -5 M16 -16 l5 -5 M0 -20 v-7 M-19 -2 h-7 M19 -2 h7" fill="none" stroke={ORANGE} strokeWidth={2.6} />
        </g>
      )}
    </g>
  );
}

/* ---------------- Głowa ---------------- */

function Head({ s, who }: { s: Spec; who: Who }) {
  const lk = LOOK[who];
  const o = { stroke: INK, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const c = lk.crest;
  return (
    <g>
      {/* uszy: małe, nisko */}
      <ellipse cx={80} cy={92} rx={7} ry={9} fill={lk.skin} {...o} />
      <ellipse cx={160} cy={92} rx={7} ry={9} fill={lk.skin} {...o} />
      {/* czaszka z grzebieniem strzałkowym (samce) i szerokie policzki */}
      <path
        d={`M120 ${30 - c} C${136} ${30 - c * 0.7} 156 42 160 62 C164 82 164 100 158 114 C150 128 136 134 120 134 C104 134 90 128 82 114 C76 100 76 82 80 62 C84 42 ${104} ${30 - c * 0.7} 120 ${30 - c} Z`}
        fill={lk.head} {...o}
      />
      {lk.crown && (
        <path d={`M86 56 C88 36 104 ${26 - c * 0.7} 120 ${31 - c} C136 ${26 - c * 0.7} 152 36 154 56 C146 48 134 46 120 50 C106 46 94 48 86 56 Z`} fill={lk.crown} stroke="none" />
      )}
      {/* pasma sierści na czaszce */}
      <path d="M104 40 q6 -6 10 -4 M126 36 q6 -2 10 4" fill="none" stroke={lk.crown ? '#8e9198' : lk.line} strokeWidth={2.4} strokeLinecap="round" />
      {who === 'gosia' && (
        <g>
          {/* kitka związana pomarańczową gumką */}
          <path d="M112 30 C108 14 118 4 126 8 C134 12 132 24 126 30 Z" fill={lk.head} {...o} />
          <rect x={111} y={24} width={18} height={8} rx={4} fill={ORANGE} {...o} strokeWidth={2.4} />
        </g>
      )}
      {/* naga skóra twarzy — kształt serca z łukiem brwiowym */}
      <path d="M120 64 C130 58 150 60 153 76 C156 90 152 102 146 112 C138 124 130 129 120 129 C110 129 102 124 94 112 C88 102 84 90 87 76 C90 60 110 58 120 64 Z" fill={lk.skin} {...o} />
      {/* łuk brwiowy: cień nad oczami */}
      <path d="M90 80 C96 72 110 72 119 78 C130 72 144 72 150 80" fill="none" stroke={lk.line} strokeWidth={2.2} opacity={0.8} />
      {/* pysk i płaski, szeroki nos */}
      <ellipse cx={120} cy={114} rx={25} ry={17} fill={lk.muzzle} {...o} />
      <path d="M106 102 Q120 88 134 102 Q134 109 127 108 Q120 104 113 108 Q106 109 106 102 Z" fill={lk.skin} {...o} strokeWidth={2.6} />
      <ellipse cx={114} cy={104} rx={3} ry={2.2} fill={INK} />
      <ellipse cx={126} cy={104} rx={3} ry={2.2} fill={INK} />
      {who === 'gustaw' && (
        <g>
          <path d="M82 68 C100 58 140 58 158 68 L158 78 C140 68 100 68 82 78 Z" fill={ORANGE} {...o} />
          <path d="M158 70 l12 -6 l-2 10 Z M158 73 l13 4 l-8 6 Z" fill={ORANGE} {...o} />
        </g>
      )}
      <BrowsG k={s.brows} lk={lk} />
      {who === 'gosia' && (
        <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
          <path d="M99 82 l-4 -3 M101 80 l-2 -4 M141 82 l4 -3 M139 80 l2 -4" />
        </g>
      )}
      <EyesG k={s.eyes} lk={lk} />
      {who === 'siwy' && (
        <g>
          {/* okulary do czytania nisko na nosie: trener patrzy ponad nimi */}
          <g fill="rgba(255,255,255,.18)" stroke={INK} strokeWidth={2.4}>
            <rect x={96} y={90} width={20} height={11} rx={5} />
            <rect x={124} y={90} width={20} height={11} rx={5} />
          </g>
          <path d="M116 95 q4 -3 8 0 M96 94 l-10 -4 M144 94 l10 -4" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          {/* siwe bokobrody na policzkach */}
          <path d="M84 100 q4 14 14 22 M156 100 q-4 14 -14 22" fill="none" stroke={lk.crown} strokeWidth={4} strokeLinecap="round" />
        </g>
      )}
      <MouthG k={s.mouth} />
    </g>
  );
}

/* ---------------- Tułów ---------------- */

function Torso({ who }: { who: Who }) {
  const lk = LOOK[who];
  const o = { stroke: INK, strokeWidth: W, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <g>
      {/* kaptury wysoko pod uszami, prawie bez szyi, beczkowata klatka */}
      <path d="M120 100 C96 100 70 108 48 122 C26 136 16 158 16 186 C16 212 20 236 26 270 L214 270 C220 236 224 212 224 186 C224 158 214 136 192 122 C170 108 144 100 120 100 Z" fill={lk.fur} {...o} />
      {/* naga skóra klatki */}
      <path d="M88 132 C96 150 108 156 120 156 C132 156 144 150 152 132 C150 170 140 190 120 192 C100 190 90 170 88 132 Z" fill={lk.skin} stroke="none" opacity={who === 'gosia' ? 0 : 1} />
      <path d="M92 126 q10 8 22 8 M148 126 q-10 8 -22 8" fill="none" stroke={lk.line} strokeWidth={2.4} strokeLinecap="round" />
      {who === 'gustaw' && (
        <g>
          <path d="M86 116 C90 146 104 158 120 158 C136 158 150 146 154 116 L172 124 C176 160 182 210 186 270 L54 270 C58 210 64 160 68 124 Z" fill="var(--c-blue, #6a9bcc)" {...o} />
          <path d="M89 122 C94 146 106 154 120 154 C134 154 146 146 151 122" fill="none" stroke="var(--c-blue-ink, #385e84)" strokeWidth={2.6} />
          <g transform="translate(104 184) scale(1.35)" fill="none" stroke="var(--c-light, #faf9f5)" strokeWidth={2.2} strokeLinecap="round">
            <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11" />
          </g>
        </g>
      )}
      {who === 'gosia' && (
        <g>
          <path d="M82 122 C92 144 106 152 120 152 C134 152 148 144 158 122 L174 130 C176 156 178 182 180 206 C150 218 90 218 60 206 C62 182 64 156 66 130 Z" fill="var(--c-green, #788c5d)" {...o} />
          <path d="M61 196 C90 208 150 208 179 196" fill="none" stroke="var(--c-green-ink, #54633f)" strokeWidth={6} />
          <path d="M120 152 v40" stroke="var(--c-green-ink, #54633f)" strokeWidth={2.4} />
          <g transform="translate(132 164) scale(0.9)" fill="none" stroke="var(--c-light, #faf9f5)" strokeWidth={2.4} strokeLinecap="round">
            <path d="M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11" />
          </g>
        </g>
      )}
      {who === 'siwy' && (
        <g>
          {/* kamizelka trenera ze stójką i zamkiem */}
          <path d="M84 114 C90 146 104 160 120 160 C136 160 150 146 156 114 L174 122 C178 160 184 210 188 270 L52 270 C56 210 62 160 66 122 Z" fill="var(--steel, #3c423d)" {...o} />
          <path d="M84 114 L92 106 L108 128 M156 114 L148 106 L132 128" fill="var(--steel, #3c423d)" {...o} />
          <path d="M120 196 V222 M120 244 V270" stroke="var(--c-mid, #b0aea5)" strokeWidth={2.4} />
          <path d="M66 150 L174 150" stroke={ORANGE} strokeWidth={0} />
          <path d="M60 200 L90 196 M180 200 L150 196" stroke={ORANGE} strokeWidth={5} strokeLinecap="round" />
          <text x={120} y={238} textAnchor="middle" fontFamily="var(--font-display, Oswald, sans-serif)" fontWeight={600} fontSize={11} letterSpacing="1" fill="var(--c-light, #faf9f5)">TRENER</text>
          {/* gwizdek na smyczy */}
          <path d="M100 124 Q104 160 112 176 M140 124 Q136 160 128 176" fill="none" stroke={ORANGE} strokeWidth={2.6} />
          <g transform="translate(120 182)">
            <rect x={-12} y={-7} width={22} height={13} rx={6} fill="var(--c-mid, #b0aea5)" {...o} strokeWidth={2.4} />
            <rect x={8} y={-7} width={8} height={6} rx={2} fill="var(--c-mid, #b0aea5)" {...o} strokeWidth={2.2} />
            <circle cx={-3} cy={0} r={2.4} fill={INK} />
          </g>
        </g>
      )}
    </g>
  );
}

/* ---------------- Komponent ---------------- */

const specOf = (who: Who, mood: GorillaMood): Spec =>
  who === 'siwy'
    ? COACH_MOODS[(mood in COACH_MOODS ? mood : 'calm') as CoachMood]
    : TRAINEE_MOODS[(mood in TRAINEE_MOODS ? mood : 'content') as TraineeMood];

export function Gorilla({
  who = 'gustaw',
  mood = 'content',
  crop = 'bust',
  size = 200,
  title,
}: {
  who?: Who;
  mood?: GorillaMood;
  crop?: 'bust' | 'face';
  size?: number;
  title?: string;
}) {
  const s = specOf(who, mood);
  const lk = LOOK[who];
  const face = crop === 'face';
  const vb = face ? [58, 2, 124, 136] : [-36, -14, 312, 280];
  const behind = (a: Arm) => !!ARMS[a].behind;
  // Głowa goryla jest mała względem barków i osadzona nisko, prawie bez szyi.
  const headT = face ? undefined : `translate(120 ${who === 'gosia' ? 130 : 128}) scale(${who === 'gosia' ? 0.86 : 0.9}) translate(-120 -134)`;
  const bodyT = `translate(120 270) scale(${lk.body}) translate(-120 -270)`;
  return (
    <svg
      className={`gorilla gorilla-${who} gorilla-${mood}`}
      width={size}
      height={Math.round((size * vb[3]!) / vb[2]!)}
      viewBox={vb.join(' ')}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      {!face && (
        <g transform={bodyT}>
          {behind(s.l) && <ArmG kind={s.l} m={false} lk={lk} part="arm" />}
          {behind(s.r) && <ArmG kind={s.r} m={true} lk={lk} part="arm" />}
          <Torso who={who} />
        </g>
      )}
      <g transform={headT}>
        <Head s={s} who={who} />
        <Extras x={s.x} only="face" />
      </g>
      {!face && (
        <g transform={bodyT}>
          {behind(s.l) && <ArmG kind={s.l} m={false} lk={lk} part="hand" />}
          {behind(s.r) && <ArmG kind={s.r} m={true} lk={lk} part="hand" />}
          {!behind(s.l) && <ArmG kind={s.l} m={false} lk={lk} />}
          {!behind(s.r) && <ArmG kind={s.r} m={true} lk={lk} />}
        </g>
      )}
      {!face && <Extras x={s.x} only="body" />}
    </svg>
  );
}
