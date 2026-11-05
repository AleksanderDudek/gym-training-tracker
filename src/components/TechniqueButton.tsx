import { createContext, lazy, Suspense, useContext, useState, type ReactNode } from 'react';
import { CirclePlay } from 'lucide-react';
import { ANIM } from '../data/anim';
import { ex } from '../data/exercises';
import type { AppState, ExerciseId } from '../types';
import { stepsSrcOf } from './Catalog';
import { track } from '../stats';
import { text } from '../i18n';

const TechniqueSheet = lazy(() => import('./TechniqueSheet'));

const T = text({
  pl: {
    how: 'Jak to zrobić?',
    howNext: (name: string) => `Jak zrobić: ${name}`,
    what: (move: boolean, steps: boolean) =>
      [move && 'ruch na animacji', steps && 'kroki', 'pracujące mięśnie', !steps && 'na co uważać'].filter(Boolean).join(' · '),
    aria: (name: string) => `Technika: ${name} — animacja, mięśnie i wskazówki`,
  },
  en: {
    how: 'How do I do it?',
    howNext: (name: string) => `How to do: ${name}`,
    what: (move: boolean, steps: boolean) =>
      [move && 'animated movement', steps && 'steps', 'working muscles', !steps && 'what to watch'].filter(Boolean).join(' · '),
    aria: (name: string) => `Technique: ${name} — animation, muscles and tips`,
  },
});

/** Otwieracz arkusza z wyższego poziomu (`TechniqueHost`); bez niego przycisk trzyma arkusz sam. */
const HostContext = createContext<((id: ExerciseId) => void) | null>(null);

/**
 * Arkusz techniki trzymany ponad tym, co się przełącza. W treningu prowadzonym panel przerwy
 * znika w chwili, gdy przerwa mija — arkusz otwarty z niego („Jak zrobić: …”) nie może zniknąć
 * razem z nim w połowie czytania.
 */
export function TechniqueHost({ state, children }: { state: AppState; children: ReactNode }) {
  const [id, setId] = useState<ExerciseId | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <HostContext.Provider
      value={(x) => {
        setId(x);
        setOpen(true);
      }}
    >
      {children}
      {id && (
        <Suspense fallback={null}>
          <TechniqueSheet key={id} state={state} id={id} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </HostContext.Provider>
  );
}

/**
 * Wyraźne wejście do techniki w treningu. Dawniej było tu szare „Technika” na dole karty, które
 * nie wyglądało na klikalne i po rozwinięciu dawało jedno zdanie. Teraz to przycisk z ikoną
 * i podpisem, co jest w środku, a arkusz otwiera się nad treningiem — bez wychodzenia z serii.
 * `next` — wariant w przerwie, dla ćwiczenia, które zaraz się zacznie.
 */
export function TechniqueButton({
  state,
  id,
  next = false,
  where = next ? 'rest' : 'set',
}: {
  state: AppState;
  id: ExerciseId;
  next?: boolean;
  /** Skąd otwarte — do anonimowych statystyk. */
  where?: 'set' | 'rest' | 'list';
}) {
  const host = useContext(HostContext);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const name = ex(id).name;
  return (
    <>
      <button
        type="button"
        className={`tech-btn${next ? ' tech-next' : ''}`}
        aria-haspopup="dialog"
        aria-label={T.aria(name)}
        onClick={() => {
          track('technique', where);
          if (host) return host(id);
          setMounted(true);
          setOpen(true);
        }}
      >
        <CirclePlay aria-hidden="true" size={next ? 20 : 26} strokeWidth={2} />
        <span className="tech-txt">
          <b>{next ? T.howNext(name) : T.how}</b>
          {!next && <small>{T.what(!!ANIM[id], !!stepsSrcOf(id))}</small>}
        </span>
        <span className="tech-go" aria-hidden="true">
          ›
        </span>
      </button>
      {!host && mounted && (
        <Suspense fallback={null}>
          <TechniqueSheet state={state} id={id} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
