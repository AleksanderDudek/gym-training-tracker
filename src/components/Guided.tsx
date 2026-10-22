import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EFFORT, READY, ex, ladderFor } from '../data/exercises';
import { EX_JOKES } from '../data/exjokes';
import { blocksOf } from '../engine/blocks';
import type { Block } from '../engine/blocks';
import { waitingPart, waitingSince } from '../engine/clock';
import { plan, planLabel } from '../engine/plan';
import { plural } from '../engine/quips';
import { restBetween, restLabel } from '../engine/rests';
import { cursorOf, loggedSets, sessionSteps } from '../engine/steps';
import type { Step } from '../engine/steps';
import type { RestPlan } from '../engine/rests';
import { keepAwake, signalOnce, unlockSound } from '../coach';
import { exercisePath } from '../routing';
import { PartStrip, secsSince, useSecondTick } from './SessionClock';
import { PrepContent } from './Structure';
import { Segmented } from './ui';
import { Timer, formatClock } from './Timer';
import type { AppState, EffortKey, ExerciseId, ReadyKey, Session, SetResult, Workout } from '../types';
import { pluralEn, text } from '../i18n';

const T = text({
  pl: {
    rest: 'Przerwa',
    restPair: 'Przejście do pary',
    restMove: 'Następna stacja',
    restRound: 'Przerwa po rundzie',
    restNext: 'Przerwa przed kolejnym ćwiczeniem',
    set: (set: number, of: number) => `Seria ${set} z ${of}`,
    round: (round: number | undefined, rounds: number | undefined, pos: number, size: number) =>
      `Runda ${round} z ${rounds} · stacja ${pos} z ${size}`,
    amrap: 'ile dasz radę',
    secs: (n: number) => `${n} s`,
    reps: (n: number) => `${n} powt.`,
    perSide: ' na stronę',
    skipped: (name: string) => `${name} pominięte na dziś.`,
    partSkipped: 'Ta część pominięta na dziś.',
    allDone: 'Wszystkie serie zrobione',
    allDoneText: 'Zamknij trening, a aplikacja przeliczy poziomy i ustawi cele na następny raz.',
    then: (name: string, where: string, target: string): ReactNode => (
      <>
        Potem: <b>{name}</b> · {where} · {target}
      </>
    ),
    undo: (name: string) => `Cofnij serię: ${name}`,
    list: 'Lista ćwiczeń',
    finish: 'Zamknij trening',
    stations: (n: number) => `${n} ${plural(n, ['stacja', 'stacje', 'stacji'])}`,
    rounds: (n: number) => `${n} ${plural(n, ['runda', 'rundy', 'rund'])}`,
    pair: (names: string) => `Para: ${names}`,
    circuit: (stations: string, rounds: string) => `Obwód: ${stations} × ${rounds}`,
    circuitBtn: (stations: string) => `obwód (${stations})`,
    deload: 'Tydzień lżejszy',
    deloadText: 'Mniej serii niż zwykle i bez testu „ile dasz radę”. Zostaw 2–3 powtórzenia zapasu.',
    feel: 'Jak się dziś czujesz? Wpływa na dzisiejsze cele, nie na twoje poziomy.',
    feelLabel: 'Samopoczucie',
    prep: 'Przygotowanie stanowiska i rozgrzewka',
    parts: (n: number) => `${n} ${plural(n, ['część', 'części', 'części'])} po kolei`,
    howTo: (n: number) =>
      `${n} ${plural(n, ['seria', 'serie', 'serii'])}. Po każdej stuknij „Zrobione” — przerwa odliczy się sama, a telefon zapika, kiedy minie. Kolejną część zaczynasz stuknięciem „Start”, więc zegar zmierzy też przejścia między ćwiczeniami.`,
    showClock: 'Pokaż czas treningu w pasku',
    begin: 'Zaczynam',
    restOver: 'Przerwa minęła — czas na serię.',
    less: 'Mniej',
    more: 'Więcej',
    secsLabel: 'sekundy',
    repsLabel: 'powtórzenia',
    weight: 'ciężar',
    done: 'Zrobione',
    technique: 'Technika',
    seeTechnique: 'Zobacz technikę →',
    skipEx: 'Pomiń to ćwiczenie dziś',
    skipPart: 'Pomiń tę część dziś',
    restLeft: (clock: string) => `Do końca przerwy ${clock}`,
    skipRest: 'Pomiń przerwę',
    getReady: (name: string, where: string, target: string): ReactNode => (
      <>
        Teraz przygotuj: <b>{name}</b> · {where} · {target}
      </>
    ),
    partWaits: (n: number, parts: number) => `Część ${n} z ${parts} czeka na start`,
    transition: 'Przejście',
    sinceAria: (min: number) => `Od końca poprzedniego ćwiczenia: ${min} min`,
    since: 'od końca poprzedniego ćwiczenia',
    recRest: (label: string) => `Zalecana przerwa · ${label} · zostało`,
    recRestLeft: (clock: string) => `Do końca zalecanej przerwy ${clock}`,
    recRestOver: 'Zalecana przerwa minęła — możesz zaczynać.',
    nextPart: 'Następna część',
    effort: (name: string): ReactNode => (
      <>
        <b>{name}</b> — ile zostało w zapasie po ostatniej serii?
      </>
    ),
    effortAria: (name: string) => `Zapas po ćwiczeniu ${name}`,
  },
  en: {
    rest: 'Rest',
    restPair: 'Over to the pair',
    restMove: 'Next station',
    restRound: 'Rest after the round',
    restNext: 'Rest before the next exercise',
    set: (set: number, of: number) => `Set ${set} of ${of}`,
    round: (round: number | undefined, rounds: number | undefined, pos: number, size: number) =>
      `Round ${round} of ${rounds} · station ${pos} of ${size}`,
    amrap: 'as many as you can',
    secs: (n: number) => `${n} s`,
    reps: (n: number) => `${n} ${pluralEn(n, 'rep', 'reps')}`,
    perSide: ' per side',
    skipped: (name: string) => `${name} skipped for today.`,
    partSkipped: 'This part skipped for today.',
    allDone: 'All sets done',
    allDoneText: 'Finish the workout and the app will recalculate your levels and set targets for next time.',
    then: (name: string, where: string, target: string): ReactNode => (
      <>
        Then: <b>{name}</b> · {where} · {target}
      </>
    ),
    undo: (name: string) => `Undo set: ${name}`,
    list: 'Exercise list',
    finish: 'Finish workout',
    stations: (n: number) => `${n} ${pluralEn(n, 'station', 'stations')}`,
    rounds: (n: number) => `${n} ${pluralEn(n, 'round', 'rounds')}`,
    pair: (names: string) => `Pair: ${names}`,
    circuit: (stations: string, rounds: string) => `Circuit: ${stations} × ${rounds}`,
    circuitBtn: (stations: string) => `circuit (${stations})`,
    deload: 'Lighter week',
    deloadText: 'Fewer sets than usual and no “as many as you can” test. Leave 2–3 reps in reserve.',
    feel: 'How do you feel today? It affects today’s targets, not your levels.',
    feelLabel: 'How you feel',
    prep: 'Station setup and warm-up',
    parts: (n: number) => `${n} ${pluralEn(n, 'part', 'parts')} in order`,
    howTo: (n: number) =>
      `${n} ${pluralEn(n, 'set', 'sets')}. After each one, tap “Done” — the rest counts down by itself and your phone beeps when it’s over. You start the next part by tapping “Start”, so the clock also times the changeovers between exercises.`,
    showClock: 'Show workout time in the bar',
    begin: 'Let’s go',
    restOver: 'Rest’s over — time for your set.',
    less: 'Less',
    more: 'More',
    secsLabel: 'seconds',
    repsLabel: 'reps',
    weight: 'weight',
    done: 'Done',
    technique: 'Technique',
    seeTechnique: 'See technique →',
    skipEx: 'Skip this exercise today',
    skipPart: 'Skip this part today',
    restLeft: (clock: string) => `Rest left: ${clock}`,
    skipRest: 'Skip rest',
    getReady: (name: string, where: string, target: string): ReactNode => (
      <>
        Get ready: <b>{name}</b> · {where} · {target}
      </>
    ),
    partWaits: (n: number, parts: number) => `Part ${n} of ${parts} is ready to start`,
    transition: 'Changeover',
    sinceAria: (min: number) => `Since the previous exercise ended: ${min} min`,
    since: 'since the previous exercise ended',
    recRest: (label: string) => `Recommended rest · ${label} · left`,
    recRestLeft: (clock: string) => `Recommended rest left: ${clock}`,
    recRestOver: 'Recommended rest is over — you can start.',
    nextPart: 'Next part',
    effort: (name: string): ReactNode => (
      <>
        <b>{name}</b> — how much was left in the tank after the last set?
      </>
    ),
    effortAria: (name: string) => `Reps in reserve after ${name}`,
  },
});

/**
 * Prowadzenie sesji: na ekranie jest tylko to, co trzeba zrobić teraz — jedna seria, a po
 * „Zrobione” odliczana przerwa i zapowiedź następnej serii. Liczby wpisuje się po serii,
 * nie po całym ćwiczeniu, z podpowiedzią celu, więc zwykle wystarczy jedno stuknięcie.
 *
 * Ocena „ile zostało w zapasie” pada raz na ćwiczenie, po jego ostatniej serii, w trakcie
 * przerwy — na niej stoi progresja. Widok listy zostaje pod ręką: oba czytają ten sam zapis.
 *
 * Trening idzie część po części (część to blok: ćwiczenie, para albo obwód). Między częściami
 * stoi karta przejścia: ile minęło od końca poprzedniej, zalecana przerwa i „Start: …” — to
 * stuknięcie zaznacza początek następnej, więc zegar sesji wie, ile trwało przejście. Sesja
 * bez zegara (zaczęta przed nim) idzie dawnym trybem, seria za serią.
 */

interface Props {
  state: AppState;
  /** Trening na dziś — z zamianami. */
  workout: Workout;
  onReady: (r: ReadyKey) => void;
  /** „Zaczynam” — start zegara i pierwszej części. */
  onBegin: () => void;
  /** „Start: …” na karcie przejścia. */
  onStartPart: (block: number) => void;
  /** Pominięcie całej części, która czeka na start. */
  onSkipPart: (ids: ExerciseId[]) => void;
  /** Licznik czasu w pasku: pokazany albo schowany. */
  onClockPref: (on: boolean) => void;
  onLogSet: (id: ExerciseId, row: SetResult, of: number, rest: RestPlan | null) => void;
  onUndo: (id: ExerciseId) => void;
  onEffort: (id: ExerciseId, effort: EffortKey) => void;
  onRest: (cmd: 'more' | 'skip') => void;
  onSkip: (id: ExerciseId) => void;
  onFinish: () => void;
  onList: () => void;
  onToast: (m: string) => void;
}

const REST_TITLE: Record<RestPlan['kind'], string> = {
  set: T.rest,
  pair: T.restPair,
  move: T.restMove,
  round: T.restRound,
  next: T.restNext,
};

/** „Seria 2 z 3”, w obwodzie „Runda 2 z 3 · stacja 3 z 7”. */
function where(step: Step, steps: readonly Step[]): string {
  if (step.kind !== 'circuit') return T.set(step.set, step.of);
  const stations = new Set(steps.filter((s) => s.block === step.block).map((s) => s.ex));
  const pos = [...stations].indexOf(step.ex) + 1;
  return T.round(step.round, step.rounds, pos, stations.size);
}

/** Cel serii słowami: „10 powt. · 16 kg”, „30 s”, „ile dasz radę”. */
function targetText(state: AppState, step: Step): string {
  const r = plan(state, step.ex)[step.set - 1];
  if (!r) return '';
  const m = ex(step.ex);
  if (r.amrap) return `${T.amrap}${r.w !== null ? ` · ${r.w} kg` : ''}`;
  const amount = m.unit === 'secs' ? T.secs(r.reps) : T.reps(r.reps);
  return `${amount}${m.side ? T.perSide : ''}${r.w !== null ? ` · ${r.w} kg` : ''}`;
}

/**
 * Odświeżanie co ćwierć sekundy do chwili `until` — licznik liczy się z chwili końca przerwy.
 * Po końcu odświeżanie staje: telefon z włączonym ekranem nie ma rysować w kółko tego samego.
 */
function useNow(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    setNow(Date.now());
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [until]);
  return now;
}

export function GuidedSession(props: Props) {
  const { state, workout } = props;
  const session = state.session!;
  const steps = sessionSteps(state, workout);
  const blocks = blocksOf(workout.items);
  const cursor = cursorOf(steps, session);
  const anyLogged = Object.values(session.res).some((r) => r.rows.length);
  // Zaczęty: po „Zaczynam” (zegar) albo z serią w zapisie — sesje sprzed zegara nie wracają do startu.
  const begun = !!session.clock || anyLogged;
  const rest = session.rest;
  const now = useNow(rest?.until ?? null);
  const resting = !!rest && now < rest.until;

  // Ekran nie gaśnie, dopóki trwa prowadzenie.
  useEffect(() => keepAwake(), []);

  // Sygnał końca przerwy — raz na przerwę, także gdy licznik doszedł do zera w tle. Tylko
  // w tym widoku, który przerwę widział w toku: powrót na ekran po jej końcu już nie piszczy.
  const sawRunning = useRef(false);
  if (resting) sawRunning.current = true;
  useEffect(() => {
    if (rest && now >= rest.until && sawRunning.current) signalOnce(rest.until);
  }, [rest, now]);

  // Pytanie o zapas tylko dla ćwiczenia, które naprawdę ma komplet serii i nie jest zamknięte.
  const pendingEffort = (session.ask ?? []).filter(
    (id) => session.res[id] && !session.done[id] && loggedSets(session, id) >= plan(state, id).length,
  );

  if (!begun)
    return (
      <Start
        {...props}
        onBegin={() => {
          unlockSound();
          props.onBegin();
        }}
      />
    );

  const step = cursor >= 0 ? steps[cursor]! : null;
  const upcoming = (from: number) =>
    steps.slice(from).find((s) => !session.skip[s.ex] && !session.done[s.ex] && loggedSets(session, s.ex) < s.set) ?? null;
  // Następna część czeka na „Start” — dopiero to stuknięcie kończy przejście.
  const waiting = waitingPart(session, steps, cursor);
  const efforts = pendingEffort.map((id) => <EffortAsk key={id} id={id} onEffort={(e) => props.onEffort(id, e)} />);

  return (
    <div className="wrap guide">
      {waiting === null && step && session.clock && (
        <PartStrip session={session} steps={steps} blocks={blocks} current={step.block} />
      )}
      {/* Na karcie przejścia ocena zapasu idzie pierwsza: to pytanie o ćwiczenie, które właśnie się skończyło. */}
      {waiting !== null && efforts}
      {waiting !== null ? (
        <TransitionPanel
          state={state}
          session={session}
          steps={steps}
          block={blocks.find((b) => b.n === waiting)!}
          parts={blocks.length}
          rest={resting ? rest! : null}
          rested={!!rest && !resting}
          now={now}
          onRest={props.onRest}
          onStart={() => {
            unlockSound();
            props.onStartPart(waiting);
          }}
          onSkip={(ids) => {
            props.onSkipPart(ids);
            props.onToast(ids.length === 1 ? T.skipped(ex(ids[0]!).name) : T.partSkipped);
          }}
        />
      ) : resting && rest ? (
        <RestPanel rest={rest} now={now} next={step} steps={steps} state={state} onRest={props.onRest} />
      ) : step ? (
        <SetPanel
          key={`${step.ex}-${step.set}-${session.ready}`}
          state={state}
          step={step}
          steps={steps}
          rested={!!rest}
          onDone={(row) => {
            unlockSound();
            const after = steps.indexOf(step) + 1;
            props.onLogSet(step.ex, row, step.of, restBetween(state, workout, step, upcoming(after)));
          }}
          onSkip={() => {
            props.onSkip(step.ex);
            props.onToast(T.skipped(ex(step.ex).name));
          }}
        />
      ) : (
        <div className="grp guide-done">
          <h2>{T.allDone}</h2>
          <p className="tight">{T.allDoneText}</p>
        </div>
      )}

      {waiting === null && efforts}

      {!resting && step && waiting === null && (() => {
        const n = upcoming(cursor + 1);
        return n ? (
          <p className="hint guide-next">{T.then(ex(n.ex).name, where(n, steps).toLowerCase(), targetText(state, n))}</p>
        ) : null;
      })()}

      <div className="guide-foot">
        {(() => {
          // Cofnięcie dotyczy naprawdę ostatniej zapisanej serii; bez zapisu — tej tuż przed
          // obecnym krokiem (sesje sprzed zapamiętywania ostatniej serii).
          const byOrder = [...steps.slice(0, cursor < 0 ? steps.length : cursor)]
            .reverse()
            .find((s) => !session.skip[s.ex] && loggedSets(session, s.ex) >= s.set)?.ex;
          const last =
            session.last && !session.skip[session.last] && loggedSets(session, session.last) > 0 ? session.last : byOrder;
          return last ? (
            <button className="btn ghost sm" onClick={() => props.onUndo(last)}>
              {T.undo(ex(last).name)}
            </button>
          ) : null;
        })()}
        <button className="btn ghost sm" onClick={props.onList}>
          {T.list}
        </button>
        <button className={`btn${cursor < 0 ? '' : ' ghost'} sm`} onClick={props.onFinish}>
          {T.finish}
        </button>
      </div>
    </div>
  );
}

/** Część jednym wierszem: „Przysiad · 3 × 8 powt. · 16 kg”, „Para: A + B”, „Obwód: 5 stacji × 3 rundy”. */
function partLine(state: AppState, b: Block): string {
  if (b.kind === 'straight') return `${ex(b.ids[0]!).name} · ${planLabel(state, b.ids[0]!)}`;
  if (b.kind === 'pair') return T.pair(b.ids.map((id) => ex(id).name).join(' + '));
  const rounds = Math.max(...b.ids.map((id) => plan(state, id).length));
  return T.circuit(T.stations(b.ids.length), T.rounds(rounds));
}

function Start({ state, workout, onReady, onList, onBegin, onClockPref }: Props) {
  const session = state.session!;
  const steps = sessionSteps(state, workout);
  const blocks = blocksOf(workout.items);
  return (
    <div className="wrap guide">
      {session.deload && (
        <div className="dnote tip" style={{ marginTop: 12 }}>
          <b>{T.deload}</b>
          <p className="tight">{T.deloadText}</p>
        </div>
      )}
      <div className="segline">{T.feel}</div>
      <Segmented
        label={T.feelLabel}
        value={session.ready}
        onChange={onReady}
        options={(Object.keys(READY) as ReadyKey[]).map((k) => ({ key: k, label: READY[k] }))}
      />
      <details className="prep prep-session" open>
        <summary>{T.prep}</summary>
        <PrepContent state={state} workout={workout} />
      </details>
      <div className="grp parts-plan">
        <h2>{T.parts(blocks.length)}</h2>
        <ol className="parts-list">
          {blocks.map((b) => (
            <li key={b.n}>{partLine(state, b)}</li>
          ))}
        </ol>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        {T.howTo(steps.length)}
      </p>
      <label className="check-row">
        <input type="checkbox" checked={state.cfg.clock !== false} onChange={(e) => onClockPref(e.target.checked)} />
        <span>{T.showClock}</span>
      </label>
      <button className="btn wide" onClick={onBegin}>
        {T.begin}
      </button>
      <div className="guide-foot">
        <button className="btn ghost sm" onClick={onList}>
          {T.list}
        </button>
      </div>
    </div>
  );
}

function SetPanel({
  state,
  step,
  steps,
  rested,
  onDone,
  onSkip,
}: {
  state: AppState;
  step: Step;
  steps: readonly Step[];
  /** Przerwa przed tą serią właśnie minęła. */
  rested: boolean;
  onDone: (row: SetResult) => void;
  onSkip: () => void;
}) {
  const m = ex(step.ex);
  const rows = plan(state, step.ex);
  const r = rows[step.set - 1];
  const prev = state.session!.res[step.ex]?.rows[step.set - 2];
  const prevPlan = rows[step.set - 2];
  const [value, setValue] = useState(r && !r.amrap ? String(r.reps) : '');
  // Ciężar z poprzedniej serii tylko wtedy, gdy ktoś go tam zmienił, a plan dla obu serii jest
  // ten sam. W przejściu na cięższy kettlebell ciężkie serie idą pierwsze — lżejsza seria po nich
  // ma dostać swój ciężar, a nie ten sprzed chwili.
  const carried = prev && prevPlan && prev.w !== prevPlan.w && prevPlan.w === r?.w ? prev.w : null;
  const [w, setW] = useState<number | null>(carried ?? r?.w ?? null);
  const timed = m.unit === 'secs';
  const n = parseInt(value || '0', 10) || 0;

  return (
    <div className="grp guide-set">
      {rested && <p className="guide-ready">{T.restOver}</p>}
      <div className="guide-where">
        <b className="ex-tag">{step.tag}</b> {where(step, steps)}
      </div>
      <h2 className="guide-name">{m.name}</h2>
      <p className="guide-target">{targetText(state, step)}</p>

      <div className="guide-entry">
        <button className="btn ghost step" aria-label={T.less} onClick={() => setValue(String(Math.max(0, n - 1)))}>
          −
        </button>
        <label className="fld">
          <span>{timed ? T.secsLabel : T.repsLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={r?.amrap ? 'max' : ''}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="btn ghost step" aria-label={T.more} onClick={() => setValue(String(n + 1))}>
          +
        </button>
      </div>
      {r && r.w !== null && (
        <label className="fld guide-weight">
          <span>{T.weight}</span>
          <select value={String(w ?? r.w)} onChange={(e) => setW(Number(e.target.value))}>
            {ladderFor(state, step.ex).map((x) => (
              <option key={x} value={x}>
                {x} kg
              </option>
            ))}
          </select>
        </label>
      )}
      {timed && r && <Timer mode={r.amrap ? 'stopwatch' : 'count'} target={r.reps} onDone={(secs) => setValue(String(secs))} />}

      <button
        className="btn wide guide-go"
        disabled={n <= 0}
        onClick={() => onDone({ reps: n, w: r && r.w !== null ? (w ?? r.w) : null })}
      >
        {T.done}
      </button>

      <details className="why">
        <summary>{T.technique}</summary>
        <p className="hint">{m.hint}</p>
        {EX_JOKES[step.ex] && <p className="exjoke">{EX_JOKES[step.ex]}</p>}
        <a className="vidlink" href={exercisePath(step.ex)}>
          {T.seeTechnique}
        </a>
      </details>
      <button className="btn ghost sm" onClick={onSkip}>
        {T.skipEx}
      </button>
    </div>
  );
}

function RestPanel({
  rest,
  now,
  next,
  steps,
  state,
  onRest,
}: {
  rest: NonNullable<NonNullable<AppState['session']>['rest']>;
  now: number;
  next: Step | null;
  steps: readonly Step[];
  state: AppState;
  onRest: (cmd: 'more' | 'skip') => void;
}) {
  const left = Math.max(0, (rest.until - now) / 1000);
  const share = rest.secs ? Math.min(1, left / rest.secs) : 0;
  return (
    <div className="grp guide-rest" aria-live="polite">
      <div className="guide-where">{REST_TITLE[rest.kind ?? 'set']} · {restLabel(rest.secs)}</div>
      <div className="guide-clock" role="timer" aria-label={T.restLeft(formatClock(left))}>
        {formatClock(Math.ceil(left))}
      </div>
      <div className="guide-bar" aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </div>
      {rest.why && <p className="hint">{rest.why}</p>}
      <div className="guide-foot">
        <button className="btn ghost sm" onClick={() => onRest('more')}>
          +30 s
        </button>
        <button className="btn sm" onClick={() => onRest('skip')}>
          {T.skipRest}
        </button>
      </div>
      {next && (
        <p className="guide-up">{T.getReady(ex(next.ex).name, where(next, steps).toLowerCase(), targetText(state, next))}</p>
      )}
    </div>
  );
}

/**
 * Karta przejścia między częściami. Duża liczba to czas od końca poprzedniej części — ta, o którą
 * chodzi w mierzeniu przejść. Zalecana przerwa stoi obok, mniejsza, i zapika jak zwykle;
 * „Start” jej nie wymaga, bo przerwa to zalecenie, a nie blokada.
 */
function TransitionPanel({
  state,
  session,
  steps,
  block,
  parts,
  rest,
  rested,
  now,
  onRest,
  onStart,
  onSkip,
}: {
  state: AppState;
  session: Session;
  steps: readonly Step[];
  block: Block;
  parts: number;
  /** Zalecana przerwa w toku. */
  rest: NonNullable<Session['rest']> | null;
  /** Zalecana przerwa już minęła. */
  rested: boolean;
  now: number;
  onRest: (cmd: 'more' | 'skip') => void;
  onStart: () => void;
  onSkip: (ids: ExerciseId[]) => void;
}) {
  // Od tego samego końca, od którego dziennik policzy to przejście — także końca części z listy.
  const since = waitingSince(session, Date.now());
  const tick = useSecondTick(since ?? 0);
  const gap = since !== null ? secsSince(since, tick) : 0;
  // Co z tej części jeszcze czeka — pierwsza niezrobiona seria każdego ćwiczenia.
  const open = block.ids
    .map((id) => steps.find((st) => st.block === block.n && st.ex === id && !session.skip[id] && !session.done[id] && loggedSets(session, id) < st.set))
    .filter((st): st is Step => !!st);
  // Na przycisku to, co naprawdę teraz zaczynasz: ćwiczenie, oba z pary, a w obwodzie — liczba stacji.
  const label =
    block.kind === 'circuit' && open.length > 1
      ? T.circuitBtn(T.stations(open.length))
      : open.map((st) => ex(st.ex).name).join(' + ');
  const left = rest ? Math.max(0, (rest.until - now) / 1000) : 0;
  return (
    <div className="grp guide-trans">
      <div className="guide-where">{T.partWaits(block.n, parts)}</div>
      <h2 className="guide-name">{T.transition}</h2>
      {since !== null && (
        <>
          <div className="guide-clock" role="timer" aria-label={T.sinceAria(Math.floor(gap / 60))}>
            {formatClock(gap)}
          </div>
          <p className="trans-cap">{T.since}</p>
        </>
      )}
      {rest && (
        <div className="trans-rest">
          <div className="guide-where">
            {T.recRest(restLabel(rest.secs))}{' '}
            <b role="timer" aria-label={T.recRestLeft(formatClock(left))}>
              {formatClock(Math.ceil(left))}
            </b>
          </div>
          <div className="guide-bar" aria-hidden="true">
            <i style={{ width: `${(rest.secs ? Math.min(1, left / rest.secs) : 0) * 100}%` }} />
          </div>
          {rest.why && <p className="hint">{rest.why}</p>}
          <button className="btn ghost sm" onClick={() => onRest('more')}>
            +30 s
          </button>
        </div>
      )}
      {rested && <p className="guide-ready">{T.recRestOver}</p>}
      <ul className="trans-next" aria-label={T.nextPart}>
        {open.map((st) => (
          <li key={st.ex}>
            <b className="ex-tag">{st.tag}</b> <b>{ex(st.ex).name}</b> · {targetText(state, st)}
          </li>
        ))}
      </ul>
      <button className="btn wide guide-go" onClick={onStart}>
        Start: {label}
      </button>
      <button className="btn ghost sm" onClick={() => onSkip(open.map((st) => st.ex))}>
        {open.length > 1 ? T.skipPart : T.skipEx}
      </button>
    </div>
  );
}

function EffortAsk({ id, onEffort }: { id: ExerciseId; onEffort: (e: EffortKey) => void }) {
  return (
    <div className="grp guide-effort">
      <div className="segline">{T.effort(ex(id).name)}</div>
      <div className="seg" role="group" aria-label={T.effortAria(ex(id).name)}>
        {(Object.keys(EFFORT) as EffortKey[]).map((k) => (
          <button key={k} onClick={() => onEffort(k)}>
            {EFFORT[k].label}
            <br />
            <span style={{ opacity: 0.75, fontSize: '11.5px' }}>{EFFORT[k].sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
