import { useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { HealthNote } from './Health';
import { SupportLine } from './Support';
import { text } from '../i18n';
import { RANKS } from '../engine/score';

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

const T = text({
  pl: {
    steps: [
      {
        icon: 'session',
        title: 'Trening, który sam się rozlicza',
        body: 'Wpisujesz wyniki serii i oceniasz, ile zostało w zapasie. Resztę silnik bierze na siebie: decyduje, kiedy dołożyć powtórzenia, a kiedy wejść na cięższe obciążenie. Ty masz tylko przyjść.',
      },
      {
        icon: 'workouts',
        title: 'Pierwsza sesja mierzy poziom',
        body: 'Każde ćwiczenie zaczyna od jednej serii próbnej. Nie ma tabelek ani zgadywania — punkt startowy bierze się z tego, co naprawdę zrobisz. Nikt nie patrzy, więc nie ma po co ściemniać.',
      },
      {
        icon: 'plan',
        title: 'Plan pilnuje terminów',
        body: 'Rozpisuje dwanaście tygodni na konkretne dni i sam decyduje, co wypada następne — także wtedy, gdy poprzedni trening się nie odbył. Za trzymanie się terminów są punkty, odznaki i stopnie od „Gościa z ulicy” po „Pomnik za życia”. Plan jest opcjonalny.',
      },
      {
        icon: 'awards',
        title: 'Bezpłatna i zostaje bezpłatna',
        body: 'Bez kont, bez reklam, bez śledzenia. Dane leżą w twojej przeglądarce. Jeśli aplikacja ci się przyda, możesz postawić kawę — w dowolnej kwocie i tylko wtedy, gdy masz ochotę. Autor pije ją i tak, ale wolałby, żeby ktoś zauważył.',
      },
    ] as Step[],
    label: 'Wprowadzenie',
    count: (n: number, of: number) => `${n} z ${of}`,
    skip: 'Pomiń',
    back: 'Wstecz',
    start: 'Zaczynamy',
    next: 'Dalej',
  },
  en: {
    steps: [
      {
        icon: 'session',
        title: 'Training that does the maths',
        body: 'You enter your set results and rate how much you had left in the tank. The engine takes care of the rest: it decides when to add reps and when to move up to a heavier weight. All you have to do is show up.',
      },
      {
        icon: 'workouts',
        title: 'Your first session measures your level',
        body: 'Every exercise starts with one test set. No tables, no guesswork — your starting point comes from what you actually do. Nobody’s watching, so there’s no point fibbing.',
      },
      {
        icon: 'plan',
        title: 'The plan keeps you to your deadlines',
        // Nazwy stopni z silnika punktów — te same, które potem widać w osiągnięciach.
        body: `It lays out twelve weeks on specific days and decides what comes next — even when the previous workout didn’t happen. Sticking to the deadlines earns points, badges and ranks from “${RANKS[0]!.name}” to “${RANKS[RANKS.length - 1]!.name}”. The plan is optional.`,
      },
      {
        icon: 'awards',
        title: 'Free, and staying free',
        body: 'No accounts, no ads, no tracking. Your data stays in your browser. If the app is useful to you, you can buy a coffee — any amount, and only if you feel like it. The author drinks it anyway, but would rather someone noticed.',
      },
    ],
    label: 'Introduction',
    count: (n: number, of: number) => `${n} of ${of}`,
    skip: 'Skip',
    back: 'Back',
    start: 'Let’s go',
    next: 'Next',
  },
});

export const STEPS: Step[] = T.steps;

export function Intro({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  return (
    <div className="intro" role="dialog" aria-modal="true" aria-label={T.label}>
      <div className="intro-box">
        <div className="intro-top">
          <span className="intro-count">{T.count(i + 1, STEPS.length)}</span>
          <button className="intro-skip" onClick={onDone}>
            {T.skip}
          </button>
        </div>

        <div className="intro-art" aria-hidden="true">
          <Icon name={step.icon} size={44} />
        </div>

        <h2 className="intro-title">{step.title}</h2>
        <p className="intro-body">{step.body}</p>

        {last && <SupportLine seed={STEPS.length} compact />}
        {/* Na każdym ekranie, nie tylko na ostatnim — wprowadzenie da się pominąć z pierwszego. */}
        <HealthNote />

        <div className="intro-dots" aria-hidden="true">
          {STEPS.map((s, n) => (
            <i key={s.title} className={n === i ? 'on' : ''} />
          ))}
        </div>

        <div className="intro-nav">
          {i > 0 && (
            <button className="btn ghost" onClick={() => setI(i - 1)}>
              {T.back}
            </button>
          )}
          <button className="btn wide" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? T.start : T.next}
          </button>
        </div>
      </div>
    </div>
  );
}
