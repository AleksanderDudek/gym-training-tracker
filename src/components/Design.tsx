import { MUSCLE_NAME } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { RULES } from '../engine/design';
import type { DesignNote } from '../engine/design';
import { ATLAS_PATH } from '../routing';

/**
 * Wspólne klocki podglądu treningu i planu: paski mięśni, uwagi doradcy, przełącznik
 * sekcji zakładki Treningi i rząd filtrów.
 */

const fmt = (n: number): string => n.toLocaleString('pl-PL', { maximumFractionDigits: 1 });

/**
 * Serie na partię w jednej sesji. Skala sięga co najmniej do limitu sesji, więc długość paska
 * od razu mówi, jak blisko granicy jest partia; kreska na pasku to sam limit.
 */
export function MuscleBars({ loads, cap = RULES.sessionCap }: { loads: { muscle: MuscleId; sets: number }[]; cap?: number }) {
  if (!loads.length) return <p className="tight">Dodaj ćwiczenie, a pokażę, które partie pracują.</p>;
  const scale = Math.max(cap * 1.2, ...loads.map((l) => l.sets));
  return (
    <div className="mbars" role="list" aria-label="Serie na partię mięśni w tej sesji">
      {loads.map((l) => (
        <div key={l.muscle} className={`mbar${l.sets > cap ? ' over' : ''}`} role="listitem">
          <span className="mbar-name">{MUSCLE_NAME[l.muscle]}</span>
          <span className="mbar-track" aria-hidden="true">
            <i style={{ width: `${Math.max(3, (l.sets / scale) * 100)}%` }} />
            <b style={{ left: `${(cap / scale) * 100}%` }} />
          </span>
          <span className="mbar-val">{fmt(l.sets)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Tydzień planu: serie na partię na tle zakresu 10–20 z badań, i ile razy w tygodniu partia
 * dostaje realny bodziec. Zielone tło paska to zakres, w którym przyrost opłaca się najbardziej.
 */
export function WeeklyBars({ weekly }: { weekly: { muscle: MuscleId; sets: number; freq: number }[] }) {
  if (!weekly.length) return null;
  const scale = Math.max(RULES.weeklyMax * 1.25, ...weekly.map((w) => w.sets));
  const pct = (n: number): string => `${(n / scale) * 100}%`;
  return (
    <div className="mbars weekly" role="list" aria-label="Serie tygodniowo na partię mięśni">
      {[...weekly]
        .sort((a, b) => b.sets - a.sets)
        .map((w) => (
          <div key={w.muscle} className={`mbar${w.sets > RULES.weeklyMax ? ' over' : ''}`} role="listitem">
            <span className="mbar-name">{MUSCLE_NAME[w.muscle]}</span>
            <span className="mbar-track" aria-hidden="true">
              <em style={{ left: pct(RULES.weeklyTarget), width: pct(RULES.weeklyMax - RULES.weeklyTarget) }} />
              <i style={{ width: `${Math.max(3, (w.sets / scale) * 100)}%` }} />
            </span>
            <span className="mbar-val">
              {fmt(w.sets)}
              {w.freq >= 1 && <small> · {fmt(w.freq)}×</small>}
            </span>
          </div>
        ))}
    </div>
  );
}

export function DesignNotes({ notes }: { notes: DesignNote[] }) {
  return (
    <div className="dnotes">
      {notes.map((n) => (
        <div key={n.code} className={`dnote ${n.level}`}>
          <b>{n.title}</b>
          <p className="tight">{n.text}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Dwie sekcje zakładki Treningi. Odnośniki, a nie przyciski: każda sekcja ma własny adres,
 * więc „wstecz” i zakładki przeglądarki działają jak wszędzie indziej.
 */
export function SectionSwitch({ on }: { on: 'workouts' | 'atlas' }) {
  return (
    // `div`, nie `nav`: arkusz stylizuje każdy `nav` jak dolny pasek przyklejony do krawędzi.
    <div className="seg sect-switch" role="navigation" aria-label="Sekcje zakładki Treningi">
      <a href="#/treningi" aria-current={on === 'workouts' ? 'page' : undefined}>
        Treningi
      </a>
      <a href={ATLAS_PATH} aria-current={on === 'atlas' ? 'page' : undefined}>
        Ćwiczenia
      </a>
    </div>
  );
}

/** Rząd filtrów, który zawija się do kolejnej linii — przełącznik segmentowy mieści najwyżej trzy. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
