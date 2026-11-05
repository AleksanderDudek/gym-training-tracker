import { ANIM } from '../data/anim';
import { EX_JOKES } from '../data/exjokes';
import { GEAR_LABEL, ex, gearOf, groupLabel } from '../data/exercises';
import { EX_MUSCLES } from '../data/muscles';
import { Sheet } from '../food/components/common/Sheet';
import { exercisePath } from '../routing';
import type { AppState, ExerciseId } from '../types';
import { CatalogSteps, stepsSrcOf } from './Catalog';
import { ExerciseMuscles, sexOf } from './ExerciseMuscles';
import { AnimatedMannequin } from './Mannequin';
import { text } from '../i18n';

const T = text({
  pl: {
    watch: 'Na co uważać',
    steps: 'Krok po kroku',
    muscles: 'Pracujące mięśnie',
    full: 'Pełna strona ćwiczenia: filmy i opis →',
    back: 'Wracam do serii',
    keep: 'Trening, zegar i przerwa liczą się dalej w tle.',
  },
  en: {
    watch: 'What to watch out for',
    steps: 'Step by step',
    muscles: 'Working muscles',
    full: 'Full exercise page: videos and details →',
    back: 'Back to my set',
    keep: 'Your workout, clock and rest keep running in the background.',
  },
});

/**
 * Technika bez wychodzenia z treningu: goryl w ruchu, na co uważać, kroki i pracujące mięśnie
 * w arkuszu od dołu. Ładowany leniwie przy pierwszym stuknięciu „Jak to zrobić?” — w samym
 * treningu nie ma po co ciągnąć arkusza i mapy ciała, dopóki ktoś o nie nie poprosi.
 */
export default function TechniqueSheet({
  state,
  id,
  open,
  onClose,
}: {
  state: AppState;
  id: ExerciseId;
  open: boolean;
  onClose: () => void;
}) {
  const m = ex(id);
  const move = ANIM[id];
  const stepsSrc = stepsSrcOf(id);
  const use = EX_MUSCLES[id];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={m.name}
      subtitle={`${groupLabel(m.group)} · ${GEAR_LABEL[gearOf(id)]}`}
      className="tech-sheet"
      footer={
        <button type="button" className="btn wide" onClick={(e) => e.currentTarget.closest('dialog')?.close()}>
          {T.back}
        </button>
      }
    >
      {/* Treść tylko w otwartym arkuszu: zamknięty nie kręci animacji goryla w tle treningu. */}
      {open && move && (
        <div className="tech-move">
          <AnimatedMannequin move={move} gear={gearOf(id)} who={state.cfg.avatar ?? 'gustaw'} size={220} />
        </div>
      )}
      {open && m.hint && (
        <section className="tech-part">
          <h3>{T.watch}</h3>
          <p>{m.hint}</p>
          {EX_JOKES[id] && <p className="exjoke">{EX_JOKES[id]}</p>}
        </section>
      )}
      {open && stepsSrc && (
        <section className="tech-part">
          <h3>{T.steps}</h3>
          <CatalogSteps src={stepsSrc} />
        </section>
      )}
      {open && use && (
        <section className="tech-part">
          <h3>{T.muscles}</h3>
          <ExerciseMuscles use={use} sex={sexOf(state)} compact />
        </section>
      )}
      <p className="tech-full">
        <a className="vidlink" href={exercisePath(id)}>
          {T.full}
        </a>
      </p>
      <p className="tight">{T.keep}</p>
    </Sheet>
  );
}
