import { pluralEn, text } from '../../../i18n';
import type { CheatSimulation } from '../../diet/cheat';
import { r10 } from '../../diet/target';
import { formatNumber } from '../../lib/format';

/**
 * The bigger-meal simulation in sentences: one source for the sheet and the planned meal's card in
 * the diary. Each answers one question about the day — does it fit, what is left for the other
 * meals, protein, the day's plan. Nothing is paid back and nothing is priced in activity: one
 * bigger day does not change the trend.
 */

/** „ok.” amounts: rounded to 10. */
const okNumber = (n: number) => formatNumber(r10(n), 0);
const g = (n: number) => `${formatNumber(Math.round(n), 0)} g`;
const pct = (share: number) => `${formatNumber(Math.round(share * 100), 0)}%`;

const T = text({
  pl: {
    meals: (n: number) => `${n} ${n === 1 ? 'posiłek' : n < 5 ? 'posiłki' : 'posiłków'}`,
    over: (kcal: string) =>
      `To ok. ${kcal} kcal ponad cel dnia. Jeden taki dzień nie zmienia trendu — jutro jedz po prostu jak zwykle.`,
    full: 'Mieści się — to wypełnia cel dnia.',
    last: (kcal: string) => `Mieści się: to ostatni posiłek dnia, zostaje jeszcze ok. ${kcal} kcal.`,
    each: (kcal: string, protein: string | null) => ` — po ok. ${kcal} kcal${protein ? ` i ${protein} białka` : ''}`,
    tight: (kcal: string, meals: string, each: string) =>
      `Mieści się na styk: zostaje ok. ${kcal} kcal na ${meals}${each}, czyli raczej przekąski.`,
    fits: (kcal: string, meals: string, each: string) => `Mieści się: zostaje ok. ${kcal} kcal na ${meals}${each}.`,
    scale: 'Waga przez dzień–dwa może pokazać więcej — to woda i sól, nie tłuszcz.',
    proteinShort: (g: string) => `Białka brakuje jeszcze ${g} — w pozostałych posiłkach postaw na chude białko.`,
    proteinMissed: (g: string) => `Białka zabraknie dziś ${g}.`,
    proteinOk: 'Białko na dziś będzie.',
    carbsOver: (g: string) => `Węglowodany ponad limit sposobu odżywiania o ${g}.`,
    planFits: 'Pozostałe posiłki z planu dnia mieszczą się bez zmian.',
    planGone: 'Pozostałe posiłki z planu już się nie zmieszczą — na resztę dnia coś lekkiego i białkowego.',
    planShare: (pct: string) =>
      `Z pozostałych posiłków z planu zmieści się ok. ${pct} — zmniejsz porcje albo pomiń jeden posiłek.`,
  },
  en: {
    meals: (n: number) => `${n} ${pluralEn(n, 'meal', 'meals')}`,
    over: (kcal: string) =>
      `That’s about ${kcal} kcal over the day’s target. One day like that doesn’t change the trend — tomorrow, just eat as usual.`,
    full: 'It fits — that fills the day’s target.',
    last: (kcal: string) => `It fits: this is the last meal of the day, with about ${kcal} kcal to spare.`,
    each: (kcal: string, protein: string | null) => ` — about ${kcal} kcal${protein ? ` and ${protein} protein` : ''} each`,
    tight: (kcal: string, meals: string, each: string) =>
      `It just fits: about ${kcal} kcal left for ${meals}${each}, so snacks rather than meals.`,
    fits: (kcal: string, meals: string, each: string) => `It fits: about ${kcal} kcal left for ${meals}${each}.`,
    scale: 'The scale may show more for a day or two — that’s water and salt, not fat.',
    proteinShort: (g: string) => `You still need ${g} protein — go for lean protein in your other meals.`,
    proteinMissed: (g: string) => `You’ll be ${g} short on protein today.`,
    proteinOk: 'You’ll hit your protein today.',
    carbsOver: (g: string) => `Carbs over your diet type’s limit by ${g}.`,
    planFits: 'The rest of today’s planned meals fit as they are.',
    planGone: 'The rest of the planned meals won’t fit any more — keep the rest of the day light and high in protein.',
    planShare: (pct: string) =>
      `About ${pct} of the remaining planned meals will fit — make the portions smaller or skip a meal.`,
  },
});

/** The headline on the ±100 band: over the target, filling it, fitting tightly, or fitting. */
export function verdictText(s: CheatSimulation): string {
  if (s.verdict === 'over') return T.over(okNumber(s.over));
  if (s.verdict === 'full') return T.full;
  if (s.restMeals === 0) return T.last(okNumber(s.left));
  // „Po …” dzieli resztę między posiłki — przy jednym posiłku powtórzyłoby tę samą liczbę.
  const each =
    s.perMeal && s.restMeals > 1
      ? T.each(okNumber(s.perMeal.kcal), s.perMeal.protein > 0 ? g(s.perMeal.protein) : null)
      : '';
  return s.verdict === 'tight'
    ? T.tight(okNumber(s.left), T.meals(s.restMeals), each)
    : T.fits(okNumber(s.left), T.meals(s.restMeals), each);
}

/** Protein still to eat, and carbs over the limit of a diet style that has one. */
export function macroTexts(s: CheatSimulation): string[] {
  const out: string[] = [];
  if (s.protein > 0) out.push(s.restMeals > 0 ? T.proteinShort(g(s.protein)) : T.proteinMissed(g(s.protein)));
  else out.push(T.proteinOk);
  if (s.carbsOver > 0) out.push(T.carbsOver(g(s.carbsOver)));
  return out;
}

/** The day's plan (meal prep or workbook): how much of the remaining portions still fits. */
export function planText(s: CheatSimulation): string | null {
  if (s.planShare === null) return null;
  if (s.planShare >= 1) return T.planFits;
  if (s.planShare <= 0.05) return T.planGone;
  return T.planShare(pct(s.planShare));
}

/** Over the target: the scale may show a little more for a day or two — water and salt, not fat. */
export function scaleText(s: CheatSimulation): string | null {
  return s.verdict === 'over' ? T.scale : null;
}
