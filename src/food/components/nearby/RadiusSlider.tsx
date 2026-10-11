import { useId, type CSSProperties } from 'react';
import { RADIUS_STEPS, radiusLabel } from '../../nearby/radius';

const LAST = RADIUS_STEPS.length - 1;

/**
 * Promień wyszukiwania w stroju suwaka z kreatora planu (`.stepper`: −, suwak, +). Stopnie nie są
 * równe (500 m … 10 km), więc suwak chodzi po ich NUMERACH: każdy ząbek to jeden stopień, a 1 km
 * stoi tam, gdzie kciuk go znajdzie, zamiast w pierwszej dwudziestej toru. Przyciski obok to
 * dokładny krok o jeden stopień — bez celowania palcem w wąski tor. Na końcu skali przycisk jest
 * tylko oznaczony jako nieczynny (`aria-disabled`): wyłączony zgubiłby fokus spod klawiatury.
 */
export function RadiusSlider({ radius, onChange }: { radius: number; onChange: (radius: number) => void }) {
  const labelId = useId();
  const index = Math.max(0, RADIUS_STEPS.indexOf(radius as (typeof RADIUS_STEPS)[number]));
  const to = (i: number) => onChange(RADIUS_STEPS[Math.min(LAST, Math.max(0, i))] ?? radius);
  // Wypełniona część toru, w procentach — rysuje ją tło suwaka.
  const fill = { '--fill': `${(index / LAST) * 100}%` } as CSSProperties;

  return (
    <div className="fd-near-radius">
      <p className="fd-near-radius-head">
        <span id={labelId}>Promień</span>
        <output className="fd-near-radius-value" aria-hidden="true">
          {radiusLabel(radius)}
        </output>
      </p>
      <div className="stepper">
        <button type="button" onClick={() => to(index - 1)} aria-disabled={index === 0} aria-label="Mniejszy promień">
          −
        </button>
        <input
          type="range"
          min={0}
          max={LAST}
          step={1}
          value={index}
          onChange={(e) => to(Number(e.target.value))}
          aria-labelledby={labelId}
          aria-valuetext={radiusLabel(radius)}
          style={fill}
        />
        <button type="button" onClick={() => to(index + 1)} aria-disabled={index === LAST} aria-label="Większy promień">
          +
        </button>
      </div>
    </div>
  );
}
