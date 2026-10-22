import { text } from '../../i18n';
import type { Macros } from '../recipes/macros';
// The global `location` for the Node scripts' compile of `i18n.ts` (types only).
import type {} from './location';
import type { DietProfileId } from './types';

const T = text({
  pl: {
    noKcal: 'bez kalorii',
    fromProtein: (pct: string) => `${pct} kalorii z białka`,
    lowProtein: (pct: string) => `mało białka: ${pct} kalorii`,
    fatShare: (pct: string) => `tłuszcz to ${pct} kalorii`,
    almostNoProtein: 'prawie bez białka',
    goodRatio: 'dobre proporcje',
    proteinFat: (p: string, f: string) => `białko ${p}, tłuszcz ${f}`,
    carbsShare: (pct: string) => `węglowodany ${pct} kalorii`,
    tooManyCarbs: (pct: string) => `za dużo węglowodanów: ${pct} kalorii`,
    outOfKetosis: (pct: string) => `wybija z ketozy: węglowodany ${pct} kalorii`,
    proteinAndCarbs: 'białko i węglowodany razem',
    proteinCarbs: (p: string, c: string) => `białko ${p}, węglowodany ${c}`,
    redukcja: {
      label: 'Redukcja wysokobiałkowa',
      description: 'Dużo białka przy deficycie kalorii: chroni mięśnie i syci najdłużej.',
      allows: 'chude mięso, ryby, jajka, skyr, twaróg, serek wiejski, warzywa, owoce w rozsądnych ilościach',
      avoids: 'słodycze, tłuste przekąski, słodkie napoje – dużo kalorii przy małej ilości białka',
    },
    zbilansowana: {
      label: 'Zbilansowana',
      description: 'Klasyczne proporcje: 20% białka, 50% węglowodanów, 30% tłuszczu.',
      allows: 'wszystko z umiarem: pełne ziarna, warzywa, owoce, chude białko, dobre tłuszcze',
      avoids: 'jedzenie, w którym tłuszcz daje ponad połowę kalorii albo białka prawie nie ma',
    },
    lowcarb: {
      label: 'Low carb',
      description: 'Najwyżej 100 g węglowodanów dziennie, więcej białka i tłuszczu.',
      allows: 'mięso, ryby, jajka, nabiał, warzywa nieskrobiowe, orzechy, oliwa',
      avoids: 'pieczywo, makaron, ryż, ziemniaki, słodycze, soki',
    },
    keto: {
      label: 'Keto',
      description: 'Do 30 g węglowodanów dziennie – reszta energii z tłuszczu.',
      allows: 'mięso, ryby, jajka, sery, masło, oliwa, awokado, zielone warzywa',
      avoids: 'wszystko ze skrobią i cukrem: pieczywo, kasze, owoce (poza jagodami w małych ilościach), słodkie jogurty',
    },
    sportowa: {
      label: 'Sportowa',
      description: 'Białko na regenerację i węglowodany na trening; tłuszcz w tle.',
      allows: 'chude białko, kasze, ryż, płatki, owoce, nabiał',
      avoids: 'tłuste jedzenie przed treningiem, posiłki prawie bez białka',
    },
  },
  en: {
    noKcal: 'no calories',
    fromProtein: (pct: string) => `${pct} of calories from protein`,
    lowProtein: (pct: string) => `low in protein: ${pct} of calories`,
    fatShare: (pct: string) => `fat is ${pct} of calories`,
    almostNoProtein: 'almost no protein',
    goodRatio: 'good proportions',
    proteinFat: (p: string, f: string) => `protein ${p}, fat ${f}`,
    carbsShare: (pct: string) => `carbs ${pct} of calories`,
    tooManyCarbs: (pct: string) => `too many carbs: ${pct} of calories`,
    outOfKetosis: (pct: string) => `knocks you out of ketosis: carbs ${pct} of calories`,
    proteinAndCarbs: 'protein and carbs together',
    proteinCarbs: (p: string, c: string) => `protein ${p}, carbs ${c}`,
    redukcja: {
      label: 'High-protein cut',
      description: 'Plenty of protein in a calorie deficit: it protects your muscles and keeps you full longest.',
      allows: 'lean meat, fish, eggs, skyr, quark, cottage cheese, vegetables, fruit in sensible amounts',
      avoids: 'sweets, fatty snacks, sugary drinks – lots of calories and little protein',
    },
    zbilansowana: {
      label: 'Balanced',
      description: 'Classic proportions: 20% protein, 50% carbs, 30% fat.',
      allows: 'everything in moderation: whole grains, vegetables, fruit, lean protein, good fats',
      avoids: 'food where fat gives over half the calories or there is hardly any protein',
    },
    lowcarb: {
      label: 'Low carb',
      description: 'At most 100 g of carbs a day, more protein and fat.',
      allows: 'meat, fish, eggs, dairy, non-starchy vegetables, nuts, olive oil',
      avoids: 'bread, pasta, rice, potatoes, sweets, juices',
    },
    keto: {
      label: 'Keto',
      description: 'Up to 30 g of carbs a day – the rest of the energy from fat.',
      allows: 'meat, fish, eggs, cheese, butter, olive oil, avocado, green vegetables',
      avoids: 'anything with starch or sugar: bread, groats, fruit (except a few berries), sweetened yoghurts',
    },
    sportowa: {
      label: 'Athletic',
      description: 'Protein for recovery and carbs for training; fat in the background.',
      allows: 'lean protein, groats, rice, oats, fruit, dairy',
      avoids: 'fatty food before training, meals with almost no protein',
    },
  },
});

export interface MacroTargets {
  kcal: number;
  protein: { target: number; min: number };
  carbs: { target: number; max: number | null };
  fat: { target: number; min: number; max: number | null };
}

export type FitLevel = 'great' | 'ok' | 'avoid';
export interface Fit {
  level: FitLevel;
  reason: string;
}

export interface DietProfile {
  id: DietProfileId;
  label: string;
  description: string;
  /** What fits, what does not, in plain words for the profile card. */
  allows: string;
  avoids: string;
  /** Grams for a day of `kcal`, protein scaled by the TARGET weight. */
  targets: (kcal: number, targetWeightKg: number) => MacroTargets;
  /** Judged on energy shares, so a portion and 100 g get the same verdict. */
  fit: (m: Macros) => Fit;
}

const round = (n: number) => Math.max(0, Math.round(n));

/** Energy shares of protein, carbohydrate and fat (4/4/9 kcal per gram). */
function sharesOf(m: Macros): { p: number; c: number; f: number } {
  const energy = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (energy <= 0) return { p: 0, c: 0, f: 0 };
  return { p: (m.protein * 4) / energy, c: (m.carbs * 4) / energy, f: (m.fat * 9) / energy };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const neutral: Fit = { level: 'ok', reason: T.noKcal };

/** Protein first; fat a share of the energy; carbohydrates whatever is left. */
function proteinFirst(
  kcal: number,
  proteinG: number,
  fatShare: number,
  minFatG: number,
  carbsMax: number | null,
): MacroTargets {
  const fat = Math.max(minFatG, (kcal * fatShare) / 9);
  const carbs = Math.max(0, (kcal - proteinG * 4 - fat * 9) / 4);
  const cappedCarbs = carbsMax === null ? carbs : Math.min(carbs, carbsMax);
  // When carbohydrates are capped, the calories they would have had go to fat.
  const fatFinal = carbsMax === null ? fat : Math.max(fat, (kcal - proteinG * 4 - cappedCarbs * 4) / 9);
  return {
    kcal,
    protein: { target: round(proteinG), min: round(proteinG * 0.8) },
    carbs: { target: round(cappedCarbs), max: carbsMax },
    fat: { target: round(fatFinal), min: round(minFatG), max: carbsMax === null ? round(fatFinal * 1.3) : null },
  };
}

export const DIET_PROFILES: Record<DietProfileId, DietProfile> = {
  redukcja: {
    id: 'redukcja',
    ...T.redukcja,
    targets: (kcal, w) => proteinFirst(kcal, 2 * w, 0.3, 0.6 * w, null),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p } = sharesOf(m);
      if (p >= 0.3) return { level: 'great', reason: T.fromProtein(pct(p)) };
      if (p >= 0.2) return { level: 'ok', reason: T.fromProtein(pct(p)) };
      return { level: 'avoid', reason: T.lowProtein(pct(p)) };
    },
  },
  zbilansowana: {
    id: 'zbilansowana',
    ...T.zbilansowana,
    targets: (kcal, w) => {
      const protein = Math.max(1.2 * w, (kcal * 0.2) / 4);
      return proteinFirst(kcal, protein, 0.3, 0.5 * w, null);
    },
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p, f } = sharesOf(m);
      if (f > 0.5 || p < 0.1)
        return { level: 'avoid', reason: f > 0.5 ? T.fatShare(pct(f)) : T.almostNoProtein };
      if (p >= 0.2 && f <= 0.35) return { level: 'great', reason: T.goodRatio };
      return { level: 'ok', reason: T.proteinFat(pct(p), pct(f)) };
    },
  },
  lowcarb: {
    id: 'lowcarb',
    ...T.lowcarb,
    targets: (kcal, w) => proteinFirst(kcal, 1.8 * w, 0.4, 0.8 * w, 100),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { c } = sharesOf(m);
      if (c <= 0.2) return { level: 'great', reason: T.carbsShare(pct(c)) };
      if (c <= 0.35) return { level: 'ok', reason: T.carbsShare(pct(c)) };
      return { level: 'avoid', reason: T.tooManyCarbs(pct(c)) };
    },
  },
  keto: {
    id: 'keto',
    ...T.keto,
    targets: (kcal, w) => proteinFirst(kcal, 1.6 * w, 0.6, 1.0 * w, 30),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { c } = sharesOf(m);
      if (c <= 0.08) return { level: 'great', reason: T.carbsShare(pct(c)) };
      if (c <= 0.15) return { level: 'ok', reason: T.carbsShare(pct(c)) };
      return { level: 'avoid', reason: T.outOfKetosis(pct(c)) };
    },
  },
  sportowa: {
    id: 'sportowa',
    ...T.sportowa,
    targets: (kcal, w) => proteinFirst(kcal, 1.8 * w, 0.25, 0.6 * w, null),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p, c, f } = sharesOf(m);
      if (f > 0.45 || p < 0.1)
        return { level: 'avoid', reason: f > 0.45 ? T.fatShare(pct(f)) : T.almostNoProtein };
      if (p >= 0.2 && c >= 0.35) return { level: 'great', reason: T.proteinAndCarbs };
      if (p >= 0.15) return { level: 'ok', reason: T.proteinCarbs(pct(p), pct(c)) };
      return { level: 'avoid', reason: T.lowProtein(pct(p)) };
    },
  },
};

export const DIET_PROFILE_IDS = Object.keys(DIET_PROFILES) as DietProfileId[];
