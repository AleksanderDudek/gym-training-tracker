import { useMemo, useState } from 'react';
import type { AssignmentBody } from '@gymtracker/link';
import { BUILTIN, EX, groupLabel } from '@gt/data/exercises';
import { MARKER_LIST } from '@gt/food/labs/markers';
import { KIND_LABEL, autoDeload, reviewPlan, reviewWorkout } from '@gt/engine/design';
import type { DesignNote } from '@gt/engine/design';
import { findExercises, splitHits } from '@gt/engine/find';
import { freshState } from '@gt/engine/plan';
import { LOCALE, text } from '@gt/i18n';
import type { PlanLevel, PlanTemplate, Workout, WorkoutGear, WorkoutKind } from '@gt/types';
import type { LibraryBody } from '../lib/data';

/**
 * Edytory treści prowadzącego. Trening i plan składa się z atlasu GYM TRACKERa i ocenia tym samym
 * doradcą (`engine/design.ts`), który podopieczny widzi w swoim kreatorze: serie na partie,
 * kolejność, pary, tygodnie lżejsze. Prowadzący decyduje — doradca tylko mówi, co widzi.
 */

const T = text({
  pl: {
    name: 'Nazwa',
    desc: 'Dla kogo i po co (opcjonalnie)',
    kind: 'Rodzaj',
    kindNone: 'bez rodzaju',
    gear: 'Sprzęt',
    gears: { none: 'bez sprzętu', kb: 'kettlebell i masa ciała', gym: 'siłownia' } as Record<WorkoutGear, string>,
    rest: 'Przerwa po serii, s (puste — z rodzaju ćwiczenia)',
    exercises: 'Ćwiczenia',
    add: 'Dodaj ćwiczenie z atlasu',
    addPh: 'np. przysiad, wiosłowanie, deska',
    pair: 'na zmianę z poprzednim',
    circuit: 'obwód',
    video: 'Twoje wideo (adres https, opcjonalnie)',
    up: 'Wyżej',
    down: 'Niżej',
    remove: 'Usuń',
    noEx: 'Dodaj pierwsze ćwiczenie.',
    review: 'Doradca GYM TRACKERa',
    sets: (n: number, min: number) => `${n} serii · ok. ${min} min`,
    goal: 'Cel jednym zdaniem (opcjonalnie)',
    weeks: 'Długość, tygodnie',
    days: 'Dni treningowe',
    cycle: 'Kolejność treningów',
    cycleHint: 'Sesje idą po kolei i wracają do początku. Twoje treningi z biblioteki i gotowe z GYM TRACKERa.',
    addWorkout: 'Dodaj trening',
    own: 'Twoje',
    builtin: 'Gotowe w GYM TRACKERze',
    level: 'Poziom ciężarów startowych',
    levels: { zero: 'od zera', base: 'podstawowy', strong: 'mocny' } as Record<PlanLevel, string>,
    deload: 'Tydzień lżejszy co',
    deloadN: (n: number) => (n ? `${n} tyg.` : 'bez lżejszych'),
    kcal: 'Kalorie na dzień (kcal)',
    protein: 'Białko na dzień (g)',
    steps: 'Kroki na dzień',
    perWeek: 'Treningi w tygodniu',
    weightGoal: 'Waga docelowa (kg)',
    rate: 'Tempo zmiany masy (kg / tydzień, ujemne — w dół)',
    note: 'Komentarz dla podopiecznego',
    tests: 'Badania',
    testPh: 'np. Witamina D, Ferrytyna, TSH',
    testNote: 'Uwaga (np. na czczo)',
    addTest: 'Dodaj badanie',
    by: 'Do kiedy (opcjonalnie)',
    title: 'Tytuł',
    text: 'Treść',
    checklist: 'Lista do odhaczenia — jeden punkt w wierszu (opcjonalnie)',
    wd: ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'],
    exN: (n: number) => `${n} ćw.`,
  },
  en: {
    name: 'Name',
    desc: 'Who it is for and why (optional)',
    kind: 'Type',
    kindNone: 'no type',
    gear: 'Equipment',
    gears: { none: 'no equipment', kb: 'kettlebell and bodyweight', gym: 'gym' } as Record<WorkoutGear, string>,
    rest: 'Rest after a set, s (empty — from the exercise type)',
    exercises: 'Exercises',
    add: 'Add an exercise from the atlas',
    addPh: 'e.g. squat, row, plank',
    pair: 'alternate with previous',
    circuit: 'circuit',
    video: 'Your video (https link, optional)',
    up: 'Up',
    down: 'Down',
    remove: 'Remove',
    noEx: 'Add the first exercise.',
    review: 'GYM TRACKER advisor',
    sets: (n: number, min: number) => `${n} sets · about ${min} min`,
    goal: 'Goal in one sentence (optional)',
    weeks: 'Length, weeks',
    days: 'Training days',
    cycle: 'Workout order',
    cycleHint: 'Sessions go in order and loop. Your library workouts and GYM TRACKER’s ready ones.',
    addWorkout: 'Add workout',
    own: 'Yours',
    builtin: 'Ready in GYM TRACKER',
    level: 'Starting load level',
    levels: { zero: 'from zero', base: 'base', strong: 'strong' } as Record<PlanLevel, string>,
    deload: 'Lighter week every',
    deloadN: (n: number) => (n ? `${n} wk` : 'none'),
    kcal: 'Calories per day (kcal)',
    protein: 'Protein per day (g)',
    steps: 'Steps per day',
    perWeek: 'Workouts per week',
    weightGoal: 'Goal weight (kg)',
    rate: 'Rate of change (kg / week, negative — down)',
    note: 'Comment for the client',
    tests: 'Tests',
    testPh: 'e.g. Vitamin D, Ferritin, TSH',
    testNote: 'Note (e.g. fasting)',
    addTest: 'Add test',
    by: 'By when (optional)',
    title: 'Title',
    text: 'Text',
    checklist: 'Checklist — one item per line (optional)',
    wd: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    exN: (n: number) => `${n} exercises`,
  },
});

const STATE = freshState();
const shortId = () => crypto.randomUUID().slice(0, 8);
const KINDS = Object.keys(KIND_LABEL) as WorkoutKind[];

export function Notes({ notes }: { notes: DesignNote[] }) {
  if (!notes.length) return null;
  return (
    <div className="stack">
      {notes.map((n) => (
        <div key={n.code} className={`note ${n.level === 'warn' ? 'warn' : n.level === 'good' ? '' : 'blue'}`}>
          <strong>{n.title}</strong> {n.text}
        </div>
      ))}
    </div>
  );
}

function ExercisePicker({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const found = useMemo(() => (q.trim() ? findExercises(q).slice(0, 8) : []), [q]);
  const pick = (id: string) => {
    onPick(id);
    setQ('');
    setSel(0);
  };
  return (
    <div>
      <label className="field">
        <span>{T.add}</span>
        <input
          id="exercise-search"
          type="search"
          role="combobox"
          aria-expanded={found.length > 0}
          aria-controls="exercise-options"
          autoComplete="off"
          placeholder={T.addPh}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, found.length - 1));
            else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0));
            else if (e.key === 'Enter' && found[sel]) {
              e.preventDefault();
              pick(found[sel].id);
            }
          }}
        />
      </label>
      {found.length ? (
        <div className="suggest" id="exercise-options" role="listbox">
          {found.map((f, i) => (
            <button key={f.id} type="button" role="option" aria-selected={i === sel} onClick={() => pick(f.id)}>
              {splitHits(EX[f.id]!.name, f.hits).map((p, j) => (p.on ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}
              <span className="soft small"> · {groupLabel(EX[f.id]!.group)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type WorkoutValue = Extract<LibraryBody, { kind: 'workout' }>;

export const emptyWorkout = (): WorkoutValue => ({ kind: 'workout', workout: { id: `w-${shortId()}`, name: '', items: [] }, videos: {} });

export function WorkoutForm({ value, onChange }: { value: WorkoutValue; onChange: (v: WorkoutValue) => void }) {
  const w = value.workout;
  const set = (patch: Partial<Workout>) => onChange({ ...value, workout: { ...w, ...patch } });
  const move = (i: number, d: number) => {
    const items = [...w.items];
    const [x] = items.splice(i, 1);
    items.splice(i + d, 0, x!);
    if (items[0]) items[0] = { ...items[0], pair: undefined };
    set({ items });
  };
  const review = useMemo(
    () =>
      w.items.length
        ? reviewWorkout(
            STATE,
            w.items.map((i) => i.ex),
            w.kind,
            w.items.map((i) => !!i.pair),
            { circuit: w.items.map((i) => !!i.circuit), rest: w.rest, roundRest: w.roundRest },
          )
        : null,
    [w],
  );

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid cols-2">
        <label className="field">
          <span>{T.name}</span>
          <input id="w-name" type="text" maxLength={80} value={w.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>{T.kind}</span>
          <select id="w-kind" value={w.kind ?? ''} onChange={(e) => set({ kind: (e.target.value || undefined) as WorkoutKind | undefined })}>
            <option value="">{T.kindNone}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{T.gear}</span>
          <select id="w-gear" value={w.gear ?? ''} onChange={(e) => set({ gear: (e.target.value || undefined) as WorkoutGear | undefined })}>
            <option value="">—</option>
            {(['none', 'kb', 'gym'] as const).map((g) => (
              <option key={g} value={g}>
                {T.gears[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{T.rest}</span>
          <input
            id="w-rest"
            type="number"
            min={10}
            max={600}
            value={w.rest ?? ''}
            onChange={(e) => set({ rest: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
      </div>
      <label className="field">
        <span>{T.desc}</span>
        <textarea id="w-desc" maxLength={400} value={w.desc ?? ''} onChange={(e) => set({ desc: e.target.value || undefined })} />
      </label>
      <div className="stack">
        <h3>{T.exercises}</h3>
        {!w.items.length ? <p className="soft">{T.noEx}</p> : null}
        <ol className="ex-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {w.items.map((it, i) => (
            <li key={`${it.ex}-${i}`} className="ex-row">
              <span className="idx">{i + 1}</span>
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <strong>{EX[it.ex]?.name ?? it.ex}</strong>
                <span className="row small">
                  {i > 0 ? (
                    <label className="check" style={{ minHeight: 32, padding: 0 }}>
                      <input
                        type="checkbox"
                        checked={!!it.pair}
                        onChange={(e) => set({ items: w.items.map((x, j) => (j === i ? { ...x, pair: e.target.checked || undefined } : x)) })}
                      />
                      {T.pair}
                    </label>
                  ) : null}
                  <label className="check" style={{ minHeight: 32, padding: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!it.circuit}
                      onChange={(e) => set({ items: w.items.map((x, j) => (j === i ? { ...x, circuit: e.target.checked || undefined } : x)) })}
                    />
                    {T.circuit}
                  </label>
                </span>
                <label className="field small">
                  <span className="sr">{T.video}</span>
                  <input
                    type="url"
                    placeholder={T.video}
                    value={value.videos[it.ex] ?? ''}
                    onChange={(e) => {
                      const videos = { ...value.videos };
                      if (e.target.value.trim()) videos[it.ex] = e.target.value.trim();
                      else delete videos[it.ex];
                      onChange({ ...value, videos });
                    }}
                  />
                </label>
              </div>
              <span className="tools">
                <button type="button" aria-label={T.up} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" aria-label={T.down} disabled={i === w.items.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" aria-label={T.remove} onClick={() => set({ items: w.items.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        <ExercisePicker onPick={(id) => set({ items: [...w.items, { ex: id }] })} />
      </div>
      {review ? (
        <div className="stack">
          <h3>
            {T.review} <span className="soft small">{T.sets(review.sets, Math.round(review.secs / 60))}</span>
          </h3>
          <Notes notes={review.notes} />
        </div>
      ) : null}
    </div>
  );
}

export type PlanValue = Extract<LibraryBody, { kind: 'plan' }>;

export const emptyPlan = (): PlanValue => ({
  kind: 'plan',
  plan: { id: `p-${shortId()}`, name: '', level: 'base', sex: 'any', daysPerWeek: 3, weeks: 8, loadFactor: 1, cycle: [], weekdays: [1, 3, 5], desc: '', kind: 'own', deloadEvery: 4, deload: autoDeload(8, 4) },
});

export function PlanForm({ value, onChange, library }: { value: PlanValue; onChange: (v: PlanValue) => void; library: Workout[] }) {
  const p = value.plan;
  const set = (patch: Partial<PlanTemplate>) => {
    const next = { ...p, ...patch };
    next.daysPerWeek = next.weekdays.length || 1;
    next.deload = autoDeload(next.weeks, next.deloadEvery ?? 0);
    onChange({ ...value, plan: next });
  };
  const all = useMemo(() => [...library, ...BUILTIN], [library]);
  const byId = useMemo(() => new Map(all.map((w) => [w.id, w])), [all]);
  const review = useMemo(() => (p.cycle.length && p.weekdays.length ? reviewPlan(STATE, p, all) : null), [p, all]);
  const [pick, setPick] = useState('');

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid cols-2">
        <label className="field">
          <span>{T.name}</span>
          <input id="p-name" type="text" maxLength={80} value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>{T.weeks}</span>
          <input id="p-weeks" type="number" min={1} max={52} value={p.weeks} onChange={(e) => set({ weeks: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })} />
        </label>
        <label className="field">
          <span>{T.level}</span>
          <select id="p-level" value={p.level} onChange={(e) => set({ level: e.target.value as PlanLevel, loadFactor: e.target.value === 'zero' ? 0.7 : e.target.value === 'strong' ? 1.2 : 1 })}>
            {(['zero', 'base', 'strong'] as const).map((l) => (
              <option key={l} value={l}>
                {T.levels[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{T.deload}</span>
          <select id="p-deload" value={p.deloadEvery ?? 0} onChange={(e) => set({ deloadEvery: Number(e.target.value) })}>
            {[0, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {T.deloadN(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 4 }}>{T.days}</legend>
        <div className="row">
          {T.wd.map((d, i) => (
            <label key={d} className="chip" style={{ minHeight: 44, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={p.weekdays.includes(i + 1)}
                onChange={(e) => set({ weekdays: e.target.checked ? [...p.weekdays, i + 1].sort() : p.weekdays.filter((x) => x !== i + 1) })}
              />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>{T.goal}</span>
        <input id="p-goal" type="text" maxLength={200} value={p.goal ?? ''} onChange={(e) => set({ goal: e.target.value || undefined })} />
      </label>
      <label className="field">
        <span>{T.desc}</span>
        <textarea id="p-desc" maxLength={600} value={p.desc} onChange={(e) => set({ desc: e.target.value })} />
      </label>
      <div className="stack">
        <h3>{T.cycle}</h3>
        <p className="small soft">{T.cycleHint}</p>
        <ol className="ex-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {p.cycle.map((id, i) => (
            <li key={`${id}-${i}`} className="ex-row">
              <span className="idx">{String.fromCharCode(65 + i)}</span>
              <div style={{ paddingTop: 10 }}>
                <strong>{byId.get(id)?.name ?? id}</strong>
                <span className="soft small"> · {T.exN(byId.get(id)?.items.length ?? 0)}</span>
              </div>
              <span className="tools">
                <button type="button" aria-label={T.remove} onClick={() => set({ cycle: p.cycle.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        <div className="row">
          <label style={{ flex: '1 1 260px' }}>
            <span className="sr">{T.addWorkout}</span>
            <select id="p-add" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{T.addWorkout}…</option>
              {library.length ? (
                <optgroup label={T.own}>
                  {library.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={T.builtin}>
                {BUILTIN.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            className="btn ghost"
            disabled={!pick}
            onClick={() => {
              set({ cycle: [...p.cycle, pick] });
              setPick('');
            }}
          >
            {T.addWorkout}
          </button>
        </div>
      </div>
      {review ? (
        <div className="stack">
          <h3>{T.review}</h3>
          <Notes notes={review.notes} />
        </div>
      ) : null}
    </div>
  );
}

type Targets = Extract<AssignmentBody, { kind: 'targets' }>;
type Labs = Extract<AssignmentBody, { kind: 'labs' }>;
type Note = Extract<AssignmentBody, { kind: 'note' }>;

export const emptyTargets = (): Targets => ({ kind: 'targets', kcal: null, protein: null, steps: null, workoutsPerWeek: null, weightGoal: null, weeklyRate: null, note: '' });
export const emptyLabs = (): Labs => ({ kind: 'labs', tests: [{ name: '', note: '' }], by: null, note: '' });
export const emptyNote = (): Note => ({ kind: 'note', title: '', text: '', checklist: [] });

function NumberField({ id, label, value, onChange, step = 1 }: { id: string; label: string; value: number | null; onChange: (n: number | null) => void; step?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input id={id} type="number" step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </label>
  );
}

export function TargetsForm({ value, onChange }: { value: Targets; onChange: (v: Targets) => void }) {
  const set = (patch: Partial<Targets>) => onChange({ ...value, ...patch });
  return (
    <div className="stack">
      <div className="grid cols-3">
        <NumberField id="t-kcal" label={T.kcal} value={value.kcal} onChange={(kcal) => set({ kcal })} />
        <NumberField id="t-protein" label={T.protein} value={value.protein} onChange={(protein) => set({ protein })} />
        <NumberField id="t-steps" label={T.steps} value={value.steps} onChange={(steps) => set({ steps })} />
        <NumberField id="t-week" label={T.perWeek} value={value.workoutsPerWeek} onChange={(workoutsPerWeek) => set({ workoutsPerWeek })} />
        <NumberField id="t-goal" label={T.weightGoal} value={value.weightGoal} onChange={(weightGoal) => set({ weightGoal })} step={0.1} />
        <NumberField id="t-rate" label={T.rate} value={value.weeklyRate} onChange={(weeklyRate) => set({ weeklyRate })} step={0.05} />
      </div>
      <label className="field">
        <span>{T.note}</span>
        <textarea id="t-note" maxLength={2000} value={value.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
    </div>
  );
}

export function LabsForm({ value, onChange }: { value: Labs; onChange: (v: Labs) => void }) {
  const set = (patch: Partial<Labs>) => onChange({ ...value, ...patch });
  const names = useMemo(() => [...new Set(MARKER_LIST.map((m) => m.name))].sort((a, b) => a.localeCompare(b, LOCALE)), []);
  return (
    <div className="stack">
      <datalist id="lab-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <h3>{T.tests}</h3>
      {value.tests.map((t, i) => (
        <div key={i} className="grid cols-2" style={{ alignItems: 'end' }}>
          <label className="field">
            <span className={i ? 'sr' : undefined}>{T.tests}</span>
            <input type="text" list="lab-names" placeholder={T.testPh} value={t.name} onChange={(e) => set({ tests: value.tests.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <label className="field" style={{ flex: 1 }}>
              <span className={i ? 'sr' : undefined}>{T.testNote}</span>
              <input type="text" placeholder={T.testNote} value={t.note} onChange={(e) => set({ tests: value.tests.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
            </label>
            <button type="button" className="btn ghost small" aria-label={T.remove} onClick={() => set({ tests: value.tests.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => set({ tests: [...value.tests, { name: '', note: '' }] })}>
        {T.addTest}
      </button>
      <label className="field" style={{ maxWidth: 240 }}>
        <span>{T.by}</span>
        <input id="l-by" type="date" value={value.by ?? ''} onChange={(e) => set({ by: e.target.value || null })} />
      </label>
      <label className="field">
        <span>{T.note}</span>
        <textarea id="l-note" maxLength={2000} value={value.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
    </div>
  );
}

export function NoteForm({ value, onChange }: { value: Note; onChange: (v: Note) => void }) {
  return (
    <div className="stack">
      <label className="field">
        <span>{T.title}</span>
        <input id="n-title" type="text" maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      </label>
      <label className="field">
        <span>{T.text}</span>
        <textarea id="n-text" maxLength={6000} rows={6} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
      </label>
      <label className="field">
        <span>{T.checklist}</span>
        <textarea
          id="n-list"
          rows={4}
          value={value.checklist.join('\n')}
          onChange={(e) => onChange({ ...value, checklist: e.target.value.split('\n').slice(0, 30) })}
        />
      </label>
    </div>
  );
}

/** Czy treść da się zapisać albo wysłać — te same minima, które przepuszcza `parseAssignment`. */
export function bodyReady(b: LibraryBody): boolean {
  switch (b.kind) {
    case 'workout':
      return !!b.workout.name.trim() && b.workout.items.length > 0;
    case 'plan':
      return !!b.plan.name.trim() && b.plan.cycle.length > 0 && b.plan.weekdays.length > 0;
    case 'targets':
      return [b.kcal, b.protein, b.steps, b.workoutsPerWeek, b.weightGoal, b.weeklyRate].some((x) => x !== null) || !!b.note.trim();
    case 'labs':
      return b.tests.some((t) => t.name.trim());
    case 'note':
      return !!b.title.trim() && (!!b.text.trim() || b.checklist.some((c) => c.trim()));
  }
}

/** Tytuł treści na liście biblioteki. */
export function bodyTitle(b: LibraryBody, fallback: string): string {
  if (b.kind === 'workout') return b.workout.name || fallback;
  if (b.kind === 'plan') return b.plan.name || fallback;
  if (b.kind === 'note') return b.title || fallback;
  return fallback;
}
