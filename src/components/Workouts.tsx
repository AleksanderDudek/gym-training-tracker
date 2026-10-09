import { Fragment, useState } from 'react';
import { BUILTIN, EX, ex } from '../data/exercises';
import { OWN_WORKOUT_JOKES, WORKOUT_JOKES } from '../data/exjokes';
import { EX_MUSCLES, MUSCLE_NAME } from '../data/muscles';
import { GOAL_PLANS, PROFILE_PLANS } from '../data/plans';
import { plannedBurn } from '../engine/burn';
import { KIND_LABEL, RULES, dose, reviewWorkout } from '../engine/design';
import { planLabel } from '../engine/plan';
import { similarTo, workoutGear } from '../engine/similar';
import { pick, plural } from '../engine/quips';
import { exercisePath, go, goBack, planPath, workoutEditPath, workoutNewPath, workoutPath } from '../routing';
import { kcalText } from './Cardio';
import { Chips, DesignNotes, MuscleBars, SectionSwitch } from './Design';
import { ExercisePicker } from './ExercisePicker';
import { WorkoutArt } from './SceneArt';
import { CircuitHead, PairHead, PrepCard, blocksOf, cueFor, tagOf } from './Structure';
import { ROUND_REST, restLabel, roundRestOf } from '../engine/rests';
import { pairProblems } from '../engine/structure';
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

type Group = 'all' | 'full' | 'split' | 'ul' | 'part' | 'profile' | 'own';

const GROUP_OF: Record<WorkoutKind, Exclude<Group, 'all' | 'own' | 'profile'>> = {
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
  { key: 'profile', label: 'Z profilem' },
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
  const r = reviewWorkout(state, w.items.map((i) => i.ex), w.kind, w.items.map((i) => !!i.pair), {
    circuit: w.items.map((i) => !!i.circuit),
    rest: w.rest,
    roundRest: w.roundRest,
  });
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
        {/* Własna wersja jednym stuknięciem z listy — wcześniej przycisk stał dopiero w podglądzie. */}
        <button className="btn sm ghost" onClick={() => go(isOwn(w) ? workoutEditPath(w.id) : workoutNewPath(w.id))}>
          {isOwn(w) ? 'Edytuj' : 'Zmień pod siebie'}
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
    // Treningi profili są wariantami całego ciała — trzydzieści dwa warianty na liście
    // wszystkich zakryłyby resztę, więc mają własną grupę.
    if (group === 'profile') return !!w.profile && (gear === 'all' || w.gear === gear);
    if (w.profile) return false;
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
function ExerciseLine({ state, id, n, cue }: { state: AppState; id: ExerciseId; n: string; cue?: string }) {
  const use = EX_MUSCLES[id];
  return (
    <div className="h-item wex">
      <div className="h-date">{n}</div>
      <div>
        <a className="wex-name" href={exercisePath(id)}>
          {EX[id]?.name ?? id}
        </a>
        <div className="h-detail">{EX[id] ? planLabel(state, id) : 'ćwiczenie spoza atlasu'}</div>
        {cue && <div className="h-detail ex-cue">{cue}</div>}
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
  const r = reviewWorkout(state, ids, w.kind, w.items.map((i) => !!i.pair), {
    circuit: w.items.map((i) => !!i.circuit),
    rest: w.rest,
    roundRest: w.roundRest,
  });
  const plans = [...GOAL_PLANS, ...PROFILE_PLANS, ...(state.plans ?? [])].filter((p) => p.cycle.includes(w.id));

  return (
    <>
      <div className="scene-hero">
        <WorkoutArt id={w.id} />
      </div>
      <div className="wrap">
        <h2 className="ex-h">{w.name}</h2>
        <p className="wmeta">{metaLine(state, w, r.secs)}</p>
        {w.desc && <p className="lead">{w.desc}</p>}
        {own &&
          w.base &&
          (() => {
            const base = allWorkouts(state).find((x) => x.id === w.base);
            return base ? (
              <p className="tight">
                Twoja wersja treningu <a href={workoutPath(base.id)}>{base.name}</a>.
              </p>
            ) : null;
          })()}
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

      <PrepCard state={state} workout={w} />

      <div className="sect-label">Kolejność i serie na dziś</div>
      {blocksOf(w.items).map((b) => {
        const sets = (id: ExerciseId) => dose(state, id).sets;
        const lines = b.ids.map((x, i) => (
          <ExerciseLine key={`${x}-${b.n}`} state={state} id={x} n={tagOf(b, i)} cue={cueFor(b, i, sets, w.rest)} />
        ));
        if (b.kind === 'circuit')
          return (
            <div className="pairbox" key={`c${b.n}`}>
              <CircuitHead b={b} sets={sets} roundRest={roundRestOf(state, w).secs} />
              {lines}
            </div>
          );
        return b.kind === 'pair' ? (
          <div className="pairbox" key={`p${b.n}`}>
            <PairHead b={b} sets={sets} />
            {lines}
          </div>
        ) : (
          lines
        );
      })}

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
  add: addOnOpen,
  onSave,
  onSetsChange,
  onToast,
}: {
  state: AppState;
  id?: string | undefined;
  from?: string | undefined;
  /** Ćwiczenie dopisane na wejściu — „Dodaj do treningu” w atlasie. Zapisuje dopiero „Zapisz trening”. */
  add?: string | undefined;
  onSave: (w: Workout) => void;
  onSetsChange: (id: ExerciseId, sets: number) => void;
  onToast: (m: string) => void;
}) {
  const editing = id ? state.workouts.find((w) => w.id === id) : undefined;
  const source = editing ?? (from ? allWorkouts(state).find((w) => w.id === from) : undefined);
  const [name, setName] = useState(editing ? editing.name : source ? `${source.name} — moja wersja` : '');
  const [kind, setKind] = useState<WorkoutKind | ''>(source?.kind ?? '');
  const sourceItems = source ? source.items.map((i) => i.ex) : [];
  // `hasOwn`, bo adres wpisany ręcznie (`…/edytuj/constructor`) trafiłby w prototyp obiektu
  // i wywrócił kreator zamiast go otworzyć.
  const extra = addOnOpen && Object.hasOwn(EX, addOnOpen) && !sourceItems.includes(addOnOpen) ? addOnOpen : null;
  const [items, setItems] = useState<ExerciseId[]>(extra ? [...sourceItems, extra] : sourceItems);
  // Ćwiczenie, dla którego otwarty jest panel „Zamień”.
  const [swapFor, setSwapFor] = useState<ExerciseId | null>(null);
  // Ćwiczenia robione „na zmianę z poprzednim”. Flaga należy do ćwiczenia, więc para
  // przeżywa przesuwanie w górę i w dół razem z nim.
  const [paired, setPaired] = useState<Set<ExerciseId>>(
    () => new Set(source?.items.filter((i) => i.pair).map((i) => i.ex) ?? []),
  );
  // Stacje obwodu — tak samo przypięte do ćwiczenia. Przełącznik „Obwód” obejmuje wszystkie.
  const [circ, setCirc] = useState<Set<ExerciseId>>(() => {
    const all = source?.items.filter((i) => i.circuit).map((i) => i.ex) ?? [];
    // Dopisane do treningu, który cały jest obwodem, staje się kolejną stacją.
    return new Set(extra && source?.items.length && all.length === source.items.length ? [...all, extra] : all);
  });
  // Przerwa po serii: pusta — z rodzaju ćwiczenia, jak zalecają wytyczne; liczba — z treningu.
  const [rest, setRest] = useState<number | ''>(source?.rest ?? '');
  const [roundRest, setRoundRest] = useState<number>(source?.roundRest ?? ROUND_REST);
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

  const inCircuit = items.map((x) => circ.has(x));
  const allCircuit = items.length > 0 && inCircuit.every(Boolean);
  const pairs = items.map((x, i) => i > 0 && paired.has(x) && !circ.has(x));
  const r = reviewWorkout(state, items, kind || undefined, pairs, {
    circuit: inCircuit,
    rest: rest || undefined,
    roundRest: circ.size ? roundRest : undefined,
  });
  const blocks = blocksOf(items.map((x, i) => ({ ex: x, pair: pairs[i], circuit: inCircuit[i] })));
  const togglePair = (x: ExerciseId) => {
    const next = new Set(paired);
    if (next.has(x)) next.delete(x);
    else next.add(x);
    setPaired(next);
  };

  const add = (x: ExerciseId) => {
    setPickKey((k) => k + 1);
    if (items.includes(x)) {
      onToast(`${ex(x).name} już jest w treningu.`);
      return;
    }
    setItems([...items, x]);
    // Do obwodu z całego treningu nowe ćwiczenie dochodzi jako kolejna stacja.
    if (allCircuit) setCirc(new Set([...circ, x]));
  };
  /**
   * Zamiana w miejscu: nowe ćwiczenie staje tam, gdzie stało stare, i przejmuje jego parę albo
   * miejsce w obwodzie. Usuwanie i dodawanie na końcu gubiło jedno i drugie.
   */
  const replace = (old: ExerciseId, neu: ExerciseId) => {
    setSwapFor(null);
    if (items.includes(neu)) {
      onToast(`${ex(neu).name} już jest w treningu.`);
      return;
    }
    setItems(items.map((x) => (x === old ? neu : x)));
    const carry = (set: Set<ExerciseId>) =>
      set.has(old) ? new Set([...set].filter((x) => x !== old).concat(neu)) : set;
    setPaired(carry(paired));
    setCirc(carry(circ));
    onToast(`${ex(old).name} → ${ex(neu).name}.`);
    // Wiersz powstaje od nowa pod nowym ćwiczeniem — fokus wraca na jego nazwę, a nie na początek strony.
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`.bl-name[aria-label="Zamień: ${CSS.escape(ex(neu).name)}"]`)?.focus(),
    );
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
    // Własna wersja pamięta, od czego się zaczęła; kopia własnej — ten sam gotowy początek.
    const base = editing?.base ?? (source ? (source.base ?? (isOwn(source) ? undefined : source.id)) : undefined);
    const w: Workout = {
      id: editing?.id ?? `w${Date.now()}`,
      name: name.trim(),
      // Sprzęt z ćwiczeń: od niego zależą stanowiska i zamienniki, a ręcznie łatwo o nim zapomnieć.
      gear: workoutGear(items),
      ...(base ? { base } : {}),
      // Tylko pary, które naprawdę powstały — trzecie „na zmianę” z rzędu nic nie znaczy.
      items: blocks.flatMap((b) =>
        b.ids.map((x, i) =>
          b.kind === 'circuit' ? { ex: x, circuit: true } : b.kind === 'pair' && i ? { ex: x, pair: true } : { ex: x },
        ),
      ),
      ...(kind ? { kind } : {}),
      ...(rest ? { rest } : {}),
      ...(blocks.some((b) => b.kind === 'circuit') ? { roundRest } : {}),
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
        {(() => {
          // Od czego zaczęła się ta wersja — gotowy trening zostaje bez zmian, także w planach.
          const baseId = editing?.base ?? (source && !editing && !isOwn(source) ? source.id : source?.base);
          const base = baseId ? allWorkouts(state).find((w) => w.id === baseId) : undefined;
          return base ? (
            <p className="tight">
              Na podstawie: <a href={workoutPath(base.id)}>{base.name}</a>. Oryginał zostaje bez zmian — także
              w planach, które go używają.
            </p>
          ) : null;
        })()}
        {extra && items.includes(extra) && (
          <p className="tight">
            Dopisane na końcu: <b>{ex(extra).name}</b>. Przesuń je strzałkami w odpowiednie miejsce, a potem zapisz.
          </p>
        )}
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

        <label className="fld">
          <span>przerwa między seriami</span>
          <select value={String(rest)} onChange={(e) => setRest(e.target.value ? Number(e.target.value) : '')}>
            <option value="">z rodzaju ćwiczenia — zalecane</option>
            {[60, 90, 120, 150, 180].map((s) => (
              <option key={s} value={s}>
                {restLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <span className="seg-label" aria-hidden="true">
          jak robić
        </span>
        <Segmented
          label="Jak robić ćwiczenia"
          value={circ.size ? 'circuit' : 'sets'}
          // Ponowne stuknięcie w zaznaczony wariant niczego nie zmienia — inaczej kopia obwodu
          // z ćwiczeniem po nim (podciąganie po obwodzie trenera) wciągnęłaby je do stacji.
          onChange={(v) => {
            if ((v === 'circuit') === circ.size > 0) return;
            setCirc(v === 'circuit' ? new Set(items) : new Set());
          }}
          options={[
            { key: 'sets', label: 'Serie pod rząd' },
            { key: 'circuit', label: 'Obwód — rundy' },
          ]}
        />
        {circ.size > 0 && (
          <label className="fld">
            <span>przerwa po rundzie</span>
            <select value={roundRest} onChange={(e) => setRoundRest(Number(e.target.value))}>
              {[60, 90, 120, 150, 180].map((s) => (
                <option key={s} value={s}>
                  {restLabel(s)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="bl-list">
          {items.map((x, i) => (
            <Fragment key={x}>
            <div className="bl-item">
              <span className="bl-no">{i + 1}</span>
              <button
                type="button"
                className="bl-name"
                aria-expanded={swapFor === x}
                aria-label={`Zamień: ${ex(x).name}`}
                onClick={() => setSwapFor(swapFor === x ? null : x)}
              >
                {ex(x).name}
              </button>
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
              <button
                type="button"
                className="bl-pair"
                onClick={() => togglePair(x)}
                // Do pary dochodzi się tylko z ćwiczeniem, które samo nie jest jeszcze w parze;
                // w obwodzie par nie ma — stacje i tak idą na zmianę.
                disabled={!i || pairs[i - 1] || circ.has(x) || circ.has(items[i - 1]!)}
                aria-pressed={pairs[i] ?? false}
                aria-label={`Na zmianę z poprzednim: ${ex(x).name}`}
                title="Na zmianę z poprzednim"
              >
                ↔
              </button>
              <button type="button" className="bl-up" onClick={() => move(i, -1)} disabled={!i} aria-label={`W górę: ${ex(x).name}`}>
                ↑
              </button>
              <button
                type="button"
                className="bl-down"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`W dół: ${ex(x).name}`}
              >
                ↓
              </button>
              <button
                type="button"
                className="bl-del"
                onClick={() => {
                  setItems(items.filter((_, k) => k !== i));
                  // Usunięte ćwiczenie nie zostawia flag — dodane ponownie zaczyna od zera.
                  setCirc(new Set([...circ].filter((c) => c !== x)));
                  setPaired(new Set([...paired].filter((c) => c !== x)));
                  if (swapFor === x) setSwapFor(null);
                }}
                aria-label={`Usuń: ${ex(x).name}`}
              >
                ×
              </button>
            </div>
            {swapFor === x && (
              <div className="bl-swap">
                <p className="tight">
                  Zamień <b>{ex(x).name}</b> na ćwiczenie, które robi podobną robotę:
                </p>
                <div className="bl-swap-opts">
                  {similarTo(x, { exclude: items, gear: workoutGear(items) }).map((o) => (
                    <button key={o} type="button" className="btn ghost sm" onClick={() => replace(x, o)}>
                      {ex(o).name}
                    </button>
                  ))}
                </div>
                <ExercisePicker label="albo dowolne z atlasu" value={null} onChange={(o) => replace(x, o)} />
                <button type="button" className="btn ghost sm" onClick={() => setSwapFor(null)}>
                  Zostaw {ex(x).name}
                </button>
              </div>
            )}
            </Fragment>
          ))}
        </div>
        {items.length > 0 && (
          <p className="hint">
            Stuknij nazwę ćwiczenia, żeby zamienić je na podobne w tym samym miejscu; × usuwa je z treningu.
            Liczba serii należy do ćwiczenia, nie do treningu — zmienia się wszędzie, gdzie to ćwiczenie
            występuje, i dalej prowadzi ją silnik progresji. ↔ łączy ćwiczenie z poprzednim w parę
            robioną na zmianę. W obwodzie liczba rund to liczba serii najdłuższej stacji, a przerwa po
            rundzie skraca się sama, gdy kolejne obwody idą równo.
          </p>
        )}
        {blocks
          .filter((b) => b.kind === 'pair')
          .map((b) => ({ b, why: pairProblems(b.ids[0]!, b.ids[1]!, undefined) }))
          .filter((x) => x.why.length)
          .map(({ b, why }) => (
            <p className="tight warnline" key={b.n}>
              Para {b.n}: {why.join(' ')}
            </p>
          ))}

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
