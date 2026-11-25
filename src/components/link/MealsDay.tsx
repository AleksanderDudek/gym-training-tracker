import { useEffect, useState } from 'react';
import type { MealDay, MealsBody, PlannedMeal } from '@gymtracker/link';
import { localDay, mealDayIndex } from '@gymtracker/link/coaching';
import { num, text } from '../../i18n';
import { ticksOn, useLink } from '../../link/store';
import { setAssignmentStatus, setDayTicks } from '../../link/sync';
import { sentDay } from '../../link/today';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';
import { DayStrip, cap, dayText, recentDays } from './DayStrip';
import type { MealShopping, ShopLine } from './mealRecipes';
import './meals.css';

/**
 * Jadłospis od prowadzącego na stronie zalecenia: dzień cyklu na wybrany dzień, posiłki do
 * odhaczenia („Zjedzone”), suma dnia wobec zjedzonego, podgląd pozostałych dni cyklu, przepisy
 * z katalogu GYM TRACKERa (składniki i kroki na miejscu, odnośnik do Przepisów) i lista zakupów
 * ze składników przepisów. Odhaczenia idą do prowadzącego w paczce (`setDayTicks`).
 */

const T = text({
  pl: {
    days: 'Dni',
    dayN: (n: number) => `Dzień ${n}`,
    todayIs: (name: string) => `Dziś: ${name}`,
    dayIs: (date: string, name: string) => `${date}: ${name}`,
    cycle: (n: number, all: number) => `Dzień ${n} z ${all} w cyklu.`,
    progress: (done: number, due: number) => `Zjedzone ${done} z ${due}.`,
    all: 'Cały dzień zjedzony.',
    startsOn: (d: string) => `Jadłospis zaczyna się ${d}.`,
    startsPreview: 'Poniżej podgląd — odhaczysz od pierwszego dnia.',
    back: 'Odhaczasz za wcześniejszy dzień.',
    toToday: 'Wróć do dziś',
    preview: (name: string) => `Podgląd: ${name}. Posiłki odhaczasz w dniu, w którym je jesz.`,
    backTo: (name: string) => `Wróć do: ${name}`,
    eaten: 'Zjedzone',
    eatenLabel: (what: string) => `Zjedzone: ${what}`,
    kcal: (n: string) => `${n} kcal`,
    p: (n: string) => `B ${n} g`,
    c: (n: string) => `W ${n} g`,
    f: (n: string) => `T ${n} g`,
    plan: 'Plan dnia',
    eatenSum: 'Zjedzone',
    noNumbers: 'prowadzący nie podał wartości',
    cycleDays: 'Dni jadłospisu',
    recipe: (min: number) => `Przepis · ${min} min`,
    perServing: 'Składniki na porcję',
    servings: (n: number) => `Przepis jest na ${n} ${n < 5 ? 'porcje' : 'porcji'} — tu składniki na jedną.`,
    steps: 'Przygotowanie',
    openRecipe: 'Otwórz w Przepisach',
    shop: 'Lista zakupów',
    shopDay: 'Na ten dzień',
    shopAll: 'Na cały jadłospis',
    shopHint: 'Składniki przepisów z jadłospisu, jedna porcja na posiłek. Zajrzyj do lodówki, zanim wyjdziesz.',
    loading: 'Wczytuję przepisy…',
    buy: 'Do kupienia',
    home: 'Sprawdź w domu',
    loose: 'Bez przepisu — kupujesz według nazwy',
    noRecipes: 'W tych posiłkach nie ma przepisów z katalogu — kupujesz według nazw.',
    packs: (n: number) => `${n} opak.`,
    note: 'Od prowadzącego',
  },
  en: {
    days: 'Days',
    dayN: (n: number) => `Day ${n}`,
    todayIs: (name: string) => `Today: ${name}`,
    dayIs: (date: string, name: string) => `${date}: ${name}`,
    cycle: (n: number, all: number) => `Day ${n} of ${all} in the cycle.`,
    progress: (done: number, due: number) => `Eaten ${done} of ${due}.`,
    all: 'The whole day eaten.',
    startsOn: (d: string) => `The meal plan starts on ${d}.`,
    startsPreview: 'Here is a preview — you can tick from the first day.',
    back: 'You are ticking an earlier day.',
    toToday: 'Back to today',
    preview: (name: string) => `Preview: ${name}. You tick meals on the day you eat them.`,
    backTo: (name: string) => `Back to: ${name}`,
    eaten: 'Eaten',
    eatenLabel: (what: string) => `Eaten: ${what}`,
    kcal: (n: string) => `${n} kcal`,
    p: (n: string) => `P ${n} g`,
    c: (n: string) => `C ${n} g`,
    f: (n: string) => `F ${n} g`,
    plan: 'Day plan',
    eatenSum: 'Eaten',
    noNumbers: 'your coach gave no values',
    cycleDays: 'Meal plan days',
    recipe: (min: number) => `Recipe · ${min} min`,
    perServing: 'Ingredients per serving',
    servings: (n: number) => `The recipe makes ${n} servings — these are for one.`,
    steps: 'Method',
    openRecipe: 'Open in Recipes',
    shop: 'Shopping list',
    shopDay: 'For this day',
    shopAll: 'For the whole plan',
    shopHint: 'Ingredients of the plan’s recipes, one serving per meal. Check the fridge before you go.',
    loading: 'Loading recipes…',
    buy: 'To buy',
    home: 'Check at home',
    loose: 'No recipe — buy by name',
    noRecipes: 'These meals have no catalogue recipes — buy by their names.',
    packs: (n: number) => `${n} ${n === 1 ? 'pack' : 'packs'}`,
    note: 'From your coach',
  },
});

type RecipeModule = typeof import('./mealRecipes');

/** Katalog przepisów dopiero wtedy, gdy jadłospis jakiś ma — osobny kawałek paczki. */
function useRecipes(need: boolean): RecipeModule | null {
  const [mod, setMod] = useState<RecipeModule | null>(null);
  useEffect(() => {
    if (!need || mod) return;
    let alive = true;
    import('./mealRecipes').then(
      (m) => {
        if (alive) setMod(m);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [need, mod]);
  return mod;
}

interface Sum {
  /** `null` — żaden posiłek nie ma tej wartości (zamiast mylącego „0 g”). */
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  any: boolean;
}

/** Suma wartości posiłków (tych, które je mają). */
export function sumMeals(meals: readonly PlannedMeal[]): Sum {
  const s: Sum = { kcal: null, protein: null, carbs: null, fat: null, any: false };
  for (const m of meals) {
    for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
      if (m[k] !== null) {
        s[k] = (s[k] ?? 0) + m[k]!;
        s.any = true;
      }
    }
  }
  return s;
}

const macroText = (m: Pick<PlannedMeal, 'kcal' | 'protein' | 'carbs' | 'fat'>): string =>
  [
    m.kcal !== null ? T.kcal(num(Math.round(m.kcal))) : null,
    m.protein !== null ? T.p(num(Math.round(m.protein))) : null,
    m.carbs !== null ? T.c(num(Math.round(m.carbs))) : null,
    m.fat !== null ? T.f(num(Math.round(m.fat))) : null,
  ]
    .filter(Boolean)
    .join(' · ');

const grams = (g: number): string => (g < 10 ? num(g, g % 1 ? 1 : 0) : num(Math.round(g)));

/** Ilość na liście zakupów: w górę do 5 g, od kilograma w kilogramach. */
export const shopAmount = (l: Pick<ShopLine, 'grams' | 'packs'>): string =>
  l.packs !== null ? T.packs(l.packs) : l.grams >= 1000 ? `${num(l.grams / 1000, 1)} kg` : l.grams < 5 ? `${grams(l.grams)} g` : `${num(Math.ceil(l.grams / 5) * 5)} g`;

const longDay = (day: string) => dayText(day, { weekday: 'long', day: 'numeric', month: 'long' });

export function MealsAssignment({ stored, state }: { stored: Coached<MealsBody>; state: AppState }) {
  const s = useLink();
  const b = stored.a.body;
  const today = localDay();
  const sd = sentDay(stored);
  const start = b.start ?? sd;
  // Nic przed wysłaniem i nic przed startem cyklu.
  const first = start > sd ? start : sd;
  const started = first <= today;
  const days = started ? recentDays(today, first) : [];
  const [picked, setPicked] = useState(today);
  const day = days.includes(picked) ? picked : today;
  const idx = started ? mealDayIndex(b, sd, day) : null;
  const [preview, setPreview] = useState<number | null>(null);
  const [shop, setShop] = useState<'day' | 'all' | null>(null);
  const shown = preview ?? idx ?? 0;
  const tickable = preview === null && idx !== null;
  const md = b.days[shown]!;
  const ticked = new Set(ticksOn(s, stored.id, day));
  const mod = useRecipes(b.days.some((d) => d.meals.some((m) => m.recipe)));

  const name = (i: number) => b.days[i]!.label || T.dayN(i + 1);
  const toggle = (i: number) => {
    const next = new Set(ticked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setDayTicks(stored, day, md.meals.map((_, k) => k).filter((k) => next.has(k)), () => state);
    if (stored.status === 'new' || stored.status === 'seen' || stored.status === 'declined') void setAssignmentStatus(stored.id, 'started');
  };
  const count = (d: string) => {
    const i = mealDayIndex(b, sd, d);
    if (i === null || d < first) return { done: 0, due: 0 };
    const t = new Set(ticksOn(s, stored.id, d));
    const n = b.days[i]!.meals.length;
    return { done: Array.from({ length: n }, (_, k) => k).filter((k) => t.has(k)).length, due: n };
  };
  const choose = (i: number) => setPreview(i === idx ? null : i);
  const pickDay = (d: string) => {
    setPicked(d);
    setPreview(null);
  };
  const eaten = md.meals.filter((_, i) => ticked.has(i));
  const progress = count(day);

  return (
    <>
      <div className="grp lk-meals-head">
        {idx !== null ? (
          <>
            <h2>{day === today ? T.todayIs(name(idx)) : T.dayIs(cap(longDay(day)), name(idx))}</h2>
            <p className="tight">
              {b.days[idx]!.label ? `${T.cycle(idx + 1, b.days.length)} ` : ''}
              <span aria-live="polite">
                {T.progress(progress.done, progress.due)}
                {progress.done === progress.due ? ` ${T.all}` : ''}
              </span>
            </p>
          </>
        ) : (
          <>
            <h2>{T.startsOn(dayText(start, { day: 'numeric', month: 'long' }))}</h2>
            <p className="tight">{T.startsPreview}</p>
          </>
        )}
        <DayStrip days={days} today={today} value={day} onChange={pickDay} count={count} label={T.days} />
        {started && day !== today ? (
          <p className="tight lk-meals-soft">
            {T.back}{' '}
            <button type="button" className="lk-meals-link" onClick={() => pickDay(today)}>
              {T.toToday}
            </button>
          </p>
        ) : null}
        {preview !== null && idx !== null ? (
          <p className="tight lk-meals-preview">
            {T.preview(name(preview))}{' '}
            <button type="button" className="lk-meals-link" onClick={() => setPreview(null)}>
              {T.backTo(name(idx))}
            </button>
          </p>
        ) : null}
      </div>

      <div className="grp">
        {preview !== null || idx === null ? <h3 className="lk-meals-dayname">{name(shown)}</h3> : null}
        <ul className="lk-meals-list">
          {md.meals.map((m, i) => (
            <li key={i} className={`lk-meals-meal${tickable && ticked.has(i) ? ' lk-meals-done' : ''}`}>
              {m.slot ? <span className="lk-meals-slot">{m.slot}</span> : null}
              <span className="lk-meals-name">{m.name}</span>
              {macroText(m) ? <span className="lk-meals-macros">{macroText(m)}</span> : null}
              {m.note ? <span className="lk-meals-note">{m.note}</span> : null}
              {mod && m.recipe ? <RecipeDetails id={m.recipe} mod={mod} /> : null}
              {tickable ? (
                <label className="lk-meals-eaten">
                  <input type="checkbox" checked={ticked.has(i)} aria-label={T.eatenLabel([m.slot, m.name].filter(Boolean).join(' — '))} onChange={() => toggle(i)} />
                  <span aria-hidden="true">{T.eaten}</span>
                </label>
              ) : null}
            </li>
          ))}
        </ul>
        <DayTotals plan={md} eaten={tickable ? eaten : null} />
      </div>

      {b.days.length > 1 ? (
        <div className="grp">
          <h2>{T.cycleDays}</h2>
          <div className="lk-meals-chips" role="group" aria-label={T.cycleDays}>
            {b.days.map((_, i) => (
              <button key={i} type="button" className="lk-meals-chip" aria-pressed={i === shown} onClick={() => choose(i)}>
                {name(i)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {b.days.some((d) => d.meals.length) ? (
        <div className="grp">
          <h2>{T.shop}</h2>
          <div className="lk-meals-chips" role="group" aria-label={T.shop}>
            <button type="button" className="lk-meals-chip" aria-pressed={shop === 'day'} onClick={() => setShop(shop === 'day' ? null : 'day')}>
              {T.shopDay}
            </button>
            <button type="button" className="lk-meals-chip" aria-pressed={shop === 'all'} onClick={() => setShop(shop === 'all' ? null : 'all')}>
              {T.shopAll}
            </button>
          </div>
          {shop ? <Shopping meals={shop === 'day' ? md.meals : b.days.flatMap((d) => d.meals)} mod={mod} need={b.days.some((d) => d.meals.some((m) => m.recipe))} /> : null}
        </div>
      ) : null}

      {b.note ? (
        <div className="grp">
          <h2>{T.note}</h2>
          <p className="link-text">{b.note}</p>
        </div>
      ) : null}
    </>
  );
}

function DayTotals({ plan, eaten }: { plan: MealDay; eaten: PlannedMeal[] | null }) {
  const p = sumMeals(plan.meals);
  const e = eaten ? sumMeals(eaten) : null;
  return (
    <dl className="lk-meals-totals">
      <div>
        <dt>{T.plan}</dt>
        <dd>{p.any ? macroText(p) : T.noNumbers}</dd>
      </div>
      {e && p.any ? (
        <div>
          <dt>{T.eatenSum}</dt>
          {/* Te same składniki co w planie dnia: niezjedzone — zero, a nie znika. */}
          <dd>{macroText({ kcal: p.kcal === null ? null : (e.kcal ?? 0), protein: p.protein === null ? null : (e.protein ?? 0), carbs: p.carbs === null ? null : (e.carbs ?? 0), fat: p.fat === null ? null : (e.fat ?? 0) })}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function RecipeDetails({ id, mod }: { id: string; mod: RecipeModule }) {
  const r = mod.recipeOf(id);
  if (!r) return null;
  const n = r.servings ?? 1;
  return (
    <details className="lk-meals-recipe">
      <summary>{T.recipe(r.minutes)}</summary>
      {r.description ? <p className="lk-meals-soft">{r.description}</p> : null}
      <h4>{T.perServing}</h4>
      <ul>
        {mod.portion(r).map((p, i) => (
          <li key={`${p.id}-${i}`}>
            {p.label} — {p.measure ? `${p.measure} (${grams(p.grams)} g)` : `${grams(p.grams)} g`}
          </li>
        ))}
      </ul>
      {n > 1 ? <p className="lk-meals-soft">{T.servings(n)}</p> : null}
      <h4>{T.steps}</h4>
      <ol>
        {r.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <a className="lk-meals-open" href={mod.recipeHref(r.id)}>
        {T.openRecipe}
      </a>
    </details>
  );
}

function Shopping({ meals, mod, need }: { meals: PlannedMeal[]; mod: RecipeModule | null; need: boolean }) {
  if (need && !mod) return <p className="tight">{T.loading}</p>;
  const list: MealShopping = mod ? mod.shoppingFor(meals) : { buy: [], home: [], loose: [...new Set(meals.map((m) => m.name))] };
  if (!list.buy.length && !list.home.length) return <p className="tight">{T.noRecipes}</p>;
  return (
    <div className="lk-meals-shop">
      <p className="lk-meals-soft">{T.shopHint}</p>
      {(
        [
          [T.buy, list.buy],
          [T.home, list.home],
        ] as const
      ).map(([title, lines]) =>
        lines.length ? (
          <div key={title}>
            <h3>{title}</h3>
            <ul>
              {lines.map((l) => (
                <li key={l.id}>
                  <span>{l.label}</span>
                  <span className="lk-meals-amount">{shopAmount(l)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {list.loose.length ? (
        <div>
          <h3>{T.loose}</h3>
          <p className="tight">{list.loose.join(', ')}</p>
        </div>
      ) : null}
    </div>
  );
}
