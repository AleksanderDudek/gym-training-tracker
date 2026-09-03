import { useState } from 'react';
import { BUILTIN } from '../data/exercises';
import {
  FREQUENCIES,
  LEVELS,
  LEVEL_DESC,
  LEVEL_LABEL,
  PLAN_WEEKS,
  SEXES,
  SEX_LABEL,
  planById,
  planId,
} from '../data/plans';
import { buildSchedule, loggedDays, planStats } from '../engine/schedule';
import { Segmented } from './ui';
import type { AppState, PlanLevel, PlanTemplate, PlannedDay, Sex } from '../types';

const WD = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'];

const shortDate = (key: string): string => {
  const [, mm, dd] = key.split('-');
  return `${dd}.${mm}`;
};

/** Polska odmiana po liczebniku: 2–4 to „treningi”, poza nastkami; reszta „treningów”. */
const sessionsWord = (n: number): string => {
  const last = n % 10;
  const teen = n % 100 >= 12 && n % 100 <= 14;
  if (n === 1) return 'trening';
  return !teen && last >= 2 && last <= 4 ? 'treningi' : 'treningów';
};

const workoutName = (id: string): string => BUILTIN.find((w) => w.id === id)?.name ?? id;

/** Sama liczba dni z odmianą. Kontekst („przerwy”, „to …”) dokłada miejsce użycia. */
const gapDays = (n: number): string => (n === 1 ? '1 dzień' : `${n} dni`);

/* ---------------- Katalog ---------------- */

function Catalogue({ onStart }: { onStart: (t: PlanTemplate) => void }) {
  const [sex, setSex] = useState<Sex>('any');
  const [level, setLevel] = useState<PlanLevel>('zero');
  const [days, setDays] = useState(3);
  const t = planById(planId(level, sex, days))!;

  return (
    <>
      <div className="wrap">
        <h2>Plan treningowy</h2>
        <p className="lead">
          Dwanaście tygodni rozpisane na konkretne dni, z widoczną przerwą między każdą parą
          treningów. Wybierz wariant — ciężary startowe i tak zweryfikuje seria próbna przy
          pierwszym treningu.
        </p>
      </div>

      <div className="grp">
        <h3>Płeć</h3>
        <p className="tight">
          Wpływa wyłącznie na ciężary startowe. Program, rotacja treningów i zasady progresji są
          identyczne — różni się przeciętny punkt wyjścia obciążenia, nie sposób trenowania.
        </p>
        <div style={{ marginTop: 10 }}>
          <Segmented
            value={sex}
            onChange={setSex}
            options={SEXES.map((k) => ({ key: k, label: SEX_LABEL[k] }))}
          />
        </div>
      </div>

      <div className="grp">
        <h3>Poziom</h3>
        <Segmented
          value={level}
          onChange={setLevel}
          options={LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k] }))}
        />
        <p className="tight">{LEVEL_DESC[level]}</p>
      </div>

      <div className="grp">
        <h3>Treningów w tygodniu</h3>
        <div className="freq">
          {FREQUENCIES.map((n) => (
            <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>
              {n}×
            </button>
          ))}
        </div>
        <p className="tight">{t.desc}</p>
      </div>

      <div className="grp">
        <h3>{t.name}</h3>
        <p className="tight">
          {PLAN_WEEKS} tygodni · {t.daysPerWeek * PLAN_WEEKS}{' '}
          {sessionsWord(t.daysPerWeek * PLAN_WEEKS)} ·{' '}
          {t.weekdays.map((w) => WD[w - 1]).join(', ')}
        </p>
        <p style={{ marginTop: 8 }}>
          Układ tygodnia:{' '}
          {t.cycle.map((c, i) => (
            <span key={i} className={`wtag${c === 'D' ? ' light' : ''}`}>
              {c}
            </span>
          ))}
          {t.cycle.includes('D') && ' — D to dzień lekki, bez ciężkiego zawiasu i wyciskania.'}
        </p>
        {t.daysPerWeek >= 6 && (
          <p className="tight" style={{ color: 'var(--warn)' }}>
            Sześć i siedem treningów w tygodniu ma sens tylko przy dobrym śnie i bez bólu. Przy
            pierwszym sygnale przeciążenia zejdź na rzadszy wariant — plan zmienisz w każdej chwili.
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn wide" onClick={() => onStart(t)}>
            Zacznij ten plan
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Kalendarz ---------------- */

function DayRow({ d }: { d: PlannedDay }) {
  const mark = d.status === 'done' ? '✓' : d.status === 'missed' ? '–' : '';
  return (
    <div className={`pday ${d.status}`}>
      <span className="pd-date">
        {WD[d.weekday - 1]} {shortDate(d.date)}
      </span>
      <span className="pd-work">
        {workoutName(d.workout)}
        {d.gap > 0 && <span className="pd-gap">{gapDays(d.gap)} przerwy</span>}
      </span>
      <span className="pd-mark">{mark}</span>
    </div>
  );
}

function ActivePlanView({
  state,
  template,
  onChange,
  onStop,
}: {
  state: AppState;
  template: PlanTemplate;
  onChange: () => void;
  onStop: () => void;
}) {
  const days = buildSchedule(template, state.plan!, loggedDays(state));
  const s = planStats(days);
  const weeks = [...new Set(days.map((d) => d.week))];
  const [open, setOpen] = useState<number>(s.week);

  return (
    <>
      <div className="wrap">
        <h2>{template.name}</h2>
        <p className="lead">
          Tydzień <b>{s.week}</b> z {template.weeks} · zrobione <b>{s.done}</b> z {s.total}
          {s.adherence !== null && ` · realizacja ${s.adherence}%`}
        </p>
      </div>

      <div className="grp">
        <h3>Przerwy między treningami</h3>
        <p className="tight">
          W tym planie najdłuższa zaplanowana przerwa to <b>{gapDays(s.maxGap)}</b>. Tyle wystarczy —
          silnik nie karze za rytm, tylko za długie zniknięcia.
        </p>
        <p style={{ marginTop: 8 }}>
          Do <b>10 dni</b> przerwy nie dzieje się nic. Od <b>11</b> wstrzymane są skoki na cięższy
          kettlebell. Od <b>21</b> cele powtórzeń wracają do dolnej granicy zakresu, a powyżej
          sześciu tygodni schodzą też szacowane maksima.
        </p>
      </div>

      {s.next && (
        <div className="grp">
          <h3>Najbliższy trening</h3>
          <p className="tight">
            {s.next.status === 'today' ? 'Dzisiaj' : `${WD[s.next.weekday - 1]} ${shortDate(s.next.date)}`}
            {' — '}
            {workoutName(s.next.workout)}
          </p>
        </div>
      )}

      {weeks.map((w) => {
        const rows = days.filter((d) => d.week === w);
        const done = rows.filter((d) => d.status === 'done').length;
        return (
          <div key={w}>
            <button className="wk-head" aria-expanded={open === w} onClick={() => setOpen(open === w ? -1 : w)}>
              <span>Tydzień {w}</span>
              <span className="wk-sum">
                {done}/{rows.length}
                {rows.some((d) => d.status === 'today') ? ' · dziś' : ''}
              </span>
            </button>
            {open === w && <div className="wk-body">{rows.map((d) => <DayRow key={d.index} d={d} />)}</div>}
          </div>
        );
      })}

      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={onChange}>
            Zmień plan
          </button>
          <button className="btn ghost wide" onClick={onStop}>
            Zakończ plan
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- Wejście ---------------- */

export function PlanView({
  state,
  onStart,
  onStop,
}: {
  state: AppState;
  onStart: (t: PlanTemplate) => void;
  onStop: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const active = state.plan ? planById(state.plan.templateId) : undefined;

  if (!state.plan || !active || picking)
    return (
      <Catalogue
        onStart={(t) => {
          setPicking(false);
          onStart(t);
        }}
      />
    );

  return (
    <ActivePlanView
      state={state}
      template={active}
      onChange={() => setPicking(true)}
      onStop={onStop}
    />
  );
}
