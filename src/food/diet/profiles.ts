import type { Macros } from '../recipes/macros';
import type { DietProfileId } from './types';

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
const neutral: Fit = { level: 'ok', reason: 'bez kalorii' };

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
    label: 'Redukcja wysokobiałkowa',
    description: 'Dużo białka przy deficycie kalorii: chroni mięśnie i syci najdłużej.',
    allows: 'chude mięso, ryby, jajka, skyr, twaróg, serek wiejski, warzywa, owoce w rozsądnych ilościach',
    avoids: 'słodycze, tłuste przekąski, słodkie napoje – dużo kalorii przy małej ilości białka',
    targets: (kcal, w) => proteinFirst(kcal, 2 * w, 0.3, 0.6 * w, null),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p } = sharesOf(m);
      if (p >= 0.3) return { level: 'great', reason: `${pct(p)} kalorii z białka` };
      if (p >= 0.2) return { level: 'ok', reason: `${pct(p)} kalorii z białka` };
      return { level: 'avoid', reason: `mało białka: ${pct(p)} kalorii` };
    },
  },
  zbilansowana: {
    id: 'zbilansowana',
    label: 'Zbilansowana',
    description: 'Klasyczne proporcje: 20% białka, 50% węglowodanów, 30% tłuszczu.',
    allows: 'wszystko z umiarem: pełne ziarna, warzywa, owoce, chude białko, dobre tłuszcze',
    avoids: 'jedzenie, w którym tłuszcz daje ponad połowę kalorii albo białka prawie nie ma',
    targets: (kcal, w) => {
      const protein = Math.max(1.2 * w, (kcal * 0.2) / 4);
      return proteinFirst(kcal, protein, 0.3, 0.5 * w, null);
    },
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p, f } = sharesOf(m);
      if (f > 0.5 || p < 0.1)
        return { level: 'avoid', reason: f > 0.5 ? `tłuszcz to ${pct(f)} kalorii` : 'prawie bez białka' };
      if (p >= 0.2 && f <= 0.35) return { level: 'great', reason: 'dobre proporcje' };
      return { level: 'ok', reason: `białko ${pct(p)}, tłuszcz ${pct(f)}` };
    },
  },
  lowcarb: {
    id: 'lowcarb',
    label: 'Low carb',
    description: 'Najwyżej 100 g węglowodanów dziennie, więcej białka i tłuszczu.',
    allows: 'mięso, ryby, jajka, nabiał, warzywa nieskrobiowe, orzechy, oliwa',
    avoids: 'pieczywo, makaron, ryż, ziemniaki, słodycze, soki',
    targets: (kcal, w) => proteinFirst(kcal, 1.8 * w, 0.4, 0.8 * w, 100),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { c } = sharesOf(m);
      if (c <= 0.2) return { level: 'great', reason: `węglowodany ${pct(c)} kalorii` };
      if (c <= 0.35) return { level: 'ok', reason: `węglowodany ${pct(c)} kalorii` };
      return { level: 'avoid', reason: `za dużo węglowodanów: ${pct(c)} kalorii` };
    },
  },
  keto: {
    id: 'keto',
    label: 'Keto',
    description: 'Do 30 g węglowodanów dziennie – reszta energii z tłuszczu.',
    allows: 'mięso, ryby, jajka, sery, masło, oliwa, awokado, zielone warzywa',
    avoids: 'wszystko ze skrobią i cukrem: pieczywo, kasze, owoce (poza jagodami w małych ilościach), słodkie jogurty',
    targets: (kcal, w) => proteinFirst(kcal, 1.6 * w, 0.6, 1.0 * w, 30),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { c } = sharesOf(m);
      if (c <= 0.08) return { level: 'great', reason: `węglowodany ${pct(c)} kalorii` };
      if (c <= 0.15) return { level: 'ok', reason: `węglowodany ${pct(c)} kalorii` };
      return { level: 'avoid', reason: `wybija z ketozy: węglowodany ${pct(c)} kalorii` };
    },
  },
  sportowa: {
    id: 'sportowa',
    label: 'Sportowa',
    description: 'Białko na regenerację i węglowodany na trening; tłuszcz w tle.',
    allows: 'chude białko, kasze, ryż, płatki, owoce, nabiał',
    avoids: 'tłuste jedzenie przed treningiem, posiłki prawie bez białka',
    targets: (kcal, w) => proteinFirst(kcal, 1.8 * w, 0.25, 0.6 * w, null),
    fit: (m) => {
      if (m.kcal <= 0) return neutral;
      const { p, c, f } = sharesOf(m);
      if (f > 0.45 || p < 0.1)
        return { level: 'avoid', reason: f > 0.45 ? `tłuszcz to ${pct(f)} kalorii` : 'prawie bez białka' };
      if (p >= 0.2 && c >= 0.35) return { level: 'great', reason: 'białko i węglowodany razem' };
      if (p >= 0.15) return { level: 'ok', reason: `białko ${pct(p)}, węglowodany ${pct(c)}` };
      return { level: 'avoid', reason: `mało białka: ${pct(p)} kalorii` };
    },
  },
};

export const DIET_PROFILE_IDS = Object.keys(DIET_PROFILES) as DietProfileId[];
