import { Check, Repeat, SkipForward, Undo2 } from 'lucide-react';
import { text } from '../../../i18n';
import { db, type Entry } from '../../diet/db';
import { planFood } from '../../diet/foods';
import { plannedKcal, type Plan, type PlannedDay, type PlannedItem } from '../../diet/plan';
import { logPlanItem, updateChoices } from '../../diet/store';
import { formatNumber } from '../../lib/format';
import { DT } from './dietText';
import { useKcalShown } from './kcalShown';
import { MacroLine } from './SuggestionList';

const T = text({
  pl: {
    title: 'Plan na ten dzień',
    day: (template: string) => `· dzień ${template}`,
    variant: 'Wariant',
    eaten: 'zjedzone: ',
    skipped: 'pominięte: ',
    instead: (text: string) => ` · zamiast: ${text}`,
    undo: 'Cofnij',
    undoItem: (text: string) => `Cofnij: ${text}`,
    restore: 'Przywróć',
    restoreItem: (text: string) => `Przywróć: ${text}`,
    swap: 'Zamień',
    swapItem: (text: string) => `Zamień: ${text}`,
    original: 'Oryginał',
    originalItem: (text: string) => `Oryginał: ${text}`,
    skip: 'Pomiń',
    skipItem: (text: string) => `Pomiń: ${text}`,
    total: (kcal: string) => `Plan: ${kcal} kcal`,
    left: (kcal: string) => ` · do zjedzenia z planu jeszcze ${kcal} kcal`,
  },
  en: {
    title: 'Plan for this day',
    day: (template: string) => `· day ${template}`,
    variant: 'Option',
    eaten: 'eaten: ',
    skipped: 'skipped: ',
    instead: (text: string) => ` · instead of: ${text}`,
    undo: 'Undo',
    undoItem: (text: string) => `Undo: ${text}`,
    restore: 'Restore',
    restoreItem: (text: string) => `Restore: ${text}`,
    swap: 'Swap',
    swapItem: (text: string) => `Swap: ${text}`,
    original: 'Original',
    originalItem: (text: string) => `Original: ${text}`,
    skip: 'Skip',
    skipItem: (text: string) => `Skip: ${text}`,
    total: (kcal: string) => `Plan: ${kcal} kcal`,
    left: (kcal: string) => ` · still to eat from the plan: ${kcal} kcal`,
  },
});

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
  const shown = useKcalShown();
  const variants = plan.templates[planned.template] ?? [];
  const left = planned.items.filter((i) => !i.skipped && !eatenEntry(entries, i));
  const leftKcal = left.reduce((sum, i) => sum + i.kcal, 0);

  return (
    <section className="grp" aria-labelledby="fd-diet-plan-day-title">
      <h2 id="fd-diet-plan-day-title">
        {T.title} <span className="fd-diet-h-meta">{T.day(planned.template)}</span>
      </h2>
      <label className="fld fd-diet-variant">
        <span>{T.variant}</span>
        <select
          value={planned.variant}
          // Inny wariant ma inne linie: jego zamiany i pominięcia wskazywałyby nie te pozycje.
          onChange={(e) => void updateChoices(date, () => ({ variant: Number(e.target.value) }))}
        >
          {variants.map((v) => (
            <option key={v.index} value={v.index}>
              {`${v.index} · ${shown ? `${formatNumber(v.totals.kcal, 0)} kcal · ` : ''}${DT.p} ${formatNumber(v.totals.protein ?? 0, 0)} g`}
            </option>
          ))}
        </select>
      </label>

      <ul className="fd-diet-list">
        {planned.items.map((item) => {
          const entry = eatenEntry(entries, item);
          return (
            <li key={item.index} className={`fd-diet-meal${item.skipped ? ' skipped' : ''}`}>
              <p className="fd-diet-name">
                {entry && (
                  <span className="fd-diet-tick">
                    <Check {...ICON} />
                    <span className="sr-only">{T.eaten}</span>
                  </span>
                )}
                {item.skipped && <span className="sr-only">{T.skipped}</span>}
                {item.text}
              </p>
              <p className="fd-diet-meta">
                <MacroLine food={planFood(item)} />
                {item.replaced && T.instead(item.replaced.text)}
              </p>
              <div className="fd-diet-acts">
                {entry ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={T.undoItem(item.text)}
                    onClick={() => entry.id && void db.entries.delete(entry.id)}
                  >
                    <Undo2 {...ICON} /> {T.undo}
                  </button>
                ) : item.skipped ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    aria-label={T.restoreItem(item.text)}
                    onClick={() =>
                      void updateChoices(date, (c) => ({
                        ...c,
                        skipped: (c.skipped ?? []).filter((i) => i !== item.index),
                      }))
                    }
                  >
                    <Undo2 {...ICON} /> {T.restore}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn sm"
                      aria-label={DT.ateFood(item.text)}
                      onClick={() => void logPlanItem(date, item.index, item)}
                    >
                      <Check {...ICON} /> {DT.ate}
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      aria-label={T.swapItem(item.text)}
                      onClick={() => onSwap(item)}
                    >
                      <Repeat {...ICON} /> {T.swap}
                    </button>
                    {item.replaced ? (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-label={T.originalItem(item.replaced.text)}
                        onClick={() =>
                          void updateChoices(date, (c) => {
                            const swaps = { ...c.swaps };
                            delete swaps[item.index];
                            return { ...c, swaps };
                          })
                        }
                      >
                        <Undo2 {...ICON} /> {T.original}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost sm"
                        aria-label={T.skipItem(item.text)}
                        onClick={() =>
                          void updateChoices(date, (c) => ({ ...c, skipped: [...(c.skipped ?? []), item.index] }))
                        }
                      >
                        <SkipForward {...ICON} /> {T.skip}
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown && (
        <p className="tight">
          {T.total(formatNumber(plannedKcal(planned) ?? 0, 0))}
          {left.length > 0 && T.left(formatNumber(leftKcal, 0))}
        </p>
      )}
    </section>
  );
}
