import { describe, expect, test } from 'vitest';
import {
  allergenTag,
  categoriesFor,
  labelAddsUp,
  nutritionOf,
  plausible,
  quantityOf,
  tidyBrand,
  tidyName,
  validEan,
  withBrand,
  type SelgrosRecord,
} from './selgros';

const value = (id: string, label: string, v: string) => ({ id, label, value: v });

/** The shape the finder returns (trimmed): Almette, 16 Oct 2026. */
const ALMETTE: SelgrosRecord = {
  productId: '339221',
  title: 'ALMETTE ŚMIETANKOWY BEZ LAKTOZY. PUSZYSTY SEREK TWAROGOWY BEZ LAKTOZY. PASTERYZOWANY. 150 G',
  productBrand: 'Almette',
  categoryPath: 'Nabiał/Sery białe',
  productDetails: [
    { id: 'generalInfo', label: 'Parametry produktu', values: [value('weight', 'Waga', '150 g')] },
    {
      id: 'allergen',
      label: 'Alergeny',
      values: [
        value('704', 'Zboża zawierajace gluten', 'Nie'),
        value('698', 'Mleko i produkty pochodne (łącznie z laktozą)', 'Tak'),
      ],
    },
    {
      id: 'nutrition',
      label: 'Wartości odżywcze',
      values: [
        value('889', 'Jednostka będąca podstawą przeliczeń', 'g/100 g'),
        value('711', 'Wielkość porcji', '15'),
        value('712', 'Wartość energetyczna kcal', '260'),
        value('713', 'Wartość energetyczna kJ', '1073'),
        value('714', 'Zawartość tłuszczów (ogólnie)', '25'),
        value('715', 'Kwasy tłuszczowe nasycone', '17'),
        value('718', 'Zawartość węglowodanów', '2,4'),
        value('719', 'Cukry', '2,3'),
        value('723', 'Zawartość białek', '6,3'),
        value('724', 'Zawartość soli', '0,78'),
        value('725', 'Wartość energetyczna kcal w porcji (energia)', '39'),
        value('731', 'Zawartość węglowodanów w porcji', '<0,5'),
      ],
    },
  ],
  units: [{ eans: ['5902899143835'], baseUnit: true, weight: { netValue: 0.15 } }],
  prices: [{ unit: 'ST', price: { grossPrice: 5.19 } }],
};

const withNutrition = (values: { id: string; label: string; value: string }[]): SelgrosRecord => ({
  ...ALMETTE,
  productDetails: [{ id: 'nutrition', label: 'Wartości odżywcze', values }],
});

describe('reading a Selgros product', () => {
  test('per 100 g from the label, the per-portion rows left alone', () => {
    expect(nutritionOf(ALMETTE)).toEqual({
      kcal: 260,
      protein: 6.3,
      carbs: 2.4,
      fat: 25,
      sugars: 2.3,
      fiber: null,
      saturatedFat: 17,
      salt: 0.78,
    });
  });

  test('energy from kJ when kcal is missing; "<0,5" is the bound; a label per portion or without a macro is no label', () => {
    const kjOnly = withNutrition([
      value('713', 'Wartość energetyczna kJ', '1073'),
      value('714', 'Zawartość tłuszczów (ogólnie)', '25'),
      value('718', 'Zawartość węglowodanów', '<0,5'),
      value('723', 'Zawartość białek', '6,3'),
    ]);
    expect(nutritionOf(kjOnly)).toMatchObject({ kcal: 256, carbs: 0.5 });
    expect(nutritionOf(withNutrition([value('889', 'Jednostka będąca podstawą przeliczeń', 'porcja')]))).toBeNull();
    expect(nutritionOf(withNutrition([value('712', 'Wartość energetyczna kcal', '260')]))).toBeNull();
    expect(nutritionOf({ ...ALMETTE, productDetails: [] })).toBeNull();
  });

  test('a label that cannot be true is caught; one whose energy does not add up is marked, not dropped', () => {
    const n = nutritionOf(ALMETTE)!;
    expect(plausible(n)).toBe(true);
    expect(plausible({ ...n, protein: 120 })).toBe(false);
    expect(plausible({ ...n, kcal: 950 })).toBe(false);
    expect(plausible({ ...n, protein: 40, carbs: 40, fat: 40 })).toBe(false);
    expect(plausible({ ...n, sugars: 9 })).toBe(false);
    expect(plausible({ ...n, saturatedFat: 30 })).toBe(false);
    expect(labelAddsUp(n)).toBe(true);
    expect(labelAddsUp({ ...n, kcal: 120 })).toBe(false);
  });

  test('EANs with a valid check digit only', () => {
    expect(validEan('5902899143835')).toBe(true);
    expect(validEan('59050735')).toBe(true);
    expect(validEan('5902899143836')).toBe(false);
    expect(validEan('590289914383')).toBe(false);
    expect(validEan('abc')).toBe(false);
  });

  test('the fourteen allergens as Open Food Facts tags', () => {
    expect(allergenTag('Mleko i produkty pochodne (łącznie z laktozą)')).toBe('en:milk');
    expect(allergenTag('Zboża zawierajace gluten')).toBe('en:gluten');
    expect(allergenTag('Orzeszki ziemne i produkty pochodne')).toBe('en:peanuts');
    expect(allergenTag('Migdały i produkty z migdałami')).toBe('en:nuts');
    expect(allergenTag('Dwutlenek siarki i siarczyny')).toBe('en:sulphur-dioxide-and-sulphites');
    expect(allergenTag('Coś innego')).toBeNull();
  });

  test('categories: the longest matching shelf, then what the name adds', () => {
    expect(categoriesFor('Nabiał/Sery białe', 'Serek wiejski lekki')).toEqual([
      'en:dairies',
      'en:cheeses',
      'en:fresh-cheeses',
      'en:cottage-cheeses',
    ]);
    expect(categoriesFor('Nabiał/Mleko i śmietana', 'Mleko 2% UHT')).toEqual(['en:dairies', 'en:milks']);
    expect(categoriesFor('Mięso, wędliny i ryby/Mięso/Mięso białe świeże', 'Filet z kurczaka')).toEqual([
      'en:meats',
      'en:poultries',
    ]);
    expect(categoriesFor('Sypkie/Ryż', 'Ryż basmati 1 kg')).toContain('en:basmati-rices');
    // An unknown shelf: only what the name says.
    expect(categoriesFor('Nowy dział', 'Tuńczyk w sosie własnym')).toEqual(['en:fishes']);
  });

  test('names and brands in capitals become readable; the brand keeps its spelling inside the name', () => {
    expect(tidyName('ALMETTE ŚMIETANKOWY. 150 G')).toBe('Almette śmietankowy. 150 g');
    expect(tidyName('Herbata Vitax Zioła Melisa 20 torebek')).toBe('Herbata Vitax Zioła Melisa 20 torebek');
    expect(tidyBrand('MLEKOVITA')).toBe('Mlekovita');
    expect(tidyBrand('SM')).toBe('SM');
    expect(tidyBrand('Come a Casa')).toBe('Come a Casa');
    expect(withBrand('Przecier pomidorowy 500g dawtona', 'Dawtona')).toBe('Przecier pomidorowy 500g Dawtona');
    expect(withBrand('Come a casa lasagne bolognese 400g', 'Come a Casa')).toBe('Come a Casa lasagne bolognese 400g');
  });

  test('the pack from the title (the page’s „Waga” is gross), else the net weight', () => {
    expect(quantityOf('COME A CASA LASAGNE BOLOGNESE 400G', 0.42)).toBe('400 g');
    expect(quantityOf('Tymbark pomidor sok 100% 200 ml butelka')).toBe('200 ml');
    expect(quantityOf('Woda mineralna 6x1,5l')).toBe('6 x 1,5 l');
    expect(quantityOf('Makaron 3kg Knorr')).toBe('3 kg');
    expect(quantityOf('Jaja przepiórcze', 0.15)).toBe('150 g');
    expect(quantityOf('Jaja przepiórcze', null)).toBeNull();
  });
});
