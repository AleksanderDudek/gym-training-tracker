import { useMemo, useState } from 'react';
import { cleanMeals } from '@gymtracker/link';
import type { MealDay, MealsBody, PlannedMeal } from '@gymtracker/link';
import { normalizeForSearch } from '@gt/food/lib/text';
import { KIND_LABELS, RECIPES } from '@gt/food/recipes/catalog';
import type { Recipe } from '@gt/food/recipes/catalog';
import { num, text } from '@gt/i18n';
import './MealsEditor.css';

/**
 * Kreator jadłospisu: dni cyklu × posiłki. Posiłek to nazwa albo przepis z katalogu GYM TRACKERa
 * (telefon otworzy go w Przepisach) i wartości, które wpisuje prowadzący — Sztab nie wczytuje bazy
 * produktów, więc makro przepisu nie liczy się tutaj samo. Telefon pokazuje dzień cyklu na dziś
 * i odhacza posiłki, Sztab — realizację ze światłami.
 */

export const MAX_DAYS = 14;
export const MAX_MEALS = 8;

/** Granice, które przepuszcza `cleanMeals` — wartość spoza nich telefon pomija. */
export const MACRO_LIMITS = { kcal: 5000, protein: 500, carbs: 1000, fat: 500 } as const;
type Macro = keyof typeof MACRO_LIMITS;
const MACROS: Macro[] = ['kcal', 'protein', 'carbs', 'fat'];

const T = text({
  pl: {
    title: 'Nazwa jadłospisu',
    titlePh: 'np. Redukcja 2000 kcal, Tydzień z rybą',
    start: 'Start cyklu (opcjonalnie)',
    startHint: 'Puste — cykl rusza w dniu wysłania. Dni nazwane od poniedziałku? Wybierz poniedziałek.',
    clearStart: 'Od wysłania',
    note: 'Komentarz dla podopiecznego',
    notePh: 'np. Posiłki możesz zamieniać w obrębie dnia.',
    days: 'Dni cyklu',
    daysHint: 'Po ostatnim dniu cykl wraca do pierwszego.',
    dayN: (n: number) => `Dzień ${n}`,
    dayLabel: 'Nazwa dnia',
    dayLabelHint: 'np. dzień tygodnia; puste — numer dnia',
    weekdays: ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'],
    dayUp: (n: number) => `Dzień ${n} wyżej`,
    dayDown: (n: number) => `Dzień ${n} niżej`,
    dayCopy: 'Duplikuj',
    dayCopyLabel: (n: number) => `Duplikuj dzień ${n}`,
    dayRemove: 'Usuń dzień',
    dayRemoveLabel: (n: number) => `Usuń dzień ${n}`,
    addDay: 'Dodaj dzień',
    noDays: 'Dodaj pierwszy dzień jadłospisu.',
    maxDays: (n: number) => `Najwyżej ${n} dni w cyklu.`,
    mealN: (d: number, m: number) => `Dzień ${d}, posiłek ${m}`,
    slot: 'Pora posiłku',
    slotOwn: 'Własna…',
    slotOwnLabel: 'Własna pora',
    slotOwnPh: 'np. Przekąska',
    slotNone: 'bez pory',
    slots: ['Śniadanie', 'II śniadanie', 'Obiad', 'Podwieczorek', 'Kolacja', 'Przed treningiem', 'Po treningu'],
    name: 'Posiłek albo przepis z GYM TRACKERa',
    namePh: 'Wpisz nazwę albo szukaj przepisu, np. owsianka',
    recipes: 'Przepisy GYM TRACKERa',
    recipe: 'Przepis',
    min: (n: number) => `${n} min`,
    unlink: 'Odłącz przepis',
    unknownRecipe: 'nie ma go już w katalogu',
    kcal: 'kcal',
    protein: 'Białko, g',
    carbs: 'Węglowodany, g',
    fat: 'Tłuszcz, g',
    mealNote: 'Uwaga (opcjonalnie)',
    mealNotePh: 'np. zamiennie z jogurtem',
    mealUp: (d: number, m: number) => `Dzień ${d}, posiłek ${m} wyżej`,
    mealDown: (d: number, m: number) => `Dzień ${d}, posiłek ${m} niżej`,
    mealRemove: (d: number, m: number) => `Usuń posiłek ${m} z dnia ${d}`,
    addMeal: 'Dodaj posiłek',
    maxMeals: (n: number) => `Najwyżej ${n} posiłków dziennie.`,
    noMeals: 'Dodaj posiłek tego dnia.',
    total: 'Razem',
    average: 'Średnio na dzień',
    part: { kcal: (n: string) => `${n} kcal`, protein: (n: string) => `B ${n} g`, carbs: (n: string) => `W ${n} g`, fat: (n: string) => `T ${n} g` },
    without: (n: number) => (n === 1 ? 'bez wartości: 1 posiłek' : `bez wartości: ${n} posiłki`),
    noNumbers: 'bez wpisanych wartości',
    before: 'Zanim zapiszesz albo wyślesz',
    p: {
      title: 'Nazwij jadłospis.',
      days: 'Dodaj co najmniej jeden dzień.',
      meals: (d: number) => `Dzień ${d}: dodaj co najmniej jeden posiłek.`,
      name: (d: number, m: number) => `Dzień ${d}, posiłek ${m}: wpisz nazwę albo wybierz przepis.`,
      range: (d: number, m: number, what: string, max: number) => `Dzień ${d}, posiłek ${m}: ${what} poza zakresem 0–${max} — telefon pominie tę wartość.`,
      recipe: (d: number, m: number) => `Dzień ${d}, posiłek ${m}: przepisu nie ma już w katalogu — telefon pokaże samą nazwę.`,
      tooManyDays: (n: number) => `Więcej niż ${n} dni — telefon weźmie pierwsze ${n}.`,
      tooManyMeals: (d: number, n: number) => `Dzień ${d}: więcej niż ${n} posiłków — telefon weźmie pierwsze ${n}.`,
    },
  },
  en: {
    title: 'Meal plan name',
    titlePh: 'e.g. Cut 2000 kcal, Fish week',
    start: 'Cycle start (optional)',
    startHint: 'Empty — the cycle starts on the day it is sent. Days named from Monday? Pick a Monday.',
    clearStart: 'From sending',
    note: 'Comment for the client',
    notePh: 'e.g. You can swap meals within a day.',
    days: 'Cycle days',
    daysHint: 'After the last day the cycle goes back to the first.',
    dayN: (n: number) => `Day ${n}`,
    dayLabel: 'Day name',
    dayLabelHint: 'e.g. a weekday; empty — the day number',
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dayUp: (n: number) => `Move day ${n} up`,
    dayDown: (n: number) => `Move day ${n} down`,
    dayCopy: 'Duplicate',
    dayCopyLabel: (n: number) => `Duplicate day ${n}`,
    dayRemove: 'Remove day',
    dayRemoveLabel: (n: number) => `Remove day ${n}`,
    addDay: 'Add day',
    noDays: 'Add the first day of the meal plan.',
    maxDays: (n: number) => `At most ${n} days in a cycle.`,
    mealN: (d: number, m: number) => `Day ${d}, meal ${m}`,
    slot: 'Meal',
    slotOwn: 'Custom…',
    slotOwnLabel: 'Custom meal name',
    slotOwnPh: 'e.g. Snack',
    slotNone: 'no slot',
    slots: ['Breakfast', 'Second breakfast', 'Lunch', 'Afternoon snack', 'Dinner', 'Before training', 'After training'],
    name: 'Dish or a GYM TRACKER recipe',
    namePh: 'Type a name or search recipes, e.g. oatmeal',
    recipes: 'GYM TRACKER recipes',
    recipe: 'Recipe',
    min: (n: number) => `${n} min`,
    unlink: 'Unlink recipe',
    unknownRecipe: 'no longer in the catalogue',
    kcal: 'kcal',
    protein: 'Protein, g',
    carbs: 'Carbs, g',
    fat: 'Fat, g',
    mealNote: 'Note (optional)',
    mealNotePh: 'e.g. or yoghurt instead',
    mealUp: (d: number, m: number) => `Move day ${d}, meal ${m} up`,
    mealDown: (d: number, m: number) => `Move day ${d}, meal ${m} down`,
    mealRemove: (d: number, m: number) => `Remove meal ${m} from day ${d}`,
    addMeal: 'Add meal',
    maxMeals: (n: number) => `At most ${n} meals a day.`,
    noMeals: 'Add a meal for this day.',
    total: 'Total',
    average: 'Average per day',
    part: { kcal: (n: string) => `${n} kcal`, protein: (n: string) => `P ${n} g`, carbs: (n: string) => `C ${n} g`, fat: (n: string) => `F ${n} g` },
    without: (n: number) => `no values: ${n} ${n === 1 ? 'meal' : 'meals'}`,
    noNumbers: 'no values entered',
    before: 'Before you save or send',
    p: {
      title: 'Name the meal plan.',
      days: 'Add at least one day.',
      meals: (d: number) => `Day ${d}: add at least one meal.`,
      name: (d: number, m: number) => `Day ${d}, meal ${m}: type a name or pick a recipe.`,
      range: (d: number, m: number, what: string, max: number) => `Day ${d}, meal ${m}: ${what} outside 0–${max} — the phone will skip this value.`,
      recipe: (d: number, m: number) => `Day ${d}, meal ${m}: the recipe is no longer in the catalogue — the phone shows just the name.`,
      tooManyDays: (n: number) => `More than ${n} days — the phone takes the first ${n}.`,
      tooManyMeals: (d: number, n: number) => `Day ${d}: more than ${n} meals — the phone takes the first ${n}.`,
    },
  },
});

export const emptyMeals = (): MealsBody => ({ kind: 'meals', title: '', days: [], start: null, note: '' });

export const newMeal = (slot = ''): PlannedMeal => ({ slot, name: '', recipe: null, kcal: null, protein: null, carbs: null, fat: null, note: '' });

/** Pierwsza z typowych pór, której jeszcze nie ma w dniu. */
export const nextSlot = (day: MealDay): string => T.slots.find((s) => !day.meals.some((m) => m.slot === s)) ?? '';

const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
export const recipeById = (id: string | null): Recipe | undefined => (id ? RECIPE_BY_ID.get(id) : undefined);

/** Przepisy z katalogu po nazwie (bez ogonków, wszystkie słowa); najpierw te, które od niej się zaczynają. */
export function findRecipes(query: string, limit = 8): Recipe[] {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = RECIPES.map((r) => ({ r, name: normalizeForSearch(r.name) })).filter((x) => words.every((w) => x.name.includes(w)));
  return hits
    .sort((a, b) => Number(b.name.startsWith(words[0]!)) - Number(a.name.startsWith(words[0]!)) || a.r.minutes - b.r.minutes)
    .slice(0, limit)
    .map((x) => x.r);
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Posiłki bez żadnej wartości. */
  missing: number;
}

/** Suma dnia z tego, co wpisano; posiłek bez żadnej liczby liczy się do `missing`. */
export function dayTotals(day: MealDay): Totals {
  const t: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, missing: 0 };
  for (const m of day.meals) {
    if (MACROS.every((k) => m[k] === null)) t.missing += 1;
    for (const k of MACROS) t[k] += m[k] ?? 0;
  }
  return t;
}

/** Średnia na dzień cyklu. */
export function planAverage(days: readonly MealDay[]): Totals | null {
  if (!days.length) return null;
  const all = days.map(dayTotals);
  const avg = (k: Macro) => all.reduce((n, t) => n + t[k], 0) / all.length;
  return { kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat'), missing: all.reduce((n, t) => n + t.missing, 0) };
}

/**
 * Co poprawić przed zapisem. `errors` puste ⇔ `cleanMeals` przepuści jadłospis (to samo sprawdza
 * telefon); `warnings` nie blokują, ale mówią, co telefon pominie.
 */
export function mealsProblems(b: MealsBody): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!b.title.trim()) errors.push(T.p.title);
  if (!b.days.length) errors.push(T.p.days);
  if (b.days.length > MAX_DAYS) warnings.push(T.p.tooManyDays(MAX_DAYS));
  b.days.slice(0, MAX_DAYS).forEach((d, i) => {
    if (!d.meals.length) errors.push(T.p.meals(i + 1));
    if (d.meals.length > MAX_MEALS) warnings.push(T.p.tooManyMeals(i + 1, MAX_MEALS));
    d.meals.slice(0, MAX_MEALS).forEach((m, j) => {
      if (!m.name.trim()) errors.push(T.p.name(i + 1, j + 1));
      for (const k of MACROS) {
        const v = m[k];
        if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= MACRO_LIMITS[k])) warnings.push(T.p.range(i + 1, j + 1, T[k], MACRO_LIMITS[k]));
      }
      if (m.recipe && !RECIPE_BY_ID.has(m.recipe)) warnings.push(T.p.recipe(i + 1, j + 1));
    });
  });
  return { errors, warnings };
}

export const mealsReady = (b: MealsBody): boolean => cleanMeals(b as unknown as Record<string, unknown>) !== null;

/** Suma tylko z tych wartości, które ktoś wpisał — „W 0 g” przy pustych węglowodanach myliłoby. */
const fmtTotals = (t: Totals, meals: readonly PlannedMeal[]) =>
  MACROS.filter((k) => meals.some((m) => m[k] !== null))
    .map((k) => T.part[k](num(Math.round(t[k]))))
    .join(' · ');

function TotalsLine({ label, t, meals }: { label: string; t: Totals | null; meals: readonly PlannedMeal[] }) {
  if (!t) return null;
  const text = fmtTotals(t, meals);
  return (
    <p className="sz-meals-total small">
      <strong>{label}:</strong> {text || T.noNumbers}
      {text && t.missing ? <span className="soft"> ({T.without(t.missing)})</span> : null}
    </p>
  );
}

const OWN = '__own';

let seq = 0;
const nextKey = () => `m${++seq}`;
const fit = (keys: readonly string[], n: number): string[] => {
  const out = keys.slice(0, n);
  while (out.length < n) out.push(nextKey());
  return out;
};
const swapped = <X,>(a: readonly X[], i: number, j: number): X[] => {
  const out = [...a];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
};

/** Klucze dni i posiłków — przesuwają się razem z nimi, więc fokus zostaje na przesuniętym wierszu. */
interface Keys {
  days: string[];
  meals: string[][];
}
const keysFit = (k: Keys, b: MealsBody): boolean => k.days.length === b.days.length && b.days.every((d, i) => k.meals[i]?.length === d.meals.length);
const fitKeys = (k: Keys, b: MealsBody): Keys => ({ days: fit(k.days, b.days.length), meals: b.days.map((d, i) => fit(k.meals[i] ?? [], d.meals.length)) });

export function MealsForm({ value, onChange }: { value: MealsBody; onChange: (v: MealsBody) => void }) {
  const [stored, setKeys] = useState<Keys>(() => fitKeys({ days: [], meals: [] }, value));
  let keys = stored;
  if (!keysFit(keys, value)) {
    // Treść podmieniona z zewnątrz (wczytana z biblioteki) — klucze dopasowane jeszcze w tym renderze.
    keys = fitKeys(keys, value);
    setKeys(keys);
  }

  const set = (patch: Partial<MealsBody>) => onChange({ ...value, ...patch });
  const setDay = (i: number, patch: Partial<MealDay>) => set({ days: value.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setMeal = (i: number, j: number, patch: Partial<PlannedMeal>) =>
    setDay(i, { meals: value.days[i]!.meals.map((m, k) => (k === j ? { ...m, ...patch } : m)) });
  const mealKeysWith = (i: number, f: (k: string[]) => string[]) => keys.meals.map((k, j) => (j === i ? f(k) : k));

  const addDay = () => {
    if (value.days.length >= MAX_DAYS) return;
    setKeys({ days: [...keys.days, nextKey()], meals: [...keys.meals, [nextKey()]] });
    set({ days: [...value.days, { label: '', meals: [newMeal(T.slots[0])] }] });
  };
  const copyDay = (i: number) => {
    if (value.days.length >= MAX_DAYS) return;
    const days = [...value.days];
    const src = days[i]!;
    days.splice(i + 1, 0, { label: '', meals: src.meals.map((m) => ({ ...m })) });
    const dayKeys = [...keys.days];
    dayKeys.splice(i + 1, 0, nextKey());
    const mealKeys = [...keys.meals];
    mealKeys.splice(i + 1, 0, src.meals.map(() => nextKey()));
    setKeys({ days: dayKeys, meals: mealKeys });
    set({ days });
  };
  const removeDay = (i: number) => {
    setKeys({ days: keys.days.filter((_, j) => j !== i), meals: keys.meals.filter((_, j) => j !== i) });
    set({ days: value.days.filter((_, j) => j !== i) });
  };
  const moveDay = (i: number, d: number) => {
    setKeys({ days: swapped(keys.days, i, i + d), meals: swapped(keys.meals, i, i + d) });
    set({ days: swapped(value.days, i, i + d) });
  };
  const addMeal = (i: number) => {
    const day = value.days[i]!;
    if (day.meals.length >= MAX_MEALS) return;
    setKeys({ ...keys, meals: mealKeysWith(i, (k) => [...k, nextKey()]) });
    setDay(i, { meals: [...day.meals, newMeal(nextSlot(day))] });
  };
  const removeMeal = (i: number, j: number) => {
    setKeys({ ...keys, meals: mealKeysWith(i, (k) => k.filter((_, x) => x !== j)) });
    setDay(i, { meals: value.days[i]!.meals.filter((_, k) => k !== j) });
  };
  const moveMeal = (i: number, j: number, d: number) => {
    setKeys({ ...keys, meals: mealKeysWith(i, (k) => swapped(k, j, j + d)) });
    setDay(i, { meals: swapped(value.days[i]!.meals, j, j + d) });
  };

  const avg = useMemo(() => planAverage(value.days), [value.days]);
  const problems = mealsProblems(value);

  return (
    <div className="stack sz-meals" style={{ gap: 16 }}>
      <label className="field">
        <span>{T.title}</span>
        <input id="meals-title" type="text" maxLength={120} placeholder={T.titlePh} value={value.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="meals-start" className="sz-meals-strong">
            {T.start}
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="meals-start" type="date" aria-describedby="meals-start-hint" value={value.start ?? ''} onChange={(e) => set({ start: e.target.value || null })} />
            {value.start ? (
              <button type="button" className="btn ghost small" onClick={() => set({ start: null })}>
                {T.clearStart}
              </button>
            ) : null}
          </div>
          <p id="meals-start-hint" className="hint">
            {T.startHint}
          </p>
        </div>
      </div>
      <label className="field">
        <span>{T.note}</span>
        <textarea id="meals-note" maxLength={2000} placeholder={T.notePh} value={value.note} onChange={(e) => set({ note: e.target.value })} />
      </label>

      <div className="stack">
        <div className="row between">
          <h3>{T.days}</h3>
          <TotalsLine label={T.average} t={avg} meals={value.days.flatMap((d) => d.meals)} />
        </div>
        <p className="small soft">{T.daysHint}</p>
        <datalist id="meals-day-names">
          {T.weekdays.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
        {!value.days.length ? <p className="soft">{T.noDays}</p> : null}
        <ol className="sz-meals-days">
          {value.days.map((day, i) => (
            <li key={keys.days[i]} className="sz-meals-day">
              <div className="sz-meals-dayhead" role="group" aria-label={T.dayN(i + 1)}>
                <span className="sz-meals-daynum">{T.dayN(i + 1)}</span>
                <label className="field sz-meals-daylabel">
                  <span className="sr">{T.dayLabel}</span>
                  <input
                    type="text"
                    maxLength={40}
                    list="meals-day-names"
                    placeholder={`${T.dayLabel}: ${T.dayLabelHint}`}
                    value={day.label}
                    onChange={(e) => setDay(i, { label: e.target.value })}
                  />
                </label>
                <span className="sz-meals-tools">
                  <button type="button" aria-label={T.dayUp(i + 1)} disabled={i === 0} onClick={() => moveDay(i, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label={T.dayDown(i + 1)} disabled={i === value.days.length - 1} onClick={() => moveDay(i, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label={T.dayCopyLabel(i + 1)} disabled={value.days.length >= MAX_DAYS} onClick={() => copyDay(i)}>
                    {T.dayCopy}
                  </button>
                  <button type="button" aria-label={T.dayRemoveLabel(i + 1)} onClick={() => removeDay(i)}>
                    {T.dayRemove}
                  </button>
                </span>
              </div>
              <TotalsLine label={T.total} t={day.meals.length ? dayTotals(day) : null} meals={day.meals} />
              {!day.meals.length ? <p className="small soft">{T.noMeals}</p> : null}
              <ol className="sz-meals-meals">
                {day.meals.map((m, j) => (
                  <MealRow
                    key={keys.meals[i]![j]}
                    id={keys.meals[i]![j]!}
                    meal={m}
                    d={i + 1}
                    n={j + 1}
                    last={j === day.meals.length - 1}
                    onChange={(patch) => setMeal(i, j, patch)}
                    onMove={(dir) => moveMeal(i, j, dir)}
                    onRemove={() => removeMeal(i, j)}
                  />
                ))}
              </ol>
              <div className="row">
                <button type="button" className="btn ghost small" disabled={day.meals.length >= MAX_MEALS} onClick={() => addMeal(i)}>
                  {T.addMeal}
                </button>
                {day.meals.length >= MAX_MEALS ? <span className="small soft">{T.maxMeals(MAX_MEALS)}</span> : null}
              </div>
            </li>
          ))}
        </ol>
        <div className="row">
          <button type="button" className="btn ghost" disabled={value.days.length >= MAX_DAYS} onClick={addDay}>
            {T.addDay}
          </button>
          {value.days.length >= MAX_DAYS ? <span className="small soft">{T.maxDays(MAX_DAYS)}</span> : null}
        </div>
      </div>

      {problems.errors.length || problems.warnings.length ? (
        <div className={`note ${problems.errors.length ? 'gold' : 'warn'} sz-meals-problems`} role="status" aria-live="polite">
          <strong>{T.before}</strong>
          <ul>
            {[...problems.errors, ...problems.warnings].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MealRow({
  id,
  meal,
  d,
  n,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  id: string;
  meal: PlannedMeal;
  d: number;
  n: number;
  last: boolean;
  onChange: (patch: Partial<PlannedMeal>) => void;
  onMove: (dir: number) => void;
  onRemove: () => void;
}) {
  // Własna pora zostaje własną, choćby wpisana nazwa zgadzała się z typową — pole nie znika w trakcie pisania.
  const [own, setOwn] = useState(() => !T.slots.includes(meal.slot));
  const recipe = recipeById(meal.recipe);
  return (
    <li className="sz-meals-meal" role="group" aria-label={T.mealN(d, n)}>
      <div className="sz-meals-mealhead">
        <label className="field sz-meals-slot">
          <span>{T.slot}</span>
          <select
            value={own ? OWN : meal.slot}
            onChange={(e) => {
              const v = e.target.value;
              setOwn(v === OWN);
              onChange({ slot: v === OWN ? '' : v });
            }}
          >
            {T.slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={OWN}>{T.slotOwn}</option>
          </select>
        </label>
        {own ? (
          <label className="field sz-meals-slot">
            <span>{T.slotOwnLabel}</span>
            <input type="text" maxLength={30} placeholder={T.slotOwnPh} value={meal.slot} onChange={(e) => onChange({ slot: e.target.value })} />
          </label>
        ) : null}
        <RecipeName id={id} meal={meal} onChange={onChange} />
        <span className="sz-meals-tools">
          <button type="button" aria-label={T.mealUp(d, n)} disabled={n === 1} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" aria-label={T.mealDown(d, n)} disabled={last} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" aria-label={T.mealRemove(d, n)} onClick={onRemove}>
            ×
          </button>
        </span>
      </div>
      {meal.recipe ? (
        <div className="row small sz-meals-recipe">
          <span className="chip blue">
            {T.recipe}: {recipe ? `${recipe.name} · ${KIND_LABELS[recipe.kind]} · ${T.min(recipe.minutes)}` : `${meal.recipe} — ${T.unknownRecipe}`}
          </span>
          <button type="button" className="btn link small" onClick={() => onChange({ recipe: null })}>
            {T.unlink}
          </button>
        </div>
      ) : null}
      <div className="sz-meals-nums">
        {MACROS.map((k) => (
          <label key={k} className="field">
            <span>{T[k]}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={MACRO_LIMITS[k]}
              step={k === 'kcal' ? 1 : 0.5}
              value={meal[k] ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value);
                onChange({ [k]: v === null || Number.isNaN(v) ? null : v } as Partial<PlannedMeal>);
              }}
            />
          </label>
        ))}
        <label className="field sz-meals-note">
          <span>{T.mealNote}</span>
          <input type="text" maxLength={300} placeholder={T.mealNotePh} value={meal.note} onChange={(e) => onChange({ note: e.target.value })} />
        </label>
      </div>
    </li>
  );
}

/** Nazwa posiłku, która jest też wyszukiwarką przepisów z katalogu (combobox). */
function RecipeName({ id, meal, onChange }: { id: string; meal: PlannedMeal; onChange: (patch: Partial<PlannedMeal>) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const found = useMemo(() => (open && meal.name.trim().length >= 2 ? findRecipes(meal.name) : []), [open, meal.name]);
  const listId = `${id}-recipes`;
  const pick = (r: Recipe) => {
    onChange({ name: r.name, recipe: r.id });
    setOpen(false);
    setSel(-1);
  };
  return (
    <div className="sz-meals-name">
      <label className="field">
        <span>{T.name}</span>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={found.length > 0}
          aria-controls={listId}
          aria-activedescendant={sel >= 0 && found[sel] ? `${listId}-${sel}` : undefined}
          autoComplete="off"
          maxLength={120}
          placeholder={T.namePh}
          value={meal.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
            setOpen(true);
            setSel(-1);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && found.length) {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, found.length - 1));
            } else if (e.key === 'ArrowUp' && found.length) {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === 'Enter' && sel >= 0 && found[sel]) {
              e.preventDefault();
              pick(found[sel]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
      </label>
      {found.length ? (
        // Kliknięcie w podpowiedź nie zabiera fokusu polu — inaczej lista zniknęłaby przed wyborem.
        <div className="suggest sz-meals-suggest" id={listId} role="listbox" aria-label={T.recipes} onMouseDown={(e) => e.preventDefault()}>
          {found.map((r, i) => (
            <button key={r.id} id={`${listId}-${i}`} type="button" role="option" aria-selected={i === sel} tabIndex={-1} onClick={() => pick(r)}>
              {r.name}
              <span className="soft small">
                {' '}
                · {KIND_LABELS[r.kind]} · {T.min(r.minutes)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
