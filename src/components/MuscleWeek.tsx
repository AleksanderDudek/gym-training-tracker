import type { ReactNode } from 'react';
import { MUSCLE_NAME } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { RULES } from '../engine/design';
import { WEEK_REFERENCE, muscleWeek, shade } from '../engine/muscleWeek';
import { plural } from '../engine/quips';
import { LOCALE, pluralEn, text } from '../i18n';
import type { AppState } from '../types';

const T = text({
  pl: {
    title: 'Mięśnie w tym tygodniu',
    range: (from: string, to: string, n: number) =>
      `${from} – ${to} · ${n} ${plural(n, ['trening', 'treningi', 'treningów'])}`,
    empty: 'Od poniedziałku jeszcze bez zamkniętego treningu. Rysunek zabarwi się po pierwszym.',
    front: 'Przód',
    back: 'Tył',
    figAria: (side: string) => `Rysunek ciała — ${side.toLowerCase()}. Liczby serii są w liście pod rysunkiem.`,
    legend: 'Serie w tygodniu',
    legendAria: 'Skala kolorów: serie w tygodniu',
    scale: ['0', 'poniżej 4', '4–10', '10–20', 'ponad 20'] as readonly string[],
    listAria: 'Serie w tym tygodniu na partię mięśni',
    sets: (n: string) => `${n} serii`,
    none: (names: string) => `Bez serii: ${names}.`,
    model: 'Seria liczy się mięśniom głównym w całości, a pomocniczym w połowie — tak samo jak w doradcy treningów.',
    reference: (from: number, to: number) =>
      `Odniesienie z badań: ${from}–${to} serii na partię tygodniowo (Schoenfeld, Ogborn i Krieger, 2017). Zielone tło paska to ten zakres.`,
    snacks: (n: number) =>
      `${n} ${plural(n, ['przekąska ruchowa', 'przekąski ruchowe', 'przekąsek ruchowych'])} w tym tygodniu — ${n === 1 ? 'nie wchodzi' : 'nie wchodzą'} do serii, bo przekąska to nie trening.`,
  },
  en: {
    title: 'Muscles this week',
    range: (from: string, to: string, n: number) => `${from} – ${to} · ${n} ${pluralEn(n, 'workout', 'workouts')}`,
    empty: 'No finished workout since Monday yet. The drawing fills in after the first one.',
    front: 'Front',
    back: 'Back',
    figAria: (side: string) => `Body drawing — ${side.toLowerCase()}. Set counts are in the list below the drawing.`,
    legend: 'Sets this week',
    legendAria: 'Colour scale: sets this week',
    scale: ['0', 'under 4', '4–10', '10–20', 'over 20'] as readonly string[],
    listAria: 'Sets this week per muscle group',
    sets: (n: string) => `${n} sets`,
    none: (names: string) => `No sets: ${names}.`,
    model: 'A set counts in full for the main muscles and as half for the helpers — the same way the workout adviser counts.',
    reference: (from: number, to: number) =>
      `Research reference: ${from}–${to} sets per muscle group a week (Schoenfeld, Ogborn and Krieger, 2017). The green band on each bar is that range.`,
    snacks: (n: number) =>
      `${n} exercise ${pluralEn(n, 'snack', 'snacks')} this week — ${n === 1 ? 'it doesn’t' : 'they don’t'} count as sets, because a snack isn’t a workout.`,
  },
});

/**
 * Mięśnie w tym tygodniu: dwa rysunki ciała (przód, tył) z szesnastoma partiami zabarwionymi
 * liczbą serii od poniedziałku i lista liczbowa pod spodem — rysunek nie jest jedynym nośnikiem,
 * a czytnik ekranu dostaje listę. Kolory wyłącznie z tokenów, więc idą za motywem.
 *
 * Bez ocen: skala to same liczby, a zakres 10–20 stoi jako odniesienie z badań, nie jako cel,
 * którego ktoś „nie dobił”.
 */

const fmt = (n: number): string => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** `yyyy-mm-dd` → „27.10” (dzień w UTC, jak cały tydzień silnika). */
const dm = (key: string): string =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/*
 * Rysunki: lewa połowa sylwetki i partii w siatce 100 × 210, prawa to jej odbicie względem x = 50.
 * Kształty są umowne — mają dać się rozpoznać w 150 px szerokości, a nie uczyć anatomii.
 */

const SILHOUETTE =
  'M50 22 L45.5 22 L45 28 Q38 29 31 31 Q22 33 21 43 L19 68 Q17 88 15.5 112 Q15 120 17 124 Q20 126 21 121 ' +
  'L23 110 Q25 92 27 76 L29.5 56 Q31 70 34 84 Q35 92 35 100 Q33 108 33.5 118 L35 160 Q34 178 36.5 196 ' +
  'L35 203 L46.5 203 L45.5 196 Q47 178 46.5 162 L48.5 124 Q49.5 121 50 121 Z';

type Shape = { muscle: MuscleId; el: ReactNode };

const ARM_FRONT = <ellipse cx="24.5" cy="57" rx="3.4" ry="9.5" />;
const FOREARM = <ellipse cx="21" cy="92" rx="3.3" ry="14" transform="rotate(7 21 92)" />;
const SIDE_DELT = <ellipse cx="24.5" cy="40" rx="3.6" ry="6.5" />;

const FRONT: Shape[] = [
  { muscle: 'bark-bok', el: SIDE_DELT },
  { muscle: 'bark-przod', el: <ellipse cx="31" cy="38" rx="4" ry="5.5" /> },
  { muscle: 'klatka', el: <path d="M49.5 35 L36 34.5 Q33 41 35 50 Q42 56 49.5 54 Z" /> },
  { muscle: 'biceps', el: ARM_FRONT },
  { muscle: 'przedramiona', el: FOREARM },
  { muscle: 'brzuch', el: <path d="M42.5 57 L49.5 57 L49.5 99 Q45 99 42.5 95 Q41 76 42.5 57 Z" /> },
  { muscle: 'czworoglowe', el: <ellipse cx="40.5" cy="138" rx="5.3" ry="18" /> },
  { muscle: 'przywodziciele', el: <ellipse cx="46.6" cy="128" rx="1.9" ry="8" /> },
  { muscle: 'lydki', el: <ellipse cx="40.8" cy="178" rx="3.6" ry="13" /> },
];

const BACK: Shape[] = [
  { muscle: 'plecy-gora', el: <path d="M50 24 L45.5 27 Q38 29 33 31.5 Q37 38 40 42 Q45 50 50 58 Z" /> },
  { muscle: 'najszersze', el: <path d="M37 44 Q32 54 33 66 Q35.5 79 42 87 L46.5 78 L44.5 61 Q42 52 37 44 Z" /> },
  { muscle: 'bark-bok', el: SIDE_DELT },
  { muscle: 'bark-tyl', el: <ellipse cx="30.5" cy="37" rx="4.5" ry="5" /> },
  { muscle: 'triceps', el: ARM_FRONT },
  { muscle: 'przedramiona', el: FOREARM },
  { muscle: 'prostowniki', el: <path d="M46 62 L49.5 62 L49.5 100 L45.5 100 Q44.5 80 46 62 Z" /> },
  { muscle: 'posladki', el: <ellipse cx="42" cy="112" rx="8" ry="8.5" /> },
  { muscle: 'dwuglowe', el: <ellipse cx="41" cy="140" rx="5.5" ry="16.5" /> },
  { muscle: 'przywodziciele', el: <ellipse cx="47" cy="127" rx="1.8" ry="7" /> },
  { muscle: 'lydki', el: <ellipse cx="41" cy="174" rx="4.6" ry="11.5" /> },
];

const MIRROR = 'matrix(-1 0 0 1 100 0)';

function Figure({ side, shapes, sets }: { side: string; shapes: Shape[]; sets: Record<MuscleId, number> }) {
  return (
    <figure className="mw-fig">
      <svg viewBox="0 0 100 210" role="img" aria-label={T.figAria(side)}>
        <circle className="mw-body" cx="50" cy="12.5" r="9" />
        <path className="mw-body" d={SILHOUETTE} />
        <path className="mw-body" d={SILHOUETTE} transform={MIRROR} />
        {shapes.map(({ muscle, el }) => (
          <g key={muscle} className={`mw-m mw-l${shade(sets[muscle])}`} data-muscle={muscle}>
            <title>{`${MUSCLE_NAME[muscle]}: ${T.sets(fmt(sets[muscle]))}`}</title>
            {el}
            <g transform={MIRROR}>{el}</g>
          </g>
        ))}
      </svg>
      <figcaption>{side}</figcaption>
    </figure>
  );
}

export function MuscleWeekCard({ state, now = Date.now() }: { state: AppState; now?: number }) {
  const w = muscleWeek(state, now);
  const sets = Object.fromEntries(w.muscles.map((m) => [m.muscle, m.sets])) as Record<MuscleId, number>;
  const worked = w.muscles.filter((m) => m.sets > 0).sort((a, b) => b.sets - a.sets);
  const idle = w.muscles.filter((m) => m.sets <= 0);
  const scale = Math.max(RULES.weeklyMax * 1.25, ...worked.map((m) => m.sets));
  const pct = (n: number): string => `${(n / scale) * 100}%`;

  return (
    <div className="grp mweek">
      <h2>{T.title}</h2>
      <p className="tight">{T.range(dm(w.from), dm(w.to), w.sessions)}</p>
      {!w.sessions && <p className="tight">{T.empty}</p>}

      <div className="mw-figs">
        <Figure side={T.front} shapes={FRONT} sets={sets} />
        <Figure side={T.back} shapes={BACK} sets={sets} />
      </div>

      <div className="mw-legend" role="list" aria-label={T.legendAria}>
        <span className="mw-legend-h">{T.legend}:</span>
        {T.scale.map((label, i) => (
          <span key={label} className="mw-key" role="listitem">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect className={`mw-m mw-l${i}`} x="0.5" y="0.5" width="13" height="13" rx="2" />
            </svg>
            {label}
          </span>
        ))}
      </div>

      {worked.length > 0 && (
        <div className="mbars weekly" role="list" aria-label={T.listAria}>
          {worked.map((m) => (
            <div key={m.muscle} className="mbar" role="listitem">
              <span className="mbar-name">{MUSCLE_NAME[m.muscle]}</span>
              <span className="mbar-track" aria-hidden="true">
                <em style={{ left: pct(WEEK_REFERENCE.from), width: pct(WEEK_REFERENCE.to - WEEK_REFERENCE.from) }} />
                <i style={{ width: `${Math.max(3, (m.sets / scale) * 100)}%` }} />
              </span>
              <span className="mbar-val">{fmt(m.sets)}</span>
            </div>
          ))}
        </div>
      )}
      {worked.length > 0 && idle.length > 0 && (
        <p className="mw-note">{T.none(idle.map((m) => MUSCLE_NAME[m.muscle]).join(', '))}</p>
      )}

      <p className="mw-note">{T.model}</p>
      <p className="mw-note">{T.reference(WEEK_REFERENCE.from, WEEK_REFERENCE.to)}</p>
      {w.snacks > 0 && <p className="mw-note">{T.snacks(w.snacks)}</p>}
    </div>
  );
}
