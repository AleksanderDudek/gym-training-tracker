// Every user-facing Polish string that is not product data.
import type { RangeKey, ToggleKey } from './filters';
import { text } from '../../i18n';
import type { SortDir, SortKey } from './sort';
import type { EcoGrade, NovaGroup, NutriGrade, Nutrient } from './types';

export const TOGGLE_LABELS: Record<ToggleKey, string> = text({
  pl: {
    hasImage: 'Ze zdjęciem',
    hasPrice: 'Z ceną',
    hasNutrition: 'Z wartościami odżywczymi',
    vegan: 'Wegańskie',
    vegetarian: 'Wegetariańskie',
    noPalmOil: 'Bez oleju palmowego',
    online: 'W sklepach internetowych',
  },
  en: {
    hasImage: 'With a photo',
    hasPrice: 'With a price',
    hasNutrition: 'With nutrition facts',
    vegan: 'Vegan',
    vegetarian: 'Vegetarian',
    noPalmOil: 'No palm oil',
    online: 'In online shops',
  },
});

export const PRESENCE_TOGGLES: ToggleKey[] = ['hasImage', 'hasPrice', 'hasNutrition', 'online'];
export const DIET_TOGGLES: ToggleKey[] = ['vegan', 'vegetarian', 'noPalmOil'];

export const NUTRIENT_LABELS: Record<Nutrient, string> = text({
  pl: {
    kcal: 'Energia',
    fat: 'Tłuszcz',
    saturatedFat: 'w tym kwasy tłuszczowe nasycone',
    carbs: 'Węglowodany',
    sugars: 'w tym cukry',
    fiber: 'Błonnik',
    protein: 'Białko',
    salt: 'Sól',
  },
  en: {
    kcal: 'Energy',
    fat: 'Fat',
    saturatedFat: 'of which saturates',
    carbs: 'Carbohydrate',
    sugars: 'of which sugars',
    fiber: 'Fibre',
    protein: 'Protein',
    salt: 'Salt',
  },
});

const RANGE_NAMES: Record<RangeKey, string> = text({
  pl: {
    kcal: 'Kalorie',
    protein: 'Białko',
    fat: 'Tłuszcz',
    carbs: 'Węglowodany',
    sugars: 'Cukry',
    salt: 'Sól',
    fiber: 'Błonnik',
    price: 'Cena',
    additives: 'Liczba dodatków (E)',
  },
  en: {
    kcal: 'Calories',
    protein: 'Protein',
    fat: 'Fat',
    carbs: 'Carbs',
    sugars: 'Sugars',
    salt: 'Salt',
    fiber: 'Fibre',
    price: 'Price',
    additives: 'Number of additives (E)',
  },
});

const PRICE_UNIT = text({ pl: 'zł', en: 'PLN' });

export const RANGE_LABELS: Record<RangeKey, { label: string; unit: string; step: number }> = {
  kcal: { label: RANGE_NAMES.kcal, unit: 'kcal', step: 10 },
  protein: { label: RANGE_NAMES.protein, unit: 'g', step: 1 },
  fat: { label: RANGE_NAMES.fat, unit: 'g', step: 1 },
  carbs: { label: RANGE_NAMES.carbs, unit: 'g', step: 1 },
  sugars: { label: RANGE_NAMES.sugars, unit: 'g', step: 1 },
  salt: { label: RANGE_NAMES.salt, unit: 'g', step: 0.1 },
  fiber: { label: RANGE_NAMES.fiber, unit: 'g', step: 1 },
  price: { label: RANGE_NAMES.price, unit: PRICE_UNIT, step: 1 },
  additives: { label: RANGE_NAMES.additives, unit: '', step: 1 },
};

export const NUTRITION_RANGES: RangeKey[] = ['kcal', 'protein', 'fat', 'carbs', 'sugars', 'salt', 'fiber'];

export const SORT_LABELS: Record<SortKey, string> = text({
  pl: {
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
  },
  en: {
    popularity: 'Popularity',
    name: 'Name',
    kcal: 'Calories',
    protein: 'Protein',
    fat: 'Fat',
    carbs: 'Carbs',
    sugars: 'Sugars',
    salt: 'Salt',
    fiber: 'Fibre',
    price: 'Price',
    nutriscore: 'Nutri-Score',
    nova: 'NOVA',
    ecoscore: 'Eco-Score',
    additives: 'Number of additives',
  },
});

const SORT_OPTION_LABELS = text({
  pl: {
    'popularity-desc': 'Najpopularniejsze',
    'name-asc': 'Nazwa A–Ż',
    'name-desc': 'Nazwa Ż–A',
    'kcal-asc': 'Kalorie: od najniższych',
    'kcal-desc': 'Kalorie: od najwyższych',
    'protein-desc': 'Białko: najwięcej',
    'fat-asc': 'Tłuszcz: najmniej',
    'carbs-asc': 'Węglowodany: najmniej',
    'sugars-asc': 'Cukry: najmniej',
    'salt-asc': 'Sól: najmniej',
    'fiber-desc': 'Błonnik: najwięcej',
    'price-asc': 'Cena: od najniższej',
    'price-desc': 'Cena: od najwyższej',
    'nutriscore-asc': 'Nutri-Score: najlepsze',
    'nova-asc': 'NOVA: najmniej przetworzone',
    'ecoscore-asc': 'Eco-Score: najlepsze',
    'additives-asc': 'Dodatki: najmniej',
  },
  en: {
    'popularity-desc': 'Most popular',
    'name-asc': 'Name A–Z',
    'name-desc': 'Name Z–A',
    'kcal-asc': 'Calories: lowest first',
    'kcal-desc': 'Calories: highest first',
    'protein-desc': 'Protein: most',
    'fat-asc': 'Fat: least',
    'carbs-asc': 'Carbs: least',
    'sugars-asc': 'Sugars: least',
    'salt-asc': 'Salt: least',
    'fiber-desc': 'Fibre: most',
    'price-asc': 'Price: lowest first',
    'price-desc': 'Price: highest first',
    'nutriscore-asc': 'Nutri-Score: best',
    'nova-asc': 'NOVA: least processed',
    'ecoscore-asc': 'Eco-Score: best',
    'additives-asc': 'Additives: fewest',
  },
});

/** The sort dropdown: the useful direction first for each key. */
export const SORT_OPTIONS: { key: SortKey; dir: SortDir; label: string }[] = (
  Object.keys(SORT_OPTION_LABELS) as (keyof typeof SORT_OPTION_LABELS)[]
).map((id) => {
  const [key, dir] = id.split('-') as [SortKey, SortDir];
  return { key, dir, label: SORT_OPTION_LABELS[id] };
});

export const NOVA_LABELS: Record<NovaGroup, string> = text({
  pl: {
    1: 'Nieprzetworzone lub minimalnie przetworzone',
    2: 'Przetworzone składniki kulinarne',
    3: 'Żywność przetworzona',
    4: 'Żywność ultraprzetworzona',
  },
  en: {
    1: 'Unprocessed or minimally processed',
    2: 'Processed culinary ingredients',
    3: 'Processed foods',
    4: 'Ultra-processed foods',
  },
});

export function gradeLabel(grade: NutriGrade | EcoGrade): string {
  return grade === 'a-plus' ? 'A+' : grade.toUpperCase();
}

export const TRI_LABELS: Record<'yes' | 'no' | 'maybe', string> = text({
  pl: { yes: 'tak', no: 'nie', maybe: 'możliwe' },
  en: { yes: 'yes', no: 'no', maybe: 'maybe' },
});
export const PALM_OIL_LABELS: Record<'free' | 'contains' | 'maybe', string> = text({
  pl: {
    free: 'bez oleju palmowego',
    contains: 'zawiera olej palmowy',
    maybe: 'może zawierać olej palmowy',
  },
  en: {
    free: 'no palm oil',
    contains: 'contains palm oil',
    maybe: 'may contain palm oil',
  },
});
