import { Check, ChefHat, ListChecks, Snowflake, Undo2 } from 'lucide-react';
import { useBridge } from '../../bridge';
import { db, type Entry } from '../../diet/db';
import { logFood } from '../../diet/store';
import { formatNumber, plural } from '../../lib/format';
import { addDays, daysBetween } from '../../diet/model';
import { gramsLabel, portionLabel, weekdaySpan } from '../../prep/format';
import { dayPlanTotals, mealAmount, mealFood, mealsOn } from '../../prep/meals';
import { itemName } from '../../prep/shopping';
import { planName } from '../../prep/store';
import type { PrepMeal, PrepPlan } from '../../prep/types';
import { planHref, shoppingHref } from './links';
import './prep.css';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/** The entry that ticked this meal off: its slot and its recipe, on this day. */
const eatenEntry = (entries: Entry[], meal: PrepMeal) =>
  entries.find((e) => e.planIndex === meal.slot && e.key === mealFood(meal).key);

interface Props {
  plan: PrepPlan;
  date: string;
  entries: Entry[];
}

/**
 * Plan z zakupami w dzienniku: posiłki dnia do odhaczenia, w dniu gotowania — co ugotować, dzień
 * przed nim — co przełożyć z zamrażarki. Odhaczony posiłek to zwykły wpis (porcja z dodatkami),
 * więc liczy się w bilansie jak wszystko, co zjedzone. W tytule nazwa planu z odnośnikiem do niego:
 * planów bywa kilka, a po nazwie widać, który prowadzi ten dzień.
 */
export function PrepDayCard({ plan, date, entries }: Props) {
  const bridge = useBridge();
  const meals = mealsOn(plan, date);
  const day = daysBetween(plan.settings.start, date) + 1;
  const cooking = plan.batches.filter((b) => b.date === date);
  const thaw = plan.shopping.flatMap((i) => i.freeze.filter((f) => f.date === addDays(date, 1)).map((f) => ({ ...f, name: itemName(i) })));
  const total = dayPlanTotals(plan, date);
  const left = meals.filter((m) => !eatenEntry(entries, m)).reduce((s, m) => s + m.total.kcal, 0);

  const eat = (meal: PrepMeal) => {
    const food = mealFood(meal);
    void logFood(date, food, { planIndex: meal.slot }).then(() =>
      bridge.toast(`Zapisane: ${food.name} · ${formatNumber(food.nutrients.kcal, 0)} kcal.`),
    );
  };

  return (
    <section className="grp" aria-labelledby="fd-prep-day-title">
      <h2 id="fd-prep-day-title">
        Plan na ten dzień<span className="sr-only">:</span>{' '}
        <span className="fd-prep-daytitle">
          <a href={planHref(plan)}>{planName(plan)}</a>{' '}
          <span className="fd-prep-soft">
            · dzień {day} z {plan.settings.days}
          </span>
        </span>
      </h2>
      {cooking.length > 0 && (
        <div className="dnote fd-prep-cooknote">
          <b>
            <ChefHat size={16} strokeWidth={2} aria-hidden /> Dziś gotujesz
          </b>
          <ul className="fd-prep-bullets">
            {cooking.map((b) => (
              <li key={`${b.role}:${b.recipeId}`}>
                {b.name}: {portionLabel(b.servings)}, {b.boxes.length}{' '}
                {plural(b.boxes.length, 'pudełko', 'pudełka', 'pudełek')} na {weekdaySpan(b.boxes.map((x) => x.date))}
              </li>
            ))}
          </ul>
          <a href={planHref(plan)}>Ilości i przepis w planie</a>
        </div>
      )}
      {thaw.length > 0 && (
        <p className="tight fd-prep-cold">
          <Snowflake size={16} strokeWidth={2} aria-hidden /> Na jutro przełóż z zamrażarki do lodówki:{' '}
          {thaw.map((t) => `${t.name} (${gramsLabel(t.grams)})`).join(', ')}.
        </p>
      )}
      <ul className="fd-prep-rows">
        {meals.map((meal) => {
          const entry = eatenEntry(entries, meal);
          return (
            <li key={meal.slot} className="fd-prep-row">
              <div className="fd-prep-row-main">
                <p className="fd-prep-group">{meal.slotName}</p>
                <p className="fd-prep-name">
                  {entry && (
                    <span className="fd-prep-tick">
                      <Check {...ICON} />
                      <span className="sr-only">zjedzone: </span>
                    </span>
                  )}
                  {meal.name}
                </p>
                <p className="fd-prep-meta">
                  {mealAmount(meal)}
                  {meal.box !== null && ' · z pudełka'}
                </p>
                <p className="fd-prep-meta fd-prep-nums">
                  {formatNumber(meal.total.kcal, 0)} kcal · B {formatNumber(meal.total.protein, 0)} · W{' '}
                  {formatNumber(meal.total.carbs, 0)} · T {formatNumber(meal.total.fat, 0)}
                </p>
              </div>
              {entry ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={`Cofnij: ${meal.name}`}
                  onClick={() => entry.id && void db.entries.delete(entry.id)}
                >
                  <Undo2 {...ICON} /> Cofnij
                </button>
              ) : (
                <button type="button" className="btn ghost sm" aria-label={`Zjadłem: ${meal.name}`} onClick={() => eat(meal)}>
                  <Check {...ICON} /> Zjadłem
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tight">
        Plan: {formatNumber(total.kcal, 0)} kcal
        {left > 0 && left < total.kcal && <> · do zjedzenia z planu jeszcze {formatNumber(left, 0)} kcal</>}
      </p>
      <a className="btn ghost sm fd-prep-listlink" href={shoppingHref(plan)}>
        <ListChecks {...ICON} /> Lista zakupów
      </a>
    </section>
  );
}
