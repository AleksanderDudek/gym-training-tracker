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
import { advise } from '../engine/advice';
import { journal } from '../engine/journal';
import { achievementCount } from './Achievements';
import { POINTS, pointsToday } from '../engine/score';
import { dayKey, daysBetween, planPolicy, planWeekdays, planWeeks } from '../engine/schedule';
import { snapshot } from '../engine/snapshot';
import type { Snapshot } from '../engine/snapshot';
import { Segmented } from './ui';
import { SupportLine } from './Support';
import { PlanCatalog, Weekdays } from './Plans';
import { BoostCard } from './Boost';
import { PlanArt } from './SceneArt';
import { HealthNote } from './Health';
import { PLANS_PATH, go } from '../routing';
import type {
  AppState,
  PlanLevel,
  PlanOptions,
  PlanPolicy,
  PlanTemplate,
  PlannedDay,
  Sex,
} from '../types';

const WD = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'];
const WD_SHORT = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];

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

/** Nazwa treningu z rotacji — gotowego albo własnego. */
const nameIn =
  (state: AppState) =>
  (id: string): string =>
    [...BUILTIN, ...state.workouts].find((w) => w.id === id)?.name ?? id;

/** Sama liczba dni z odmianą. Kontekst („przerwy”, „to …”) dokłada miejsce użycia. */
const gapDays = (n: number): string => (n === 1 ? '1 dzień' : `${n} dni`);

/* ---------------- Katalog ---------------- */

export function Catalogue({
  onStart,
  onCancel,
}: {
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
  onCancel?: (() => void) | undefined;
}) {
  const [sex, setSex] = useState<Sex>('any');
  const [level, setLevel] = useState<PlanLevel>('zero');
  const [days, setDays] = useState(3);
  const [start, setStart] = useState(dayKey(Date.now()));
  const [policy, setPolicy] = useState<PlanPolicy>('shift');
  const t = planById(planId(level, sex, days))!;
  // Wybór dni startuje od układu z szablonu i resetuje się przy zmianie częstotliwości.
  const [picked, setPicked] = useState<number[] | null>(null);
  const weekdays = picked ?? t.weekdays;

  const toggle = (wd: number) => {
    const set = new Set(weekdays);
    if (set.has(wd)) set.delete(wd);
    else set.add(wd);
    setPicked([...set].sort((a, b) => a - b));
  };

  const sessions = weekdays.length * PLAN_WEEKS;

  return (
    <>
      {/* Scena idzie za wybranym poziomem — od zera, podstawowy, mocny. */}
      <div className="scene-hero">
        <PlanArt plan={t} />
      </div>
      <div className="wrap">
        <p className="lead">
          Dwanaście tygodni rozpisane na konkretne dni. Aplikacja pilnuje terminów: liczy
          zrobione i opuszczone, przyznaje punkty za trzymanie się kalendarza i sama decyduje,
          który trening wypada następny — także wtedy, gdy poprzedni się nie odbył.
        </p>
      </div>

      <div className="grp">
        <h2>Płeć</h2>
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
        <h2>Poziom</h2>
        <Segmented
          value={level}
          onChange={setLevel}
          options={LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k] }))}
        />
        <p className="tight">{LEVEL_DESC[level]}</p>
      </div>

      <div className="grp">
        <h2>Treningów w tygodniu</h2>
        <div className="freq">
          {FREQUENCIES.map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              onClick={() => {
                setDays(n);
                setPicked(null);
              }}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="tight">{t.desc}</p>
      </div>

      <div className="grp">
        <h2>Dzień startu</h2>
        <p className="tight">
          Terminy liczą się od tego dnia. Dni tygodnia sprzed startu nie są zaległościami.
        </p>
        <div style={{ marginTop: 8, maxWidth: 200 }}>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value || dayKey(Date.now()))}
          />
        </div>
      </div>

      <div className="grp">
        <h2>Dni treningowe</h2>
        <p className="tight">
          Domyślnie tak, żeby przerwy między treningami były równe. Zmień, jeśli tydzień
          wygląda u ciebie inaczej — silnik i tak liczy terminy z tego, co tu wybierzesz.
        </p>
        <div className="wdays">
          {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
            <button
              key={wd}
              aria-pressed={weekdays.includes(wd)}
              aria-label={WD[wd - 1]}
              onClick={() => toggle(wd)}
            >
              {WD_SHORT[wd - 1]}
            </button>
          ))}
        </div>
        <p className="tight" style={{ marginTop: 8 }}>
          {weekdays.length
            ? `${weekdays.map((w) => WD[w - 1]).join(', ')} · ${sessions} ${sessionsWord(sessions)} przez ${PLAN_WEEKS} tygodni`
            : 'Wybierz przynajmniej jeden dzień.'}
        </p>
      </div>

      <div className="grp">
        <h2>Gdy trening się nie odbędzie</h2>
        <Segmented
          value={policy}
          onChange={setPolicy}
          options={[
            { key: 'shift' as PlanPolicy, label: 'Trening czeka' },
            { key: 'fixed' as PlanPolicy, label: 'Trening przepada' },
          ]}
        />
        <p className="tight">
          {policy === 'shift'
            ? 'Rotacja przesuwa się dopiero po zrobionym treningu. Opuszczony poniedziałek nie zjada treningu A — dostanie go najbliższy termin. Zalecane: żaden wzorzec ruchowy nie wypada z planu.'
            : 'Rotacja idzie sztywno z kalendarzem. Opuszczony trening przepada, a kolejny termin bierze to, co wypada w kalendarzu.'}
        </p>
      </div>

      <div className="grp">
        <h2>{t.name}</h2>
        <p style={{ marginTop: 8 }}>
          Układ rotacji:{' '}
          {t.cycle.map((c, i) => (
            <span key={i} className={`wtag${c === 'D' ? ' light' : ''}`}>
              {c}
            </span>
          ))}
          {t.cycle.includes('D') && ' — D to dzień lekki, bez ciężkiego zawiasu i wyciskania.'}
        </p>
        {days >= 6 && (
          <p className="tight" style={{ color: 'var(--warn)' }}>
            Sześć i siedem treningów w tygodniu ma sens tylko przy dobrym śnie i bez bólu. Przy
            pierwszym sygnale przeciążenia zejdź na rzadszy wariant — plan zmienisz w każdej chwili.
          </p>
        )}
        <div className="actions">
          <button
            className="btn wide"
            disabled={!weekdays.length}
            onClick={() => onStart(t, { start, weekdays, policy })}
          >
            Zacznij ten plan
          </button>
          {onCancel && (
            <button className="btn ghost wide" onClick={onCancel}>
              Wróć do planu
            </button>
          )}
        </div>
        <HealthNote style={{ marginTop: 10 }} />
      </div>
    </>
  );
}

/* ---------------- Kalendarz ---------------- */

function DayRow({
  d,
  onTick,
  workoutName,
}: {
  d: PlannedDay;
  onTick: (i: number) => void;
  workoutName: (id: string) => string;
}) {
  const mark =
    d.status === 'done' ? (d.late === 0 ? '✓' : '↺') : d.status === 'missed' ? '–' : '';
  const tickable = d.status !== 'future' && d.source !== 'log';

  return (
    <div className={`pday ${d.status}${d.late > 0 ? ' late' : ''}`}>
      <span className="pd-date">
        {WD[d.weekday - 1]} {shortDate(d.date)}
      </span>
      <span className="pd-work">
        {workoutName(d.workout)}
        <span className="pd-gap">
          {d.status === 'done' && d.late > 0
            ? `nadrobiony ${gapDays(d.late)} po terminie`
            : d.status === 'open'
              ? 'do nadrobienia'
              : d.status === 'missed'
                ? 'opuszczony — trening wchodzi na kolejny termin'
                : d.gap > 0
                  ? `${gapDays(d.gap)} przerwy`
                  : ''}
        </span>
      </span>
      {tickable ? (
        <button
          className="pd-tick"
          aria-pressed={d.source === 'tick'}
          title={d.source === 'tick' ? 'Cofnij odhaczenie' : 'Odhacz — trening zrobiony poza aplikacją'}
          onClick={() => onTick(d.index)}
        >
          <span>{d.source === 'tick' ? '✓' : ''}</span>
        </button>
      ) : (
        <span className="pd-mark">{mark}</span>
      )}
    </div>
  );
}

function Scoreboard({ snap }: { snap: Snapshot }) {
  const { stats, score, rank, points } = snap;
  const pct = Math.round(rank.progress * 100);

  return (
    <div className="grp">
      <div className="rankline">
        <span className="rank-name">{rank.rank.name}</span>
        <span className="rank-pts">{points} pkt</span>
      </div>
      <div className="rank-bar">
        <i style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <p className="tight">
        {rank.next
          ? `Do stopnia „${rank.next.name}” brakuje ${rank.next.at - points} pkt.`
          : 'Najwyższy stopień. Dalej liczy się już tylko seria.'}
      </p>

      <div className="tiles">
        <div className="tile">
          <b>{stats.adherence === null ? '—' : `${stats.adherence}%`}</b>
          <span>realizacja</span>
        </div>
        <div className="tile">
          <b>{stats.streak}</b>
          <span>seria w terminie</span>
        </div>
        <div className="tile">
          <b>
            {stats.done}/{stats.total}
          </b>
          <span>terminy</span>
        </div>
        <div className="tile">
          <b>{stats.missed}</b>
          <span>opuszczone</span>
        </div>
      </div>

      <details className="why" style={{ marginTop: 12 }}>
        <summary>Skąd te punkty</summary>
        <div>
          <ul className="ptlist">
            <li>
              Terminy: <b>{score.parts.sessions} pkt</b> — {stats.onTime} w terminie po{' '}
              {POINTS.onTime}, {stats.late} nadrobione po {POINTS.late.join('/')}.
            </li>
            <li>
              Seria: <b>{score.parts.streak} pkt</b> — {POINTS.streakStep} pkt za każdy kolejny
              termin w terminie, do {POINTS.streakCap * POINTS.streakStep} pkt za sesję.
            </li>
            <li>
              Czyste tygodnie: <b>{score.parts.weeks} pkt</b> — {score.cleanWeeks} ×{' '}
              {POINTS.cleanWeek}.
            </li>
            <li>
              Treningi poza planem: <b>{score.parts.extra} pkt</b> — {stats.extra} ×{' '}
              {POINTS.extra}.
            </li>
            {points > score.points && (
              <li>
                Dorobek z wcześniejszych planów: <b>{points - score.points} pkt</b>.
              </li>
            )}
          </ul>
          <p style={{ marginTop: 8 }}>
            Punktów ujemnych nie ma. Opuszczony termin nic nie zabiera — zeruje serię, a to
            i tak boli najbardziej.
          </p>
        </div>
      </details>
    </div>
  );
}

/**
 * Odznaki mają własną zakładkę, bo większość z nich liczy się z całej historii, a nie
 * z kalendarza planu. Tu zostaje sam licznik — żeby było widać, że rosną.
 */
function BadgeLine({ state }: { state: AppState }) {
  const { have, total } = achievementCount(state);
  return (
    <div className="grp">
      <h2>
        Odznaki {have}/{total}
      </h2>
      <p className="tight">
        Pełna lista z progami i postępem jest w zakładce <b>Osiągnięcia</b>. Terminy planu
        odblokowują rodziny „Seria w terminie”, „Bez pudła”, „Czysty tydzień” i „Nadrabiacz”.
      </p>
      <a className="vidlink" href="#/osiagniecia">
        Zobacz osiągnięcia
      </a>
    </div>
  );
}

function Journal({ snap, state }: { snap: Snapshot; state: AppState }) {
  const [all, setAll] = useState(false);
  const workoutName = nameIn(state);
  const items = journal(snap.schedule, state.events, workoutName).filter(
    (e) => e.date <= snap.today,
  );
  const shown = all ? items : items.slice(0, 12);

  return (
    <div className="grp">
      <h2>Dziennik</h2>
      <p className="tight">
        Każdy termin zostawia ślad — także ten, w którym nic się nie wydarzyło.
      </p>
      <div className="jrn">
        {shown.map((e) => (
          <div key={e.id} className={`jrow j-${e.kind}`}>
            <span className="j-date">{shortDate(e.date)}</span>
            <span className="j-body">
              <b>{e.title}</b>
              {e.text && <span className="j-text">{e.text}</span>}
            </span>
            <span className="j-pts">{e.points ? `+${e.points}` : ''}</span>
          </div>
        ))}
        {!shown.length && <p className="tight">Jeszcze nic — pierwszy termin dopiero przed tobą.</p>}
      </div>
      {items.length > shown.length && (
        <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAll(true)}>
          Pokaż wszystkie ({items.length})
        </button>
      )}
    </div>
  );
}

function ActivePlanView({
  state,
  snap,
  onChange,
  onStop,
  onTick,
  onFrequency,
  edits,
}: {
  state: AppState;
  snap: Snapshot;
  onChange: () => void;
  onStop: () => void;
  onTick: (i: number) => void;
  onFrequency: (days: number) => void;
  edits: PlanEdits;
}) {
  const { template, schedule, stats, today } = snap;
  const workoutName = nameIn(state);
  const days = schedule.days;
  const weeks = [...new Set(days.map((d) => d.week))];
  const [open, setOpen] = useState<number>(stats.week);
  const tips = advise(state, template, snap.plan, stats, today);
  const worth = pointsToday(stats, today);

  return (
    <>
      <div className="scene-hero">
        <PlanArt plan={template} />
      </div>
      <div className="wrap">
        <h2>{template.name}</h2>
        <p className="lead">
          Tydzień <b>{stats.week}</b> z {planWeeks(template, snap.plan)} · zrobione <b>{stats.done}</b> z{' '}
          {stats.total}
          {stats.adherence !== null && ` · realizacja ${stats.adherence}%`}
        </p>
      </div>

      <Scoreboard snap={snap} />

      {tips.map((a) => (
        <div className="grp" key={a.kind}>
          <h2>{a.title}</h2>
          <p className="tight" style={a.level === 'warn' ? { color: 'var(--warn)' } : undefined}>
            {a.text}
          </p>
          {a.kind === 'due' || a.kind === 'makeup' ? (
            <p style={{ marginTop: 8 }}>
              Dziś do wzięcia: <b>{worth.now} pkt</b>
              {stats.due && ` · ${workoutName(stats.due.workout)}`}
            </p>
          ) : null}
          {a.freq !== undefined && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => onFrequency(a.freq!)}>
              Przejdź na {a.freq}× w tygodniu
            </button>
          )}
          {a.days && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => edits.onWeekdays(a.days!)}>
              Od dziś: {a.days.map((d) => WD[d - 1]).join(', ')}
            </button>
          )}
        </div>
      ))}

      <BoostCard state={state} today={today} onStart={edits.onStart} />

      {stats.next && (
        <div className="grp">
          <h2>Najbliższy termin</h2>
          <p className="tight">
            {stats.next.date === today
              ? 'Dzisiaj'
              : `${WD[stats.next.weekday - 1]} ${shortDate(stats.next.date)} — za ${gapDays(daysBetween(today, stats.next.date))}`}
            {' · '}
            {workoutName(stats.next.workout)}
          </p>
        </div>
      )}

      <div className="grp">
        <h2>Rytm i przerwy</h2>
        <p className="tight">
          Dni treningowe: {planWeekdays(template, snap.plan).map((w) => WD[w - 1]).join(', ')}.
          Najdłuższa zaplanowana przerwa to <b>{gapDays(stats.maxGap)}</b>.
        </p>
        <p style={{ marginTop: 8 }}>
          Do <b>10 dni</b> przerwy nie dzieje się nic. Od <b>11</b> wstrzymane są skoki na cięższy
          obciążenie. Od <b>21</b> cele powtórzeń wracają do dolnej granicy zakresu, a powyżej
          sześciu tygodni schodzą też szacowane maksima.
        </p>
      </div>

      {weeks.map((w) => {
        const rows = days.filter((d) => d.week === w);
        const done = rows.filter((d) => d.status === 'done').length;
        return (
          <div key={w}>
            <button
              className="wk-head"
              aria-expanded={open === w}
              onClick={() => setOpen(open === w ? -1 : w)}
            >
              <span>
                Tydzień {w}
                {rows[0]?.deload && <i className="wk-deload"> · lżejszy</i>}
              </span>
              <span className="wk-sum">
                {done}/{rows.length}
                {rows.some((d) => d.status === 'today') ? ' · dziś' : ''}
                {rows.some((d) => d.status === 'open') ? ' · do nadrobienia' : ''}
              </span>
            </button>
            {open === w && (
              <div className="wk-body">
                {rows.map((d) => (
                  <DayRow key={d.index} d={d} onTick={onTick} workoutName={workoutName} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <PlanAdjust key={planWeekdays(template, snap.plan).join()} snap={snap} onChange={onChange} edits={edits} />

      <BadgeLine state={state} />
      <Journal snap={snap} state={state} />

      <div className="wrap">
        <div className="actions">
          <button className="btn ghost wide" onClick={onChange}>
            Zmień plan
          </button>
          <button className="btn ghost wide" onClick={onStop}>
            Zakończ plan
          </button>
        </div>
        <SupportLine seed={state.log.length + 2} />
      </div>
    </>
  );
}

/* ---------------- Wejście ---------------- */

/**
 * Zakładka Plan: uruchomiony plan z kalendarzem albo — gdy żadnego nie ma — katalog planów.
 * Zmiana planu prowadzi do katalogu pod własnym adresem, więc „wstecz” wraca do kalendarza.
 */
/** Zmiany planu w trakcie — od dziś, bez przepisywania tego, co minęło. */
export interface PlanEdits {
  onWeekdays: (days: number[]) => void;
  onPolicy: (p: PlanPolicy) => void;
  onExtend: (weeks: number) => void;
  /** Start treningu dodatkowego z podpowiedzi. */
  onStart: (workoutId: string) => void;
}

export function PlanView({
  state,
  onStop,
  onTick,
  onFrequency,
  edits,
}: {
  state: AppState;
  onStop: () => void;
  onTick: (index: number) => void;
  onFrequency: (days: number) => void;
  edits: PlanEdits;
}) {
  const snap = snapshot(state);
  if (!snap) return <PlanCatalog state={state} />;
  return (
    <ActivePlanView
      state={state}
      snap={snap}
      onChange={() => go(PLANS_PATH)}
      onStop={onStop}
      onTick={onTick}
      onFrequency={onFrequency}
      edits={edits}
    />
  );
}

/** O ile przedłużyć plan jednym stuknięciem: miesiąc, czyli tyle, ile trwa krótki plan z celem. */
const EXTEND_WEEKS = 4;

/**
 * Zmiana planu od dziś: dni treningowe, zasada przepadłych terminów i przedłużenie. Nowe dni
 * działają od dziś — terminy, które minęły, zostają, razem z punktami, seriami i odznakami.
 */
function PlanAdjust({ snap, onChange, edits }: { snap: Snapshot; onChange: () => void; edits: PlanEdits }) {
  const { template, plan, stats } = snap;
  const now = planWeekdays(template, plan);
  const [days, setDays] = useState<number[]>(now);
  const policy = planPolicy(plan);
  const total = planWeeks(template, plan);
  const ending = !stats.next || stats.week >= total - 1;
  const changed = days.join() !== now.join();
  return (
    <details className="grp adjust" open={ending}>
      <summary>
        <h2>Zmień plan od dziś</h2>
      </summary>
      <p className="tight">
        Zmiany działają od dziś. Terminy, które minęły, zostają takie, jakie były — razem z punktami,
        seriami i odznakami. Rotacja treningów idzie dalej.
      </p>
      <span className="seg-label">dni treningowe</span>
      <Weekdays value={days} onChange={setDays} />
      <button className="btn sm" disabled={!changed || !days.length} onClick={() => edits.onWeekdays(days)}>
        Zapisz dni od dziś
      </button>
      <span className="seg-label" style={{ marginTop: 12 }}>
        gdy termin przepadnie
      </span>
      <Segmented
        label="Gdy termin przepadnie"
        options={[
          { key: 'shift' as PlanPolicy, label: 'Trening czeka' },
          { key: 'fixed' as PlanPolicy, label: 'Trening przepada' },
        ]}
        value={policy}
        onChange={(p) => p !== policy && edits.onPolicy(p)}
      />
      <p className="tight">
        Plan trwa {total} {total === 1 ? 'tydzień' : total < 5 ? 'tygodnie' : 'tygodni'}
        {plan.extraWeeks ? `, w tym ${plan.extraWeeks} dołożone` : ''}.{' '}
        {ending ? 'To już końcówka — da się ją przedłużyć bez zakładania nowego planu.' : ''}
      </p>
      <div className="btnrow">
        <button className="btn sm ghost" onClick={() => edits.onExtend(EXTEND_WEEKS)}>
          Przedłuż o {EXTEND_WEEKS} tygodnie
        </button>
        <button className="btn sm ghost" onClick={onChange}>
          Inny plan z katalogu
        </button>
      </div>
    </details>
  );
}
