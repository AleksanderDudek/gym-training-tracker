import { useState } from 'react';
import { BUILTIN, EX, ex } from '../data/exercises';
import { OWN_WORKOUT_JOKES, WORKOUT_JOKES } from '../data/exjokes';
import { EX_MUSCLES, MUSCLE_NAME } from '../data/muscles';
import { GOAL_PLANS } from '../data/plans';
import { plannedBurn } from '../engine/burn';
import { KIND_LABEL, RULES, dose, reviewWorkout } from '../engine/design';
import { planLabel } from '../engine/plan';
import { pick, plural } from '../engine/quips';
import { exercisePath, go, goBack, planPath, workoutEditPath, workoutNewPath, workoutPath } from '../routing';
import { kcalText } from './Cardio';
import { Chips, DesignNotes, MuscleBars, SectionSwitch } from './Design';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutArt } from './SceneArt';
import { HealthNote } from './Health';
import { EmptyState, Segmented } from './ui';
import { SupportLine } from './Support';
import type { AppState, ExerciseId, Workout, WorkoutGear, WorkoutKind } from '../types';

/**
 * Zakładka Treningi: biblioteka gotowych zestawów i własnych, podgląd każdego z nich
 * i kreator z doradcą, który w trakcie układania mówi, czy trening ma sens.
 */

export const GEAR_WORKOUT: Record<WorkoutGear, string> = {
  none: 'bez sprzętu',
  kb: 'kettlebell',
  gym: 'siłownia',
};

/** Filtr sprzętu — ten sam w bibliotece treningów i w katalogu planów. */
export const GEAR_FILTER: { key: 'all' | WorkoutGear; label: string }[] = [
  { key: 'all', label: 'Każdy' },
  { key: 'none', label: 'Bez sprzętu' },
  { key: 'kb', label: 'Kettlebell' },
  { key: 'gym', label: 'Siłownia' },
];

const EX_FORMS = ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'] as const;

type Group = 'all' | 'full' | 'split' | 'ul' | 'part' | 'own';

const GROUP_OF: Record<WorkoutKind, Exclude<Group, 'all' | 'own'>> = {
  full: 'full',
  light: 'full',
  push: 'split',
  pull: 'split',
  legs: 'split',
  upper: 'ul',
  lower: 'ul',
  glutes: 'part',
  chest: 'part',
  back: 'part',
  shoulders: 'part',
  arms: 'part',
  core: 'part',
};

const GROUPS: { key: Group; label: string }[] = [
  { key: 'all', label: 'Wszystkie' },
  { key: 'full', label: 'Całe ciało' },
  { key: 'split', label: 'Push · pull · nogi' },
  { key: 'ul', label: 'Góra · dół' },
  { key: 'part', label: 'Partie' },
  { key: 'own', label: 'Twoje' },
];

const isOwn = (w: Workout): boolean => !BUILTIN.some((b) => b.id === w.id);

export const allWorkouts = (state: AppState): Workout[] => [...BUILTIN, ...state.workouts];

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** „Push — pchanie · siłownia · 6 ćwiczeń · ok. 32 min · ≈ 180 kcal”. */
function metaLine(state: AppState, w: Workout, secs: number): string {
  const burn = plannedBurn(state, w);
  const n = w.items.length;
  return [
    w.kind ? KIND_LABEL[w.kind] : isOwn(w) ? 'własny' : null,
    w.gear ? GEAR_WORKOUT[w.gear] : null,
    `${n} ${plural(n, EX_FORMS)}`,
    n ? `ok. ${Math.max(1, Math.round(secs / 60))} min` : null,
    burn && n ? kcalText(burn.active) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function WorkoutCard({
  state,
  w,
  planned,
  onStart,
}: {
  state: AppState;
  w: Workout;
  planned: boolean;
  onStart: (id: string) => void;
}) {
  const r = reviewWorkout(state, w.items.map((i) => i.ex), w.kind);
  const top = r.loads.slice(0, 3).map((l) => lower(MUSCLE_NAME[l.muscle]));
  return (
    <div className={`grp wcard${planned ? ' today' : ''}`}>
      <WorkoutArt id={w.id} />
      {planned && <div className="today-tag">Dziś według planu</div>}
      <h2 className="today-name">{w.name}</h2>
      <p className="wmeta">{metaLine(state, w, r.secs)}</p>
      {w.desc && <p className="tight">{w.desc}</p>}
      {top.length > 0 && <p className="tight">Najwięcej pracy: {top.join(', ')}.</p>}
      {!r.ok && <p className="tight warnline">Doradca ma zastrzeżenia — zajrzyj do podglądu.</p>}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => onStart(w.id)}>
          Zacznij
        </button>
        <button className="btn sm ghost" onClick={() => go(workoutPath(w.id))}>
          Podgląd
        </button>
      </div>
    </div>
  );
}

/** Biblioteka: filtr sprzętu i rodzaju, trening z planu na górze, potem reszta. */
export function WorkoutLibrary({
  state,
  plannedId,
  onStart,
}: {
  state: AppState;
  plannedId?: string | undefined;
  onStart: (id: string) => void;
}) {
  const [gear, setGear] = useState<'all' | WorkoutGear>('all');
  const [group, setGroup] = useState<Group>('all');

  const shown = allWorkouts(state).filter((w) => {
    const own = isOwn(w);
    if (group === 'own') return own;
    if (group !== 'all' && (!w.kind || GROUP_OF[w.kind] !== group)) return false;
    // Własne treningi nie mają przypisanego sprzętu — widać je przy każdym filtrze sprzętu.
    return gear === 'all' || own || w.gear === gear;
  });
  const sorted = [...shown].sort((a, b) => Number(b.id === plannedId) - Number(a.id === plannedId));

  return (
    <>
      <div className="wrap">
        <SectionSwitch on="workouts" />
        <p className="lead">
          Gotowe zestawy — całe ciało, podziały push/pull/nogi i góra/dół oraz treningi pod
          konkretną partię — i twoje własne. Każdy ma podgląd: ćwiczenia z seriami, które partie
          pracują i co mówi doradca.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn wide" onClick={() => go(workoutNewPath())}>
            Ułóż własny trening
          </button>
        </div>
      </div>

      <div className="grp">
        <Segmented label="Sprzęt" value={gear} onChange={setGear} options={GEAR_FILTER} />
        <Chips label="Rodzaj treningu" value={group} onChange={setGroup} options={GROUPS} />
      </div>

      {sorted.length ? (
        sorted.map((w) => (
          <WorkoutCard key={w.id} state={state} w={w} planned={w.id === plannedId} onStart={onStart} />
        ))
      ) : (
        <div className="wrap">
          <EmptyState
            title={group === 'own' ? 'Jeszcze nic własnego' : 'Nic nie pasuje do filtrów'}
            text={
              group === 'own'
                ? 'Ułóż pierwszy trening albo skopiuj gotowy i zmień go pod siebie — doradca podpowie w trakcie.'
                : 'Zmień sprzęt albo rodzaj treningu.'
            }
          />
        </div>
      )}

      <div className="wrap">
        <SupportLine seed={state.log.length} />
      </div>
    </>
  );
}

/** Ćwiczenie w podglądzie: kolejność, recepta na dziś i partie, które pracują. */
function ExerciseLine({ state, id, n }: { state: AppState; id: ExerciseId; n: number }) {
  const use = EX_MUSCLES[id];
  return (
    <div className="h-item wex">
      <div className="h-date">{n}</div>
      <div>
        <a className="wex-name" href={exercisePath(id)}>
          {EX[id]?.name ?? id}
        </a>
        <div className="h-detail">{EX[id] ? planLabel(state, id) : 'ćwiczenie spoza atlasu'}</div>
        {use && (
          <div className="h-detail">
            {use.p.map((m) => lower(MUSCLE_NAME[m])).join(', ')}
            {use.s.length ? ` · pomocniczo ${use.s.map((m) => lower(MUSCLE_NAME[m])).join(', ')}` : ''}
          </div>
        )}
      </div>
      <div className="streak">{dose(state, id).sets} s.</div>
    </div>
  );
}

/** Podgląd treningu przed startem. Gotowy da się skopiować, własny — edytować i usunąć. */
export function WorkoutPreview({
  state,
  id,
  onStart,
  onDelete,
}: {
  state: AppState;
  id: string;
  onStart: (id: string) => void;
  onDelete: (w: Workout) => void;
}) {
  const w = allWorkouts(state).find((x) => x.id === id);
  if (!w)
    return (
      <div className="wrap">
        <EmptyState
          title="Nie ma takiego treningu"
          text="Mógł zostać usunięty. Wróć do listy i wybierz inny."
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );

  const own = isOwn(w);
  const ids = w.items.map((i) => i.ex);
  const r = reviewWorkout(state, ids, w.kind);
  const plans = [...GOAL_PLANS, ...(state.plans ?? [])].filter((p) => p.cycle.includes(w.id));

  return (
    <>
      <div className="scene-hero">
        <WorkoutArt id={w.id} />
      </div>
      <div className="wrap">
        <h2 className="ex-h">{w.name}</h2>
        <p className="wmeta">{metaLine(state, w, r.secs)}</p>
        {w.desc && <p className="lead">{w.desc}</p>}
        <p className="exjoke">{WORKOUT_JOKES[w.id] ?? pick(OWN_WORKOUT_JOKES, w.name.length + w.items.length)}</p>
        <div className="actions">
          <button className="btn wide" onClick={() => onStart(w.id)} disabled={!ids.length}>
            Zacznij: {w.name}
          </button>
          {own ? (
            <div className="btnrow">
              <button className="btn ghost" onClick={() => go(workoutEditPath(w.id))}>
                Edytuj
              </button>
              <button className="btn ghost" onClick={() => onDelete(w)}>
                Usuń
              </button>
            </div>
          ) : (
            <button className="btn ghost wide" onClick={() => go(workoutNewPath(w.id))}>
              Skopiuj i zmień pod siebie
            </button>
          )}
        </div>
      </div>

      <div className="sect-label">Ćwiczenia i serie na dziś</div>
      {ids.map((x, i) => (
        <ExerciseLine key={`${x}-${i}`} state={state} id={x} n={i + 1} />
      ))}

      <div className="grp" style={{ marginTop: 14 }}>
        <h2>Które partie pracują</h2>
        <p className="tight">
          Serie na partię w tej sesji: główny mięsień ruchu liczy się w całości, pomocniczy w połowie,
          a serie wybuchowe i na czas — za pół. Kreska na pasku to ok. {RULES.sessionCap} serii,
          powyżej których przyrost prawie przestaje rosnąć.
        </p>
        <MuscleBars loads={r.loads} />
      </div>

      <div className="grp">
        <h2>Doradca</h2>
        <DesignNotes notes={r.notes} />
      </div>

      <div className="wrap">
        <HealthNote style={{ marginTop: 12 }} />
      </div>

      {plans.length > 0 && (
        <div className="grp">
          <h2>W planach</h2>
          <ul className="ptlist">
            {plans.map((p) => (
              <li key={p.id}>
                <a href={planPath(p.id)}>{p.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Kreator treningu z doradcą. Nowy, kopia gotowego albo edycja własnego. Przegląd liczy się
 * przy każdej zmianie, więc od razu widać, że czwarte ćwiczenie na pośladki przebija limit
 * sesji, a izolacja wstawiona przed przysiadem psuje kolejność.
 */
export function WorkoutBuilder({
  state,
  id,
  from,
  onSave,
  onSetsChange,
  onToast,
}: {
  state: AppState;
  id?: string | undefined;
  from?: string | undefined;
  onSave: (w: Workout) => void;
  onSetsChange: (id: ExerciseId, sets: number) => void;
  onToast: (m: string) => void;
}) {
  const editing = id ? state.workouts.find((w) => w.id === id) : undefined;
  const source = editing ?? (from ? allWorkouts(state).find((w) => w.id === from) : undefined);
  const [name, setName] = useState(editing ? editing.name : source ? `${source.name} — moja wersja` : '');
  const [kind, setKind] = useState<WorkoutKind | ''>(source?.kind ?? '');
  const [items, setItems] = useState<ExerciseId[]>(source ? source.items.map((i) => i.ex) : []);
  // Klucz pola wyboru: po dodaniu ćwiczenia pole zaczyna od nowa, gotowe na kolejne.
  const [pickKey, setPickKey] = useState(0);

  if (id && !editing)
    return (
      <div className="wrap">
        <EmptyState
          title="Tego treningu nie da się edytować"
          text="Edytować można tylko własne treningi. Gotowy skopiujesz z jego podglądu."
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );

  const r = reviewWorkout(state, items, kind || undefined);

  const add = (x: ExerciseId) => {
    setPickKey((k) => k + 1);
    if (items.includes(x)) {
      onToast(`${ex(x).name} już jest w treningu.`);
      return;
    }
    setItems([...items, x]);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next);
  };

  const save = () => {
    if (!name.trim()) {
      onToast('Nadaj treningowi nazwę.');
      return;
    }
    if (!items.length) {
      onToast('Dodaj przynajmniej jedno ćwiczenie.');
      return;
    }
    const w: Workout = {
      id: editing?.id ?? `w${Date.now()}`,
      name: name.trim(),
      items: items.map((x) => ({ ex: x })),
      ...(kind ? { kind } : {}),
    };
    onSave(w);
    go(workoutPath(w.id), { replace: true });
  };

  return (
    <>
      <div className="wrap">
        <p className="lead">
          Dodawaj ćwiczenia, a doradca od razu policzy serie na partie, czas i kolejność. Rodzaj
          treningu mówi mu, czego się spodziewać — od push nikt nie oczekuje wiosłowania.
        </p>
      </div>

      <div className="grp builder">
        <label className="fld">
          <span>nazwa</span>
          <input
            type="text"
            placeholder="np. Pośladki i core — wtorek"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="fld">
          <span>rodzaj</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as WorkoutKind | '')}>
            <option value="">bez rodzaju — tylko zasady ogólne</option>
            {(Object.keys(KIND_LABEL) as WorkoutKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <div className="bl-list">
          {items.map((x, i) => (
            <div className="bl-item" key={x}>
              <span className="bl-no">{i + 1}</span>
              <span className="bl-name">{ex(x).name}</span>
              <select
                aria-label={`Serie: ${ex(x).name}`}
                value={dose(state, x).sets}
                onChange={(e) => onSetsChange(x, Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} s.
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => move(i, -1)} disabled={!i} aria-label={`W górę: ${ex(x).name}`}>
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`W dół: ${ex(x).name}`}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, k) => k !== i))}
                aria-label={`Usuń: ${ex(x).name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <p className="hint">
            Liczba serii należy do ćwiczenia, nie do treningu — zmienia się wszędzie, gdzie to ćwiczenie
            występuje, i dalej prowadzi ją silnik progresji.
          </p>
        )}

        <ExercisePicker key={pickKey} label="dodaj ćwiczenie" value={null} onChange={add} />

        {!r.orderOk && (
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setItems(r.order)}>
            Ułóż kolejność według zasad
          </button>
        )}
      </div>

      <div className="grp">
        <h2>
          Doradca{items.length ? ` · ${r.sets} serii · ok. ${Math.max(1, Math.round(r.secs / 60))} min` : ''}
        </h2>
        {items.length ? <DesignNotes notes={r.notes} /> : <p className="tight">Czeka na pierwsze ćwiczenie.</p>}
        <MuscleBars loads={r.loads} />
      </div>

      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={save}>
            Zapisz trening
          </button>
          <button className="btn ghost wide" onClick={() => goBack('#/treningi')}>
            Anuluj
          </button>
        </div>
      </div>
    </>
  );
}
