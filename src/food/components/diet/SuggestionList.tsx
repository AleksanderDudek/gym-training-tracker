import { Plus, Star } from 'lucide-react';
import type { Food } from '../../diet/foods';
import type { Fit, FitLevel } from '../../diet/profiles';
import { isPair, type Suggestion } from '../../diet/suggest';
import { formatNumber } from '../../lib/format';

const FIT_LABEL: Record<FitLevel, string> = { great: 'pasuje', ok: 'może być', avoid: 'nie pasuje' };

/**
 * Jak jedzenie pasuje do sposobu odżywiania. Słowo niesie ocenę samo — kolor tylko ją podkreśla;
 * powód stoi w podpowiedzi i w linijce powodów pod spodem.
 */
export function FitBadge({ fit }: { fit: Fit }) {
  return (
    <span className={`fd-diet-fit fd-diet-${fit.level}`} title={fit.reason}>
      {FIT_LABEL[fit.level]}
    </span>
  );
}

/** „640 kcal · B 41 · W 43 · T 31”; nieznane makro to „?”, nigdy zero. */
export function MacroLine({ food }: { food: Food }) {
  const n = food.nutrients;
  const g = (v: number | null) => (v === null ? '?' : formatNumber(v, 0));
  return (
    <span className="fd-diet-nums">
      {formatNumber(n.kcal, 0)} kcal · B {g(n.protein)} · W {g(n.carbs)} · T {g(n.fat)}
    </span>
  );
}

interface Props {
  suggestions: Suggestion[];
  actionLabel: string;
  onPick: (food: Food) => void;
}

/** Propozycje w kolejności, z powodami; gwiazdka przy najlepszych na tę chwilę. */
export function SuggestionList({ suggestions, actionLabel, onPick }: Props) {
  if (suggestions.length === 0) return <p className="tight">Brak propozycji w tym budżecie.</p>;
  return (
    <ul className="fd-diet-list">
      {suggestions.map((s, i) => {
        // Zamienniki idą najpierw pojedynczo; pary po nich dostają własny nagłówek.
        const prev = suggestions[i - 1];
        const firstPair = isPair(s.food) && (!prev || !isPair(prev.food));
        return (
          <li key={s.food.key} className="fd-diet-sug">
            {firstPair && <p className="fd-diet-group">{i === 0 ? 'Dwie rzeczy razem' : 'Albo dwie rzeczy razem'}</p>}
            <div className="fd-diet-row">
              <div className="fd-diet-row-main">
                <p className="fd-diet-name">
                  {s.best && (
                    <span className="fd-diet-best">
                      <Star size={14} strokeWidth={2} aria-hidden /> najlepsze
                    </span>
                  )}{' '}
                  {s.food.name} <FitBadge fit={s.fit} />
                </p>
                <p className="fd-diet-meta">
                  <MacroLine food={s.food} /> · {s.food.amountLabel}
                  {s.where && <> · {s.where}</>}
                </p>
                <p className="fd-diet-why">{s.reasons.slice(0, 3).join(' · ')}</p>
              </div>
              <button
                type="button"
                className="btn ghost sm fd-diet-act"
                onClick={() => onPick(s.food)}
                aria-label={`${actionLabel}: ${s.food.name}`}
              >
                <Plus size={20} strokeWidth={2} aria-hidden /> {actionLabel}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
