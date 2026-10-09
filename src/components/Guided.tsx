import { useEffect, useRef, useState } from 'react';
import { EFFORT, READY, ex, ladderFor } from '../data/exercises';
import { EX_JOKES } from '../data/exjokes';
import { plan } from '../engine/plan';
import { restBetween, restLabel } from '../engine/rests';
import { cursorOf, loggedSets, sessionSteps } from '../engine/steps';
import type { Step } from '../engine/steps';
import type { RestPlan } from '../engine/rests';
import { keepAwake, signalOnce, unlockSound } from '../coach';
import { exercisePath } from '../routing';
import { PrepContent } from './Structure';
import { Segmented } from './ui';
import { Timer, formatClock } from './Timer';
import type { AppState, EffortKey, ExerciseId, ReadyKey, SetResult, Workout } from '../types';

/**
 * Prowadzenie sesji: na ekranie jest tylko to, co trzeba zrobić teraz — jedna seria, a po
 * „Zrobione” odliczana przerwa i zapowiedź następnej serii. Liczby wpisuje się po serii,
 * nie po całym ćwiczeniu, z podpowiedzią celu, więc zwykle wystarczy jedno stuknięcie.
 *
 * Ocena „ile zostało w zapasie” pada raz na ćwiczenie, po jego ostatniej serii, w trakcie
 * przerwy — na niej stoi progresja. Widok listy zostaje pod ręką: oba czytają ten sam zapis.
 */

interface Props {
  state: AppState;
  /** Trening na dziś — z zamianami. */
  workout: Workout;
  onReady: (r: ReadyKey) => void;
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
  set: 'Przerwa',
  pair: 'Przejście do pary',
  move: 'Następna stacja',
  round: 'Przerwa po rundzie',
  next: 'Przerwa przed kolejnym ćwiczeniem',
};

/** „Seria 2 z 3”, w obwodzie „Runda 2 z 3 · stacja 3 z 7”. */
function where(step: Step, steps: readonly Step[]): string {
  if (step.kind !== 'circuit') return `Seria ${step.set} z ${step.of}`;
  const stations = new Set(steps.filter((s) => s.block === step.block).map((s) => s.ex));
  const pos = [...stations].indexOf(step.ex) + 1;
  return `Runda ${step.round} z ${step.rounds} · stacja ${pos} z ${stations.size}`;
}

/** Cel serii słowami: „10 powt. · 16 kg”, „30 s”, „ile dasz radę”. */
function targetText(state: AppState, step: Step): string {
  const r = plan(state, step.ex)[step.set - 1];
  if (!r) return '';
  const m = ex(step.ex);
  if (r.amrap) return `ile dasz radę${r.w !== null ? ` · ${r.w} kg` : ''}`;
  const amount = m.unit === 'secs' ? `${r.reps} s` : `${r.reps} powt.`;
  return `${amount}${m.side ? ' na stronę' : ''}${r.w !== null ? ` · ${r.w} kg` : ''}`;
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
  const cursor = cursorOf(steps, session);
  const anyLogged = Object.values(session.res).some((r) => r.rows.length);
  const [begun, setBegun] = useState(anyLogged);
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

  if (!begun && !anyLogged)
    return (
      <Start
        {...props}
        onBegin={() => {
          unlockSound();
          setBegun(true);
        }}
      />
    );

  const step = cursor >= 0 ? steps[cursor]! : null;
  const upcoming = (from: number) =>
    steps.slice(from).find((s) => !session.skip[s.ex] && !session.done[s.ex] && loggedSets(session, s.ex) < s.set) ?? null;

  return (
    <div className="wrap guide">
      {resting && rest ? (
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
            props.onToast(`${ex(step.ex).name} pominięte na dziś.`);
          }}
        />
      ) : (
        <div className="grp guide-done">
          <h2>Wszystkie serie zrobione</h2>
          <p className="tight">Zamknij trening, a aplikacja przeliczy poziomy i ustawi cele na następny raz.</p>
        </div>
      )}

      {pendingEffort.map((id) => (
        <EffortAsk key={id} id={id} onEffort={(e) => props.onEffort(id, e)} />
      ))}

      {!resting && step && (() => {
        const n = upcoming(cursor + 1);
        return n ? (
          <p className="hint guide-next">
            Potem: <b>{ex(n.ex).name}</b> · {where(n, steps).toLowerCase()} · {targetText(state, n)}
          </p>
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
              Cofnij serię: {ex(last).name}
            </button>
          ) : null;
        })()}
        <button className="btn ghost sm" onClick={props.onList}>
          Lista ćwiczeń
        </button>
        <button className={`btn${cursor < 0 ? '' : ' ghost'} sm`} onClick={props.onFinish}>
          Zamknij trening
        </button>
      </div>
    </div>
  );
}

function Start({ state, workout, onReady, onList, onBegin }: Props & { onBegin: () => void }) {
  const session = state.session!;
  const steps = sessionSteps(state, workout);
  return (
    <div className="wrap guide">
      {session.deload && (
        <div className="dnote tip" style={{ marginTop: 12 }}>
          <b>Tydzień lżejszy</b>
          <p className="tight">Mniej serii niż zwykle i bez testu „ile dasz radę”. Zostaw 2–3 powtórzenia zapasu.</p>
        </div>
      )}
      <div className="segline">Jak się dziś czujesz? Wpływa na dzisiejsze cele, nie na twoje poziomy.</div>
      <Segmented
        label="Samopoczucie"
        value={session.ready}
        onChange={onReady}
        options={(Object.keys(READY) as ReadyKey[]).map((k) => ({ key: k, label: READY[k] }))}
      />
      <details className="prep prep-session" open>
        <summary>Przygotowanie stanowiska i rozgrzewka</summary>
        <PrepContent state={state} workout={workout} />
      </details>
      <p className="hint" style={{ marginTop: 10 }}>
        {steps.length} {steps.length === 1 ? 'seria' : steps.length < 5 ? 'serie' : 'serii'} po kolei. Po każdej
        stuknij „Zrobione” — przerwa odliczy się sama, a telefon zapika, kiedy minie.
      </p>
      <button className="btn wide" onClick={onBegin}>
        Zaczynam
      </button>
      <div className="guide-foot">
        <button className="btn ghost sm" onClick={onList}>
          Lista ćwiczeń
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
      {rested && <p className="guide-ready">Przerwa minęła — czas na serię.</p>}
      <div className="guide-where">
        <b className="ex-tag">{step.tag}</b> {where(step, steps)}
      </div>
      <h2 className="guide-name">{m.name}</h2>
      <p className="guide-target">{targetText(state, step)}</p>

      <div className="guide-entry">
        <button className="btn ghost step" aria-label="Mniej" onClick={() => setValue(String(Math.max(0, n - 1)))}>
          −
        </button>
        <label className="fld">
          <span>{timed ? 'sekundy' : 'powtórzenia'}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={r?.amrap ? 'max' : ''}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="btn ghost step" aria-label="Więcej" onClick={() => setValue(String(n + 1))}>
          +
        </button>
      </div>
      {r && r.w !== null && (
        <label className="fld guide-weight">
          <span>ciężar</span>
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
        Zrobione
      </button>

      <details className="why">
        <summary>Technika</summary>
        <p className="hint">{m.hint}</p>
        {EX_JOKES[step.ex] && <p className="exjoke">{EX_JOKES[step.ex]}</p>}
        <a className="vidlink" href={exercisePath(step.ex)}>
          Zobacz technikę →
        </a>
      </details>
      <button className="btn ghost sm" onClick={onSkip}>
        Pomiń to ćwiczenie dziś
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
      <div className="guide-clock" role="timer" aria-label={`Do końca przerwy ${formatClock(left)}`}>
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
          Pomiń przerwę
        </button>
      </div>
      {next && (
        <p className="guide-up">
          Teraz przygotuj: <b>{ex(next.ex).name}</b> · {where(next, steps).toLowerCase()} · {targetText(state, next)}
        </p>
      )}
    </div>
  );
}

function EffortAsk({ id, onEffort }: { id: ExerciseId; onEffort: (e: EffortKey) => void }) {
  return (
    <div className="grp guide-effort">
      <div className="segline">
        <b>{ex(id).name}</b> — ile zostało w zapasie po ostatniej serii?
      </div>
      <div className="seg" role="group" aria-label={`Zapas po ćwiczeniu ${ex(id).name}`}>
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
