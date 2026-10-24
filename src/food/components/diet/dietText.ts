import { pluralEn, text } from '../../../i18n';
import { formatNumber } from '../../lib/format';

/**
 * Words the diet screens share: the macro initials of the number lines („B 41 · W 43 · T 31”), the
 * macro names, the eaten tick and the saved toast. A screen's own sentences stay in its own catalog.
 */
export const DT = text({
  pl: {
    /** Initials in „640 kcal · B 41 · W 43 · T 31”: białko, węglowodany, tłuszcz. */
    p: 'B',
    c: 'W',
    f: 'T',
    protein: 'Białko',
    carbs: 'Węglowodany',
    fat: 'Tłuszcz',
    proteinG: 'Białko (g)',
    carbsG: 'Węglowodany (g)',
    fatG: 'Tłuszcz (g)',
    kcalField: 'Kalorie (kcal)',
    /** The button that logs a meal, and its accessible name — the same word for everyone. */
    ate: 'Zjedzone',
    ateFood: (name: string) => `Zjedzone: ${name}`,
    /** The tick beside a meal already logged. */
    eaten: 'zjedzone',
    addEaten: 'Dodaj zjedzone',
    favorites: 'Ulubione',
    /** A meal bigger than usual, planned or eaten („cheat meal” before). */
    bigMeal: 'Większy posiłek',
    /** „1 posiłek”, „2 posiłki”, „5 posiłków”. */
    meals: (n: number) => `${n} ${n === 1 ? 'posiłek' : n < 5 ? 'posiłki' : 'posiłków'}`,
    /** The toast after a log: „Zapisane: Skyr · 120 kcal.” */
    saved: (name: string, kcal: number) => `Zapisane: ${name} · ${formatNumber(kcal, 0)} kcal.`,
    /** The same toast without calories („Bez liczenia kalorii”). */
    savedPlain: (name: string) => `Zapisane: ${name}.`,
  },
  en: {
    p: 'P',
    c: 'C',
    f: 'F',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    proteinG: 'Protein (g)',
    carbsG: 'Carbs (g)',
    fatG: 'Fat (g)',
    kcalField: 'Calories (kcal)',
    ate: 'Eaten',
    ateFood: (name: string) => `Eaten: ${name}`,
    eaten: 'eaten',
    addEaten: 'Add food',
    favorites: 'Favourites',
    bigMeal: 'Bigger meal',
    meals: (n: number) => `${n} ${pluralEn(n, 'meal', 'meals')}`,
    saved: (name: string, kcal: number) => `Saved: ${name} · ${formatNumber(kcal, 0)} kcal.`,
    savedPlain: (name: string) => `Saved: ${name}.`,
  },
});

/** The toast after a log: with the calories, or only the name when they are off screen. */
export const savedText = (name: string, kcal: number, shown: boolean): string =>
  shown ? DT.saved(name, kcal) : DT.savedPlain(name);
