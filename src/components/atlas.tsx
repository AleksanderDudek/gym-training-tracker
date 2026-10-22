import { useState, type ReactNode } from 'react';
import { EX, GEAR_LABEL, STAGES, ex, gearOf, NO_EQUIPMENT } from '../data/exercises';
import { VIDEOS } from '../data/videos';
import { ANIM } from '../data/anim';
import { EX_JOKES } from '../data/exjokes';
import { AnimatedMannequin } from './Mannequin';
import { MODE_NAMES } from '../engine/hints';
import { P, exercisesByGroup, levelLabel, planLabel } from '../engine/plan';
import { exercisePath, go, snackAddPath, workoutEditPath, workoutNewPath } from '../routing';
import { Chip, EmptyState } from './ui';
import { VideoEmbed } from './VideoEmbed';
import { SupportLine } from './Support';
import { kcalText } from './Cardio';
import { SectionSwitch } from './Design';
import { profileOf } from '../engine/energy';
import { exercisePlannedBurn } from '../engine/burn';
import type { AppState, ExerciseId, Gear } from '../types';
import { LOCALE, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    lead: 'Każde ćwiczenie ma własną podstronę z opisem techniki, a te z pierwszej biblioteki także z filmami. Adres podstrony da się wysłać albo zapisać w zakładkach.',
    all: 'wszystko',
    none: 'bez sprzętu',
    count: (shown: number, total: number) => `${shown} z ${total} ćwiczeń.`,
    videos: (n: number) => ` · ${n} ${n === 1 ? 'film' : n < 5 ? 'filmy' : 'filmów'}`,
    energy: (label: string, met: string, code: string) => `Wydatek energii: ${label}, ${met} MET (Compendium ${code}).`,
    energyAt: (dose: string, min: number, kcal: string) =>
      ` Na twoim poziomie (${dose}) to ok. ${min} min z przerwami i ${kcal} ponad spoczynek.`,
    energyNoWeight: ' Po wpisaniu wagi w profilu policzę tu kalorie jednej sesji.',
    noExTitle: 'Nie ma takiego ćwiczenia',
    noExText: (id: string) => `Identyfikator „${id}” do niczego nie pasuje. Wróć do spisu i wybierz ruch z listy.`,
    watch: 'Na co uważać',
    mode: (mode: string, side: boolean) =>
      `Typ progresji: ${mode}${side ? '. Powtórzenia liczone osobno na każdą stronę' : ''}.`,
    unit: (secs: boolean, gear: string): ReactNode => (
      <>
        Jednostka: <b>{secs ? 'sekundy' : 'powtórzenia'}</b>
        {secs && ' — w sesji dostajesz stoper albo odliczanie'}. Sprzęt: <b>{gear}</b>.
      </>
    ),
    snack: 'Zapisz jako przekąskę ruchową',
    stages: 'Etapy trudności',
    here: 'tutaj jesteś',
    path: 'Tor ruchu',
    pathText:
      'Sylwetka rysowana w aplikacji z kątów stawów — bez nagrań, bez reklam i bez zapytań na zewnątrz. Pokazuje tor ruchu i tempo, nie zastępuje instruktażu.',
    video: 'Jak to trenować — wideo',
    videoText:
      'Najpopularniejsze nagrania techniki z YouTube, wybrane po liczbie wyświetleń i trafności. Odtwarzacz ładuje się dopiero po kliknięciu w miniaturę.',
    noVideo:
      'Dla tego ćwiczenia nie ma jeszcze wybranych filmów. Tor ruchu wyżej i opis techniki wystarczą, żeby je poprawnie zaplanować.',
    kb: 'To samo ćwiczenie z kettlebell',
    kbText: 'Nagrania pokazujące wariant z odważnikiem kulowym — chwyt, ustawienie ciężaru i różnice względem wersji podstawowej.',
    disclaimer:
      'Filmy pochodzą od zewnętrznych autorów i nie są częścią tej aplikacji. Przy bólu lub kontuzji skonsultuj technikę ze specjalistą.',
    add: 'Dodaj do treningu',
    yourWorkout: 'twój trening',
    already: 'To ćwiczenie już jest w tym treningu.',
    addOpen: 'Dodaj i otwórz trening',
    newWith: 'Nowy trening z tym ćwiczeniem',
    noOwn:
      'Własnych treningów jeszcze nie ma. Zacznij nowy od tego ćwiczenia — albo skopiuj gotowy trening w sekcji Treningi i dopisz je tam.',
  },
  en: {
    lead: 'Every exercise has its own page with a technique description, and the ones from the original library have videos too. You can share a page’s address or bookmark it.',
    all: 'all',
    none: 'no equipment',
    count: (shown: number, total: number) => `${shown} of ${total} exercises.`,
    videos: (n: number) => ` · ${n} ${pluralEn(n, 'video', 'videos')}`,
    energy: (label: string, met: string, code: string) => `Energy use: ${label}, ${met} MET (Compendium ${code}).`,
    energyAt: (dose: string, min: number, kcal: string) =>
      ` At your level (${dose}) that’s about ${min} min with rests and ${kcal} above resting.`,
    energyNoWeight: ' Enter your weight in your profile and I’ll work out the calories for one session here.',
    noExTitle: 'No such exercise',
    noExText: (id: string) => `The ID “${id}” doesn’t match anything. Go back to the list and pick a movement.`,
    watch: 'What to watch out for',
    mode: (mode: string, side: boolean) => `Progression type: ${mode}${side ? '. Reps are counted separately for each side' : ''}.`,
    unit: (secs: boolean, gear: string): ReactNode => (
      <>
        Unit: <b>{secs ? 'seconds' : 'reps'}</b>
        {secs && ' — in the session you get a stopwatch or a countdown'}. Equipment: <b>{gear}</b>.
      </>
    ),
    snack: 'Save as an exercise snack',
    stages: 'Difficulty stages',
    here: 'you are here',
    path: 'Movement path',
    pathText:
      'The figure is drawn in the app from joint angles — no recordings, no ads and no outside requests. It shows the movement path and tempo; it doesn’t replace coaching.',
    video: 'How to train it — videos',
    videoText:
      'The most popular technique videos on YouTube, picked by views and relevance. The player only loads when you tap the thumbnail.',
    noVideo:
      'No videos have been picked for this exercise yet. The movement path above and the technique description are enough to plan it properly.',
    kb: 'The same exercise with a kettlebell',
    kbText: 'Videos showing the kettlebell variation — grip, where the weight sits and how it differs from the basic version.',
    disclaimer:
      'The videos come from outside creators and aren’t part of this app. If you have pain or an injury, check your technique with a specialist.',
    add: 'Add to a workout',
    yourWorkout: 'your workout',
    already: 'This exercise is already in that workout.',
    addOpen: 'Add and open the workout',
    newWith: 'New workout with this exercise',
    noOwn:
      'You don’t have any workouts of your own yet. Start a new one with this exercise — or copy a ready-made workout in the Workouts section and add it there.',
  },
});

/* ---------------- Spis ćwiczeń ---------------- */

/**
 * Filtry sprzętu. „Wszystko” zostaje pierwsze, bo to domyślny widok. „Bez sprzętu” to nie
 * sprzęt, tylko jego brak: masa ciała bez drążka, kółka i skakanki — to, co zrobisz w domu
 * na podłodze, przy ścianie, krześle i stole.
 */
type AtlasFilter = Gear | 'all' | 'none';
const GEAR_FILTERS: AtlasFilter[] = [
  'all',
  'none',
  'kettlebell',
  'barbell',
  'dumbbell',
  'machine',
  'bodyweight',
];

export function AtlasView({ state }: { state: AppState }) {
  const groups = exercisesByGroup();
  const [gear, setGear] = useState<AtlasFilter>('all');
  const match = (id: ExerciseId): boolean =>
    gear === 'all' || (gear === 'none' ? NO_EQUIPMENT.has(id) : gearOf(id) === gear);
  const shown = Object.entries(groups)
    .map(([g, ids]) => [g, ids.filter(match)] as const)
    .filter(([, ids]) => ids.length);
  const total = shown.reduce((n, [, ids]) => n + ids.length, 0);

  return (
    <>
      <div className="wrap">
        <SectionSwitch on="atlas" />
        <p className="lead">{T.lead}</p>
        <div className="gearfilter">
          {GEAR_FILTERS.map((g) => (
            <button key={g} aria-pressed={gear === g} onClick={() => setGear(g)}>
              {g === 'all' ? T.all : g === 'none' ? T.none : GEAR_LABEL[g]}
            </button>
          ))}
        </div>
        <p className="tight" style={{ marginTop: 8 }}>
          {T.count(total, Object.values(groups).reduce((n, ids) => n + ids.length, 0))}
        </p>
      </div>
      {shown.map(([g, ids]) => (
        <div key={g}>
          <div className="sect-label">{g}</div>
          {ids.map((id) => {
            const v = VIDEOS[id];
            const count = (v?.main.length ?? 0) + (v?.kb.length ?? 0);
            return (
              <button className="atlas-row" key={id} onClick={() => go(exercisePath(id))}>
                <Chip state={state} id={id} />
                <div>
                  <div className="ex-name">{ex(id).name}</div>
                  <div className="ex-target">
                    {GEAR_LABEL[gearOf(id)]}
                    {' · '}
                    {levelLabel(state, id)}
                    {count > 0 && T.videos(count)}
                  </div>
                </div>
                <div className="go">→</div>
              </button>
            );
          })}
        </div>
      ))}
      <div className="wrap">
        <SupportLine seed={total} />
      </div>
    </>
  );
}

/* ---------------- Podstrona ćwiczenia ---------------- */

/**
 * Wydatek energii ruchu: z której pozycji Compendium bierze się liczba i ile wychodzi jedna
 * sesja na obecnym poziomie. Bez wagi zostaje sama pozycja — kalorii nie zgadujemy.
 */
function ExerciseEnergy({ state, id }: { state: AppState; id: ExerciseId }) {
  const prof = profileOf(id);
  const b = exercisePlannedBurn(state, id);
  const p = P(state, id);
  return (
    <p className="tight">
      {T.energy(prof.label, prof.met.toLocaleString(LOCALE), prof.code)}
      {b
        ? T.energyAt(
            `${p.sets} × ${p.target}${ex(id).unit === 'secs' ? ' s' : ''}`,
            Math.max(1, Math.round(b.secs / 60)),
            kcalText(b.active),
          )
        : T.energyNoWeight}
    </p>
  );
}

export function ExercisePage({ state, id }: { state: AppState; id: ExerciseId }) {
  // `hasOwn`, bo ręcznie wpisane `#/cwiczenia/constructor` trafiłoby w prototyp obiektu.
  const m = Object.hasOwn(EX, id) ? EX[id] : undefined;

  if (!m) {
    return (
      <div className="wrap">
        <EmptyState
          title={T.noExTitle}
          text={T.noExText(id)}
          cast={{ who: 'siwy', mood: 'wise' }}
        />
      </div>
    );
  }

  const p = P(state, id);
  const move = ANIM[id];
  const videos = VIDEOS[id] ?? { main: [], kb: [] };
  const stages = m.stages ? STAGES[m.stages] : null;

  return (
    <>
      <div className="wrap">
        <div className="ex-hero">
          <Chip state={state} id={id} />
          <div>
            <div className="ex-group">
              {m.group} · {GEAR_LABEL[gearOf(id)]}
            </div>
            <h2 className="ex-h">{m.name}</h2>
            <div className="ex-target">{planLabel(state, id)}</div>
          </div>
        </div>
      </div>

      <div className="grp">
        <h2>{T.watch}</h2>
        <p>{m.hint}</p>
        {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
        <p className="tight">{T.mode(MODE_NAMES[m.mode] ?? '', !!m.side)}</p>
        <p className="tight">{T.unit(m.unit === 'secs', GEAR_LABEL[gearOf(id)])}</p>
        <ExerciseEnergy state={state} id={id} />
        {/* Krótka seria tego ruchu poza treningiem — prosto z miejsca, w którym ktoś go ogląda. */}
        <div style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => go(snackAddPath(id))}>
            {T.snack}
          </button>
        </div>
      </div>

      <AddToWorkout state={state} id={id} />

      {stages && (
        <div className="grp">
          <h2>{T.stages}</h2>
          <ol className="stages">
            {stages.map((s, i) => (
              <li key={s} className={i === (p.stage ?? 0) ? 'now' : i < (p.stage ?? 0) ? 'past' : ''}>
                {s}
                {i === (p.stage ?? 0) && <span className="badge">{T.here}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {move && (
        <>
          <div className="sect-label">{T.path}</div>
          <div className="grp">
            <AnimatedMannequin move={move} gear={gearOf(id)} />
            <p className="tight" style={{ marginTop: 10 }}>
              {T.pathText}
            </p>
          </div>
        </>
      )}

      <div className="sect-label">{T.video}</div>
      <div className="grp">
        {videos.main.length ? (
          <>
            <p className="tight">{T.videoText}</p>
            <div className="vids">
              {videos.main.map((v) => (
                <VideoEmbed key={v.id} video={v} />
              ))}
            </div>
          </>
        ) : (
          <p>{T.noVideo}</p>
        )}
      </div>

      {videos.kb.length > 0 && (
        <>
          <div className="sect-label">{T.kb}</div>
          <div className="grp">
            <p className="tight">{T.kbText}</p>
            <div className="vids">
              {videos.kb.map((v) => (
                <VideoEmbed key={v.id} video={v} />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="wrap">
        <p className="disclaimer">{T.disclaimer}</p>
      </div>
    </>
  );
}

/**
 * „Dodaj do treningu” z atlasu: do jednego z własnych treningów albo do nowego. Otwiera kreator
 * z ćwiczeniem dopisanym na końcu — nic nie zapisuje, dopóki ktoś nie stuknie „Zapisz trening”,
 * więc da się jeszcze przesunąć ćwiczenie, zamienić je albo zrezygnować.
 */
function AddToWorkout({ state, id }: { state: AppState; id: ExerciseId }) {
  const own = state.workouts;
  const [target, setTarget] = useState<string>(own[0]?.id ?? '');
  const already = own.find((w) => w.id === target)?.items.some((i) => i.ex === id) ?? false;
  return (
    <div className="grp">
      <h2>{T.add}</h2>
      {own.length ? (
        <>
          <label className="fld">
            <span>{T.yourWorkout}</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {own.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {already && <p className="tight">{T.already}</p>}
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button className="btn sm" disabled={already} onClick={() => go(workoutEditPath(target, id))}>
              {T.addOpen}
            </button>
            <button className="btn ghost sm" onClick={() => go(workoutNewPath(undefined, id))}>
              {T.newWith}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="tight">{T.noOwn}</p>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => go(workoutNewPath(undefined, id))}>
            {T.newWith}
          </button>
        </>
      )}
    </div>
  );
}
