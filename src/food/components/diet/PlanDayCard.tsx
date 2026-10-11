import { Check, Repeat, SkipForward, Undo2 } from 'lucide-react';
import { db, type Entry } from '../../diet/db';
import { planFood } from '../../diet/foods';
import { plannedKcal, type Plan, type PlannedDay, type PlannedItem } from '../../diet/plan';
import { logPlanItem, updateChoices } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { MacroLine } from './SuggestionList';

interface Props {
  plan: Plan;
  planned: PlannedDay;
  date: string;
  entries: Entry[];
  onSwap: (item: PlannedItem) => void;
}

/** Wpis, który odhaczył tę pozycję, jeśli taki jest (ta sama linia tego samego wariantu). */
const eatenEntry = (entries: Entry[], item: PlannedItem) =>
  entries.find((e) => e.planIndex === item.index && e.key === `plan:${item.text}`);

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * Plan dnia z arkusza, który da się nagiąć: inny wariant, pozycja zamieniona na coś o podobnej
 * kaloryczności, pozycja pominięta. Odhaczenie zapisuje pozycję jako zjedzoną — a liczy się to,
 * co zjedzone, czy było w planie, czy nie. Przyciski pod nazwą, nie obok: na telefonie 320 px
 * trzy przyciski i nazwa potrawy w jednym rzędzie by się nie zmieściły.
 */
export function PlanDayCard({ plan, planned, date, entries, onSwap }: Props) {
  const variants = plan.templates[planned.template] ?? [];
  const left = planned.items.filter((i) => !i.skipped && !eatenEntry(entries, i));
  const leftKcal = left.reduce((sum, i) => sum + i.kcal, 0);

  return (
    <section className="grp" aria-labelledby="fd-plan-day-title">
      <h2 id="fd-plan-day-title">
        Plan na ten dzień <span className="fd-h-meta">· dzień {planned.template}</span>
      </h2>
      <label className="fld fd-variant">
        <span>Wariant</span>
        <select
          value={planned.variant}
          // Inny wariant ma inne linie: jego zamiany i pominięcia wskazywałyby nie te pozycje.
          onChange={(e) => void updateChoices(date, () => ({ variant: Number(e.target.value) }))}
        >
          {variants.map((v) => (
            <option key={v.index} value={v.index}>
              {v.index} · {formatNumber(v.totals.kcal, 0)} kcal · B {formatNumber(v.totals.protein ?? 0, 0)} g
            </option>
          ))}
        </select>
      </label>

      <ul className="fd-list">
        {planned.items.map((item) => {
          const entry = eatenEntry(entries, item);
          return (
            <li key={item.index} className={`fd-meal${item.skipped ? ' skipped' : ''}`}>
              <p className="fd-name">
                {entry && (
                  <span className="fd-tick">
                    <Check {...ICON} />
                    <span className="sr-only">zjedzone: </span>
                  </span>
                )}
                {item.skipped && <span className="sr-only">pominięte: </span>}
                {item.text}
              </p>
              <p className="fd-meta">
                <MacroLine food={planFood(item)} />
                {item.replaced && <> · zamiast: {item.replaced.text}</>}
              </p>
              <div className="fd-acts">
                {entry ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={`Cofnij: ${item.text}`}
                    onClick={() => entry.id && void db.entries.delete(entry.id)}
                  >
                    <Undo2 {...ICON} /> Cofnij
                  </button>
                ) : item.skipped ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={`Przywróć: ${item.text}`}
                    onClick={() =>
                      void updateChoices(date, (c) => ({
                        ...c,
                        skipped: (c.skipped ?? []).filter((i) => i !== item.index),
                      }))
                    }
                  >
                    <Undo2 {...ICON} /> Przywróć
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn sm"
                      aria-label={`Zjadłem: ${item.text}`}
                      onClick={() => void logPlanItem(date, item.index, item)}
                    >
                      <Check {...ICON} /> Zjadłem
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={`Zamień: ${item.text}`}
                      onClick={() => onSwap(item)}
                    >
                      <Repeat {...ICON} /> Zamień
                    </button>
                    {item.replaced ? (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-label={`Oryginał: ${item.replaced.text}`}
                        onClick={() =>
                          void updateChoices(date, (c) => {
                            const swaps = { ...c.swaps };
                            delete swaps[item.index];
                            return { ...c, swaps };
                          })
                        }
                      >
                        <Undo2 {...ICON} /> Oryginał
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-label={`Pomiń: ${item.text}`}
                        onClick={() =>
                          void updateChoices(date, (c) => ({ ...c, skipped: [...(c.skipped ?? []), item.index] }))
                        }
                      >
                        <SkipForward {...ICON} /> Pomiń
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="tight">
        Plan: {formatNumber(plannedKcal(planned) ?? 0, 0)} kcal
        {left.length > 0 && <> · do zjedzenia z planu jeszcze {formatNumber(leftKcal, 0)} kcal</>}
      </p>
    </section>
  );
}
