import { useCallback } from 'react';
import type { BodyView, BodyViews } from '../data/bodymap/types';
import type { MuscleId, MuscleUse } from '../data/muscles';
import { useLoaded } from '../data/catalog/load';
import { text } from '../i18n';

const T = text({
  pl: { front: 'Przód', back: 'Tył', loading: 'Rysuję sylwetkę…', failed: 'Rysunek się nie wczytał.', retry: 'Spróbuj jeszcze raz' },
  en: { front: 'Front', back: 'Back', loading: 'Drawing the figure…', failed: 'The drawing didn’t load.', retry: 'Try again' },
});

export type BodySex = 'male' | 'female';

/*
 * Kontury z MuscleMap (MIT) — osobny kawałek na płeć, ~45–55 kB, ładowany przy pierwszym
 * rysunku. Obietnica wspólna dla wszystkich map na stronie.
 */
const cache: Partial<Record<BodySex, Promise<BodyViews>>> = {};
function loadViews(sex: BodySex): Promise<BodyViews> {
  const p = (cache[sex] ??= (sex === 'female' ? import('../data/bodymap/female') : import('../data/bodymap/male')).then(
    (m) => m.default,
  ));
  p.catch(() => delete cache[sex]);
  return p;
}

const tone = (m: MuscleId | null, use: MuscleUse): string =>
  m === null ? 'bm-skin' : use.p.includes(m) ? 'bm-p' : use.s.includes(m) ? 'bm-s' : 'bm-off';

function View({ view, use, label }: { view: BodyView; use: MuscleUse; label: string }) {
  return (
    <figure className="bm-fig">
      <svg viewBox={view.box.join(' ')} aria-hidden="true" focusable="false">
        {view.parts.map(([m, d], i) => (
          <path key={i} className={`bm-part ${tone(m, use)}`} d={d} data-muscle={m ?? undefined} />
        ))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/**
 * Sylwetka przód + tył z mięśniami ćwiczenia: główne w kolorze, pomocnicze jaśniej, reszta szara.
 * Sam rysunek jest ukryty przed czytnikiem ekranu — nazwy mięśni stoją w liście obok
 * (`ExerciseMuscles`), więc obraz nie jest jedynym nośnikiem informacji.
 */
export default function BodyMap({ use, sex, compact = false }: { use: MuscleUse; sex: BodySex; compact?: boolean }) {
  const load = useCallback(() => loadViews(sex), [sex]);
  const views = useLoaded(load);
  if (views.state === 'loading') return <div className={`bm-figs bm-wait${compact ? ' bm-compact' : ''}`}>{T.loading}</div>;
  if (views.state === 'error')
    return (
      <p className="tight">
        {T.failed}{' '}
        <button type="button" className="btn ghost sm" onClick={views.retry}>
          {T.retry}
        </button>
      </p>
    );
  return (
    <div className={`bm-figs${compact ? ' bm-compact' : ''}`}>
      <View view={views.value.front} use={use} label={T.front} />
      <View view={views.value.back} use={use} label={T.back} />
    </div>
  );
}
