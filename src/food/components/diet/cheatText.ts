import type { CheatSimulation } from '../../diet/cheat';
import { formatNumber } from '../../lib/format';

/**
 * The cheat-meal simulation in sentences: one source for the sheet and the planned cheat meal's card.
 * Each answers one question - do I fit, what is left for the other meals, what it costs the week
 * and the scale, and how to make up for it.
 */

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const g = (n: number) => `${formatNumber(Math.round(n), 0)} g`;
const meals = (n: number) => `${n} ${n === 1 ? 'posiłek' : n < 5 ? 'posiłki' : 'posiłków'}`;
/** „2”, „1,4” — tenths only when there are any. */
const times = (n: number) => {
  const t = Math.round(n * 10) / 10;
  return formatNumber(t, Number.isInteger(t) ? 0 : 1);
};
const pct = (share: number) => `${formatNumber(Math.round(share * 100), 0)}%`;

/** The headline: fits, fits tightly, just over, or over - with what is left for the rest of the day. */
export function verdictText(s: CheatSimulation): string {
  if (s.verdict === 'over') return `Przekroczysz cel o ${kcal(s.over)} (${pct(s.overShare)}).`;
  if (s.verdict === 'edge') return `Lekko ponad cel: o ${kcal(s.over)} (${pct(s.overShare)}) — to jeszcze w granicach dnia.`;
  if (s.restMeals === 0) return `Mieścisz się: to ostatni posiłek dnia, zostaje jeszcze ${kcal(s.left)}.`;
  const each = s.perMeal ? ` — po ok. ${kcal(s.perMeal.kcal)}${s.perMeal.protein > 0 ? ` i ${g(s.perMeal.protein)} białka` : ''}` : '';
  return s.verdict === 'tight'
    ? `Mieścisz się na styk: zostaje ${kcal(s.left)} na ${meals(s.restMeals)}${each}, czyli raczej przekąski.`
    : `Mieścisz się: zostaje ${kcal(s.left)} na ${meals(s.restMeals)}${each}.`;
}

/** Protein still to eat and the macros over the profile's limits. */
export function macroTexts(s: CheatSimulation): string[] {
  const out: string[] = [];
  if (s.protein > 0)
    out.push(
      s.restMeals > 0
        ? `Białka brakuje jeszcze ${g(s.protein)} — w pozostałych posiłkach postaw na chude białko.`
        : `Białka zabraknie dziś ${g(s.protein)}.`,
    );
  else out.push('Białko na dziś będzie.');
  if (s.carbs.over > 0) out.push(`Węglowodany ponad limit sposobu odżywiania o ${g(s.carbs.over)}.`);
  if (s.fat.over > 0) out.push(`Tłuszcz ponad górną granicę o ${g(s.fat.over)}.`);
  return out;
}

/** The day's plan (meal prep or workbook): how much of the remaining portions still fits. */
export function planText(s: CheatSimulation): string | null {
  if (s.planShare === null) return null;
  if (s.planShare >= 1) return 'Pozostałe posiłki z planu dnia mieszczą się bez zmian.';
  if (s.planShare <= 0.05)
    return 'Pozostałe posiłki z planu już się nie zmieszczą — na resztę dnia coś lekkiego i białkowego.';
  return `Z pozostałych posiłków z planu zmieści się ok. ${pct(s.planShare)} — zmniejsz porcje albo pomiń jeden posiłek.`;
}

/** Beyond today: the week's balance, the scale and what would make up for it. */
export function beyondTexts(s: CheatSimulation, typicalTraining: boolean): string[] {
  if (s.over <= 0) return [];
  const out: string[] = [];
  const w = s.week;
  if (w.kind === 'spread')
    out.push(
      `Tydzień: cel na kolejne ${w.days} ${w.days === 1 ? 'dzień' : 'dni'} spadnie o ok. ${kcal(-w.perDay)} dziennie${w.unpaid > 0 ? `, a ${kcal(w.unpaid)} zostanie w bilansie (najwyżej 10% celu dziennie)` : ''}.`,
    );
  else if (w.kind === 'sunday') out.push('Dziś niedziela — nadwyżka nie przejdzie na nowy tydzień, zostaje w prognozie wagi.');
  else if (w.kind === 'off') out.push('Korekta tygodniowa jest wyłączona — nadwyżka zostaje w bilansie.');
  const grams = Math.round(s.kg * 1000);
  out.push(
    `W prognozie wagi to ok. ${formatNumber(grams, 0)} g. Waga przez dzień–dwa pokaże więcej — to woda i sól, nie tłuszcz.`,
  );
  if (s.offset)
    out.push(
      `Żeby to odrobić ruchem: ok. ${formatNumber(s.offset.steps, 0)} kroków więcej${typicalTraining && s.offset.trainings > 0 ? ` albo ${times(s.offset.trainings)} × typowy trening` : ''}.`,
    );
  return out;
}
