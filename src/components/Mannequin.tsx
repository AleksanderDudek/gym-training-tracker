import { useEffect, useRef, useState } from 'react';
import { MOVES } from '../data/moves';
import type { MoveName, PropSpot } from '../data/moves';
import { STAGE, face, headAngle, polyline, sampleCycle, skeleton } from '../engine/pose';
import type { Pt, Skeleton } from '../engine/pose';
import type { Gear } from '../types';

/**
 * Manekin ćwiczeń: ruch wykonuje ktoś z obsady — Gustaw albo Gosia.
 *
 * Dlaczego nie nagrania ani modele 3D: wszystko tutaj powstaje w przeglądarce z kilkuset
 * bajtów liczb. Nie ma cudzego prawa autorskiego do pilnowania, nie ma reklam przed
 * odtworzeniem, nie ma zapytań do obcych serwerów i nic nie znika, gdy autor skasuje film.
 *
 * Szkielet jest ten sam, co wcześniej (`engine/pose.ts`: te same osiemnaście ruchów, te
 * same klatki, ta sama mimika zaciskająca się w najtrudniejszym miejscu). Zmienia się
 * kreska: zamiast patyczka jest sierść z konturem, tors w kolorze koszulki postaci i
 * profil goryla z wysuniętym pyskiem. Ten, kto pokazuje ruch w atlasie, jest więc tą samą
 * postacią, co ta na banerach i w oknach — jedna obsada w całej aplikacji.
 */

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Punkt chwytu: środek między nadgarstkami, czyli tam, gdzie realnie jest sprzęt. */
function propPoint(s: Skeleton, spot: PropSpot): Pt | null {
  if (spot === 'hands') return mid(s.wristN, s.wristF);
  if (spot === 'rack' || spot === 'shoulders') return { x: s.neck.x, y: s.neck.y + 3 };
  return null;
}

function Prop({ at, gear, spot }: { at: Pt | null; gear: Gear; spot: PropSpot }) {
  if (!at || spot === 'none' || gear === 'bodyweight') return null;
  const o = { stroke: 'var(--ink)', strokeLinecap: 'round' as const };

  if (gear === 'barbell' || spot === 'rack') {
    return (
      <g className="mq-prop">
        <line x1={at.x - 36} y1={at.y} x2={at.x + 36} y2={at.y} strokeWidth="3.4" {...o} />
        <rect x={at.x - 33} y={at.y - 9} width="7" height="18" rx="2" fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.6" />
        <rect x={at.x + 26} y={at.y - 9} width="7" height="18" rx="2" fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.6" />
      </g>
    );
  }
  if (gear === 'kettlebell') {
    return (
      <g className="mq-prop">
        <path d={`M${at.x - 4.5} ${at.y + 1}a4.5 4.5 0 0 1 9 0`} fill="none" strokeWidth="2.6" {...o} />
        <circle cx={at.x} cy={at.y + 10} r="7" fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.8" />
      </g>
    );
  }
  if (gear === 'machine') {
    return (
      <g className="mq-prop">
        <line x1={at.x - 16} y1={at.y} x2={at.x + 16} y2={at.y} strokeWidth="3.4" {...o} />
        <line x1={at.x} y1={at.y} x2={at.x + 44} y2={at.y - 26} strokeWidth="1.8" stroke="var(--edge)" />
      </g>
    );
  }
  // Hantle: krótka sztabka z talerzami po obu stronach dłoni.
  return (
    <g className="mq-prop">
      <line x1={at.x - 11} y1={at.y} x2={at.x + 11} y2={at.y} strokeWidth="2.8" {...o} />
      <rect x={at.x - 12} y={at.y - 6} width="5" height="12" rx="1.5" fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.4" />
      <rect x={at.x + 7} y={at.y - 6} width="5" height="12" rx="1.5" fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.4" />
    </g>
  );
}

const line = (a: Pt, b: Pt): string => polyline([a, b]);
const limb = (a: Pt, b: Pt, c: Pt): string => polyline([a, b, c]);

/** Kończyna z konturem: najpierw gruba kreska `--ink`, na niej sierść. */
function Fur({ d, w }: { d: string; w: number }) {
  return (
    <>
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth={w + 3.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--fur)" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/**
 * Profil głowy goryla, obrócony razem z głową. Mina pochodzi z tej samej funkcji `face()`
 * co wcześniej: brew ściąga się do nosa, oko mruży się do kreski, usta otwierają się
 * do wydechu. Nosa nie ma — w profilu sterczałby przez kontur jak dziób.
 */
function GorillaHead({
  at,
  angle,
  effort,
  who,
}: {
  at: Pt;
  angle: number;
  effort: number;
  who: 'gustaw' | 'gosia';
}) {
  const f = face(effort);
  const { x, y } = at;
  const browY = y - 4.6;
  return (
    <g transform={`rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
      {who === 'gosia' && (
        <g>
          <circle cx={x - 3} cy={y - 13} r={4.2} fill="var(--fur)" stroke="var(--ink)" strokeWidth="1.8" />
          <rect x={x - 6.5} y={y - 11.5} width="7" height="3" rx="1.5" fill="var(--c-orange)" />
        </g>
      )}
      <circle cx={x} cy={y} r={11.5} fill="var(--fur)" stroke="var(--ink)" strokeWidth="2.2" />
      <path d={`M${x + 1} ${y - 7} q9 0 10 7 q2 6 -2 9 q-5 3 -9 0 Z`} fill="var(--hide)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
      <ellipse cx={x + 8} cy={y + 4.5} rx={5} ry={3.6} fill="var(--muzzle)" stroke="var(--ink)" strokeWidth="1.6" />
      {who === 'gustaw' && (
        <path d={`M${x - 11} ${y - 5} Q${x} ${y - 11} ${x + 10} ${y - 7} L${x + 10} ${y - 4} Q${x} ${y - 8} ${x - 11} ${y - 2} Z`} fill="var(--c-orange)" stroke="var(--ink)" strokeWidth="1.4" />
      )}
      <path d={`M${x + 2.2} ${browY}L${x + 8} ${(browY + (f.brow / 26) * 2.5).toFixed(2)}`} stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      {f.eye > 0.45 ? (
        <g>
          <circle cx={x + 5.2} cy={y - 1.4} r={2.1 * f.eye} fill="#fff" stroke="var(--ink)" strokeWidth="0.8" />
          <circle cx={x + 5.6} cy={y - 1.4} r={1.1 * f.eye} fill="var(--ink)" />
        </g>
      ) : (
        <path d={`M${x + 3.4} ${y - 1.4}h3.6`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {f.open ? (
        <ellipse cx={x + 8.6} cy={y + 6.2} rx="1.8" ry="1.6" fill="var(--ink)" />
      ) : (
        <path d={`M${x + 6} ${y + 6}Q${x + 8.6} ${(y + 6 + f.mouth * 0.8).toFixed(2)} ${x + 11} ${y + 6}`} fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </g>
  );
}

/**
 * Kropelki potu w najtrudniejszym momencie ruchu. Nie niosą informacji i o to chodzi:
 * sylwetka, która wyraźnie się męczy, jest zabawniejsza i lepiej pokazuje, gdzie wysiłek
 * jest największy. Pojawiają się tylko w okolicach dołu ruchu i tylko tam, gdzie jest ciężko.
 */
function Sweat({ at, effort }: { at: Pt; effort: number }) {
  if (effort <= 0.05) return null;
  const drops = [
    { dx: -14, dy: -6 },
    { dx: 13, dy: -9 },
    { dx: -18, dy: 4 },
  ];
  return (
    <g className="mq-sweat" opacity={Math.min(1, effort)}>
      {drops.map((d, i) => (
        <path
          key={i}
          d={`M${at.x + d.dx} ${at.y + d.dy - 4 - effort * 7}q3 3.4 0 6.4q-3-3-0-6.4Z`}
          fill="var(--c-blue)"
          stroke="var(--ink)"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

/**
 * Jedna sylwetka. `phase` 0–1 to miejsce w cyklu powtórzenia; przy wyłączonych animacjach
 * zostaje nieruchoma klatka z najciekawszego momentu ruchu, bo to ona uczy techniki.
 */
export function Mannequin({
  move,
  gear,
  phase,
  size = 168,
  who = 'gustaw',
}: {
  move: MoveName;
  gear: Gear;
  phase: number;
  size?: number;
  /** Kto pokazuje ruch. Gosia jest rysowana nieco drobniej, jak w reszcie obsady. */
  who?: 'gustaw' | 'gosia';
}) {
  const m = MOVES[move];
  const s = skeleton(sampleCycle(m.frames, phase));
  const prop = propPoint(s, m.prop);
  // Wysiłek rośnie w okolicy klatki kluczowej i gaśnie na końcach — kropelki lecą wtedy,
  // kiedy w prawdziwej serii najbardziej by leciały.
  const peak = m.key ?? 0.45;
  const effort = Math.max(0, 1 - Math.abs(((phase % 1) + 1) % 1 - peak) / 0.22);
  // Gosia rysowana drobniej, tak samo jak w popiersiach obsady; koszulka trzyma kolor postaci.
  const k = who === 'gosia' ? 0.9 : 1;
  const top = who === 'gustaw' ? 'var(--c-blue)' : 'var(--c-green)';

  return (
    <svg
      className="mq"
      width={size}
      height={(size * STAGE.h) / STAGE.w}
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      role="img"
      aria-label={m.alt}
    >
      <line className="mq-ground" x1="10" y1={STAGE.ground} x2={STAGE.w - 10} y2={STAGE.ground} />
      {m.scene === 'bench' && (
        <g className="mq-scene">
          <rect x="30" y="100" width="76" height="8" rx="2" />
          <line x1="44" y1="108" x2="44" y2={STAGE.ground} />
          <line x1="96" y1="108" x2="96" y2={STAGE.ground} />
        </g>
      )}
      {m.scene === 'bar' && (
        <g className="mq-scene">
          <line x1="34" y1="6" x2="122" y2="6" strokeWidth="4" />
        </g>
      )}
      {/* Dalsza ręka i noga przygaszone kryciem — to głębia, nie stan interfejsu. */}
      <g opacity="0.55">
        <Fur d={limb(s.neck, s.elbowF, s.wristF)} w={8 * k} />
        <Fur d={limb(s.hip, s.kneeF, s.ankleF)} w={8 * k} />
      </g>
      <Fur d={line(s.hip, s.neck)} w={17 * k} />
      <path d={line(s.hip, s.neck)} stroke={top} strokeWidth={13 * k} strokeLinecap="round" fill="none" />
      <Fur d={limb(s.hip, s.kneeN, s.ankleN)} w={9 * k} />
      <Fur d={line(s.ankleN, s.toeN)} w={5} />
      <GorillaHead at={s.head} angle={headAngle(s)} effort={effort} who={who} />
      <Fur d={limb(s.neck, s.elbowN, s.wristN)} w={10 * k} />
      <circle cx={s.wristN.x} cy={s.wristN.y} r={4.6 * k} fill="var(--hide)" stroke="var(--ink)" strokeWidth="1.6" />
      <Prop at={prop} gear={gear} spot={m.prop} />
      <Sweat at={s.head} effort={effort} />
    </svg>
  );
}

/** Klatka, na której zatrzymuje się animacja: dolna pozycja ruchu uczy najwięcej. */
const KEY_PHASE = 0.45;

const keyPhase = (move: MoveName): number => MOVES[move].key ?? KEY_PHASE;

/**
 * Manekin z własnym zegarem. Czas liczony jest ze znacznika czasu, nie z liczby klatek,
 * więc tempo powtórzenia zgadza się z rzeczywistością także wtedy, gdy przeglądarka
 * przycina odświeżanie w tle.
 */
export function AnimatedMannequin({
  move,
  gear,
  size,
  who = 'gustaw',
}: {
  move: MoveName;
  gear: Gear;
  size?: number;
  who?: 'gustaw' | 'gosia';
}) {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const [playing, setPlaying] = useState(!reduced);
  const [phase, setPhase] = useState(reduced ? keyPhase(move) : 0);
  const raf = useRef(0);
  const started = useRef(0);
  const offset = useRef(0);
  const secs = MOVES[move].secs;

  useEffect(() => {
    if (!playing) return;
    started.current = performance.now();
    const tick = (now: number) => {
      setPhase((offset.current + (now - started.current) / 1000 / secs) % 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, secs]);

  const toggle = () => {
    if (playing) offset.current = phase;
    setPlaying(!playing);
  };

  return (
    <div className="mqbox">
      <Mannequin move={move} gear={gear} phase={phase} who={who} {...(size ? { size } : {})} />
      <div className="mq-side">
        <p className="mq-alt">{MOVES[move].alt}</p>
        <button className="btn sm ghost" onClick={toggle} aria-pressed={playing}>
          {playing ? 'Zatrzymaj' : 'Odtwórz'}
        </button>
        {!playing && (
          <label className="mq-scrub">
            <span>klatka ruchu</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(phase * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                offset.current = v;
                setPhase(v);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
