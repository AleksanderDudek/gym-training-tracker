// Reading a Selgros product record (the data the product finder at selgros.pl/znajdz-produkt
// fetches for its grid) into the chain data file. Pure, so it is tested without the site.
import type { ChainProductData } from '../../../src/food/chains/types';
import { foldDiacritics } from '../../../src/food/lib/text';

export interface SelgrosRecord {
  productId: string;
  title: string;
  productBrand: string | null;
  categoryPath: string;
  productDetails?: { id: string; label: string; values: { id: string; label: string; value: string }[] }[];
  units?: { eans?: string[]; baseUnit?: boolean; unit?: { code?: string }; weight?: { netValue?: number | null } }[];
  prices?: { unit?: string; price?: { grossPrice?: number } }[];
}

type Nutrition = ChainProductData['nutrition'];

/** The unit sold one at a time: its EAN, price and weight describe the product. */
export function baseUnit(r: SelgrosRecord) {
  const units = r.units ?? [];
  return units.find((u) => u.baseUnit) ?? units[0];
}

/**
 * The regular price of the base unit — not of a portion, a carton or a pallet, and not an empty
 * placeholder. Goods sold by weight have a price per kilogram.
 */
export function priceOf(r: SelgrosRecord): { price: number | null; perKg: boolean } {
  const want = baseUnit(r)?.unit?.code;
  const priced = (p: NonNullable<SelgrosRecord['prices']>[number]) => typeof p.price?.grossPrice === 'number' && p.price.grossPrice > 0;
  const chosen =
    (want ? r.prices?.find((p) => p.unit === want && priced(p)) : undefined) ?? r.prices?.find((p) => p.unit === 'KG' && priced(p));
  return chosen ? { price: chosen.price!.grossPrice!, perKg: chosen.unit === 'KG' } : { price: null, perKg: false };
}

/** A value from one group of the product's details ("generalInfo", "nutrition", "allergen"). */
export function detail(r: SelgrosRecord, group: string, label: RegExp): string | undefined {
  return r.productDetails?.find((d) => d.id === group)?.values.find((v) => label.test(v.label))?.value;
}

/** "2,4" → 2.4; "<0,5" → 0.5 (the bound itself — at most half a gram off). */
export function num(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

/** Per 100 g (or 100 ml) from the "Wartości odżywcze" group; per-portion rows are left alone. */
export function nutritionOf(r: SelgrosRecord): Nutrition | null {
  const basis = detail(r, 'nutrition', /podstaw[aą] przelicze/i);
  if (basis && !/100\s*(g|ml)/i.test(basis)) return null;
  const per100 = (label: RegExp) => num(detail(r, 'nutrition', label));
  let kcal = per100(/^Wartość energetyczna kcal$/);
  const kj = per100(/^Wartość energetyczna kJ$/);
  if (kcal === null && kj !== null) kcal = Math.round(kj / 4.184);
  const fat = per100(/^Zawartość tłuszczów \(ogólnie\)$/);
  const carbs = per100(/^Zawartość węglowodanów$/);
  const protein = per100(/^Zawartość białek$/);
  if (kcal === null || fat === null || carbs === null || protein === null) return null;
  return {
    kcal,
    protein,
    carbs,
    fat,
    sugars: per100(/^Cukry$/),
    fiber: per100(/^(Zawartość )?błonnik/i),
    saturatedFat: per100(/^Kwasy tłuszczowe nasycone$/),
    salt: per100(/^Zawartość soli$/),
  };
}

/**
 * Numbers a label can have: nothing above 100 g in 100 g, energy up to pure fat, sugars within the
 * carbohydrates and saturated fat within the fat (half a gram for rounding).
 */
export function plausible(n: Nutrition): boolean {
  const grams = [n.protein, n.carbs, n.fat, n.sugars ?? 0, n.saturatedFat ?? 0, n.salt ?? 0, n.fiber ?? 0];
  return (
    n.kcal >= 0 &&
    n.kcal <= 900 &&
    grams.every((g) => g >= 0 && g <= 100) &&
    n.protein + n.carbs + n.fat <= 105 &&
    (n.sugars ?? 0) <= n.carbs + 0.5 &&
    (n.saturatedFat ?? 0) <= n.fat + 0.5
  );
}

/** Energy from the macros against the energy on the label (fibre at 2 kcal/g). */
export function labelAddsUp(n: Nutrition): boolean {
  const computed = 4 * n.protein + 4 * n.carbs + 9 * n.fat + 2 * (n.fiber ?? 0);
  return Math.abs(computed - n.kcal) <= Math.max(25, n.kcal * 0.15);
}

/** GTIN-8 / GTIN-13 with a valid check digit. */
export function validEan(code: string): boolean {
  if (!/^(\d{8}|\d{13})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** The fourteen allergens of EU law, as the chain's page names them → Open Food Facts tags. */
const ALLERGEN_TAGS: [RegExp, string][] = [
  [/^zboża/i, 'en:gluten'],
  [/^skorupiaki/i, 'en:crustaceans'],
  [/^jaja/i, 'en:eggs'],
  [/^ryby/i, 'en:fish'],
  [/^orzeszki ziemne|^orzechy arachidowe/i, 'en:peanuts'],
  [/^soja/i, 'en:soybeans'],
  [/^mleko/i, 'en:milk'],
  [/^orzechy|^migdały|^orzech/i, 'en:nuts'],
  [/^seler/i, 'en:celery'],
  [/^gorczyca/i, 'en:mustard'],
  [/^nasiona sezamu|^sezam/i, 'en:sesame-seeds'],
  [/^dwutlenek siarki|^siarczyny/i, 'en:sulphur-dioxide-and-sulphites'],
  [/^łubin/i, 'en:lupin'],
  [/^mięczaki/i, 'en:molluscs'],
];

export function allergenTag(label: string): string | null {
  return ALLERGEN_TAGS.find(([re]) => re.test(label.trim()))?.[1] ?? null;
}

/*
 * The chain's categories as Open Food Facts tags with their parents (OFF products carry the whole
 * hierarchy), longest path first. Filters, the ready protein groups and the recipe matchers then
 * treat the chain's product like any other. Tags missing from the product base's dictionary are
 * dropped by the fetch script (and reported), so nothing shows up as a raw tag.
 */
const DAIRY = ['en:dairies'];
const PLANT = ['en:plant-based-foods'];
const CEREAL = [...PLANT, 'en:cereals-and-potatoes'];
const SWEET = ['en:snacks', 'en:sweet-snacks'];
const MEAT = ['en:meats'];
const FISH = ['en:seafood', 'en:fishes'];
const PATHS: [string, string[]][] = [
  ['Nabiał/Desery mleczne', [...DAIRY, 'en:dairy-desserts', 'en:desserts']],
  ['Nabiał/Jaja', ['en:farming-products', 'en:eggs']],
  ['Nabiał/Jogurty', [...DAIRY, 'en:fermented-foods', 'en:fermented-milk-products', 'en:yogurts']],
  ['Nabiał/Kefiry i maślanki', [...DAIRY, 'en:fermented-foods', 'en:fermented-milk-products']],
  ['Nabiał/Masła, margaryny i smarowidła', ['en:fats']],
  ['Nabiał/Mleko i śmietana', DAIRY],
  ['Nabiał/Serki homogenizowane', [...DAIRY, 'en:cheeses', 'en:fresh-cheeses']],
  ['Nabiał/Sery białe', [...DAIRY, 'en:cheeses', 'en:fresh-cheeses']],
  ['Nabiał/Sery topione i pleśniowe', [...DAIRY, 'en:cheeses']],
  ['Nabiał/Sery żółte i produkty seropodobne', [...DAIRY, 'en:cheeses']],
  ['Nabiał', DAIRY],
  ['Mięso, wędliny i ryby/Wędliny', [...MEAT, 'en:prepared-meats']],
  ['Mięso, wędliny i ryby/Suszone mięso i wędliny', [...MEAT, 'en:prepared-meats', 'en:dried-meats']],
  ['Mięso, wędliny i ryby/Mięso/Mięso białe świeże', [...MEAT, 'en:poultries']],
  ['Mięso, wędliny i ryby/Mięso', MEAT],
  ['Mięso, wędliny i ryby/Ryby/Wędzone', [...FISH, 'en:smoked-fishes']],
  ['Mięso, wędliny i ryby/Ryby', FISH],
  ['Mięso, wędliny i ryby/Konserwy, pasztety i pasty/Konserwy rybne', ['en:canned-foods', ...FISH, 'en:canned-fishes']],
  ['Mięso, wędliny i ryby/Konserwy, pasztety i pasty', ['en:canned-foods', ...MEAT]],
  ['Mięso, wędliny i ryby', MEAT],
  ['Sypkie/Cukier', ['en:sweeteners', 'en:sugars']],
  ['Sypkie/Kasze', [...CEREAL, 'en:cereal-grains', 'en:groats']],
  ['Sypkie/Makarony', [...CEREAL, 'en:pastas']],
  ['Sypkie/Mąki', [...CEREAL, 'en:flours']],
  ['Sypkie/Płatki', [...CEREAL, 'en:breakfast-cereals']],
  ['Sypkie/Przyprawy', ['en:condiments', 'en:spices']],
  ['Sypkie/Ryż', [...CEREAL, 'en:cereal-grains', 'en:rices']],
  ['Sypkie/Warzywa suche', [...PLANT, 'en:legumes', 'en:pulses']],
  ['Sypkie', PLANT],
  ['Słodycze i przekąski/Batony', [...SWEET, 'en:bars']],
  ['Słodycze i przekąski/Bombonierki', [...SWEET, 'en:confectioneries', 'en:chocolates']],
  ['Słodycze i przekąski/Ciasta', [...SWEET, 'en:biscuits-and-cakes', 'en:cakes']],
  ['Słodycze i przekąski/Ciastka paczkowane', [...SWEET, 'en:biscuits-and-cakes', 'en:biscuits']],
  ['Słodycze i przekąski/Cukierki i czekoladki paczkowane', [...SWEET, 'en:confectioneries', 'en:candies']],
  ['Słodycze i przekąski/Czekolady', [...SWEET, 'en:cocoa-and-its-products', 'en:chocolates']],
  ['Słodycze i przekąski/Desery', ['en:desserts']],
  ['Słodycze i przekąski/Gumy do żucia i lizaki', [...SWEET, 'en:confectioneries', 'en:candies']],
  ['Słodycze i przekąski/Lody', ['en:frozen-foods', 'en:desserts', 'en:frozen-desserts', 'en:ice-creams']],
  ['Słodycze i przekąski/Orzeszki i suszone owoce', PLANT],
  ['Słodycze i przekąski/Przekąski słone', ['en:snacks', 'en:salty-snacks']],
  ['Słodycze i przekąski/Żelki i pianki', [...SWEET, 'en:confectioneries', 'en:candies']],
  ['Słodycze i przekąski', ['en:snacks']],
  ['Przetwory/Ketchupy', ['en:condiments', 'en:sauces', 'en:ketchup']],
  ['Przetwory/Koncentraty i przeciery', PLANT],
  ['Przetwory/Kremy do smarowania pieczywa', ['en:spreads', 'en:sweet-spreads']],
  ['Przetwory/Majonezy, dressingi i octy', ['en:condiments', 'en:sauces']],
  ['Przetwory/Miody, dżemy i powidła', ['en:spreads', 'en:sweet-spreads']],
  ['Przetwory/Musztardy', ['en:condiments', 'en:mustards']],
  ['Przetwory/Oleje i oliwy', ['en:fats', 'en:vegetable-oils']],
  ['Przetwory/Sosy', ['en:condiments', 'en:sauces']],
  ['Dania gotowe i mrożonki/Frytki', ['en:frozen-foods', ...CEREAL, 'en:fries']],
  ['Dania gotowe i mrożonki/Gotowe posiłki', ['en:meals']],
  ['Dania gotowe i mrożonki/Mrożonki', ['en:frozen-foods']],
  ['Dania gotowe i mrożonki/Sałatki', ['en:meals', 'en:salads']],
  ['Dania gotowe i mrożonki/Zupy i buliony', ['en:meals', 'en:soups']],
  ['Owoce i warzywa/Grzyby', [...PLANT, 'en:mushrooms']],
  ['Owoce i warzywa/Konserwy warzywne i owocowe', ['en:canned-foods', ...PLANT]],
  ['Owoce i warzywa/Owoce świeże', [...PLANT, 'en:fruits']],
  ['Owoce i warzywa', [...PLANT, 'en:vegetables']],
  ['Pieczywo/Pieczywo chrupkie', [...CEREAL, 'en:breads', 'en:crispbreads']],
  ['Pieczywo', [...CEREAL, 'en:breads']],
  ['Napoje i woda/Napoje roślinne', ['en:beverages', ...PLANT, 'en:plant-based-beverages', 'en:dairy-substitutes']],
  ['Napoje i woda/Soki, syropy i nektary', ['en:beverages', 'en:juices-and-nectars']],
  ['Napoje i woda/Woda', ['en:beverages', 'en:waters']],
  ['Napoje i woda', ['en:beverages']],
  ['Kawa i herbata/Herbata', ['en:beverages', 'en:teas']],
  ['Kawa i herbata/Kakao', ['en:cocoa-and-its-products']],
  ['Kawa i herbata/Kawa', ['en:beverages', 'en:coffees']],
  ['Kawa i herbata/Śmietanki', [...DAIRY, 'en:creams']],
  ['Dla dzieci/Mleka', ['en:baby-foods', 'en:baby-milks']],
  ['Dla dzieci', ['en:baby-foods']],
  ['Produkty wegetariańskie i wegańskie', PLANT],
];

/**
 * What the name says better than the shelf it stands on, matched on the folded, lower-case name —
 * and only on the shelves where the word means that: „śmietankowe” lody are no cream, „drobny” cukier
 * no poultry, a chocolate „z orzechami” no nuts, „masło orzechowe” no butter.
 */
const BY_NAME: { re: RegExp; tags: string[]; on: string[] }[] = [
  { re: /\bmleko\b/, tags: ['en:milks'], on: ['Nabiał/Mleko'] },
  { re: /\bsmietan(a|y|e|ie|ka|ki)\b/, tags: ['en:creams'], on: ['Nabiał/Mleko', 'Kawa i herbata/Śmietanki'] },
  { re: /\bmaslo\b(?! orzech)/, tags: ['en:dairies', 'en:butters'], on: ['Nabiał/Masła'] },
  { re: /\bmargaryn/, tags: ['en:margarines'], on: ['Nabiał/Masła'] },
  { re: /\bskyr\b/, tags: ['en:yogurts'], on: ['Nabiał'] },
  { re: /\btwarog\w*|\btwarozek/, tags: ['en:quarks'], on: ['Nabiał/Sery białe'] },
  { re: /serek wiejski|\bcottage\b/, tags: ['en:cottage-cheeses'], on: ['Nabiał/Sery białe'] },
  { re: /\bkefir/, tags: ['en:fermented-milk-products'], on: ['Nabiał'] },
  { re: /\bmaslank/, tags: ['en:buttermilks'], on: ['Nabiał'] },
  { re: /\bbasmati\b/, tags: ['en:basmati-rices'], on: ['Sypkie/Ryż'] },
  { re: /\bdlugoziarn/, tags: ['en:long-grain-rices'], on: ['Sypkie/Ryż'] },
  { re: /\bryz bial/, tags: ['en:white-rices'], on: ['Sypkie/Ryż'] },
  { re: /\boliwa\b/, tags: ['en:olive-oils'], on: ['Przetwory/Oleje'] },
  { re: /\b(orzech\w*|migdal\w*|nerkowc\w*|pistacj\w*|arachid\w*)\b/, tags: ['en:nuts'], on: ['Słodycze i przekąski/Orzeszki', 'Sypkie'] },
  { re: /\b(suszon\w*|rodzynk\w*|daktyl\w*|zurawin\w*)\b/, tags: ['en:dried-fruits'], on: ['Słodycze i przekąski/Orzeszki', 'Sypkie'] },
  { re: /^(?!.*\b(o smaku|a['’]?\s?la|smak\w*)\b).*\b(kurczak\w*|indyk\w*|drobiow\w*|drobiu)\b/, tags: ['en:poultries'], on: ['Mięso, wędliny i ryby'] },
  { re: /\btunczyk\w*/, tags: ['en:fishes'], on: ['Mięso, wędliny i ryby'] },
  { re: /\bhum+us\b/, tags: ['en:spreads'], on: ['Przetwory', 'Produkty wegetariańskie i wegańskie'] },
  { re: /\btofu\b|\broslinn\w* (kotlet|burger|kielbas|parowk)/, tags: ['en:meat-analogues'], on: ['Produkty wegetariańskie i wegańskie'] },
];

const normal = (path: string) => path.replace(/\s+/g, ' ').trim();

export function categoriesFor(path: string, name: string): string[] {
  const p = normal(path);
  const fromPath = PATHS.map(([prefix, tags]) => [normal(prefix), tags] as const)
    .filter(([prefix]) => p === prefix || p.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
  const folded = foldDiacritics(name.toLowerCase());
  const fromName = BY_NAME.filter((r) => r.on.some((shelf) => p.startsWith(shelf)) && r.re.test(folded)).flatMap(
    (r) => r.tags,
  );
  return [...new Set([...(fromPath ?? []), ...fromName])];
}

/** Titles in capitals become a sentence: "ALMETTE ŚMIETANKOWY. 150 G" → "Almette śmietankowy. 150 g". */
export function tidyName(title: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const letters = t.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '');
  if (!letters || upper.length / letters.length < 0.6) return t;
  const lower = t.toLocaleLowerCase('pl');
  return lower.charAt(0).toLocaleUpperCase('pl') + lower.slice(1);
}

/** "MLEKOVITA" → "Mlekovita"; mixed case and short marks ("SM", "Ab") stay as written. */
export function tidyBrand(brand: string): string {
  const b = brand.replace(/\s+/g, ' ').trim();
  if (b !== b.toLocaleUpperCase('pl') || b.length <= 3) return b;
  return b
    .toLocaleLowerCase('pl')
    .replace(/(^|[\s-])(\p{L})/gu, (_m, s: string, c: string) => s + c.toLocaleUpperCase('pl'));
}

const UNITS: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000 };

/**
 * The pack size out of a title, for the unit the EAN, the price and the net weight describe. A title
 * can name several amounts — "6x330ml", "240 g (40 g x 6 szt.)", "10 g x 200 szt." — so the one
 * closest to the base unit's net weight wins; without it, a multipack as a whole, else the first.
 */
export function quantityOf(title: string, netKg?: number | null): string | null {
  const found: { label: string; amount: number }[] = [];
  const add = (amount: string, unit: string, count?: string) => {
    const u = unit.toLowerCase();
    const value = Number(amount.replace(',', '.')) * (UNITS[u] ?? 1);
    found.push({ label: `${amount} ${u}`, amount: value });
    if (count) found.push({ label: `${count} x ${amount} ${u}`, amount: value * Number(count) });
  };
  for (const m of title.matchAll(/(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b(?:\s*[x×]\s*(\d+))?/gi))
    add(m[2]!, m[3]!, m[1] ?? m[4]);
  if (found.length) {
    if (netKg && netKg > 0) {
      const target = netKg * 1000;
      return found.reduce((best, f) => (Math.abs(f.amount - target) < Math.abs(best.amount - target) ? f : best)).label;
    }
    return (found.find((f) => f.label.includes(' x ')) ?? found[0]!).label;
  }
  if (netKg && netKg > 0) return netKg < 1 ? `${Math.round(netKg * 1000)} g` : `${String(netKg).replace('.', ',')} kg`;
  return null;
}

/** The brand inside a name written in sentence case gets its own spelling back: "…500g dawtona" → "…500g Dawtona". */
export function withBrand(name: string, brand: string | null): string {
  if (!brand || brand.length < 3) return name;
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return name.replace(new RegExp(`(^|[\\s(])${escaped}(?=$|[\\s,.)])`, 'giu'), (_m, before: string) => `${before}${brand}`);
}
