import { pluralEn, text } from '../../../i18n';
import type { CheatSimulation } from '../../diet/cheat';
import { formatNumber } from '../../lib/format';

/**
 * The cheat-meal simulation in sentences: one source for the sheet and the planned cheat meal's card.
 * Each answers one question - do I fit, what is left for the other meals, what it costs the week
 * and the scale, and how to make up for it.
 */

const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const g = (n: number) => `${formatNumber(Math.round(n), 0)} g`;
/** „2”, „1,4” — tenths only when there are any. */
const times = (n: number) => {
  const t = Math.round(n * 10) / 10;
  return formatNumber(t, Number.isInteger(t) ? 0 : 1);
};
const pct = (share: number) => `${formatNumber(Math.round(share * 100), 0)}%`;

const T = text({
  pl: {
    meals: (n: number) => `${n} ${n === 1 ? 'posiłek' : n < 5 ? 'posiłki' : 'posiłków'}`,
    over: (kcal: string, pct: string) => `Przekroczysz cel o ${kcal} (${pct}).`,
    edge: (kcal: string, pct: string) => `Lekko ponad cel: o ${kcal} (${pct}) — to jeszcze w granicach dnia.`,
    last: (kcal: string) => `Mieścisz się: to ostatni posiłek dnia, zostaje jeszcze ${kcal}.`,
    each: (kcal: string, protein: string | null) => ` — po ok. ${kcal}${protein ? ` i ${protein} białka` : ''}`,
    tight: (kcal: string, meals: string, each: string) =>
      `Mieścisz się na styk: zostaje ${kcal} na ${meals}${each}, czyli raczej przekąski.`,
    fits: (kcal: string, meals: string, each: string) => `Mieścisz się: zostaje ${kcal} na ${meals}${each}.`,
    proteinShort: (g: string) => `Białka brakuje jeszcze ${g} — w pozostałych posiłkach postaw na chude białko.`,
    proteinMissed: (g: string) => `Białka zabraknie dziś ${g}.`,
    proteinOk: 'Białko na dziś będzie.',
    carbsOver: (g: string) => `Węglowodany ponad limit sposobu odżywiania o ${g}.`,
    fatOver: (g: string) => `Tłuszcz ponad górną granicę o ${g}.`,
    planFits: 'Pozostałe posiłki z planu dnia mieszczą się bez zmian.',
    planGone: 'Pozostałe posiłki z planu już się nie zmieszczą — na resztę dnia coś lekkiego i białkowego.',
    planShare: (pct: string) =>
      `Z pozostałych posiłków z planu zmieści się ok. ${pct} — zmniejsz porcje albo pomiń jeden posiłek.`,
    weekCapped: 'Tydzień: korekta celu jest już na limicie 10% dziennie — ta nadwyżka zostanie w bilansie.',
    weekSpread: (days: number, perDay: string, unpaid: string | null) =>
      `Tydzień: cel na kolejne ${days} ${days === 1 ? 'dzień' : 'dni'} spadnie o ok. ${perDay} dziennie${unpaid ? `, a ${unpaid} zostanie w bilansie (najwyżej 10% celu dziennie)` : ''}.`,
    sunday: 'Dziś niedziela — nadwyżka nie przejdzie na nowy tydzień, zostaje w prognozie wagi.',
    off: 'Korekta tygodniowa jest wyłączona — nadwyżka zostaje w bilansie.',
    scale: (grams: string) =>
      `W prognozie wagi to ok. ${grams} g. Waga przez dzień–dwa pokaże więcej — to woda i sól, nie tłuszcz.`,
    offset: (steps: string, trainings: string | null) =>
      `Żeby to odrobić ruchem: ok. ${steps} kroków więcej${trainings ? ` albo ${trainings} × typowy trening` : ''}.`,
  },
  en: {
    meals: (n: number) => `${n} ${pluralEn(n, 'meal', 'meals')}`,
    over: (kcal: string, pct: string) => `You’ll go over the goal by ${kcal} (${pct}).`,
    edge: (kcal: string, pct: string) => `Just over the goal: by ${kcal} (${pct}) — still within the day.`,
    last: (kcal: string) => `It fits: this is the last meal of the day, with ${kcal} to spare.`,
    each: (kcal: string, protein: string | null) => ` — about ${kcal}${protein ? ` and ${protein} protein` : ''} each`,
    tight: (kcal: string, meals: string, each: string) =>
      `It just fits: ${kcal} left for ${meals}${each}, so snacks rather than meals.`,
    fits: (kcal: string, meals: string, each: string) => `It fits: ${kcal} left for ${meals}${each}.`,
    proteinShort: (g: string) => `You still need ${g} protein — go for lean protein in your other meals.`,
    proteinMissed: (g: string) => `You’ll be ${g} short on protein today.`,
    proteinOk: 'You’ll hit your protein today.',
    carbsOver: (g: string) => `Carbs over your diet type’s limit by ${g}.`,
    fatOver: (g: string) => `Fat over the upper limit by ${g}.`,
    planFits: 'The rest of today’s planned meals fit as they are.',
    planGone: 'The rest of the planned meals won’t fit any more — keep the rest of the day light and high in protein.',
    planShare: (pct: string) =>
      `About ${pct} of the remaining planned meals will fit — make the portions smaller or skip a meal.`,
    weekCapped: 'Week: the goal adjustment is already at its 10%-a-day limit — this surplus stays in the balance.',
    weekSpread: (days: number, perDay: string, unpaid: string | null) =>
      `Week: the goal for the next ${days} ${pluralEn(days, 'day', 'days')} drops by about ${perDay} a day${unpaid ? `, and ${unpaid} stays in the balance (at most 10% of the goal a day)` : ''}.`,
    sunday: 'It’s Sunday — the surplus won’t carry over to the new week, it stays in the weight forecast.',
    off: 'The weekly adjustment is off — the surplus stays in the balance.',
    scale: (grams: string) =>
      `In the weight forecast that’s about ${grams} g. The scale will show more for a day or two — that’s water and salt, not fat.`,
    offset: (steps: string, trainings: string | null) =>
      `To make up for it with activity: about ${steps} more steps${trainings ? ` or ${trainings} × a typical workout` : ''}.`,
  },
});

/** The headline: fits, fits tightly, just over, or over - with what is left for the rest of the day. */
export function verdictText(s: CheatSimulation): string {
  if (s.verdict === 'over') return T.over(kcal(s.over), pct(s.overShare));
  if (s.verdict === 'edge') return T.edge(kcal(s.over), pct(s.overShare));
  if (s.restMeals === 0) return T.last(kcal(s.left));
  const each = s.perMeal ? T.each(kcal(s.perMeal.kcal), s.perMeal.protein > 0 ? g(s.perMeal.protein) : null) : '';
  return s.verdict === 'tight'
    ? T.tight(kcal(s.left), T.meals(s.restMeals), each)
    : T.fits(kcal(s.left), T.meals(s.restMeals), each);
}

/** Protein still to eat and the macros over the profile's limits. */
export function macroTexts(s: CheatSimulation): string[] {
  const out: string[] = [];
  if (s.protein > 0) out.push(s.restMeals > 0 ? T.proteinShort(g(s.protein)) : T.proteinMissed(g(s.protein)));
  else out.push(T.proteinOk);
  if (s.carbs.over > 0) out.push(T.carbsOver(g(s.carbs.over)));
  if (s.fat.over > 0) out.push(T.fatOver(g(s.fat.over)));
  return out;
}

/** The day's plan (meal prep or workbook): how much of the remaining portions still fits. */
export function planText(s: CheatSimulation): string | null {
  if (s.planShare === null) return null;
  if (s.planShare >= 1) return T.planFits;
  if (s.planShare <= 0.05) return T.planGone;
  return T.planShare(pct(s.planShare));
}

/** Beyond today: the week's balance, the scale and what would make up for it. */
export function beyondTexts(s: CheatSimulation, typicalTraining: boolean): string[] {
  if (s.over <= 0) return [];
  const out: string[] = [];
  const w = s.week;
  if (w.kind === 'spread' && w.perDay === 0) out.push(T.weekCapped);
  else if (w.kind === 'spread') out.push(T.weekSpread(w.days, kcal(-w.perDay), w.unpaid > 0 ? kcal(w.unpaid) : null));
  else if (w.kind === 'sunday') out.push(T.sunday);
  else if (w.kind === 'off') out.push(T.off);
  const grams = Math.round(s.kg * 1000);
  out.push(T.scale(formatNumber(grams, 0)));
  if (s.offset)
    out.push(
      T.offset(
        formatNumber(s.offset.steps, 0),
        typicalTraining && s.offset.trainings > 0 ? times(s.offset.trainings) : null,
      ),
    );
  return out;
}
