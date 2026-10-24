import { Plus, Star } from 'lucide-react';
import { text } from '../../../i18n';
import type { Food } from '../../diet/foods';
import type { Fit, FitLevel } from '../../diet/profiles';
import { isPair, type Suggestion } from '../../diet/suggest';
import { formatNumber } from '../../lib/format';
import { DT } from './dietText';
import { useKcalShown } from './kcalShown';

const T = text({
  pl: {
    fit: { great: 'pasuje', ok: 'może być', avoid: 'nie pasuje' } as Record<FitLevel, string>,
    none: 'Brak propozycji w tym budżecie.',
    pairsFirst: 'Dwie rzeczy razem',
    pairsAfter: 'Albo dwie rzeczy razem',
    best: 'najlepsze',
  },
  en: {
    fit: { great: 'fits', ok: 'could do', avoid: 'doesn’t fit' },
    none: 'No suggestions within this budget.',
    pairsFirst: 'Two things together',
    pairsAfter: 'Or two things together',
    best: 'best',
  },
});

export const FIT_LABEL: Record<FitLevel, string> = T.fit;

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

/**
 * „640 kcal · B 41 · W 43 · T 31”; nieznane makro to „?”, nigdy zero. Bez liczenia kalorii
 * (`KcalShown`) zostaje samo białko: „B 41 g” — w każdej liście diety, także w arkuszach.
 */
export function MacroLine({ food }: { food: Food }) {
  const shown = useKcalShown();
  const n = food.nutrients;
  const g = (v: number | null) => (v === null ? '?' : formatNumber(v, 0));
  if (!shown)
    return (
      <span className="fd-diet-nums">
        {DT.p} {g(n.protein)} g
      </span>
    );
  return (
    <span className="fd-diet-nums">
      {formatNumber(n.kcal, 0)} kcal · {DT.p} {g(n.protein)} · {DT.c} {g(n.carbs)} · {DT.f} {g(n.fat)}
    </span>
  );
}

interface Props {
  suggestions: Suggestion[];
  actionLabel: string;
  onPick: (food: Food) => void;
}

/** A reason about the calorie budget („450 z 600 kcal, które zostały”): left out without calories on screen. */
const KCAL_REASON = /\bkcal\b/;

/**
 * Propozycje w kolejności, z powodami; gwiazdka przy najlepszych na tę chwilę. Bez liczenia kalorii
 * powody o budżecie kalorii odpadają, zostają te o białku i o sposobie odżywiania.
 */
export function SuggestionList({ suggestions, actionLabel, onPick }: Props) {
  const shown = useKcalShown();
  if (suggestions.length === 0) return <p className="tight">{T.none}</p>;
  return (
    <ul className="fd-diet-list">
      {suggestions.map((s, i) => {
        // Zamienniki idą najpierw pojedynczo; pary po nich dostają własny nagłówek.
        const prev = suggestions[i - 1];
        const firstPair = isPair(s.food) && (!prev || !isPair(prev.food));
        return (
          <li key={s.food.key} className="fd-diet-sug">
            {firstPair && <p className="fd-diet-group">{i === 0 ? T.pairsFirst : T.pairsAfter}</p>}
            <div className="fd-diet-row">
              <div className="fd-diet-row-main">
                <p className="fd-diet-name">
                  {s.best && (
                    <span className="fd-diet-best">
                      <Star size={14} strokeWidth={2} aria-hidden /> {T.best}
                    </span>
                  )}{' '}
                  {s.food.name} <FitBadge fit={s.fit} />
                </p>
                <p className="fd-diet-meta">
                  <MacroLine food={s.food} /> · {s.food.amountLabel}
                  {s.where && <> · {s.where}</>}
                </p>
                <p className="fd-diet-why">
                  {(shown ? s.reasons : s.reasons.filter((r) => !KCAL_REASON.test(r))).slice(0, 3).join(' · ')}
                </p>
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
