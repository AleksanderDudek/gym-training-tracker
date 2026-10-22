import { EX } from '../data/exercises';
import { blocksOf, tagOf } from '../engine/blocks';
import type { Block } from '../engine/blocks';
import { plural } from '../engine/quips';
import { CIRCUIT_MOVE, restLabel } from '../engine/rests';
import { PAIR_REST_TEXT, platesPerSide, restOf, setupFor, warmupFor } from '../engine/structure';
import type { AppState, ExerciseId, Workout } from '../types';
import { LOCALE, pluralEn, text } from '../i18n';

const T = text({
  pl: {
    rounds: (n: number) => plural(n, ['runda', 'rundy', 'rund']),
    prepare: 'Przygotuj',
    nothing: 'Nic nie trzeba — wystarczy kawałek podłogi.',
    barbell: 'Sztanga (gryf 20 kg):',
    perSide: (kg: string) => ` — po ${kg} na stronę`,
    bareBar: ' — sam gryf',
    dumbbells: 'Hantle:',
    plus: 'Do tego:',
    findMachines: 'Znajdź na sali, zanim zaczniesz:',
    taken: (alts: string[]) => ` (zajęta? ${alts.join(' albo ')})`,
    machineHint:
      'Gdy maszyna jest zajęta, zrób w tym czasie następny blok i wróć — kolejność bloków to zalecenie, nie przepis. Albo w sesji stuknij „Zamień” przy ćwiczeniu: wynik trafi do historii zamiennika.',
    warmup: 'Rozgrzewka',
    thenWorking: (ramp: string) => `${ramp}, potem serie robocze.`,
    before: 'Przed treningiem',
    straight: (n: number, rest: string) =>
      `${n} ${plural(n, ['seria', 'serie', 'serii'])}${n > 1 ? ' pod rząd' : ''} · przerwa ${rest}`,
    station: (i: number, of: number, rounds: string) => `stacja ${i} z ${of} · ${rounds}`,
    alternate: (tag: string, name: string, rest: string) => `na zmianę z ${tag} ${name} · przerwa ${rest}`,
    circuitHead: (n: number, rounds: string) => `Obwód ${n} — ${rounds}`,
    circuitText: (n: number, last: string, move: number, rest: string) =>
      `Stacje ${n}A–${last} po kolei, ok. ${move} s na przejście między nimi; po każdej rundzie ${rest} przerwy. Stacja z mniejszą liczbą serii odpada z ostatnich rund.`,
    pairHead: (n: number) => `Para ${n} — na zmianę`,
    pairText: (n: number, rest: string, tail: string) =>
      `Seria ${n}A, ${rest} przerwy, seria ${n}B, ${rest} przerwy — i znów ${n}A, aż obie skończą serie${tail}.`,
    each: (n: number) => ` (po ${n})`,
    uneven: (a: number, b: number) => ` (${a} i ${b}; nadwyżkę jednego dokończ z jego zwykłą przerwą)`,
  },
  en: {
    rounds: (n: number) => pluralEn(n, 'round', 'rounds'),
    prepare: 'Get ready',
    nothing: 'Nothing needed — a bit of floor will do.',
    barbell: 'Barbell (20 kg bar):',
    perSide: (kg: string) => ` — ${kg} per side`,
    bareBar: ' — just the bar',
    dumbbells: 'Dumbbells:',
    plus: 'Plus:',
    findMachines: 'Find these in the gym before you start:',
    taken: (alts: string[]) => ` (taken? ${alts.join(' or ')})`,
    machineHint:
      'If a machine is taken, do the next block in the meantime and come back — the block order is a suggestion, not a rule. Or tap “Swap” next to the exercise during the session: the result goes into the substitute’s history.',
    warmup: 'Warm-up',
    thenWorking: (ramp: string) => `${ramp}, then your working sets.`,
    before: 'Before the workout',
    straight: (n: number, rest: string) =>
      `${n} ${pluralEn(n, 'set', 'sets')}${n > 1 ? ' in a row' : ''} · rest ${rest}`,
    station: (i: number, of: number, rounds: string) => `station ${i} of ${of} · ${rounds}`,
    alternate: (tag: string, name: string, rest: string) => `alternate with ${tag} ${name} · rest ${rest}`,
    circuitHead: (n: number, rounds: string) => `Circuit ${n} — ${rounds}`,
    circuitText: (n: number, last: string, move: number, rest: string) =>
      `Stations ${n}A–${last} in order, about ${move} s to move between them; after each round, ${rest} rest. A station with fewer sets drops out of the last rounds.`,
    pairHead: (n: number) => `Pair ${n} — alternating`,
    pairText: (n: number, rest: string, tail: string) =>
      `Set ${n}A, ${rest} rest, set ${n}B, ${rest} rest — then ${n}A again, until both have finished their sets${tail}.`,
    each: (n: number) => ` (${n} each)`,
    uneven: (a: number, b: number) => ` (${a} and ${b}; finish the extra sets of one with its usual rest)`,
  },
});

/**
 * Instrukcja treningu: co przygotować, jak się rozgrzać i w jakiej kolejności robić serie.
 * Ta sama treść stoi w podglądzie treningu i na górze sesji — w sesji zwinięta, gdy pierwsza
 * seria jest już zapisana.
 */

const kg = (n: number): string => `${n.toLocaleString(LOCALE, { maximumFractionDigits: 2 })} kg`;
const name = (id: ExerciseId): string => EX[id]?.name ?? id;
const list = (xs: string[]): string => xs.join(', ');

export function PrepContent({ state, workout }: { state: AppState; workout: Workout }) {
  const setup = setupFor(state, workout);
  const warm = warmupFor(state, workout);
  const empty =
    !setup.kettlebells.length && !setup.barbells.length && !setup.dumbbells.length && !setup.machines.length && !setup.other.length;

  return (
    <>
      <h3 className="prep-h">{T.prepare}</h3>
      {empty && <p className="tight">{T.nothing}</p>}
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
          <b>{T.barbell}</b>{' '}
          {setup.barbells.map((b, i) => (
            <span key={b.id}>
              {i ? '; ' : ''}
              {b.name} {kg(b.kg)}
              {platesPerSide(b.kg) > 0 ? T.perSide(kg(platesPerSide(b.kg))) : T.bareBar}
            </span>
          ))}
          .
        </p>
      )}
      {setup.dumbbells.length > 0 && (
        <p className="tight">
          <b>{T.dumbbells}</b>{' '}
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
          <b>{T.plus}</b> {list(setup.other)}.
        </p>
      )}
      {setup.machines.length > 0 && (
        <>
          <p className="tight">
            <b>{T.findMachines}</b>
          </p>
          <ul className="prep-list">
            {setup.machines.map((m) => (
              <li key={m.name}>
                <b>{m.name}</b> —{' '}
                {m.uses.map((u, i) => (
                  <span key={u.id}>
                    {i ? '; ' : ''}
                    {u.name}
                    {u.alt.length > 0 && T.taken(u.alt)}
                  </span>
                ))}
                .
              </li>
            ))}
          </ul>
          <p className="hint">{T.machineHint}</p>
        </>
      )}

      <h3 className="prep-h">{T.warmup}</h3>
      <p className="tight">{warm.general}</p>
      {warm.ramps.length > 0 && (
        <ul className="prep-list">
          {warm.ramps.map((r) => (
            <li key={r.id}>
              <b>{r.name}:</b>{' '}
              {r.sets.length
                ? T.thenWorking(r.sets.map((x) => `${kg(x.kg)} × ${x.reps}`).join(', '))
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
      <h2>{T.before}</h2>
      <PrepContent state={state} workout={workout} />
    </div>
  );
}

/**
 * Jak robić blok — jednym zdaniem pod nazwą ćwiczenia. `sets` to liczba serii na dziś,
 * `rest` — przerwa z treningu, gdy ją podaje (inaczej z rodzaju ćwiczenia).
 */
export function cueFor(b: Block, i: number, sets: (id: ExerciseId) => number, rest?: number): string {
  const id = b.ids[i]!;
  if (b.kind === 'straight') {
    const n = sets(id);
    return T.straight(n, rest ? restLabel(rest) : restOf(id));
  }
  if (b.kind === 'circuit') {
    const n = sets(id);
    return T.station(i + 1, b.ids.length, `${n} ${T.rounds(n)}`);
  }
  const j = i === 0 ? 1 : 0;
  return T.alternate(tagOf(b, j), name(b.ids[j]!), PAIR_REST_TEXT);
}

/** Nagłówek obwodu: stacje po kolei, krótkie przejścia, pełna przerwa po rundzie. */
export function CircuitHead({ b, sets, roundRest }: { b: Block; sets: (id: ExerciseId) => number; roundRest: number }) {
  const rounds = Math.max(...b.ids.map(sets));
  const last = tagOf(b, b.ids.length - 1);
  return (
    <div className="pair-head">
      <b>{T.circuitHead(b.n, `${rounds} ${T.rounds(rounds)}`)}</b>
      <span>{T.circuitText(b.n, last, CIRCUIT_MOVE, restLabel(roundRest))}</span>
    </div>
  );
}

/** Nagłówek pary: co robić po kolei. */
export function PairHead({ b, sets }: { b: Block; sets: (id: ExerciseId) => number }) {
  const [a, c] = b.ids as [ExerciseId, ExerciseId];
  const na = sets(a);
  const nc = sets(c);
  return (
    <div className="pair-head">
      <b>{T.pairHead(b.n)}</b>
      <span>{T.pairText(b.n, PAIR_REST_TEXT, na === nc ? T.each(na) : T.uneven(na, nc))}</span>
    </div>
  );
}

export { blocksOf, tagOf };
