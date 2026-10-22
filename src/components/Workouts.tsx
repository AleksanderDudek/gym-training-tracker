import { Fragment, useState, type ReactNode } from 'react';
import { BUILTIN, EX, ex } from '../data/exercises';
import { OWN_WORKOUT_JOKES, WORKOUT_JOKES } from '../data/exjokes';
import { EX_MUSCLES, MUSCLE_NAME } from '../data/muscles';
import { GOAL_PLANS, PROFILE_PLANS } from '../data/plans';
import { plannedBurn } from '../engine/burn';
import { averageTime, durationText } from '../engine/clock';
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
import { pluralEn, text } from '../i18n';

const T = text({
  pl: {
    noGear: 'bez sprzętu',
    gym: 'siłownia',
    any: 'Każdy',
    noGearF: 'Bez sprzętu',
    gymF: 'Siłownia',
    all: 'Wszystkie',
    full: 'Całe ciało',
    split: 'Push · pull · nogi',
    ul: 'Góra · dół',
    part: 'Partie',
    profile: 'Z profilem',
    own: 'Twoje',
    ownKind: 'własny',
    exercises: (n: number) => `${n} ${plural(n, ['ćwiczenie', 'ćwiczenia', 'ćwiczeń'])}`,
    about: (min: number) => `ok. ${min} min`,
    plannedToday: 'Dziś według planu',
    mostWork: (list: string) => `Najwięcej pracy: ${list}.`,
    doubts: 'Doradca ma zastrzeżenia — zajrzyj do podglądu.',
    start: 'Zacznij',
    preview: 'Podgląd',
    edit: 'Edytuj',
    makeYours: 'Zmień pod siebie',
    libLead:
      'Gotowe zestawy — całe ciało, podziały push/pull/nogi i góra/dół oraz treningi pod konkretną partię — i twoje własne. Każdy ma podgląd: ćwiczenia z seriami, które partie pracują i co mówi doradca.',
    buildOwn: 'Ułóż własny trening',
    gear: 'Sprzęt',
    kind: 'Rodzaj treningu',
    noOwnTitle: 'Jeszcze nic własnego',
    noMatchTitle: 'Nic nie pasuje do filtrów',
    noOwnText: 'Ułóż pierwszy trening albo skopiuj gotowy i zmień go pod siebie — doradca podpowie w trakcie.',
    noMatchText: 'Zmień sprzęt albo rodzaj treningu.',
    offAtlas: 'ćwiczenie spoza atlasu',
    helpers: (list: string) => ` · pomocniczo ${list}`,
    sets: (n: number) => `${n} s.`,
    noWorkoutTitle: 'Nie ma takiego treningu',
    noWorkoutText: 'Mógł zostać usunięty. Wróć do listy i wybierz inny.',
    avg: (time: string, n: number) => `Twój średni czas: ${time} ${n === 1 ? '(z ostatniego treningu)' : `(z ${n} ostatnich)`}`,
    yourVersion: (link: ReactNode) => <>Twoja wersja treningu {link}.</>,
    startNamed: (name: string) => `Zacznij: ${name}`,
    del: 'Usuń',
    copy: 'Skopiuj i zmień pod siebie',
    order: 'Kolejność i serie na dziś',
    muscles: 'Które partie pracują',
    musclesText: (cap: number) =>
      `Serie na partię w tej sesji: główny mięsień ruchu liczy się w całości, pomocniczy w połowie, a serie wybuchowe i na czas — za pół. Kreska na pasku to ok. ${cap} serii, powyżej których przyrost prawie przestaje rosnąć.`,
    advisor: 'Doradca',
    inPlans: 'W planach',
    noEditTitle: 'Tego treningu nie da się edytować',
    noEditText: 'Edytować można tylko własne treningi. Gotowy skopiujesz z jego podglądu.',
    myVersion: (name: string) => `${name} — moja wersja`,
    already: (name: string) => `${name} już jest w treningu.`,
    swapAria: (name: string) => `Zamień: ${name}`,
    needName: 'Nadaj treningowi nazwę.',
    needEx: 'Dodaj przynajmniej jedno ćwiczenie.',
    builderLead:
      'Dodawaj ćwiczenia, a doradca od razu policzy serie na partie, czas i kolejność. Rodzaj treningu mówi mu, czego się spodziewać — od push nikt nie oczekuje wiosłowania.',
    basedOn: (link: ReactNode) => (
      <>
        Na podstawie: {link}. Oryginał zostaje bez zmian — także w planach, które go używają.
      </>
    ),
    added: (name: ReactNode) => (
      <>
        Dopisane na końcu: {name}. Przesuń je strzałkami w odpowiednie miejsce, a potem zapisz.
      </>
    ),
    name: 'nazwa',
    namePh: 'np. Pośladki i core — wtorek',
    type: 'rodzaj',
    noType: 'bez rodzaju — tylko zasady ogólne',
    rest: 'przerwa między seriami',
    restAuto: 'z rodzaju ćwiczenia — zalecane',
    how: 'jak robić',
    howAria: 'Jak robić ćwiczenia',
    straight: 'Serie pod rząd',
    circuit: 'Obwód — rundy',
    roundRest: 'przerwa po rundzie',
    setsAria: (name: string) => `Serie: ${name}`,
    pairAria: (name: string) => `Na zmianę z poprzednim: ${name}`,
    pairTitle: 'Na zmianę z poprzednim',
    upAria: (name: string) => `W górę: ${name}`,
    downAria: (name: string) => `W dół: ${name}`,
    delAria: (name: string) => `Usuń: ${name}`,
    swapFor: (name: ReactNode) => <>Zamień {name} na ćwiczenie, które robi podobną robotę:</>,
    anyAtlas: 'albo dowolne z atlasu',
    keep: (name: string) => `Zostaw ${name}`,
    hint: 'Stuknij nazwę ćwiczenia, żeby zamienić je na podobne w tym samym miejscu; × usuwa je z treningu. Liczba serii należy do ćwiczenia, nie do treningu — zmienia się wszędzie, gdzie to ćwiczenie występuje, i dalej prowadzi ją silnik progresji. ↔ łączy ćwiczenie z poprzednim w parę robioną na zmianę. W obwodzie liczba rund to liczba serii najdłuższej stacji, a przerwa po rundzie skraca się sama, gdy kolejne obwody idą równo.',
    pair: (n: number, why: string) => `Para ${n}: ${why}`,
    addEx: 'dodaj ćwiczenie',
    reorder: 'Ułóż kolejność według zasad',
    advisorSum: (sets: number, min: number) => ` · ${sets} serii · ok. ${min} min`,
    waiting: 'Czeka na pierwsze ćwiczenie.',
    save: 'Zapisz trening',
    cancel: 'Anuluj',
  },
  en: {
    noGear: 'no equipment',
    gym: 'gym',
    any: 'Any',
    noGearF: 'No equipment',
    gymF: 'Gym',
    all: 'All',
    full: 'Full body',
    split: 'Push · pull · legs',
    ul: 'Upper · lower',
    part: 'Body parts',
    profile: 'With a focus',
    own: 'Yours',
    ownKind: 'your own',
    exercises: (n: number) => `${n} ${pluralEn(n, 'exercise', 'exercises')}`,
    about: (min: number) => `about ${min} min`,
    plannedToday: 'Today, as planned',
    mostWork: (list: string) => `Works hardest: ${list}.`,
    doubts: 'The advisor has doubts — take a look at the preview.',
    start: 'Start',
    preview: 'Preview',
    edit: 'Edit',
    makeYours: 'Make it yours',
    libLead:
      'Ready-made workouts — full body, push/pull/legs and upper/lower splits, and workouts for a single body part — plus your own. Each has a preview: the exercises with their sets, which muscles work and what the advisor says.',
    buildOwn: 'Build your own workout',
    gear: 'Equipment',
    kind: 'Workout type',
    noOwnTitle: 'Nothing of your own yet',
    noMatchTitle: 'Nothing matches the filters',
    noOwnText: 'Build your first workout, or copy a ready-made one and make it yours — the advisor will help along the way.',
    noMatchText: 'Change the equipment or the workout type.',
    offAtlas: 'exercise not in the atlas',
    helpers: (list: string) => ` · also ${list}`,
    sets: (n: number) => `${n} ${pluralEn(n, 'set', 'sets')}`,
    noWorkoutTitle: 'No such workout',
    noWorkoutText: 'It may have been deleted. Go back to the list and pick another.',
    avg: (time: string, n: number) => `Your average time: ${time} ${n === 1 ? '(from your last workout)' : `(from your last ${n})`}`,
    yourVersion: (link: ReactNode) => <>Your version of {link}.</>,
    startNamed: (name: string) => `Start: ${name}`,
    del: 'Delete',
    copy: 'Copy and make it yours',
    order: 'Order and sets for today',
    muscles: 'Muscles worked',
    musclesText: (cap: number) =>
      `Sets per muscle group in this session: the main muscle of a movement counts in full, a helper muscle as half, and explosive and timed sets count as half. The line on the bar marks about ${cap} sets — beyond that, gains almost stop growing.`,
    advisor: 'Advisor',
    inPlans: 'In plans',
    noEditTitle: 'This workout can’t be edited',
    noEditText: 'Only your own workouts can be edited. Copy a ready-made one from its preview.',
    myVersion: (name: string) => `${name} — my version`,
    already: (name: string) => `${name} is already in the workout.`,
    swapAria: (name: string) => `Swap: ${name}`,
    needName: 'Give your workout a name.',
    needEx: 'Add at least one exercise.',
    builderLead:
      'Add exercises and the advisor works out sets per muscle group, time and order straight away. The workout type tells it what to expect — nobody wants rows on push day.',
    basedOn: (link: ReactNode) => (
      <>
        Based on: {link}. The original stays as it is — in the plans that use it, too.
      </>
    ),
    added: (name: ReactNode) => (
      <>
        Added at the end: {name}. Move it into place with the arrows, then save.
      </>
    ),
    name: 'name',
    namePh: 'e.g. Glutes and core — Tuesday',
    type: 'type',
    noType: 'no type — general rules only',
    rest: 'rest between sets',
    restAuto: 'by exercise type — recommended',
    how: 'how to do it',
    howAria: 'How to do the exercises',
    straight: 'Straight sets',
    circuit: 'Circuit — rounds',
    roundRest: 'rest after a round',
    setsAria: (name: string) => `Sets: ${name}`,
    pairAria: (name: string) => `Alternate with the previous one: ${name}`,
    pairTitle: 'Alternate with the previous one',
    upAria: (name: string) => `Move up: ${name}`,
    downAria: (name: string) => `Move down: ${name}`,
    delAria: (name: string) => `Remove: ${name}`,
    swapFor: (name: ReactNode) => <>Swap {name} for an exercise that does a similar job:</>,
    anyAtlas: 'or any from the atlas',
    keep: (name: string) => `Keep ${name}`,
    hint: 'Tap an exercise name to swap it for a similar one in the same spot; × removes it from the workout. The number of sets belongs to the exercise, not the workout — it changes everywhere the exercise appears, and the progression engine keeps managing it. ↔ pairs an exercise with the previous one, done alternately. In a circuit, the number of rounds is the set count of the longest station, and the rest after a round shortens by itself when the circuits go smoothly.',
    pair: (n: number, why: string) => `Pair ${n}: ${why}`,
    addEx: 'add exercise',
    reorder: 'Order by the rules',
    advisorSum: (sets: number, min: number) => ` · ${sets} ${pluralEn(sets, 'set', 'sets')} · about ${min} min`,
    waiting: 'Waiting for the first exercise.',
    save: 'Save workout',
    cancel: 'Cancel',
  },
});

/**
 * Zakładka Treningi: biblioteka gotowych zestawów i własnych, podgląd każdego z nich
 * i kreator z doradcą, który w trakcie układania mówi, czy trening ma sens.
 */

export const GEAR_WORKOUT: Record<WorkoutGear, string> = {
  none: T.noGear,
  kb: 'kettlebell',
  gym: T.gym,
};

/** Filtr sprzętu — ten sam w bibliotece treningów i w katalogu planów. */
export const GEAR_FILTER: { key: 'all' | WorkoutGear; label: string }[] = [
  { key: 'all', label: T.any },
  { key: 'none', label: T.noGearF },
  { key: 'kb', label: 'Kettlebell' },
  { key: 'gym', label: T.gymF },
];

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
  { key: 'all', label: T.all },
  { key: 'full', label: T.full },
  { key: 'split', label: T.split },
  { key: 'ul', label: T.ul },
  { key: 'part', label: T.part },
  { key: 'profile', label: T.profile },
  { key: 'own', label: T.own },
];

const isOwn = (w: Workout): boolean => !BUILTIN.some((b) => b.id === w.id);

export const allWorkouts = (state: AppState): Workout[] => [...BUILTIN, ...state.workouts];

const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** „Push — pchanie · siłownia · 6 ćwiczeń · ok. 32 min · ≈ 180 kcal”. */
function metaLine(state: AppState, w: Workout, secs: number): string {
  const burn = plannedBurn(state, w);
  const n = w.items.length;
  return [
    w.kind ? KIND_LABEL[w.kind] : isOwn(w) ? T.ownKind : null,
    w.gear ? GEAR_WORKOUT[w.gear] : null,
    T.exercises(n),
    n ? T.about(Math.max(1, Math.round(secs / 60))) : null,
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
      {planned && <div className="today-tag">{T.plannedToday}</div>}
      <h2 className="today-name">{w.name}</h2>
      <p className="wmeta">{metaLine(state, w, r.secs)}</p>
      {w.desc && <p className="tight">{w.desc}</p>}
      {top.length > 0 && <p className="tight">{T.mostWork(top.join(', '))}</p>}
      {!r.ok && <p className="tight warnline">{T.doubts}</p>}
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => onStart(w.id)}>
          {T.start}
        </button>
        <button className="btn sm ghost" onClick={() => go(workoutPath(w.id))}>
          {T.preview}
        </button>
        {/* Własna wersja jednym stuknięciem z listy — wcześniej przycisk stał dopiero w podglądzie. */}
        <button className="btn sm ghost" onClick={() => go(isOwn(w) ? workoutEditPath(w.id) : workoutNewPath(w.id))}>
          {isOwn(w) ? T.edit : T.makeYours}
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
        <p className="lead">{T.libLead}</p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn wide" onClick={() => go(workoutNewPath())}>
            {T.buildOwn}
          </button>
        </div>
      </div>

      <div className="grp">
        <Segmented label={T.gear} value={gear} onChange={setGear} options={GEAR_FILTER} />
        <Chips label={T.kind} value={group} onChange={setGroup} options={GROUPS} />
      </div>

      {sorted.length ? (
        sorted.map((w) => (
          <WorkoutCard key={w.id} state={state} w={w} planned={w.id === plannedId} onStart={onStart} />
        ))
      ) : (
        <div className="wrap">
          <EmptyState
            title={group === 'own' ? T.noOwnTitle : T.noMatchTitle}
            text={group === 'own' ? T.noOwnText : T.noMatchText}
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
        <div className="h-detail">{EX[id] ? planLabel(state, id) : T.offAtlas}</div>
        {cue && <div className="h-detail ex-cue">{cue}</div>}
        {use && (
          <div className="h-detail">
            {use.p.map((m) => lower(MUSCLE_NAME[m])).join(', ')}
            {use.s.length ? T.helpers(use.s.map((m) => lower(MUSCLE_NAME[m])).join(', ')) : ''}
          </div>
        )}
      </div>
      <div className="streak">{T.sets(dose(state, id).sets)}</div>
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
          title={T.noWorkoutTitle}
          text={T.noWorkoutText}
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
        {(() => {
          // Szacunek mówi, ile trening powinien trwać; zegar — ile trwał u ciebie naprawdę.
          const avg = averageTime(state.log, w);
          return avg ? (
            <p className="wmeta">{T.avg(durationText(avg.secs), avg.n)}</p>
          ) : null;
        })()}
        {w.desc && <p className="lead">{w.desc}</p>}
        {own &&
          w.base &&
          (() => {
            const base = allWorkouts(state).find((x) => x.id === w.base);
            return base ? (
              <p className="tight">{T.yourVersion(<a href={workoutPath(base.id)}>{base.name}</a>)}</p>
            ) : null;
          })()}
        <p className="exjoke">{WORKOUT_JOKES[w.id] ?? pick(OWN_WORKOUT_JOKES, w.name.length + w.items.length)}</p>
        <div className="actions">
          <button className="btn wide" onClick={() => onStart(w.id)} disabled={!ids.length}>
            {T.startNamed(w.name)}
          </button>
          {own ? (
            <div className="btnrow">
              <button className="btn ghost" onClick={() => go(workoutEditPath(w.id))}>
                {T.edit}
              </button>
              <button className="btn ghost" onClick={() => onDelete(w)}>
                {T.del}
              </button>
            </div>
          ) : (
            <button className="btn ghost wide" onClick={() => go(workoutNewPath(w.id))}>
              {T.copy}
            </button>
          )}
        </div>
      </div>

      <PrepCard state={state} workout={w} />

      <div className="sect-label">{T.order}</div>
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
        <h2>{T.muscles}</h2>
        <p className="tight">{T.musclesText(RULES.sessionCap)}</p>
        <MuscleBars loads={r.loads} />
      </div>

      <div className="grp">
        <h2>{T.advisor}</h2>
        <DesignNotes notes={r.notes} />
      </div>

      <div className="wrap">
        <HealthNote style={{ marginTop: 12 }} />
      </div>

      {plans.length > 0 && (
        <div className="grp">
          <h2>{T.inPlans}</h2>
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
  const [name, setName] = useState(editing ? editing.name : source ? T.myVersion(source.name) : '');
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
          title={T.noEditTitle}
          text={T.noEditText}
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
      onToast(T.already(ex(x).name));
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
      onToast(T.already(ex(neu).name));
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
      document.querySelector<HTMLButtonElement>(`.bl-name[aria-label="${T.swapAria(CSS.escape(ex(neu).name))}"]`)?.focus(),
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
      onToast(T.needName);
      return;
    }
    if (!items.length) {
      onToast(T.needEx);
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
        <p className="lead">{T.builderLead}</p>
        {(() => {
          // Od czego zaczęła się ta wersja — gotowy trening zostaje bez zmian, także w planach.
          const baseId = editing?.base ?? (source && !editing && !isOwn(source) ? source.id : source?.base);
          const base = baseId ? allWorkouts(state).find((w) => w.id === baseId) : undefined;
          return base ? (
            <p className="tight">{T.basedOn(<a href={workoutPath(base.id)}>{base.name}</a>)}</p>
          ) : null;
        })()}
        {extra && items.includes(extra) && (
          <p className="tight">{T.added(<b>{ex(extra).name}</b>)}</p>
        )}
      </div>

      <div className="grp builder">
        <label className="fld">
          <span>{T.name}</span>
          <input
            type="text"
            placeholder={T.namePh}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="fld">
          <span>{T.type}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as WorkoutKind | '')}>
            <option value="">{T.noType}</option>
            {(Object.keys(KIND_LABEL) as WorkoutKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>

        <label className="fld">
          <span>{T.rest}</span>
          <select value={String(rest)} onChange={(e) => setRest(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{T.restAuto}</option>
            {[60, 90, 120, 150, 180].map((s) => (
              <option key={s} value={s}>
                {restLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <span className="seg-label" aria-hidden="true">
          {T.how}
        </span>
        <Segmented
          label={T.howAria}
          value={circ.size ? 'circuit' : 'sets'}
          // Ponowne stuknięcie w zaznaczony wariant niczego nie zmienia — inaczej kopia obwodu
          // z ćwiczeniem po nim (podciąganie po obwodzie trenera) wciągnęłaby je do stacji.
          onChange={(v) => {
            if ((v === 'circuit') === circ.size > 0) return;
            setCirc(v === 'circuit' ? new Set(items) : new Set());
          }}
          options={[
            { key: 'sets', label: T.straight },
            { key: 'circuit', label: T.circuit },
          ]}
        />
        {circ.size > 0 && (
          <label className="fld">
            <span>{T.roundRest}</span>
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
                aria-label={T.swapAria(ex(x).name)}
                onClick={() => setSwapFor(swapFor === x ? null : x)}
              >
                {ex(x).name}
              </button>
              <select
                aria-label={T.setsAria(ex(x).name)}
                value={dose(state, x).sets}
                onChange={(e) => onSetsChange(x, Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {T.sets(n)}
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
                aria-label={T.pairAria(ex(x).name)}
                title={T.pairTitle}
              >
                ↔
              </button>
              <button type="button" className="bl-up" onClick={() => move(i, -1)} disabled={!i} aria-label={T.upAria(ex(x).name)}>
                ↑
              </button>
              <button
                type="button"
                className="bl-down"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={T.downAria(ex(x).name)}
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
                aria-label={T.delAria(ex(x).name)}
              >
                ×
              </button>
            </div>
            {swapFor === x && (
              <div className="bl-swap">
                <p className="tight">{T.swapFor(<b>{ex(x).name}</b>)}</p>
                <div className="bl-swap-opts">
                  {similarTo(x, { exclude: items, gear: workoutGear(items) }).map((o) => (
                    <button key={o} type="button" className="btn ghost sm" onClick={() => replace(x, o)}>
                      {ex(o).name}
                    </button>
                  ))}
                </div>
                <ExercisePicker label={T.anyAtlas} value={null} onChange={(o) => replace(x, o)} />
                <button type="button" className="btn ghost sm" onClick={() => setSwapFor(null)}>
                  {T.keep(ex(x).name)}
                </button>
              </div>
            )}
            </Fragment>
          ))}
        </div>
        {items.length > 0 && (
          <p className="hint">{T.hint}</p>
        )}
        {blocks
          .filter((b) => b.kind === 'pair')
          .map((b) => ({ b, why: pairProblems(b.ids[0]!, b.ids[1]!, undefined) }))
          .filter((x) => x.why.length)
          .map(({ b, why }) => (
            <p className="tight warnline" key={b.n}>
              {T.pair(b.n, why.join(' '))}
            </p>
          ))}

        <ExercisePicker key={pickKey} label={T.addEx} value={null} onChange={add} />

        {!r.orderOk && (
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setItems(r.order)}>
            {T.reorder}
          </button>
        )}
      </div>

      <div className="grp">
        <h2>
          {T.advisor}
          {items.length ? T.advisorSum(r.sets, Math.max(1, Math.round(r.secs / 60))) : ''}
        </h2>
        {items.length ? <DesignNotes notes={r.notes} /> : <p className="tight">{T.waiting}</p>}
        <MuscleBars loads={r.loads} />
      </div>

      <div className="wrap">
        <div className="actions">
          <button className="btn wide" onClick={save}>
            {T.save}
          </button>
          {/* i18n-ignore: trasa */}
          <button className="btn ghost wide" onClick={() => goBack('#/treningi')}>
            {T.cancel}
          </button>
        </div>
      </div>
    </>
  );
}
