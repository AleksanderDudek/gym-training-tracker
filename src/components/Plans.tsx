import { useState } from 'react';
import {
  GOAL_PLANS,
  LEVELS,
  LEVEL_DESC,
  LEVEL_LABEL,
  SEXES,
  SEX_LABEL,
  loadFactorFor,
  planOf,
  weekdaysFor,
} from '../data/plans';
import { RULES, autoDeload, reviewPlan, weekLayout } from '../engine/design';
import { dayKey } from '../engine/schedule';
import { plural } from '../engine/quips';
import {
  PLAN_CLASSIC_PATH,
  PLAN_NEW_PATH,
  go,
  goBack,
  planEditPath,
  planPath,
  workoutPath,
} from '../routing';
import { Chips, DesignNotes, WeeklyBars } from './Design';
import { GEAR_WORKOUT, allWorkouts } from './Workouts';
import { EmptyState, Segmented } from './ui';
import type { AppState, PlanLevel, PlanOptions, PlanPolicy, PlanTemplate, Sex, WorkoutGear } from '../types';

/**
 * Plany: katalog (z celem, własne i klasyczny), podgląd z doradcą i startem oraz kreator
 * planu na 4–48 tygodni.
 */

const WD = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'niedz'];
const WD_SHORT = ['P', 'W', 'Ś', 'C', 'P', 'S', 'N'];
const WEEK_FORMS = ['tydzień', 'tygodnie', 'tygodni'] as const;

export const MIN_WEEKS = 4;
export const MAX_WEEKS = 48;

const nameOf = (state: AppState, id: string): string =>
  allWorkouts(state).find((w) => w.id === id)?.name ?? id;

/** „60 dni · 9 tygodni · 4× w tygodniu · siłownia · podstawowy”. */
function planMeta(t: PlanTemplate): string {
  return [
    t.days ? `${t.days} dni` : null,
    `${t.weeks} ${plural(t.weeks, WEEK_FORMS)}`,
    `${t.weekdays.length}× w tygodniu`,
    t.gear ? GEAR_WORKOUT[t.gear] : null,
    t.kind === 'goal' ? LEVEL_LABEL[t.level].toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PlanCard({ t, active }: { t: PlanTemplate; active: boolean }) {
  return (
    <div className={`grp wcard${active ? ' today' : ''}`}>
      {active && <div className="today-tag">Twój plan teraz</div>}
      <h2 className="today-name">{t.name}</h2>
      <p className="wmeta">{planMeta(t)}</p>
      {t.goal && <p className="tight">{t.goal}</p>}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button className="btn sm ghost" onClick={() => go(planPath(t.id))}>
          Zobacz plan
        </button>
      </div>
    </div>
  );
}

type Length = 'all' | '30' | '60' | '90';

/** Katalog planów. Na górze plany z celem, potem własne i konfigurator klasyczny. */
export function PlanCatalog({ state }: { state: AppState }) {
  const [len, setLen] = useState<Length>('all');
  const [gear, setGear] = useState<'all' | WorkoutGear>('all');
  const active = state.plan?.templateId;
  const goals = GOAL_PLANS.filter(
    (t) => (len === 'all' || String(t.days) === len) && (gear === 'all' || t.gear === gear),
  );
  const own = state.plans ?? [];

  return (
    <>
      <div className="wrap">
        <p className="lead">
          Plan rozpisuje treningi na konkretne dni i pilnuje terminów. Plany z celem trwają 30, 60
          albo 90 dni i składają się z treningów z biblioteki; własny ułożysz na 4–48 tygodni,
          a doradca sprawdzi, czy tydzień ma sens.
        </p>
      </div>

      <div className="sect-label">Plany z celem</div>
      <div className="grp">
        <Chips
          label="Długość"
          value={len}
          onChange={setLen}
          options={[
            { key: 'all', label: 'Każda długość' },
            { key: '30', label: '30 dni' },
            { key: '60', label: '60 dni' },
            { key: '90', label: '90 dni' },
          ]}
        />
        <Segmented
          label="Sprzęt"
          value={gear}
          onChange={setGear}
          options={[
            { key: 'all', label: 'Każdy sprzęt' },
            { key: 'kb', label: 'Kettlebell i dom' },
            { key: 'gym', label: 'Siłownia' },
          ]}
        />
      </div>
      {goals.map((t) => (
        <PlanCard key={t.id} t={t} active={t.id === active} />
      ))}
      {!goals.length && (
        <div className="wrap">
          <p className="tight">Żaden plan nie pasuje do filtrów.</p>
        </div>
      )}

      <div className="sect-label">Twoje plany</div>
      {own.map((t) => (
        <PlanCard key={t.id} t={t} active={t.id === active} />
      ))}
      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={() => go(PLAN_NEW_PATH)}>
            Ułóż własny plan
          </button>
        </div>
      </div>

      <div className="sect-label">Plan klasyczny z kettlebell</div>
      <div className="grp">
        <p className="tight">
          Dwanaście tygodni na treningach A–D, z doborem poziomu, płci i liczby treningów w tygodniu
          od dwóch do siedmiu. Pierwszy plan tej aplikacji — dalej działa jak dotąd.
        </p>
        <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => go(PLAN_CLASSIC_PATH)}>
          Ustaw plan klasyczny
        </button>
      </div>
    </>
  );
}

/** Wybór dni tygodnia — siedem przełączników. */
function Weekdays({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (wd: number) => {
    const set = new Set(value);
    if (set.has(wd)) set.delete(wd);
    else set.add(wd);
    onChange([...set].sort((a, b) => a - b));
  };
  return (
    <div className="wdays">
      {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
        <button
          type="button"
          key={wd}
          aria-pressed={value.includes(wd)}
          aria-label={WD[wd - 1]}
          onClick={() => toggle(wd)}
        >
          {WD_SHORT[wd - 1]}
        </button>
      ))}
    </div>
  );
}

/** Tydzień planu słowami: dzień i trening, z odnośnikiem do podglądu treningu. */
function WeekTable({ state, t }: { state: AppState; t: Pick<PlanTemplate, 'cycle' | 'weekdays' | 'weeks'> }) {
  const rows = weekLayout(t);
  return (
    <div className="plan-week">
      {rows.map((r) => (
        <div className="pw-row" key={r.weekday}>
          <span className="pw-day">{WD[r.weekday - 1]}</span>
          {r.workout ? <a href={workoutPath(r.workout)}>{nameOf(state, r.workout)}</a> : <span>—</span>}
        </div>
      ))}
      {t.cycle.length > rows.length && (
        <p className="tight" style={{ marginTop: 6 }}>
          Rotacja ma {t.cycle.length} treningi, więc w kolejnych tygodniach dni przesuwają się po kolei:{' '}
          {t.cycle.map((c) => nameOf(state, c)).join(' → ')}.
        </p>
      )}
    </div>
  );
}

/**
 * Start planu: dzień, dni tygodnia, co z opuszczonym treningiem i punkt wyjścia ciężarów.
 * Poziom i płeć wpływają tylko na ciężary startowe ćwiczeń jeszcze nieskalibrowanych —
 * pierwsza seria próbna i tak zweryfikuje każdy z nich.
 */
function StartForm({
  t,
  onStart,
}: {
  t: PlanTemplate;
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
}) {
  const [start, setStart] = useState(dayKey(Date.now()));
  const [weekdays, setWeekdays] = useState<number[]>(t.weekdays);
  const [policy, setPolicy] = useState<PlanPolicy>('shift');
  const [level, setLevel] = useState<PlanLevel>(t.level);
  const [sex, setSex] = useState<Sex>('any');

  return (
    <div className="grp">
      <h2>Start</h2>
      <label className="fld">
        <span>dzień startu</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value || dayKey(Date.now()))} />
      </label>
      <div className="seg-label">dni treningowe</div>
      <Weekdays value={weekdays} onChange={setWeekdays} />
      {weekdays.length !== t.weekdays.length && weekdays.length > 0 && (
        <p className="tight warnline" style={{ marginTop: 6 }}>
          Plan jest ułożony na {t.weekdays.length}× w tygodniu, a wybrane są {weekdays.length} dni. Rotacja
          pójdzie dalej po kolei, ale doradca liczył tydzień dla {t.weekdays.length} dni.
        </p>
      )}
      <div className="seg-label" style={{ marginTop: 10 }}>
        gdy trening się nie odbędzie
      </div>
      <Segmented
        label="Opuszczony trening"
        value={policy}
        onChange={setPolicy}
        options={[
          { key: 'shift', label: 'Trening czeka' },
          { key: 'fixed', label: 'Trening przepada' },
        ]}
      />
      <details className="why">
        <summary>Ciężary startowe: {LEVEL_LABEL[level].toLowerCase()}, {SEX_LABEL[sex].toLowerCase()}</summary>
        <div>
          <p className="tight">
            Tylko dla ćwiczeń, których jeszcze nie robiłeś — zmierzone poziomy zostają. Płeć zmienia
            wyłącznie przeciętny punkt startu ciężaru, nie sposób trenowania.
          </p>
          <Segmented
            label="Poziom"
            value={level}
            onChange={setLevel}
            options={LEVELS.map((k) => ({ key: k, label: LEVEL_LABEL[k] }))}
          />
          <p className="tight">{LEVEL_DESC[level]}</p>
          <Segmented label="Płeć" value={sex} onChange={setSex} options={SEXES.map((k) => ({ key: k, label: SEX_LABEL[k] }))} />
        </div>
      </details>
      <div className="actions">
        <button
          className="btn wide"
          disabled={!weekdays.length}
          onClick={() => onStart(t, { start, weekdays, policy, loadFactor: loadFactorFor(level, sex) })}
        >
          Zacznij ten plan
        </button>
      </div>
    </div>
  );
}

/** Podgląd planu z celem albo własnego: tydzień, mięśnie, doradca, start. */
export function PlanDetail({
  state,
  id,
  onStart,
  onDelete,
}: {
  state: AppState;
  id: string;
  onStart: (t: PlanTemplate, o: PlanOptions) => void;
  onDelete: (t: PlanTemplate) => void;
}) {
  const t = planOf(state, id);
  if (!t)
    return (
      <div className="wrap">
        <EmptyState
          title="Nie ma takiego planu"
          text="Mógł zostać usunięty. Wróć do katalogu i wybierz inny."
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );
  const r = reviewPlan(state, t, allWorkouts(state));
  const active = state.plan?.templateId === t.id;

  return (
    <>
      <div className="wrap">
        <h2 className="ex-h">{t.name}</h2>
        <p className="wmeta">{planMeta(t)}</p>
        {t.goal && <p className="lead">{t.goal}</p>}
        {active && (
          <p className="tight">
            To twój aktualny plan. <a href="#/plan">Kalendarz i terminy →</a>
          </p>
        )}
      </div>

      <div className="grp">
        <h2>Tydzień</h2>
        <p className="tight">{t.desc}</p>
        <WeekTable state={state} t={t} />
        <p className="tight" style={{ marginTop: 8 }}>
          {t.deload?.length
            ? `${t.deload.length === 1 ? `Tydzień lżejszy: ${t.deload[0]}.` : `Tygodnie lżejsze: ${t.deload.join(', ')}.`} Mniej serii (z trzech zostają dwie), bez serii „ile dasz radę” i bez zmiany poziomów — zmęczenie schodzi, forma zostaje.`
            : 'Bez tygodnia lżejszego — przy tej długości nie jest potrzebny.'}
        </p>
      </div>

      {t.expect && (
        <div className="grp">
          <h2>Czego się spodziewać</h2>
          <p className="tight">{t.expect}</p>
        </div>
      )}

      <div className="grp">
        <h2>Serie tygodniowo</h2>
        <p className="tight">
          Ile serii tygodniowo dostaje każda partia i w ilu dniach. Zielone pole to {RULES.weeklyTarget}–
          {RULES.weeklyMax} serii — zakres, w którym przyrost opłaca się najbardziej.
        </p>
        <WeeklyBars weekly={r.weekly} />
      </div>

      <div className="grp">
        <h2>Doradca</h2>
        <DesignNotes notes={r.notes} />
      </div>

      <StartForm key={t.id} t={t} onStart={onStart} />

      {t.kind === 'own' && (
        <div className="wrap">
          <div className="btnrow" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={() => go(planEditPath(t.id))}>
              Edytuj plan
            </button>
            <button className="btn ghost" onClick={() => onDelete(t)}>
              Usuń plan
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const DELOAD_OPTIONS: { every: number; label: string }[] = [
  { every: 0, label: 'bez tygodnia lżejszego' },
  { every: 4, label: 'co 4 tygodnie' },
  { every: 5, label: 'co 5 tygodni' },
  { every: 6, label: 'co 6 tygodni (zalecane)' },
  { every: 8, label: 'co 8 tygodni' },
];

/**
 * Kreator planu na 4–48 tygodni. Dni tygodnia, trening na każdy dzień i tydzień lżejszy,
 * a obok na żywo tydzień rozpisany na partie i uwagi doradcy.
 */
export function PlanBuilder({
  state,
  id,
  onSave,
  onToast,
}: {
  state: AppState;
  id?: string | undefined;
  onSave: (t: PlanTemplate) => void;
  onToast: (m: string) => void;
}) {
  const editing = id ? state.plans?.find((p) => p.id === id) : undefined;
  const workouts = allWorkouts(state);
  const [name, setName] = useState(editing?.name ?? '');
  const [weeks, setWeeks] = useState(editing?.weeks ?? 8);
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? weekdaysFor(3));
  // Trening na każdy dzień tygodnia; przy zmianie dni zostaje to, co już było wybrane.
  const [byDay, setByDay] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    const days = editing?.weekdays ?? weekdaysFor(3);
    const cycle = editing?.cycle ?? ['A', 'B', 'C'];
    days.forEach((d, i) => (out[d] = cycle[i % cycle.length] ?? 'A'));
    return out;
  });
  const [every, setEvery] = useState<number>(() => {
    if (!editing) return RULES.deloadEvery;
    if (editing.deloadEvery !== undefined) return editing.deloadEvery;
    // Plany zapisane przed zapamiętywaniem: odczyt z pierwszego tygodnia lżejszego, a krótki
    // plan bez niego dostaje wartość zalecaną — przy wydłużeniu tydzień lżejszy się pojawi.
    const d = editing.deload?.[0];
    return d && DELOAD_OPTIONS.some((o) => o.every === d) ? d : RULES.deloadEvery;
  });

  if (id && !editing)
    return (
      <div className="wrap">
        <EmptyState
          title="Tego planu nie da się edytować"
          text="Edytować można tylko własne plany."
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );

  const days = [...weekdays].sort((a, b) => a - b);
  const cycle = days.map((d) => byDay[d] ?? 'A');
  const deload = autoDeload(weeks, every);
  const shape = { cycle, weekdays: days, weeks, deload };
  const r = reviewPlan(state, shape, workouts);

  const setDays = (v: number[]) => {
    const next = { ...byDay };
    v.forEach((d) => (next[d] ??= 'A'));
    setByDay(next);
    setWeekdays(v);
  };

  const save = () => {
    if (!name.trim()) {
      onToast('Nadaj planowi nazwę.');
      return;
    }
    if (!days.length) {
      onToast('Wybierz przynajmniej jeden dzień tygodnia.');
      return;
    }
    const t: PlanTemplate = {
      id: editing?.id ?? `p${Date.now()}`,
      name: name.trim(),
      kind: 'own',
      level: editing?.level ?? 'base',
      sex: 'any',
      daysPerWeek: days.length,
      weeks,
      loadFactor: editing?.loadFactor ?? loadFactorFor('base', 'any'),
      cycle,
      weekdays: days,
      desc: `Własny plan: ${days.length}× w tygodniu przez ${weeks} ${plural(weeks, WEEK_FORMS)}.`,
      deload,
      deloadEvery: every,
    };
    onSave(t);
    go(planPath(t.id), { replace: true });
  };

  const groups: { label: string; list: typeof workouts }[] = [
    { label: 'Twoje', list: state.workouts },
    { label: 'Całe ciało', list: workouts.filter((w) => w.kind === 'full' || w.kind === 'light') },
    { label: 'Podziały', list: workouts.filter((w) => ['push', 'pull', 'legs', 'upper', 'lower'].includes(w.kind ?? '')) },
    {
      label: 'Partie',
      list: workouts.filter((w) => ['glutes', 'chest', 'back', 'shoulders', 'arms', 'core'].includes(w.kind ?? '')),
    },
  ].filter((g) => g.list.length);

  return (
    <>
      <div className="wrap">
        <p className="lead">
          Wybierz dni, przypisz każdemu trening i długość planu. Doradca od razu policzy serie
          tygodniowo na partie, przerwy między ciężkimi dniami i tygodnie lżejsze.
        </p>
      </div>

      <div className="grp builder">
        <label className="fld">
          <span>nazwa</span>
          <input type="text" placeholder="np. Góra i dół do wakacji" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="fld" style={{ marginTop: 10 }}>
          <span id="plan-weeks">długość: {weeks} {plural(weeks, WEEK_FORMS)} (od {MIN_WEEKS} do {MAX_WEEKS})</span>
          <div className="stepper">
            <button type="button" onClick={() => setWeeks(Math.max(MIN_WEEKS, weeks - 1))} aria-label="Tydzień mniej">
              −
            </button>
            <input
              type="range"
              min={MIN_WEEKS}
              max={MAX_WEEKS}
              value={weeks}
              aria-labelledby="plan-weeks"
              onChange={(e) => setWeeks(Number(e.target.value))}
            />
            <button type="button" onClick={() => setWeeks(Math.min(MAX_WEEKS, weeks + 1))} aria-label="Tydzień więcej">
              +
            </button>
          </div>
        </div>

        <div className="seg-label" style={{ marginTop: 10 }}>
          dni treningowe
        </div>
        <Weekdays value={days} onChange={setDays} />

        {days.map((d) => (
          <label className="fld" key={d}>
            <span>{WD[d - 1]}</span>
            <select value={byDay[d] ?? 'A'} onChange={(e) => setByDay({ ...byDay, [d]: e.target.value })}>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.list.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.gear ? ` (${GEAR_WORKOUT[w.gear]})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}

        <label className="fld">
          <span>tydzień lżejszy</span>
          <select value={every} onChange={(e) => setEvery(Number(e.target.value))}>
            {DELOAD_OPTIONS.map((o) => (
              <option key={o.every} value={o.every}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint" style={{ marginTop: 6 }}>
          {deload.length === 1
            ? `Lżejszy wypadnie w ${deload[0]}. tygodniu.`
            : deload.length
              ? `Lżejsze wypadną w tygodniach: ${deload.join(', ')}.`
              : 'Żaden tydzień nie będzie lżejszy.'}
        </p>
      </div>

      <div className="grp">
        <h2>Doradca</h2>
        <DesignNotes notes={r.notes} />
        <WeeklyBars weekly={r.weekly} />
      </div>

      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={save}>
            Zapisz plan
          </button>
          <button className="btn ghost wide" onClick={() => goBack('#/plany')}>
            Anuluj
          </button>
        </div>
      </div>
    </>
  );
}
