import { memo, useId } from 'react';
import { kbColor } from '../data/exercises';
import { MOVES } from '../data/moves';
import { planScene, workoutScene } from '../data/scenes';
import type { Gag, Scene, Setting } from '../data/scenes';
import type { PlanTemplate } from '../types';
import { Gorilla } from './Gorilla';
import { Mannequin } from './Mannequin';

/**
 * Ilustracje do kart treningów i planów — sceny z ekipą goryli, przeniesione z systemu
 * projektowego (`WorkoutArt`, `PlanArt`).
 *
 * Format 2:1, viewBox 600×300, szerokość treści karty: 332, 362 i 402 px na telefonach 360,
 * 390 i 430 px, najwyżej 612 px na komputerze. Postać ma wtedy 166–201 px wysokości —
 * czytelna, a lista trzydziestu sześciu kart nie zamienia się w galerię.
 *
 * Sceny są rysowane w SVG, a nie wczytywane z plików PNG, które system projektowy też ma:
 * zero zapytań, działają offline w PWA bez dokładania pięciu megabajtów do pamięci service
 * workera, są ostre przy DPR 3 i biorą kolory z tych samych tokenów co reszta aplikacji.
 * PNG 1200×600 zostają do udostępnień poza aplikacją.
 */

const INK = 'var(--ink)';
const o = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const FLOOR = 262;
const DISPLAY = { fontFamily: 'var(--display)', fontWeight: 600 } as const;

function Backdrop({ set }: { set: Setting }) {
  const gym = set === 'gym';
  return (
    <g>
      <rect width="600" height="300" fill={gym ? 'var(--surface-2)' : 'var(--c-sand)'} />
      {gym ? (
        <g>
          {/* Rytm płyt ściennych. */}
          <path d="M0 214 H600" stroke="var(--line)" strokeWidth="3" />
          {[120, 240, 360, 480].map((x) => (
            <path key={x} d={`M${x} 0 V214`} stroke="var(--line)" strokeWidth="2" />
          ))}
          <rect x="0" y={FLOOR} width="600" height="38" fill="var(--edge)" />
        </g>
      ) : (
        <g>
          <rect x="0" y="236" width="600" height="6" fill="var(--c-mid)" />
          <rect x="0" y={FLOOR} width="600" height="38" fill="var(--c-mid)" />
          {[0, 90, 180, 270, 360, 450, 540].map((x) => (
            <path key={x} d={`M${x + 30} ${FLOOR} l-20 38`} stroke="#9e9c93" strokeWidth="2" />
          ))}
        </g>
      )}
      <path d={`M0 ${FLOOR} H600`} stroke={INK} strokeWidth="2.6" />
    </g>
  );
}

/** Kettlebell w kolorze zawodniczym z drabiny ciężarów — ten sam, co na kafelkach wagi. */
const KB = ({ x, y, kg, s = 1 }: { x: number; y: number; kg: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-9 -14 a9 9 0 0 1 18 0" fill="none" {...o} strokeWidth={4.5} />
    <circle cx="0" cy="0" r="14" fill={kbColor(kg)} {...o} />
    <path d="M-6 -4 a6 6 0 0 1 6 -5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.4" strokeLinecap="round" />
  </g>
);

function GagG({ g, set }: { g: Gag; set: Setting }) {
  switch (g) {
    case 'kbs':
      return (
        <g>
          <KB x={252} y={FLOOR - 14} kg={12} s={0.9} />
          <KB x={284} y={FLOOR - 16} kg={16} />
          <KB x={318} y={FLOOR - 18} kg={24} s={1.1} />
        </g>
      );
    case 'rack':
      return (
        <g transform="translate(26 70)">
          <path d="M0 0 V192 M70 0 V192" {...o} strokeWidth={6} stroke="var(--steel)" />
          {[40, 90, 140].map((y) => (
            <path key={y} d={`M-6 ${y} H76`} {...o} strokeWidth={4} stroke="var(--steel)" />
          ))}
          {[30, 80, 130].map((y, i) => (
            <circle key={y} cx={i % 2 ? 4 : 66} cy={y} r="14" fill="var(--c-orange)" {...o} />
          ))}
        </g>
      );
    case 'mirror':
      return (
        <g>
          <rect x="20" y="30" width="96" height="176" rx="4" fill="var(--silver)" {...o} />
          <path d="M38 60 l30 -20 M38 90 l48 -32" stroke="#fff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case 'stairs':
      return <path d="M330 262 V230 H362 V198 H394 V166 H426 V262 Z" fill="var(--c-mid)" {...o} />;
    case 'sofa':
      return (
        <g transform="translate(20 168)">
          <rect x="0" y="22" width="150" height="72" rx="14" fill="var(--c-orange-bg)" {...o} />
          <rect x="-8" y="40" width="28" height="54" rx="10" fill="var(--c-orange-bg)" {...o} />
          <rect x="130" y="40" width="28" height="54" rx="10" fill="var(--c-orange-bg)" {...o} />
          <path d="M75 30 V70" {...o} strokeWidth={2} />
        </g>
      );
    case 'table':
      return (
        <g>
          <rect x="70" y="150" width="230" height="14" rx="3" fill="var(--c-mid)" {...o} />
          <path d="M86 164 V262 M284 164 V262" {...o} strokeWidth={7} stroke="#8d8b83" />
        </g>
      );
    case 'chairs':
      return (
        <g>
          {[
            [22, 0],
            [266, 1],
          ].map(([x, f]) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path
                d={f ? 'M54 150 V262 M8 206 V262 M54 206 H4' : 'M2 150 V262 M48 206 V262 M2 206 H52'}
                {...o}
                strokeWidth={6}
                stroke="var(--c-orange-ink)"
              />
            </g>
          ))}
        </g>
      );
    case 'doorbar':
      return (
        <g>
          <path d="M24 262 V20 H316 V262" fill="none" {...o} strokeWidth={10} stroke="#8d8b83" />
          <path d="M34 40 H306" {...o} strokeWidth={6} stroke="var(--steel)" />
        </g>
      );
    case 'leaves':
      return (
        <g>
          <path d="M24 262 V20 H316 V262" fill="none" {...o} strokeWidth={10} stroke="#8d8b83" />
          {[
            [30, 30],
            [70, 18],
            [120, 26],
            [220, 22],
            [280, 16],
            [308, 46],
            [26, 80],
            [312, 110],
          ].map(([x, y], i) => (
            <path
              key={i}
              d={`M${x} ${y} q14 -14 28 0 q-14 14 -28 0 Z`}
              fill="var(--c-green)"
              {...o}
              strokeWidth={2}
              transform={`rotate(${i * 37} ${x} ${y})`}
            />
          ))}
        </g>
      );
    case 'rug':
      return (
        <g>
          <ellipse cx="170" cy={FLOOR + 14} rx="150" ry="16" fill="var(--c-green)" {...o} />
          <g transform={`translate(296 ${FLOOR + 12})`}>
            <ellipse cx="-8" cy="0" rx="6" ry="7" fill="#fff" {...o} strokeWidth={2} />
            <ellipse cx="8" cy="0" rx="6" ry="7" fill="#fff" {...o} strokeWidth={2} />
            <circle cx="-6" cy="-1" r="2.6" fill={INK} />
            <circle cx="10" cy="-1" r="2.6" fill={INK} />
          </g>
        </g>
      );
    case 'broom':
      return (
        <g>
          <path d="M300 300 V250" {...o} strokeWidth={7} stroke="#8d6b44" />
          <path d="M278 300 l10 -20 h24 l10 20 Z" fill="var(--c-orange)" {...o} transform="translate(0 30)" />
          <path d="M300 262 l-16 -8 M300 262 l18 -6 M300 262 l-6 -16 M300 262 l8 -14" {...o} strokeWidth={2.2} />
          <path d="M276 236 l-10 -10 M324 236 l10 -10 M300 228 v-14" {...o} />
        </g>
      );
    case 'boxes':
      return (
        <g>
          <rect x="250" y="200" width="70" height="62" fill="#c8a978" {...o} />
          <path d="M250 214 H320 M285 200 V214" {...o} strokeWidth={2} />
          <rect x="262" y="148" width="50" height="52" fill="#d4b98c" {...o} />
          <path d="M262 160 H312" {...o} strokeWidth={2} />
        </g>
      );
    case 'clock':
      return (
        <g transform="translate(296 70)">
          <circle r="34" fill="var(--surface)" {...o} strokeWidth={4} />
          <path d="M0 0 V-22 M0 0 L16 10" {...o} strokeWidth={4} />
          <path d="M-46 -30 l-8 -6 M46 -30 l8 -6" {...o} />
        </g>
      );
    case 'spotlight':
      return (
        <g>
          <path d="M120 0 L20 262 H300 Z" fill="#fff" fillOpacity=".55" />
          <ellipse cx="160" cy={FLOOR} rx="140" ry="8" fill="#fff" fillOpacity=".7" />
        </g>
      );
    case 'spoon':
      return (
        <g transform="translate(560 150) rotate(20)">
          <ellipse cx="0" cy="-40" rx="18" ry="26" fill="var(--silver)" {...o} />
          <path d="M0 -14 V60" {...o} strokeWidth={8} stroke="var(--silver)" />
          <path d="M0 -14 V60" fill="none" stroke={INK} strokeWidth={1} />
        </g>
      );
    case 'seams':
      return (
        <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round">
          <path d="M150 70 l8 -8 M162 80 l10 -6 M140 62 l2 -10" />
          <path d="M126 52 l-4 -10" />
        </g>
      );
    case 'ticket':
      return (
        <g transform="translate(500 70) rotate(-8)">
          <rect x="-46" y="-22" width="92" height="44" rx="6" fill="var(--c-orange-bg)" {...o} />
          <text x="0" y="8" textAnchor="middle" style={{ ...DISPLAY, fontSize: 22 }} fill={INK}>
            KARNET
          </text>
        </g>
      );
    case 'queue':
      return (
        <g transform="translate(300 40)">
          <rect x="-4" y="0" width="8" height="120" fill="#8d8b83" />
          <rect x="-66" y="-10" width="132" height="44" rx="4" fill="var(--surface)" {...o} />
          <text x="0" y="20" textAnchor="middle" style={{ ...DISPLAY, fontSize: 20 }} fill={INK}>
            KOLEJKA: 0
          </text>
        </g>
      );
    case 'shower':
      return (
        <g transform="translate(300 40)">
          <rect x="-40" y="0" width="80" height="222" rx="4" fill="var(--c-blue)" fillOpacity=".35" {...o} />
          <path d="M-20 30 a20 12 0 0 1 40 0 Z" fill="var(--silver)" {...o} />
          {[-12, 0, 12].map((x) => (
            <path key={x} d={`M${x} 44 v14 M${x + 3} 70 v12`} stroke="var(--c-blue)" strokeWidth="3" strokeLinecap="round" />
          ))}
        </g>
      );
    case 'feather':
      return (
        <g transform="translate(540 120) rotate(30)">
          <path d="M0 -40 C22 -20 18 20 0 40 C-18 20 -22 -20 0 -40 Z" fill="var(--c-light)" {...o} />
          <path d="M0 -36 V54" {...o} strokeWidth={2} />
        </g>
      );
    case 'arcs':
      return (
        <g fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2 9" opacity=".7">
          <path d="M90 236 Q170 120 240 160" />
          <path d="M80 214 Q160 104 236 136" />
        </g>
      );
    case 'phoneflash':
      return (
        <g transform="translate(520 60)">
          <path d="M0 -26 L6 -6 L26 0 L6 6 L0 26 L-6 6 L-26 0 L-6 -6 Z" fill="#fff" {...o} strokeWidth={2} />
        </g>
      );
    case 'clipboard':
      return (
        <g transform="translate(316 120) rotate(8)">
          <rect x="-30" y="-40" width="60" height="80" rx="4" fill="#c8a978" {...o} />
          <rect x="-24" y="-30" width="48" height="64" fill="var(--surface)" {...o} strokeWidth={1.8} />
          {[-18, -6, 6, 18].map((y) => (
            <path key={y} d={`M-16 ${y} h6 M-4 ${y} h20`} stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          ))}
          <rect x="-12" y="-46" width="24" height="10" rx="3" fill="var(--steel)" />
        </g>
      );
    case 'banana':
      return <path d="M520 250 q30 -10 46 -40 q4 30 -40 52 Z" fill="#e8c547" {...o} />;
    case 'window':
      return (
        <g>
          <rect x="40" y="36" width="120" height="110" rx="3" fill="var(--c-blue)" fillOpacity=".45" {...o} />
          <path d="M100 36 V146 M40 91 H160" {...o} strokeWidth={4} stroke="var(--surface)" />
          <rect x="40" y="36" width="120" height="110" rx="3" fill="none" {...o} />
        </g>
      );
    case 'plant':
      return (
        <g transform={`translate(${set === 'gym' ? 560 : 330} ${FLOOR})`}>
          <path d="M-14 0 l4 -30 h20 l4 30 Z" fill="var(--c-orange)" {...o} />
          {[-30, -10, 12, 30].map((a, i) => (
            <path
              key={i}
              d="M0 -30 q-6 -30 0 -50 q6 20 0 50"
              fill="var(--c-green)"
              {...o}
              strokeWidth={2}
              transform={`rotate(${a} 0 -30)`}
            />
          ))}
        </g>
      );
  }
}

/** Długość planu na kartce kalendarza w lewym górnym rogu. */
function Calendar({ n }: { n: string }) {
  return (
    <g transform="translate(14 16) rotate(-4) scale(0.82)">
      <rect x="0" y="0" width="104" height="92" rx="6" fill="var(--surface)" {...o} />
      <rect x="0" y="0" width="104" height="22" rx="6" fill="var(--c-orange)" {...o} />
      <path d="M24 -8 V12 M80 -8 V12" {...o} strokeWidth={5} />
      <text x="52" y="78" textAnchor="middle" style={{ ...DISPLAY, fontSize: 50 }} fill={INK}>
        {n}
      </text>
      <text x="96" y="86" textAnchor="end" style={{ ...DISPLAY, fontWeight: 500, fontSize: 12 }} fill="var(--ink-soft)">
        {n === '?' ? '' : 'DNI'}
      </text>
    </g>
  );
}

/** Rozmiar czcionki dymka w jednostkach viewBoxu — ok. 14 px na telefonie 360 px. */
export const BUBBLE_FS = 26;

/**
 * Szerokość dymka z liczby znaków. Oswald jest wąski: średni znak to ok. 0,54 wysokości
 * czcionki; 34 to marginesy. Liczone z góry, bo SVG nie łamie tekstu ani nie mierzy go
 * przed narysowaniem.
 */
export const bubbleWidth = (lines: readonly string[]): number =>
  Math.max(...lines.map((l) => l.length)) * BUBBLE_FS * 0.54 + 34;

function Bubble({ lines, x, y, tail, minX = 8 }: { lines: string[]; x: number; y: number; tail: [number, number]; minX?: number }) {
  const fs = BUBBLE_FS;
  const w = bubbleWidth(lines);
  const h = lines.length * fs * 1.08 + 22;
  const bx = Math.max(Math.min(Math.max(minX, x - w / 2), 592 - w), 8);
  const by = Math.max(8, y - h);
  const tx = Math.min(Math.max(bx + 18, tail[0]), bx + w - 18);
  return (
    <g>
      <path d={`M${tx - 12} ${by + h - 2} L${tail[0]} ${tail[1]} L${tx + 12} ${by + h - 2} Z`} fill="var(--surface)" {...o} />
      <rect x={bx} y={by} width={w} height={h} rx="16" fill="var(--surface)" {...o} />
      <path d={`M${tx - 10} ${by + h - 1.3} H${tx + 10}`} stroke="var(--surface)" strokeWidth="4" />
      {lines.map((l, i) => (
        <text key={i} x={bx + w / 2} y={by + 11 + fs * 0.9 + i * fs * 1.08} textAnchor="middle" style={{ ...DISPLAY, fontSize: fs }} fill={INK}>
          {l}
        </text>
      ))}
    </g>
  );
}

/** Gagi, które stoją za postaciami — meble, ściany, światło. Reszta idzie na wierzch. */
const BEHIND = new Set<Gag>(['rack', 'mirror', 'window', 'sofa', 'table', 'doorbar', 'leaves', 'stairs', 'shower', 'spotlight', 'queue', 'boxes', 'clock']);

/** Ruchy nad głową i w staniu są wysokie — mniejsza skala, żeby głowa i drążek mieściły się w kadrze. */
const TALL = new Set(['pullup', 'pressOverhead', 'calf', 'curl', 'lateral', 'carry', 'swing', 'dip']);

/** Szerokość manekina w scenie (jego viewBox 160×150, ziemia na 134). */
const ACT_W = 320;

function SceneSvg({ s, className = 'scene-art' }: { s: Scene; className?: string | undefined }) {
  // Każda karta na liście ma własny `clipPath` — ten sam identyfikator w kilkudziesięciu
  // obrazkach na jednej stronie to niepoprawny dokument, a przeglądarki potrafią wtedy
  // przyciąć wszystkie sceny do pierwszej.
  const clip = `scene-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const act = s.act;
  const aw = act && TALL.has(act.move) ? 262 : ACT_W;
  const actH = (aw * 150) / 160;
  const actY = FLOOR - (actH * 134) / 150;
  const fanW = act ? 210 : 236;
  const fanX = act ? 600 - fanW + 8 : 330;
  const fan2X = act ? 300 : 80;
  const fan2W = act ? 170 : 236;
  const gags = s.gags ?? [];
  const bustH = (w: number) => (w * 280) / 312;
  // Kotwica dymka: nad głową mówiącego.
  const anchor: Record<Scene['by'], [number, number]> = {
    act: [act ? 200 : 160, act ? 96 : 140],
    fan: [fanX + fanW * 0.5, 300 - bustH(fanW) + 30],
    fan2: [fan2X + fan2W * 0.5, 300 - bustH(fan2W) + 30],
    prop: gags.includes('broom') ? [300, 244] : [296, FLOOR + 2],
  };
  const [ax, ay] = anchor[s.by];
  const bubbleY = s.by === 'prop' ? ay - 40 : Math.min(ay - 22, 150);
  return (
    <svg className={className} viewBox="0 0 600 300" role="img" aria-label={s.alt} preserveAspectRatio="xMidYMid slice">
      <defs>
        <clipPath id={clip}>
          <rect width="600" height="300" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <Backdrop set={s.set} />
        {s.set === 'kb' && !gags.includes('kbs') && (
          <g opacity=".9">
            <KB x={34} y={FLOOR - 12} kg={8} s={0.8} />
          </g>
        )}
        {gags.filter((g) => BEHIND.has(g)).map((g) => (
          <GagG key={g} g={g} set={s.set} />
        ))}
        {s.big && <Calendar n={s.big} />}
        {act && (
          <g transform={`translate(${act.flip ? ACT_W + 10 : 10} ${actY}) scale(${act.flip ? -1 : 1} 1)`}>
            <Mannequin who={act.who} move={act.move} gear={act.gear} phase={MOVES[act.move].key ?? 0.45} size={aw} build="scene" />
          </g>
        )}
        {s.fan2 && (
          <g transform={`translate(${fan2X} ${300 - bustH(fan2W) + 14})`}>
            <Gorilla who={s.fan2.who} mood={s.fan2.mood} size={fan2W} />
          </g>
        )}
        {s.fan && (
          <g transform={`translate(${fanX} ${300 - bustH(fanW) + 14})`}>
            <Gorilla who={s.fan.who} mood={s.fan.mood} size={fanW} />
          </g>
        )}
        {gags.filter((g) => !BEHIND.has(g)).map((g) => (
          <GagG key={g} g={g} set={s.set} />
        ))}
        <Bubble lines={s.bubble} x={ax} y={bubbleY} tail={[ax, ay]} minX={s.big ? 120 : 8} />
      </g>
    </svg>
  );
}

/**
 * Ilustracja treningu: z biblioteki — jego scena, własny — wspólna. `memo`, bo lista ma
 * trzydzieści sześć kart, a scena zależy tylko od identyfikatora — przełączenie filtra nie
 * musi przerysowywać goryli, które zostają na ekranie.
 */
export const WorkoutArt = memo(function WorkoutArt({ id, className }: { id: string; className?: string }) {
  return <SceneSvg s={workoutScene(id)} className={className} />;
});

type PlanArtProps = { plan: Pick<PlanTemplate, 'id' | 'kind' | 'level'>; className?: string };

/**
 * Ilustracja planu: z celem — po identyfikatorze, klasyczny — po poziomie, własny — wspólna.
 * Porównanie po polach, nie po obiekcie: widok planu składa szablon na nowo przy każdym
 * odświeżeniu, a scena zależy tylko od tych trzech pól.
 */
export const PlanArt = memo(
  function PlanArt({ plan, className }: PlanArtProps) {
    return <SceneSvg s={planScene(plan)} className={className} />;
  },
  (a: PlanArtProps, b: PlanArtProps) =>
    a.className === b.className && a.plan.id === b.plan.id && a.plan.kind === b.plan.kind && a.plan.level === b.plan.level,
);
