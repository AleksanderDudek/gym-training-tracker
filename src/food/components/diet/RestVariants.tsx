import { Check, Shuffle } from 'lucide-react';
import type { Entry } from '../../diet/db';
import type { Food } from '../../diet/foods';
import type { RestVariant } from '../../diet/suggest';
import { formatNumber } from '../../lib/format';
import { FitBadge, MacroLine } from './SuggestionList';

interface Props {
  variants: RestVariant[];
  /** What is left of the day, kcal and protein — each variant says how close it lands. */
  left: { kcal: number; protein: number };
  /** Already eaten today: a meal of a variant that was logged shows „zjedzone”. */
  entries?: Entry[];
  /** „Zjadłem” on a meal; without it the list is only to read (the cheat-meal sheet). */
  onLog?: (food: Food) => void;
  onReroll?: () => void;
}

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;

/**
 * „Reszta dnia”: kilka zestawów posiłków na to, co zostało — każdy z porami dnia i sumą wobec
 * reszty („980 z 1000 kcal, 85 g białka”). Posiłki w zestawie są dobrane tak, żeby suma trafiła
 * w resztę: każdy kolejny dostaje to, co zostało po poprzednich (`restOfDay`).
 */
export function RestVariants({ variants, left, entries = [], onLog, onReroll }: Props) {
  if (!variants.length) return null;
  return (
    <div className="fd-diet-rest">
      {variants.map((v, i) => (
        <section key={v.meals.map((m) => m.suggestion.food.key).join('|')} className="fd-diet-restvar" aria-label={`Wariant ${i + 1}`}>
          <p className="fd-diet-resthead">
            <b>Wariant {i + 1}</b> · {kcal(v.kcal)} z {kcal(left.kcal)} · {formatNumber(v.protein, 0)} g białka
            {left.protein > 0 && ` (z ${formatNumber(Math.round(left.protein), 0)})`}
          </p>
          <ul className="fd-diet-list">
            {v.meals.map(({ slot, suggestion: s }) => {
              const eaten = entries.some((e) => e.key === s.food.key);
              return (
                <li key={slot} className="fd-diet-row">
                  <div className="fd-diet-row-main">
                    <p className="fd-diet-group">{slot}</p>
                    <p className="fd-diet-name">
                      {s.food.name} <FitBadge fit={s.fit} />
                    </p>
                    <p className="fd-diet-meta">
                      <MacroLine food={s.food} /> · {s.food.amountLabel}
                      {s.where && <> · {s.where}</>}
                    </p>
                  </div>
                  {onLog &&
                    (eaten ? (
                      <span className="fd-diet-done">
                        <Check size={20} strokeWidth={2} aria-hidden /> zjedzone
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost sm fd-diet-act"
                        onClick={() => onLog(s.food)}
                        aria-label={`Zjadłem: ${s.food.name}`}
                      >
                        <Check size={20} strokeWidth={2} aria-hidden /> Zjadłem
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {onReroll && (
        <button type="button" className="btn ghost sm fd-diet-reroll" onClick={onReroll}>
          <Shuffle size={20} strokeWidth={2} aria-hidden /> Inne warianty
        </button>
      )}
    </div>
  );
}
