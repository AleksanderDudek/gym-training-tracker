import { useEffect, useState } from 'react';
import { ex } from '../data/exercises';
import { blockDone } from '../engine/clock';
import type { Block } from '../engine/blocks';
import type { Step } from '../engine/steps';
import { formatClock } from './Timer';
import type { Session } from '../types';
import { text } from '../i18n';

const T = text({
  pl: {
    clockAria: (min: number) => `Czas treningu: ${min} min`,
    onStraight: 'na tym ćwiczeniu',
    onPair: 'na tej parze',
    onCircuit: 'na tym obwodzie',
    done: 'zrobiona',
    skip: 'pominięta',
    now: 'teraz',
    next: 'przed tobą',
    partsAria: 'Części treningu',
    partSr: (n: number, names: string, state: string) => `Część ${n}: ${names} — ${state}`,
    partOf: (n: number, of: number) => `Część ${n} z ${of}`,
  },
  en: {
    clockAria: (min: number) => `Workout time: ${min} min`,
    onStraight: 'on this exercise',
    onPair: 'on this pair',
    onCircuit: 'on this circuit',
    done: 'done',
    skip: 'skipped',
    now: 'now',
    next: 'up next',
    partsAria: 'Workout parts',
    partSr: (n: number, names: string, state: string) => `Part ${n}: ${names} — ${state}`,
    partOf: (n: number, of: number) => `Part ${n} of ${of}`,
  },
});

/**
 * Zegar sesji na ekranie: licznik w pasku aplikacji i pasek części nad serią.
 *
 * Liczby liczą się z chwil zapisanych w sesji (`session.clock`), a nie z tyknięć, więc
 * zgaszony ekran, schowana karta i odświeżenie niczego nie przekłamują — tyknięcia tylko
 * odświeżają rysunek.
 */

/**
 * Teraz, odświeżane raz na sekundę, póki karta jest na ekranie — równo z pełnymi sekundami
 * liczonymi od `origin`, żeby licznik nie przeskakiwał sekundy przy rozjechanym interwale.
 * Schowana karta nie rysuje: po powrocie liczba i tak jest dobra.
 */
export function useSecondTick(origin: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: number | undefined;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const into = (((n - origin) % 1000) + 1000) % 1000;
      t = window.setTimeout(tick, 1000 - into + 5);
    };
    const run = () => {
      window.clearTimeout(t);
      t = undefined;
      if (document.visibilityState === 'visible') tick();
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', run);
    };
  }, [origin]);
  return now;
}

/** Sekundy od chwili `from` do teraz, bez ułamków i nigdy poniżej zera. */
export const secsSince = (from: number, now: number): number => Math.max(0, Math.floor((now - from) / 1000));

/**
 * Licznik w pasku: ile trwa trening. Czytnik ekranu dostaje same minuty — `role="timer"`
 * i tak nie ogłasza zmian sam z siebie, a etykieta zmieniana co sekundę byłaby szumem.
 */
export function ClockPill({ begin }: { begin: number }) {
  const now = useSecondTick(begin);
  const secs = secsSince(begin, now);
  return (
    <div className="clock-pill" role="timer" aria-label={T.clockAria(Math.floor(secs / 60))}>
      {formatClock(secs)}
    </div>
  );
}

const ON_PART: Record<Block['kind'], string> = {
  straight: T.onStraight,
  pair: T.onPair,
  circuit: T.onCircuit,
};

type PartState = 'done' | 'skip' | 'now' | 'next';

const PART_STATE: Record<PartState, string> = {
  done: T.done,
  skip: T.skip,
  now: T.now,
  next: T.next,
};

/**
 * Pasek części: zrobione, bieżąca i następne, a pod nim czas na bieżącej części. Stan
 * niesie też kształt (pełny, obrys, kreska) i tekst dla czytnika, nie tylko kolor.
 */
export function PartStrip({
  session,
  steps,
  blocks,
  current,
}: {
  session: Session;
  steps: readonly Step[];
  blocks: readonly Block[];
  /** Numer bieżącej części (bloku). */
  current: number;
}) {
  const start = session.clock?.parts[current]?.start;
  const now = useSecondTick(start ?? 0);
  if (!session.clock) return null;
  const idx = blocks.findIndex((b) => b.n === current);
  const kind = blocks[idx]?.kind ?? 'straight';
  const stateOf = (b: Block): PartState => {
    if (b.n === current) return 'now';
    if (!blockDone(steps, session, b.n)) return 'next';
    return b.ids.every((id) => session.skip[id]) ? 'skip' : 'done';
  };
  return (
    <div className="part-strip">
      <ol className="part-segs" aria-label={T.partsAria}>
        {blocks.map((b) => {
          const st = stateOf(b);
          return (
            <li key={b.n} className={`part-seg ${st}`}>
              <span className="sr-only">{T.partSr(b.n, b.ids.map((id) => ex(id).name).join(' + '), PART_STATE[st])}</span>
            </li>
          );
        })}
      </ol>
      <p className="part-line">
        {T.partOf(idx + 1, blocks.length)}
        {start !== undefined && ` · ${ON_PART[kind]} ${formatClock(secsSince(start, now))}`}
      </p>
    </div>
  );
}
