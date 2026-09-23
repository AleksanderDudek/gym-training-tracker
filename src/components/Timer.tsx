import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sekundy w formacie zegara. Powyżej minuty człowiek czyta „1:30” szybciej niż „90 s”,
 * poniżej — odwrotnie, więc krótkie czasy zostają gołą liczbą.
 */
export function formatClock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type TimerMode = 'count' | 'stopwatch';

/**
 * Stoper ćwiczeń na czas.
 *
 * `stopwatch` mierzy w górę — używany przy próbie i teście, gdzie nie ma celu, tylko pytanie
 * „ile wytrzymasz”. `count` odlicza do zera od przepisanego czasu; po drodze widać, ile
 * zostało, a nie ile minęło, bo to jest pytanie, które zadaje sobie ktoś w desce.
 *
 * Czas liczy się z różnicy znaczników czasu, a nie z liczby tyknięć: karta w tle dostaje
 * rzadsze `setInterval`, więc licznik oparty na tyknięciach zostawałby w tyle.
 */
export function Timer({
  mode,
  target,
  onDone,
}: {
  mode: TimerMode;
  /** Czas do odliczenia w sekundach. Ignorowany przez stoper. */
  target: number;
  /** Zatrzymanie albo koniec odliczania — przekazuje zmierzone sekundy. */
  onDone: (secs: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const base = useRef(0);

  const tick = useCallback(() => {
    setElapsed(base.current + (Date.now() - startedAt.current) / 1000);
  }, []);

  useEffect(() => {
    if (!running) return;
    const h = window.setInterval(tick, 200);
    return () => window.clearInterval(h);
  }, [running, tick]);

  const left = mode === 'count' ? Math.max(0, target - elapsed) : 0;
  const done = mode === 'count' && running && left <= 0;

  // Odliczanie zatrzymuje się samo na zerze i od razu wpisuje pełny czas do formularza.
  useEffect(() => {
    if (!done) return;
    setRunning(false);
    base.current = target;
    setElapsed(target);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 60, 120]);
    onDone(target);
  }, [done, target, onDone]);

  const start = () => {
    startedAt.current = Date.now();
    base.current = elapsed;
    setRunning(true);
  };

  const stop = () => {
    tick();
    setRunning(false);
    base.current = elapsed;
    onDone(Math.round(mode === 'count' ? Math.min(target, elapsed) : elapsed));
  };

  const reset = () => {
    setRunning(false);
    base.current = 0;
    setElapsed(0);
  };

  const shown = mode === 'count' ? left : elapsed;
  const pct = mode === 'count' && target > 0 ? Math.min(1, elapsed / target) : 0;

  return (
    <div className={`timer${running ? ' on' : ''}`}>
      <div className="timer-read" aria-live="off">
        {formatClock(shown)}
        {mode === 'count' && <span className="timer-of"> z {formatClock(target)}</span>}
      </div>
      {mode === 'count' && (
        <div className="timer-bar">
          <i style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
      <div className="timer-btns">
        <button className="btn sm" onClick={running ? stop : start}>
          {running ? 'Stop' : elapsed > 0 ? 'Wznów' : mode === 'count' ? 'Start odliczania' : 'Start stopera'}
        </button>
        {elapsed > 0 && !running && (
          <button className="btn sm ghost" onClick={reset}>
            Od nowa
          </button>
        )}
      </div>
    </div>
  );
}
