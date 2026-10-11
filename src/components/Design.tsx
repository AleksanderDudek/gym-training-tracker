import { MUSCLE_NAME } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import { RULES } from '../engine/design';
import type { DesignNote } from '../engine/design';
import { ATLAS_PATH, SECTIONS } from '../routing';
import { Sections } from './Sections';

/**
 * Wspólne klocki podglądu treningu i planu: paski mięśni, uwagi doradcy, przełącznik
 * sekcji zakładki Trening i rząd filtrów.
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

const SECTION_PATH = { plan: '#/plan', workouts: '#/treningi', atlas: ATLAS_PATH } as const;

/** Trzy sekcje zakładki Trening: Plan, Treningi i Ćwiczenia — u góry każdej z nich. */
export function SectionSwitch({ on }: { on: keyof typeof SECTION_PATH }) {
  return <Sections aria-label="Sekcje zakładki Trening" items={SECTIONS.work} current={SECTION_PATH[on]} />;
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
