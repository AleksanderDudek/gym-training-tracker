import { lazy, Suspense } from 'react';
import { MUSCLE_NAME } from '../data/muscles';
import type { MuscleUse } from '../data/muscles';
import type { AppState } from '../types';
import type { BodySex } from './BodyMap';
import { text } from '../i18n';

const BodyMap = lazy(() => import('./BodyMap'));

const T = text({
  pl: {
    main: 'Główne',
    help: 'Pomocnicze',
    none: 'Ruch całego ciała — bez jednej wiodącej partii mięśni.',
    legendMain: 'pracują najmocniej',
    legendHelp: 'pomagają i stabilizują',
  },
  en: {
    main: 'Main',
    help: 'Helpers',
    none: 'A whole-body movement — no single leading muscle group.',
    legendMain: 'do most of the work',
    legendHelp: 'assist and stabilise',
  },
});

export const sexOf = (state: AppState): BodySex => (state.cfg.avatar === 'gosia' ? 'female' : 'male');

/**
 * Pracujące mięśnie: rysunek przód/tył (sylwetka idzie za postacią z ustawień) i lista nazw.
 * Te same 16 partii co „Mięśnie w tym tygodniu” — seria tego ćwiczenia liczy się tam dokładnie
 * tym mięśniom, które świecą tutaj.
 */
export function ExerciseMuscles({ use, sex, compact = false }: { use: MuscleUse; sex: BodySex; compact?: boolean }) {
  if (!use.p.length && !use.s.length) return <p className="tight">{T.none}</p>;
  return (
    <div className="bm">
      <Suspense fallback={<div className={`bm-figs bm-wait${compact ? ' bm-compact' : ''}`} />}>
        <BodyMap use={use} sex={sex} compact={compact} />
      </Suspense>
      <dl className="bm-list">
        {use.p.length > 0 && (
          <div>
            <dt>
              <i className="bm-dot bm-p" aria-hidden="true" />
              {T.main} <span className="bm-sub">— {T.legendMain}</span>
            </dt>
            <dd>{use.p.map((m) => MUSCLE_NAME[m]).join(', ')}</dd>
          </div>
        )}
        {use.s.length > 0 && (
          <div>
            <dt>
              <i className="bm-dot bm-s" aria-hidden="true" />
              {T.help} <span className="bm-sub">— {T.legendHelp}</span>
            </dt>
            <dd>{use.s.map((m) => MUSCLE_NAME[m]).join(', ')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
