import { describe, expect, test } from 'vitest';
import { DIET_PROFILES } from '../diet/profiles';
import { DATASET, PRODUCTS } from '../test/fixtures';
import {
  goalMetric,
  itemFromOff,
  itemFromProduct,
  packWeight,
  perKcal,
  pricePer10gProtein,
  pricePer100,
  rankForGoal,
  scanFood,
  type ScanItem,
} from './compare';
import {
  COMPARE_KEY,
  COMPARE_MAX,
  COMPARE_TTL_MS,
  addToCompare,
  clearCompare,
  readCompare,
  removeFromCompare,
  restoreCompare,
  type CompareStorage,
} from './compareStore';
import { parseOff } from './off';

const byCode = (code: string) => itemFromProduct(PRODUCTS.find((p) => p.code === code)!, DATASET.dictionaries, 0);
const gouda = byCode('1'); // 350 kcal, B 25, T 27, W 0, 150 g, 19,99 zł
const skyr = byCode('2'); // 63 kcal, B 11, W 4, T 0, 150 g, 4,29 zł
const musli = byCode('3'); // 410 kcal, B 9, W 64, T 12
const pepsi = byCode('4'); // 42 kcal, B 0, W 10,6

function memory(): CompareStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('porównanie pod cel', () => {
  test('redukcja: najwięcej białka na 100 kcal wygrywa; to, co „nie pasuje”, nigdy nie wygrywa jedną liczbą', () => {
    const ranked = rankForGoal([musli, gouda, skyr, pepsi], DIET_PROFILES.redukcja);
    expect(ranked.map((r) => r.item.name)).toEqual(['Skyr naturalny', 'Żółty ser Gouda', 'Musli owocowe', 'Pepsi']);
    expect(ranked[0]).toMatchObject({ winner: true, fit: { level: 'great' } });
    expect(ranked[0]!.value).toBeCloseTo(17.46, 1);
    expect(ranked.filter((r) => r.winner)).toHaveLength(1);
  });

  test('keto: najmniej węglowodanów na 100 kcal; ser przed skyrem', () => {
    expect(goalMetric(DIET_PROFILES.keto)).toBe('carbs');
    const ranked = rankForGoal([skyr, musli, gouda], DIET_PROFILES.keto);
    expect(ranked.map((r) => r.item.name)).toEqual(['Żółty ser Gouda', 'Skyr naturalny', 'Musli owocowe']);
    expect(perKcal(gouda, 'carbs')).toBe(0);
  });

  test('bez pełnych liczb na końcu i bez wygranej; jeden produkt nie ma kogo pokonać', () => {
    const unknown: ScanItem = { ...skyr, code: '9', name: 'Bez danych', per100: { ...skyr.per100, protein: null } };
    const ranked = rankForGoal([unknown, pepsi], DIET_PROFILES.zbilansowana);
    expect(ranked.map((r) => r.item.name)).toEqual(['Pepsi', 'Bez danych']);
    expect(ranked[1]).toMatchObject({ fit: null, value: null, winner: false });
    expect(rankForGoal([skyr], DIET_PROFILES.redukcja)[0]!.winner).toBe(false);
  });

  test('ceny: za 100 g z wagi opakowania (wielopaki w całości) i za 10 g białka', () => {
    expect(packWeight('150 g')).toBe(150);
    expect(packWeight('4 x 125 g')).toBe(500);
    expect(packWeight('1,5 kg')).toBe(1500);
    expect(packWeight('0,5 l')).toBe(500);
    expect(packWeight('opakowanie')).toBeNull();
    expect(pricePer100(skyr)).toBeCloseTo(2.86, 2);
    expect(pricePer10gProtein(skyr)).toBeCloseTo(2.6, 1);
    expect(pricePer100({ ...skyr, price: { value: 30, perKg: true } })).toBe(3);
    expect(pricePer10gProtein(pepsi)).toBeNull();
  });

  test('zeskanowany produkt jako jedzenie dziennika: opakowanie jako porcja, ten sam klucz co w bazie', () => {
    expect(scanFood(skyr)).toMatchObject({ key: 'product:2', amountLabel: '150 g', nutrients: { kcal: 95, protein: 16.5 } });
    expect(scanFood({ ...skyr, per100: { ...skyr.per100, fat: null } })).toBeNull();
  });

  test('produkt z Open Food Facts: nazwa po polsku, kcal z kJ, gdy brak kcal; nieznany kod to null', () => {
    const off = parseOff({
      status: 1,
      code: '5900512320359',
      product: {
        code: '5900512320359',
        product_name: 'Mleko WYPASIONE 3,2%',
        product_name_pl: 'Mleko 3,2%',
        brands: 'Mlekovita, Wypasione',
        quantity: '1l',
        image_front_small_url: 'https://images.openfoodfacts.org/images/products/590/051/232/0359/front_en.26.200.jpg',
        nutriscore_grade: 'c',
        nutriments: { energy_100g: 252.7, proteins_100g: 3.2, carbohydrates_100g: 4.7, fat_100g: 3.2, sugars_100g: '4,7' },
      },
    });
    expect(off).toMatchObject({
      name: 'Mleko 3,2%',
      brands: 'Mlekovita',
      image: '590/051/232/0359/front_en.26.200.jpg',
      nutriscore: 'c',
      per100: { kcal: 60, protein: 3.2, carbs: 4.7, fat: 3.2, sugars: 4.7, salt: null },
    });
    expect(itemFromOff(off!, 5)).toMatchObject({ source: 'off', price: null, addedAt: 5 });
    expect(parseOff({ status: 0, status_verbose: 'product not found' })).toBeNull();
    expect(parseOff('<html>')).toBeNull();
  });
});

describe('pamięć porównania', () => {
  test('nowy skan na początek, ten sam produkt drugi raz przesuwa się na początek bez dubla', () => {
    const storage = memory();
    addToCompare(storage, skyr, 0);
    addToCompare(storage, gouda, 1000);
    const state = addToCompare(storage, skyr, 2000);
    expect(state.items.map((i) => i.code)).toEqual(['2', '1']);
    expect(state.items[0]!.addedAt).toBe(2000);
  });

  test('znika sama godzinę po ostatnim dodaniu — każdy skan daje kolejną godzinę', () => {
    const storage = memory();
    addToCompare(storage, skyr, 0);
    addToCompare(storage, gouda, 40 * 60_000);
    expect(readCompare(storage, 90 * 60_000).items).toHaveLength(2);
    expect(readCompare(storage, 90 * 60_000).expiresAt).toBe(40 * 60_000 + COMPARE_TTL_MS);
    expect(readCompare(storage, 100 * 60_000)).toEqual({ items: [], expiresAt: null });
    expect(storage.data.has(COMPARE_KEY)).toBe(false);
  });

  test('usunięcie jednego nie przedłuża godziny; wyczyszczenie oddaje listę do „Cofnij”', () => {
    const storage = memory();
    addToCompare(storage, skyr, 0);
    addToCompare(storage, gouda, 0);
    expect(removeFromCompare(storage, '2', 30 * 60_000)).toEqual({ items: [expect.objectContaining({ code: '1' })], expiresAt: COMPARE_TTL_MS });
    const saved = clearCompare(storage, 31 * 60_000);
    expect(readCompare(storage, 31 * 60_000).items).toEqual([]);
    expect(restoreCompare(storage, saved!, 32 * 60_000).items.map((i) => i.code)).toEqual(['1']);
    // Po godzinie nie ma czego przywracać.
    expect(restoreCompare(storage, saved!, COMPARE_TTL_MS).items).toEqual([]);
  });

  test(`najwyżej ${COMPARE_MAX} produktów: najstarszy skan robi miejsce`, () => {
    const storage = memory();
    for (let i = 0; i < COMPARE_MAX + 2; i++) addToCompare(storage, { ...skyr, code: String(100 + i) }, i);
    const { items } = readCompare(storage, 20);
    expect(items).toHaveLength(COMPARE_MAX);
    expect(items[0]!.code).toBe(String(100 + COMPARE_MAX + 1));
    expect(items.at(-1)!.code).toBe('102');
  });

  test('zablokowana pamięć: lista żyje do końca strony, zamiast kurczyć się do ostatniego skanu; nigdy wyjątek', () => {
    const broken: CompareStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(addToCompare(broken, skyr, 0).items).toHaveLength(1);
    expect(addToCompare(broken, gouda, 1).items.map((i) => i.code)).toEqual(['1', '2']);
    expect(readCompare(broken, 2).items).toHaveLength(2);
    expect(readCompare(broken, COMPARE_TTL_MS + 1).items).toEqual([]);
    // Bez żadnej pamięci tak samo.
    addToCompare(null, skyr, 0);
    expect(readCompare(null, 1).items).toHaveLength(1);
    clearCompare(null, 2);
    expect(readCompare(null, 3).items).toEqual([]);
    // Uszkodzony zapis w działającej pamięci to pusta lista.
    const storage = memory();
    storage.data.set(COMPARE_KEY, '{nie json');
    expect(readCompare(storage, 0).items).toEqual([]);
  });
});
