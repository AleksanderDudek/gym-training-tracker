import { useState } from 'react';
import { EFFORT, ex, ladderFor } from '../data/exercises';
import { levelHint, whyText } from '../engine/hints';
import { P, plan, planLabel } from '../engine/plan';
import { exercisePath } from '../routing';
import { Chip, Segmented } from './ui';
import { Timer } from './Timer';
import type { AppState, EffortKey, ExerciseId, SetResult } from '../types';

interface Props {
  state: AppState;
  id: ExerciseId;
  onSave: (id: ExerciseId, rows: SetResult[], effort: EffortKey) => void;
  onClear: (id: ExerciseId) => void;
  onSkip: (id: ExerciseId) => void;
  onToast: (msg: string) => void;
}

export function ExerciseCard({ state, id, onSave, onClear, onSkip, onToast }: Props) {
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
  const unitLabel = timed ? 'sekundy' : 'powtórzenia';
  const unitShort = timed ? 's' : 'powt.';
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
      onToast('Wpisz wynik przynajmniej jednej serii.');
      return;
    }
    onSave(id, out, effort);
  };

  return (
    <div className={`ex${saved ? ' done' : ''}${skipped ? ' skipped' : ''}${open ? ' open' : ''}`}>
      <button className="ex-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chip state={state} id={id} />
        <span>
          <span className="ex-name">{m.name}</span>
          <span className="ex-target">{planLabel(state, id)}</span>
        </span>
        <span className="tick">{skipped ? '–' : '✓'}</span>
      </button>

      {open && (
        <div className="ex-body">
          <p className="hint">{m.hint}</p>
          <a className="vidlink" href={exercisePath(id)}>
            Zobacz technikę na wideo →
          </a>
          <div
            className={`nextlvl${hint.hit ? ' hit' : ''}`}
            dangerouslySetInnerHTML={{ __html: hint.html }}
          />

          {timed && (
            <p className="hint">
              To ćwiczenie mierzy się <b>w sekundach</b>, nie w powtórzeniach.{' '}
              {calib
                ? 'Próba idzie na stoperze: włącz, wytrzymaj tyle, ile dasz radę, zatrzymaj.'
                : 'Odliczanie startuje od przepisanego czasu i samo wpisuje wynik.'}
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
                  <span>{r.amrap ? `${unitLabel} — ile dasz radę` : unitLabel}</span>
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
                    <span>ciężar</span>
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
            {calib
              ? 'Ile zostało w zapasie na koniec próby? Od tego zależy twój poziom startowy.'
              : 'Ile zostało w zapasie po ostatniej serii?'}
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
            <summary>Dlaczego taki cel?</summary>
            <div dangerouslySetInnerHTML={{ __html: whyText(state, id) }} />
          </details>

          <button className="btn wide" onClick={save}>
            {prev ? 'Zaktualizuj wynik' : 'Zapisz wynik'}
          </button>
          <div style={{ height: 9 }} />
          {prev && (
            <>
              <button className="btn ghost wide" onClick={() => onClear(id)}>
                Usuń wynik tego ćwiczenia
              </button>
              <div style={{ height: 9 }} />
            </>
          )}
          <button className="btn ghost wide" onClick={() => onSkip(id)}>
            {skipped ? 'Przywróć do treningu' : 'Pomiń to ćwiczenie'}
          </button>
          {p.trans && (
            <p className="hint" style={{ marginTop: 12 }}>
              Serie oznaczone ▲ robisz cięższym obciążeniem.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
