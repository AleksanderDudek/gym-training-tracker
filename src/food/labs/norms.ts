import { say } from '../../i18n';
import type { Sex } from '../diet/types';

/**
 * Daily intakes for adults from „Normy żywienia dla populacji Polski” (Jarosz et al., NIZP-PZH,
 * 2020): RDA where the norms set one, AI where they only set an adequate intake. Pregnancy uses
 * the norms' pregnancy values for the few nutrients the plan aims at.
 */

export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugars'
  | 'satFat'
  | 'iron'
  | 'zinc'
  | 'magnesium'
  | 'calcium'
  | 'potassium'
  | 'sodium'
  | 'phosphorus'
  | 'selenium'
  | 'iodine'
  | 'vitC'
  | 'vitD'
  | 'vitB12'
  | 'folate'
  | 'vitA'
  | 'vitE'
  | 'vitK'
  | 'vitB6'
  | 'epaDha'
  | 'ala'
  | 'cholesterol';

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  kcal: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sugars: 'g',
  satFat: 'g',
  iron: 'mg',
  zinc: 'mg',
  magnesium: 'mg',
  calcium: 'mg',
  potassium: 'mg',
  sodium: 'mg',
  phosphorus: 'mg',
  selenium: 'µg',
  iodine: 'µg',
  vitC: 'mg',
  vitD: 'µg',
  vitB12: 'µg',
  folate: 'µg',
  vitA: 'µg',
  vitE: 'mg',
  vitK: 'µg',
  vitB6: 'mg',
  epaDha: 'g',
  ala: 'g',
  cholesterol: 'mg',
};

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  kcal: say('Energia', 'Energy'),
  protein: say('Białko', 'Protein'),
  carbs: say('Węglowodany', 'Carbohydrates'),
  fat: say('Tłuszcz', 'Fat'),
  fiber: say('Błonnik', 'Fibre'),
  sugars: say('Cukry', 'Sugars'),
  satFat: say('Tłuszcze nasycone', 'Saturated fat'),
  iron: say('Żelazo', 'Iron'),
  zinc: say('Cynk', 'Zinc'),
  magnesium: say('Magnez', 'Magnesium'),
  calcium: say('Wapń', 'Calcium'),
  potassium: say('Potas', 'Potassium'),
  sodium: say('Sód', 'Sodium'),
  phosphorus: say('Fosfor', 'Phosphorus'),
  selenium: say('Selen', 'Selenium'),
  iodine: say('Jod', 'Iodine'),
  vitC: say('Witamina C', 'Vitamin C'),
  vitD: say('Witamina D', 'Vitamin D'),
  vitB12: say('Witamina B12', 'Vitamin B12'),
  folate: say('Foliany', 'Folate'),
  vitA: say('Witamina A', 'Vitamin A'),
  vitE: say('Witamina E', 'Vitamin E'),
  vitK: say('Witamina K', 'Vitamin K'),
  vitB6: say('Witamina B6', 'Vitamin B6'),
  epaDha: say('Omega-3 (EPA i DHA)', 'Omega-3 (EPA and DHA)'),
  ala: say('Omega-3 roślinne (ALA)', 'Plant omega-3 (ALA)'),
  cholesterol: say('Cholesterol', 'Cholesterol'),
};

export interface Norm {
  amount: number;
  /** RDA: enough for 97.5 % of people; AI: the intake that appears adequate. */
  kind: 'RDA' | 'AI';
}

interface PersonNorm {
  sex: Sex;
  age: number | null;
  pregnancy: boolean;
}

type Table = (p: { sex: Sex; age: number }) => number;

const NORMS: Partial<Record<NutrientKey, { kind: Norm['kind']; amount: Table; pregnancy?: number }>> = {
  iron: { kind: 'RDA', amount: ({ sex, age }) => (sex === 'K' && age <= 50 ? 18 : 10), pregnancy: 27 },
  zinc: { kind: 'RDA', amount: ({ sex }) => (sex === 'M' ? 11 : 8), pregnancy: 11 },
  magnesium: { kind: 'RDA', amount: ({ sex, age }) => (sex === 'M' ? (age <= 30 ? 400 : 420) : age <= 30 ? 310 : 320), pregnancy: 360 },
  calcium: { kind: 'RDA', amount: ({ sex, age }) => (age > 65 || (sex === 'K' && age > 50) ? 1200 : 1000) },
  potassium: { kind: 'AI', amount: () => 3500 },
  selenium: { kind: 'RDA', amount: () => 55, pregnancy: 60 },
  iodine: { kind: 'RDA', amount: () => 150, pregnancy: 220 },
  vitC: { kind: 'RDA', amount: ({ sex }) => (sex === 'M' ? 90 : 75), pregnancy: 85 },
  vitD: { kind: 'AI', amount: () => 15 },
  vitB12: { kind: 'RDA', amount: () => 2.4, pregnancy: 2.6 },
  folate: { kind: 'RDA', amount: () => 400, pregnancy: 600 },
  vitA: { kind: 'RDA', amount: ({ sex }) => (sex === 'M' ? 900 : 700), pregnancy: 770 },
  vitE: { kind: 'AI', amount: ({ sex }) => (sex === 'M' ? 10 : 8) },
  vitK: { kind: 'AI', amount: ({ sex }) => (sex === 'M' ? 65 : 55) },
  vitB6: { kind: 'RDA', amount: ({ sex, age }) => (age <= 50 ? 1.3 : sex === 'M' ? 1.7 : 1.5), pregnancy: 1.9 },
  fiber: { kind: 'AI', amount: () => 25 },
  epaDha: { kind: 'AI', amount: () => 0.25 },
};

/** The daily norm for an adult, or null where the norms set none the app uses. Age unknown: 30. */
export function normFor(key: NutrientKey, person: PersonNorm): Norm | null {
  const row = NORMS[key];
  if (!row) return null;
  const age = person.age ?? 30;
  if (person.pregnancy && person.sex === 'K' && row.pregnancy !== undefined) return { amount: row.pregnancy, kind: row.kind };
  return { amount: row.amount({ sex: person.sex, age }), kind: row.kind };
}
