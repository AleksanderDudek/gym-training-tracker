import { useState, type ReactNode } from 'react';
import { EFFORT, ex, ladderFor } from '../data/exercises';
import { EX_JOKES } from '../data/exjokes';
import { levelHint, whyText } from '../engine/hints';
import { P, plan, planLabel } from '../engine/plan';
import { exercisePath } from '../routing';
import { Chip, Segmented } from './ui';
import { Timer } from './Timer';
import type { AppState, EffortKey, ExerciseId, SetResult } from '../types';
import { text } from '../i18n';

const T = text({
  pl: {
    secs: 'sekundy',
    reps: 'powtórzenia',
    secsShort: 's',
    repsShort: 'powt.',
    needOne: 'Wpisz wynik przynajmniej jednej serii.',
    video: 'Zobacz technikę na wideo →',
    swappedFor: (name: string) => `Zamiennik za: ${name}.`,
    swapToday: 'Maszyna zajęta albo brak sprzętu? Zamień na dziś:',
    backTo: (name: string) => `Wróć do: ${name}`,
    timed: (
      <>
        To ćwiczenie mierzy się <b>w sekundach</b>, nie w powtórzeniach.
      </>
    ) as ReactNode,
    calibTimer: 'Próba idzie na stoperze: włącz, wytrzymaj tyle, ile dasz radę, zatrzymaj.',
    countTimer: 'Odliczanie startuje od przepisanego czasu i samo wpisuje wynik.',
    amrap: (unit: string) => `${unit} — ile dasz radę`,
    weight: 'ciężar',
    calibEffort: 'Ile zostało w zapasie na koniec próby? Od tego zależy twój poziom startowy.',
    effort: 'Ile zostało w zapasie po ostatniej serii?',
    why: 'Dlaczego taki cel?',
    update: 'Zaktualizuj wynik',
    save: 'Zapisz wynik',
    clear: 'Usuń wynik tego ćwiczenia',
    restore: 'Przywróć do treningu',
    skip: 'Pomiń to ćwiczenie',
    heavy: 'Serie oznaczone ▲ robisz cięższym obciążeniem.',
  },
  en: {
    secs: 'seconds',
    reps: 'reps',
    secsShort: 's',
    repsShort: 'reps',
    needOne: 'Enter a result for at least one set.',
    video: 'Watch the technique video →',
    swappedFor: (name: string) => `Swapped in for: ${name}.`,
    swapToday: 'Machine taken or no equipment? Swap for today:',
    backTo: (name: string) => `Back to: ${name}`,
    timed: (
      <>
        This exercise is measured <b>in seconds</b>, not reps.
      </>
    ) as ReactNode,
    calibTimer: 'The test set runs on the stopwatch: start it, hold as long as you can, then stop.',
    countTimer: 'The countdown starts from the prescribed time and fills in the result by itself.',
    amrap: (unit: string) => `${unit} — as many as you can`,
    weight: 'weight',
    calibEffort: 'How much was left in the tank at the end of the test set? Your starting level depends on it.',
    effort: 'How much was left in the tank after the last set?',
    why: 'Why this target?',
    update: 'Update result',
    save: 'Save result',
    clear: 'Delete this exercise’s result',
    restore: 'Put back into the workout',
    skip: 'Skip this exercise',
    heavy: 'Sets marked ▲ are done with a heavier weight.',
  },
});

interface Props {
  state: AppState;
  id: ExerciseId;
  onSave: (id: ExerciseId, rows: SetResult[], effort: EffortKey) => void;
  onClear: (id: ExerciseId) => void;
  onSkip: (id: ExerciseId) => void;
  onToast: (msg: string) => void;
  /** Miejsce w treningu: „3” albo „2A” w parze. */
  tag?: string | undefined;
  /** Jak robić: „3 serie pod rząd · przerwa 2–3 min” albo „na zmianę z 2B …”. */
  cue?: string | undefined;
  /** Zamiana na dziś: ćwiczenie z treningu i to, na co da się je zamienić (z nim samym, gdy już zamienione). */
  swaps?: { orig: ExerciseId; options: ExerciseId[] } | undefined;
  onSwap?: ((orig: ExerciseId, to: ExerciseId) => void) | undefined;
}

export function ExerciseCard({ state, id, onSave, onClear, onSkip, onToast, tag, cue, swaps, onSwap }: Props) {
  const session = state.session!;
  const m = ex(id);
  const p = P(state, id);
  const rows = plan(state, id);
  const prev = session.res[id];
  const saved = Boolean(session.done[id]);
  const skipped = Boolean(session.skip[id]);

  const [open, setOpen] = useState(false);
  const [effort, setEffort] = useState<EffortKey>(prev?.effort ?? 'solid');
  const [values, setValues] = useState<string[]>(() =>
    // Seria testowa startuje pusta — podpowiedziana liczba sugerowałaby cel, a testu
    // nie da się „zaliczyć”; ma pokazać, ile naprawdę wychodzi.
    rows.map((r, i) => String(prev?.rows[i]?.reps ?? (r.amrap ? '' : r.reps))),
  );
  const [weights, setWeights] = useState<(number | null)[]>(() =>
    rows.map((r, i) => prev?.rows[i]?.w ?? r.w),
  );

  const hint = levelHint(state, id, values, effort);
  const timed = m.unit === 'secs';
  const unitLabel = timed ? T.secs : T.reps;
  const unitShort = timed ? T.secsShort : T.repsShort;
  const calib = p.phase === 'calib';

  const setValue = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    setValues(next);
  };

  const save = () => {
    const out: SetResult[] = values.map((v, i) => ({
      reps: parseInt(v || '0', 10) || 0,
      w: weights[i] ?? null,
    }));
    if (!out.some((r) => r.reps > 0)) {
      onToast(T.needOne);
      return;
    }
    onSave(id, out, effort);
  };

  return (
    <div className={`ex${saved ? ' done' : ''}${skipped ? ' skipped' : ''}${open ? ' open' : ''}`}>
      <button className="ex-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chip state={state} id={id} />
        <span>
          <span className="ex-name">
            {tag && <b className="ex-tag">{tag}</b>}
            {m.name}
          </span>
          <span className="ex-target">{planLabel(state, id)}</span>
          {cue && <span className="ex-cue">{cue}</span>}
        </span>
        <span className="tick">{skipped ? '–' : '✓'}</span>
      </button>

      {open && (
        <div className="ex-body">
          <p className="hint">{m.hint}</p>
          {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
          <a className="vidlink" href={exercisePath(id)}>
            {T.video}
          </a>
          {swaps && onSwap && swaps.options.length > 0 && !saved && (
            <div className="swaprow">
              <span>
                {swaps.orig !== id ? T.swappedFor(ex(swaps.orig).name) : T.swapToday}
              </span>
              {swaps.options.map((o) => (
                <button key={o} type="button" className="btn ghost sm" onClick={() => onSwap(swaps.orig, o)}>
                  {o === swaps.orig ? T.backTo(ex(o).name) : ex(o).name}
                </button>
              ))}
            </div>
          )}
          <div
            className={`nextlvl${hint.hit ? ' hit' : ''}`}
            dangerouslySetInnerHTML={{ __html: hint.html }}
          />

          {timed && (
            <p className="hint">
              {T.timed}{' '}
              {calib ? T.calibTimer : T.countTimer}
            </p>
          )}

          {rows.map((r, i) => (
            <div key={i}>
              <div className={`setrow${r.heavy ? ' heavy' : ''}`}>
                <span className={`setno${r.amrap ? ' test' : ''}`}>
                  {r.amrap ? 'test' : i + 1}
                  {r.heavy ? '▲' : ''}
                </span>
                <label className="fld">
                  <span>{r.amrap ? T.amrap(unitLabel) : unitLabel}</span>
                  <span className="withunit">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={r.amrap ? 'max' : String(r.reps)}
                      value={values[i] ?? ''}
                      onChange={(e) => setValue(i, e.target.value)}
                    />
                    <i>{unitShort}</i>
                  </span>
                </label>
                {r.w !== null ? (
                  <label className="fld">
                    <span>{T.weight}</span>
                    <select
                      value={String(weights[i] ?? r.w)}
                      onChange={(e) => {
                        const next = [...weights];
                        next[i] = Number(e.target.value);
                        setWeights(next);
                      }}
                    >
                      {ladderFor(state, id).map((x) => (
                        <option key={x} value={x}>
                          {x} kg
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span />
                )}
              </div>
              {timed && (
                <Timer
                  mode={r.amrap ? 'stopwatch' : 'count'}
                  target={r.reps}
                  onDone={(secs) => setValue(i, String(secs))}
                />
              )}
            </div>
          ))}

          <div className="segline">
            {calib ? T.calibEffort : T.effort}
          </div>
          <Segmented
            value={effort}
            onChange={setEffort}
            options={(Object.keys(EFFORT) as EffortKey[]).map((k) => ({
              key: k,
              label: (
                <>
                  {EFFORT[k].label}
                  <br />
                  <span style={{ opacity: 0.75, fontSize: '11.5px' }}>{EFFORT[k].sub}</span>
                </>
              ),
            }))}
          />

          <details className="why">
            <summary>{T.why}</summary>
            <div dangerouslySetInnerHTML={{ __html: whyText(state, id) }} />
          </details>

          <button className="btn wide" onClick={save}>
            {prev ? T.update : T.save}
          </button>
          <div style={{ height: 9 }} />
          {prev && (
            <>
              <button className="btn ghost wide" onClick={() => onClear(id)}>
                {T.clear}
              </button>
              <div style={{ height: 9 }} />
            </>
          )}
          <button className="btn ghost wide" onClick={() => onSkip(id)}>
            {skipped ? T.restore : T.skip}
          </button>
          {p.trans && (
            <p className="hint" style={{ marginTop: 12 }}>
              {T.heavy}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
