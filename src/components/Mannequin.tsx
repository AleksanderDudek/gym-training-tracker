import { useEffect, useRef, useState } from 'react';
import { MOVES } from '../data/moves';
import type { MoveName, PropSpot } from '../data/moves';
import { STAGE, face, headAngle, polyline, sampleCycle, skeleton } from '../engine/pose';
import type { Pt, Skeleton } from '../engine/pose';
import type { Gear } from '../types';

/**
 * Manekin ćwiczeń: patyczkowa sylwetka rysowana od zera z kątów stawów.
 *
 * Dlaczego nie nagrania ani modele 3D: wszystko tutaj powstaje w przeglądarce z kilkuset
 * bajtów liczb. Nie ma cudzego prawa autorskiego do pilnowania, nie ma reklam przed
 * odtworzeniem, nie ma zapytań do obcych serwerów i nic nie znika, gdy autor skasuje film.
 * Sylwetka ma minę i zmienia ją razem z ruchem: na górze powtórzenia odpuszcza, na dole
 * zaciska zęby. Mimika nie jest ozdobą — pokazuje, w którym miejscu zakresu jest ciężko,
 * a przy okazji robi z patyczka kogoś, komu można kibicować.
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

  if (gear === 'barbell' || spot === 'rack') {
    return (
      <g className="mq-prop">
        <line x1={at.x - 34} y1={at.y} x2={at.x + 34} y2={at.y} strokeWidth="3" />
        <line x1={at.x - 28} y1={at.y - 7} x2={at.x - 28} y2={at.y + 7} strokeWidth="6" />
        <line x1={at.x + 28} y1={at.y - 7} x2={at.x + 28} y2={at.y + 7} strokeWidth="6" />
      </g>
    );
  }
  if (gear === 'kettlebell') {
    return (
      <g className="mq-prop">
        <path
          d={`M${at.x - 4} ${at.y + 1}a4 4 0 0 1 8 0`}
          fill="none"
          strokeWidth="2.4"
        />
        <circle cx={at.x} cy={at.y + 9} r="6.2" strokeWidth="2.4" />
      </g>
    );
  }
  if (gear === 'machine') {
    return (
      <g className="mq-prop">
        <line x1={at.x - 16} y1={at.y} x2={at.x + 16} y2={at.y} strokeWidth="3" />
        <line x1={at.x} y1={at.y} x2={at.x + 44} y2={at.y - 26} strokeWidth="1.6" />
      </g>
    );
  }
  // Hantle: krótka sztabka z obciążnikami po obu stronach dłoni.
  return (
    <g className="mq-prop">
      <line x1={at.x - 11} y1={at.y} x2={at.x + 11} y2={at.y} strokeWidth="2.6" />
      <line x1={at.x - 9} y1={at.y - 5} x2={at.x - 9} y2={at.y + 5} strokeWidth="5" />
      <line x1={at.x + 9} y1={at.y - 5} x2={at.x + 9} y2={at.y + 5} strokeWidth="5" />
    </g>
  );
}

const line = (a: Pt, b: Pt): string => polyline([a, b]);
const limb = (a: Pt, b: Pt, c: Pt): string => polyline([a, b, c]);

const HEAD_R = 11;

/**
 * Twarz z profilu, obrócona razem z głową. Rysowana w układzie lokalnym, w którym „do góry”
 * to kierunek głowy, a „do przodu” to prawo — czyli ta strona, w którą sylwetka jest zwrócona.
 */
function Face({ at, angle, effort }: { at: Pt; angle: number; effort: number }) {
  const f = face(effort);
  const x = at.x;
  const y = at.y;
  // Bez nosa. Profil z garbkiem wymaga narysowania go na konturze czaszki, a narysowany
  // w środku sterczy przez kreskę jak dziób — oko, brew i usta wystarczają.
  const browY = y - 5.4;
  const mouthX = x + 3.2;
  const mouthY = y + 3.9;

  return (
    <g className="mq-face" transform={`rotate(${angle.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}>
      <path
        d={`M${x + 1.1} ${browY}L${x + 5.7} ${(browY + (f.brow / 26) * 2.5).toFixed(2)}`}
        className="mq-line"
      />
      {f.eye > 0.45 ? (
        <circle cx={x + 3.5} cy={y - 2} r={(1.4 * f.eye).toFixed(2)} className="mq-ink" />
      ) : (
        <path d={`M${x + 2.1} ${y - 2}h2.9`} className="mq-line" />
      )}
      {f.open ? (
        <ellipse cx={mouthX} cy={mouthY} rx="1.7" ry="2.2" className="mq-ink" />
      ) : (
        <path
          d={`M${mouthX - 2.4} ${mouthY}Q${mouthX} ${(mouthY + f.mouth).toFixed(2)} ${mouthX + 2.4} ${mouthY}`}
          className="mq-line"
        />
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
}: {
  move: MoveName;
  gear: Gear;
  phase: number;
  size?: number;
}) {
  const m = MOVES[move];
  const s = skeleton(sampleCycle(m.frames, phase));
  const prop = propPoint(s, m.prop);
  // Wysiłek rośnie w okolicy klatki kluczowej i gaśnie na końcach — kropelki lecą wtedy,
  // kiedy w prawdziwej serii najbardziej by leciały.
  const peak = m.key ?? 0.45;
  const effort = Math.max(0, 1 - Math.abs(((phase % 1) + 1) % 1 - peak) / 0.22);

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
      <g className="mq-far">
        <path d={limb(s.neck, s.elbowF, s.wristF)} />
        <path d={limb(s.hip, s.kneeF, s.ankleF)} />
        <path d={line(s.ankleF, s.toeF)} />
      </g>
      <g className="mq-body">
        <path d={line(s.hip, s.neck)} strokeWidth="9" />
        <circle className="mq-head" cx={s.head.x} cy={s.head.y} r={HEAD_R} />
        <path d={limb(s.hip, s.kneeN, s.ankleN)} />
        <path d={line(s.ankleN, s.toeN)} />
        <path d={limb(s.neck, s.elbowN, s.wristN)} />
      </g>
      <Face at={s.head} angle={headAngle(s)} effort={effort} />
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
}: {
  move: MoveName;
  gear: Gear;
  size?: number;
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
      <Mannequin move={move} gear={gear} phase={phase} {...(size ? { size } : {})} />
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
