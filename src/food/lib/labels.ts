// Every user-facing Polish string that is not product data.
import type { RangeKey, ToggleKey } from './filters';
import type { SortDir, SortKey } from './sort';
import type { EcoGrade, NovaGroup, NutriGrade, Nutrient } from './types';

export const TOGGLE_LABELS: Record<ToggleKey, string> = {
  hasImage: 'Ze zdjęciem',
  hasPrice: 'Z ceną',
  hasNutrition: 'Z wartościami odżywczymi',
  vegan: 'Wegańskie',
  vegetarian: 'Wegetariańskie',
  noPalmOil: 'Bez oleju palmowego',
};

export const PRESENCE_TOGGLES: ToggleKey[] = ['hasImage', 'hasPrice', 'hasNutrition'];
export const DIET_TOGGLES: ToggleKey[] = ['vegan', 'vegetarian', 'noPalmOil'];

export const NUTRIENT_LABELS: Record<Nutrient, string> = {
  kcal: 'Energia',
  fat: 'Tłuszcz',
  saturatedFat: 'w tym kwasy tłuszczowe nasycone',
  carbs: 'Węglowodany',
  sugars: 'w tym cukry',
  fiber: 'Błonnik',
  protein: 'Białko',
  salt: 'Sól',
};

export const RANGE_LABELS: Record<RangeKey, { label: string; unit: string; step: number }> = {
  kcal: { label: 'Kalorie', unit: 'kcal', step: 10 },
  protein: { label: 'Białko', unit: 'g', step: 1 },
  fat: { label: 'Tłuszcz', unit: 'g', step: 1 },
  carbs: { label: 'Węglowodany', unit: 'g', step: 1 },
  sugars: { label: 'Cukry', unit: 'g', step: 1 },
  salt: { label: 'Sól', unit: 'g', step: 0.1 },
  fiber: { label: 'Błonnik', unit: 'g', step: 1 },
  price: { label: 'Cena', unit: 'zł', step: 1 },
  additives: { label: 'Liczba dodatków (E)', unit: '', step: 1 },
};

export const NUTRITION_RANGES: RangeKey[] = ['kcal', 'protein', 'fat', 'carbs', 'sugars', 'salt', 'fiber'];

export const SORT_LABELS: Record<SortKey, string> = {
  popularity: 'Popularność',
  name: 'Nazwa',
  kcal: 'Kalorie',
  protein: 'Białko',
  fat: 'Tłuszcz',
  carbs: 'Węglowodany',
  sugars: 'Cukry',
  salt: 'Sól',
  fiber: 'Błonnik',
  price: 'Cena',
  nutriscore: 'Nutri-Score',
  nova: 'NOVA',
  ecoscore: 'Eco-Score',
  additives: 'Liczba dodatków',
};

/** The sort dropdown: the useful direction first for each key. */
export const SORT_OPTIONS: { key: SortKey; dir: SortDir; label: string }[] = [
  { key: 'popularity', dir: 'desc', label: 'Najpopularniejsze' },
  { key: 'name', dir: 'asc', label: 'Nazwa A–Ż' },
  { key: 'name', dir: 'desc', label: 'Nazwa Ż–A' },
  { key: 'kcal', dir: 'asc', label: 'Kalorie: od najniższych' },
  { key: 'kcal', dir: 'desc', label: 'Kalorie: od najwyższych' },
  { key: 'protein', dir: 'desc', label: 'Białko: najwięcej' },
  { key: 'fat', dir: 'asc', label: 'Tłuszcz: najmniej' },
  { key: 'carbs', dir: 'asc', label: 'Węglowodany: najmniej' },
  { key: 'sugars', dir: 'asc', label: 'Cukry: najmniej' },
  { key: 'salt', dir: 'asc', label: 'Sól: najmniej' },
  { key: 'fiber', dir: 'desc', label: 'Błonnik: najwięcej' },
  { key: 'price', dir: 'asc', label: 'Cena: od najniższej' },
  { key: 'price', dir: 'desc', label: 'Cena: od najwyższej' },
  { key: 'nutriscore', dir: 'asc', label: 'Nutri-Score: najlepsze' },
  { key: 'nova', dir: 'asc', label: 'NOVA: najmniej przetworzone' },
  { key: 'ecoscore', dir: 'asc', label: 'Eco-Score: najlepsze' },
  { key: 'additives', dir: 'asc', label: 'Dodatki: najmniej' },
];

export const NOVA_LABELS: Record<NovaGroup, string> = {
  1: 'Nieprzetworzone lub minimalnie przetworzone',
  2: 'Przetworzone składniki kulinarne',
  3: 'Żywność przetworzona',
  4: 'Żywność ultraprzetworzona',
};

export function gradeLabel(grade: NutriGrade | EcoGrade): string {
  return grade === 'a-plus' ? 'A+' : grade.toUpperCase();
}

export const TRI_LABELS = { yes: 'tak', no: 'nie', maybe: 'możliwe' } as const;
export const PALM_OIL_LABELS = {
  free: 'bez oleju palmowego',
  contains: 'zawiera olej palmowy',
  maybe: 'może zawierać olej palmowy',
} as const;
