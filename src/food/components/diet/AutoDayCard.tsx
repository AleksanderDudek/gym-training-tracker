import { Check, Shuffle } from 'lucide-react';
import { text } from '../../../i18n';
import type { Entry } from '../../diet/db';
import type { Food } from '../../diet/foods';
import { slotLabel, type AutoMeal } from '../../diet/suggest';
import { formatNumber } from '../../lib/format';
import { DT } from './dietText';
import { FitBadge, MacroLine } from './SuggestionList';

const T = text({
  pl: {
    title: 'Propozycja dnia',
    lead: (hasPlan: boolean, kcal: string, protein: string) =>
      `${hasPlan ? 'Plan nie obejmuje tego dnia – ' : 'Bez planu – '}zestaw z tego, co masz w pobliżu i w domu: ${kcal} kcal, ${protein} g białka.`,
    loading: 'Wczytuję przepisy i produkty…',
    noData: 'Za mało danych, żeby ułożyć dzień – dodaj swoje jedzenie albo otwórz „W pobliżu”.',
    reroll: 'Inny zestaw',
  },
  en: {
    title: 'Suggested day',
    lead: (hasPlan: boolean, kcal: string, protein: string) =>
      `${hasPlan ? 'Your plan doesn’t cover this day – ' : 'No plan – '}a set from what’s nearby and at home: ${kcal} kcal, ${protein} g protein.`,
    loading: 'Loading recipes and products…',
    noData: 'Not enough data to plan the day – add your own food or open “Nearby”.',
    reroll: 'Another set',
  },
});

interface Props {
  meals: AutoMeal[];
  entries: Entry[];
  hasPlan: boolean;
  /** Baza produktów jeszcze się wczytuje: zestaw ułoży się na nowo, gdy dojdą przepisy i produkty. */
  loading: boolean;
  onLog: (food: Food) => void;
  onReroll: () => void;
}

/**
 * „Ułóż dzień” na dzień, którego plan nie obejmuje (albo gdy planu nie ma): posiłek na każdą
 * porę dnia z tego, co sprzedają sklepy w pobliżu, i z tego, co jest w domu. Zestaw zostaje,
 * dopóki ktoś nie poprosi o inny.
 */
export function AutoDayCard({ meals, entries, hasPlan, loading, onLog, onReroll }: Props) {
  const kcal = meals.reduce((sum, m) => sum + m.suggestion.food.nutrients.kcal, 0);
  const protein = meals.reduce((sum, m) => sum + (m.suggestion.food.nutrients.protein ?? 0), 0);
  return (
    <section className="grp" aria-labelledby="fd-diet-auto-title">
      <h2 id="fd-diet-auto-title">{T.title}</h2>
      <p className="tight">{T.lead(hasPlan, formatNumber(kcal, 0), formatNumber(protein, 0))}</p>
      {meals.length === 0 ? (
        <p className="tight">
          {loading ? T.loading : T.noData}
        </p>
      ) : (
        <ul className="fd-diet-list">
          {meals.map(({ slot, suggestion: s }) => {
            const eaten = entries.some((e) => e.key === s.food.key);
            return (
              <li key={slot} className="fd-diet-row">
                <div className="fd-diet-row-main">
                  <p className="fd-diet-group">{slotLabel(slot)}</p>
                  <p className="fd-diet-name">
                    {s.food.name} <FitBadge fit={s.fit} />
                  </p>
                  <p className="fd-diet-meta">
                    <MacroLine food={s.food} /> · {s.food.amountLabel}
                    {s.where && <> · {s.where}</>}
                  </p>
                </div>
                {eaten ? (
                  <span className="fd-diet-done">
                    <Check size={20} strokeWidth={2} aria-hidden /> {DT.eaten}
                  </span>
                ) : (
                  // Obrys, nie wypełnienie: cztery ciemne przyciski w jednej karcie zagłuszałyby
                  // „Dodaj zjedzone” — jedyną główną akcję ekranu.
                  <button
                    type="button"
                    className="btn ghost sm fd-diet-act"
                    onClick={() => onLog(s.food)}
                    aria-label={DT.ateFood(s.food.name)}
                  >
                    <Check size={20} strokeWidth={2} aria-hidden /> {DT.ate}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn ghost sm fd-diet-reroll" onClick={onReroll}>
        <Shuffle size={20} strokeWidth={2} aria-hidden /> {T.reroll}
      </button>
    </section>
  );
}
