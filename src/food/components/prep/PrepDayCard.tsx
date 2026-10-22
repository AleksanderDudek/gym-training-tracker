import { Check, ChefHat, ListChecks, Snowflake, Undo2 } from 'lucide-react';
import { pluralEn, text } from '../../../i18n';
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
import { COMMON } from '../common/text';
import './prep.css';

const T = text({
  pl: {
    saved: (name: string, kcal: string) => `Zapisane: ${name} · ${kcal} kcal.`,
    title: 'Plan na ten dzień',
    day: (day: number, days: number) => `· dzień ${day} z ${days}`,
    cooking: 'Dziś gotujesz',
    batch: (name: string, portion: string, boxes: number, span: string) =>
      `${name}: ${portion}, ${boxes} ${plural(boxes, 'pudełko', 'pudełka', 'pudełek')} na ${span}`,
    amounts: 'Ilości i przepis w planie',
    thaw: (list: string) => `Na jutro przełóż z zamrażarki do lodówki: ${list}.`,
    eatenSr: 'zjedzone: ',
    fromBox: ' · z pudełka',
    undoLabel: (name: string) => `Cofnij: ${name}`,
    undo: 'Cofnij',
    eatLabel: (name: string) => `Zjadłem: ${name}`,
    eat: 'Zjadłem',
    plan: (kcal: string) => `Plan: ${kcal} kcal`,
    left: (kcal: string) => ` · do zjedzenia z planu jeszcze ${kcal} kcal`,
    list: 'Lista zakupów',
  },
  en: {
    saved: (name: string, kcal: string) => `Saved: ${name} · ${kcal} kcal.`,
    title: 'Plan for this day',
    day: (day: number, days: number) => `· day ${day} of ${days}`,
    cooking: 'Cooking today',
    batch: (name: string, portion: string, boxes: number, span: string) =>
      `${name}: ${portion}, ${boxes} ${pluralEn(boxes, 'box', 'boxes')} for ${span}`,
    amounts: 'Amounts and recipe in the plan',
    thaw: (list: string) => `For tomorrow, move from the freezer to the fridge: ${list}.`,
    eatenSr: 'eaten: ',
    fromBox: ' · from a box',
    undoLabel: (name: string) => `Undo: ${name}`,
    undo: 'Undo',
    eatLabel: (name: string) => `Eaten: ${name}`,
    eat: 'Eaten',
    plan: (kcal: string) => `Plan: ${kcal} kcal`,
    left: (kcal: string) => ` · ${kcal} kcal of the plan still to eat`,
    list: 'Shopping list',
  },
});

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
      bridge.toast(T.saved(food.name, formatNumber(food.nutrients.kcal, 0))),
    );
  };

  return (
    <section className="grp" aria-labelledby="fd-prep-day-title">
      <h2 id="fd-prep-day-title">
        {T.title}
        <span className="sr-only">:</span>{' '}
        <span className="fd-prep-daytitle">
          <a href={planHref(plan)}>{planName(plan)}</a>{' '}
          <span className="fd-prep-soft">{T.day(day, plan.settings.days)}</span>
        </span>
      </h2>
      {cooking.length > 0 && (
        <div className="dnote fd-prep-cooknote">
          <b>
            <ChefHat size={16} strokeWidth={2} aria-hidden /> {T.cooking}
          </b>
          <ul className="fd-prep-bullets">
            {cooking.map((b) => (
              <li key={`${b.role}:${b.recipeId}`}>
                {T.batch(b.name, portionLabel(b.servings), b.boxes.length, weekdaySpan(b.boxes.map((x) => x.date)))}
              </li>
            ))}
          </ul>
          <a href={planHref(plan)}>{T.amounts}</a>
        </div>
      )}
      {thaw.length > 0 && (
        <p className="tight fd-prep-cold">
          <Snowflake size={16} strokeWidth={2} aria-hidden /> {T.thaw(thaw.map((t) => `${t.name} (${gramsLabel(t.grams)})`).join(', '))}
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
                      <span className="sr-only">{T.eatenSr}</span>
                    </span>
                  )}
                  {meal.name}
                </p>
                <p className="fd-prep-meta">
                  {mealAmount(meal)}
                  {meal.box !== null && T.fromBox}
                </p>
                <p className="fd-prep-meta fd-prep-nums">
                  {formatNumber(meal.total.kcal, 0)} kcal · {COMMON.p} {formatNumber(meal.total.protein, 0)} · {COMMON.c}{' '}
                  {formatNumber(meal.total.carbs, 0)} · {COMMON.f} {formatNumber(meal.total.fat, 0)}
                </p>
              </div>
              {entry ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  aria-label={T.undoLabel(meal.name)}
                  onClick={() => entry.id && void db.entries.delete(entry.id)}
                >
                  <Undo2 {...ICON} /> {T.undo}
                </button>
              ) : (
                <button type="button" className="btn ghost sm" aria-label={T.eatLabel(meal.name)} onClick={() => eat(meal)}>
                  <Check {...ICON} /> {T.eat}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tight">
        {T.plan(formatNumber(total.kcal, 0))}
        {left > 0 && left < total.kcal && T.left(formatNumber(left, 0))}
      </p>
      <a className="btn ghost sm fd-prep-listlink" href={shoppingHref(plan)}>
        <ListChecks {...ICON} /> {T.list}
      </a>
    </section>
  );
}
