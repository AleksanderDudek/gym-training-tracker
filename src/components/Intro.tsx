import { useState } from 'react';
import { SUPPORT_URL } from '../engine/share';
import { Icon } from './icons';
import type { IconName } from './icons';

/**
 * Wprowadzenie dla nowych.
 *
 * Cztery ekrany, bo piąty nikt nie czyta. Pominięcie jest widoczne na każdym kroku, a nie
 * schowane pod krzyżykiem w rogu — wprowadzenie, którego nie da się wyminąć, jest bramką,
 * nie pomocą. Ostatni ekran mówi wprost, że aplikacja jest bezpłatna, i podaje jedną
 * konkretną akcję dla tych, którzy chcą się odwdzięczyć.
 */

interface Step {
  icon: IconName;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    icon: 'session',
    title: 'Trening, który sam się rozlicza',
    body: 'Wpisujesz wyniki serii i oceniasz, ile zostało w zapasie. Resztę silnik bierze na siebie: decyduje, kiedy dołożyć powtórzenia, a kiedy wejść na cięższe obciążenie.',
  },
  {
    icon: 'workouts',
    title: 'Pierwsza sesja mierzy poziom',
    body: 'Każde ćwiczenie zaczyna od jednej serii próbnej. Nie ma tabelek ani zgadywania — punkt startowy bierze się z tego, co naprawdę zrobisz.',
  },
  {
    icon: 'plan',
    title: 'Plan pilnuje terminów',
    body: 'Rozpisuje dwanaście tygodni na konkretne dni i sam decyduje, który trening wypada następny — także wtedy, gdy poprzedni się nie odbył. Za trzymanie się terminów są punkty i odznaki. Plan jest opcjonalny.',
  },
  {
    icon: 'awards',
    title: 'Bezpłatna i zostaje bezpłatna',
    body: 'Bez kont, bez reklam, bez śledzenia. Dane leżą w twojej przeglądarce i możesz je wyeksportować do pliku. Jeśli aplikacja ci się przyda, możesz postawić kawę — w dowolnej kwocie i tylko wtedy, gdy masz ochotę.',
  },
];

export function Intro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label="Wprowadzenie">
      <div className="intro-box">
        <div className="intro-top">
          <span className="intro-count">
            {i + 1} z {STEPS.length}
          </span>
          <button className="intro-skip" onClick={onDone}>
            Pomiń
          </button>
        </div>

        <div className="intro-art" aria-hidden="true">
          <Icon name={step.icon} size={44} />
        </div>

        <h2 className="intro-title">{step.title}</h2>
        <p className="intro-body">{step.body}</p>

        {last && (
          <a className="btn sm ghost intro-coffee" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Postaw kawę
          </a>
        )}

        <div className="intro-dots" aria-hidden="true">
          {STEPS.map((s, n) => (
            <i key={s.title} className={n === i ? 'on' : ''} />
          ))}
        </div>

        <div className="intro-nav">
          {i > 0 && (
            <button className="btn ghost" onClick={() => setI(i - 1)}>
              Wstecz
            </button>
          )}
          <button className="btn wide" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'Zaczynamy' : 'Dalej'}
          </button>
        </div>
      </div>
    </div>
  );
}
