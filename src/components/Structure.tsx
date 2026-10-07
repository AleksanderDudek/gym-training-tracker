import { EX } from '../data/exercises';
import { blocksOf, tagOf } from '../engine/blocks';
import type { Block } from '../engine/blocks';
import { plural } from '../engine/quips';
import { PAIR_REST_TEXT, platesPerSide, restOf, setupFor, warmupFor } from '../engine/structure';
import type { AppState, ExerciseId, Workout } from '../types';

/**
 * Instrukcja treningu: co przygotować, jak się rozgrzać i w jakiej kolejności robić serie.
 * Ta sama treść stoi w podglądzie treningu i na górze sesji — w sesji zwinięta, gdy pierwsza
 * seria jest już zapisana.
 */

const kg = (n: number): string => `${n.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} kg`;
const name = (id: ExerciseId): string => EX[id]?.name ?? id;
const SET_FORMS = ['seria', 'serie', 'serii'] as const;
const list = (xs: string[]): string => xs.join(', ');

export function PrepContent({ state, workout }: { state: AppState; workout: Workout }) {
  const setup = setupFor(state, workout);
  const warm = warmupFor(state, workout);
  const empty =
    !setup.kettlebells.length && !setup.barbells.length && !setup.dumbbells.length && !setup.machines.length && !setup.other.length;

  return (
    <>
      <h3 className="prep-h">Przygotuj</h3>
      {empty && <p className="tight">Nic nie trzeba — wystarczy kawałek podłogi.</p>}
      {setup.kettlebells.length > 0 && (
        <p className="tight">
          <b>Kettlebell:</b>{' '}
          {setup.kettlebells.map((k, i) => (
            <span key={k.kg}>
              {i ? '; ' : ''}
              {kg(k.kg)} — {list(k.for)}
            </span>
          ))}
          .
        </p>
      )}
      {setup.barbells.length > 0 && (
        <p className="tight">
          <b>Sztanga (gryf 20 kg):</b>{' '}
          {setup.barbells.map((b, i) => (
            <span key={b.id}>
              {i ? '; ' : ''}
              {b.name} {kg(b.kg)}
              {platesPerSide(b.kg) > 0 ? ` — po ${kg(platesPerSide(b.kg))} na stronę` : ' — sam gryf'}
            </span>
          ))}
          .
        </p>
      )}
      {setup.dumbbells.length > 0 && (
        <p className="tight">
          <b>Hantle:</b>{' '}
          {setup.dumbbells.map((d, i) => (
            <span key={d.kg}>
              {i ? '; ' : ''}
              {kg(d.kg)} — {list(d.for)}
            </span>
          ))}
          .
        </p>
      )}
      {setup.other.length > 0 && (
        <p className="tight">
          <b>Do tego:</b> {list(setup.other)}.
        </p>
      )}
      {setup.machines.length > 0 && (
        <>
          <p className="tight">
            <b>Znajdź na sali, zanim zaczniesz:</b>
          </p>
          <ul className="prep-list">
            {setup.machines.map((m) => (
              <li key={m.name}>
                <b>{m.name}</b> —{' '}
                {m.uses.map((u, i) => (
                  <span key={u.id}>
                    {i ? '; ' : ''}
                    {u.name}
                    {u.alt.length > 0 && ` (zajęta? ${u.alt.join(' albo ')})`}
                  </span>
                ))}
                .
              </li>
            ))}
          </ul>
          <p className="hint">
            Gdy maszyna jest zajęta, zrób w tym czasie następny blok i wróć — kolejność bloków to
            zalecenie, nie przepis. Albo w sesji stuknij „Zamień” przy ćwiczeniu: wynik trafi do
            historii zamiennika.
          </p>
        </>
      )}

      <h3 className="prep-h">Rozgrzewka</h3>
      <p className="tight">{warm.general}</p>
      {warm.ramps.length > 0 && (
        <ul className="prep-list">
          {warm.ramps.map((r) => (
            <li key={r.id}>
              <b>{r.name}:</b>{' '}
              {r.sets.length
                ? `${r.sets.map((x) => `${kg(x.kg)} × ${x.reps}`).join(', ')}, potem serie robocze.`
                : r.text}
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{warm.after}</p>
    </>
  );
}

/** Pole „przygotuj” w podglądzie treningu. */
export function PrepCard({ state, workout }: { state: AppState; workout: Workout }) {
  return (
    <div className="grp prep">
      <h2>Przed treningiem</h2>
      <PrepContent state={state} workout={workout} />
    </div>
  );
}

/** Jak robić blok — jednym zdaniem pod nazwą ćwiczenia. `sets` to liczba serii na dziś. */
export function cueFor(b: Block, i: number, sets: (id: ExerciseId) => number): string {
  const id = b.ids[i]!;
  if (b.kind === 'straight') {
    const n = sets(id);
    return `${n} ${plural(n, SET_FORMS)}${n > 1 ? ' pod rząd' : ''} · przerwa ${restOf(id)}`;
  }
  const j = i === 0 ? 1 : 0;
  return `na zmianę z ${tagOf(b, j)} ${name(b.ids[j]!)} · przerwa ${PAIR_REST_TEXT}`;
}

/** Nagłówek pary: co robić po kolei. */
export function PairHead({ b, sets }: { b: Block; sets: (id: ExerciseId) => number }) {
  const [a, c] = b.ids as [ExerciseId, ExerciseId];
  const na = sets(a);
  const nc = sets(c);
  return (
    <div className="pair-head">
      <b>Para {b.n} — na zmianę</b>
      <span>
        Seria {b.n}A, {PAIR_REST_TEXT} przerwy, seria {b.n}B, {PAIR_REST_TEXT} przerwy — i znów {b.n}A,
        aż obie skończą serie
        {na === nc ? ` (po ${na})` : ` (${na} i ${nc}; nadwyżkę jednego dokończ z jego zwykłą przerwą)`}.
      </span>
    </div>
  );
}

export { blocksOf, tagOf };
