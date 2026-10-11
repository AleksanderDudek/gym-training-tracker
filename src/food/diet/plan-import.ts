import { storeKey } from '../lib/stores';
import { normalizeForSearch } from '../lib/text';
import type { Plan, PlanItem, PlanVariant } from './plan';
import type { Nutrients, Profile, Sex } from './types';
import { cell, excelDate, lastRow, type Cell, type Sheet, type Workbook } from './xlsx';

/**
 * Reads the user's reduction-plan workbook (sheets PANEL, WARIANTY, PLAN 91
 * DNI, DANIA, DODATKI) into a profile, a plan, and the days already logged in
 * it. Labels are matched by their beginning, folded, so a renamed unit in
 * brackets or a stray space does not break the import.
 */

export interface LoggedDay {
  date: string;
  variant?: number;
  weightKg?: number;
  steps?: number;
  extraKcal?: number;
}

export interface ImportedPlan {
  profile: Partial<Profile>;
  plan: Plan;
  days: LoggedDay[];
  /** Things the importer could not reconcile, for the user to see. */
  warnings: string[];
}

const fold = (value: Cell | undefined) => normalizeForSearch(String(value ?? ''));
const num = (value: Cell | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const str = (value: Cell | undefined): string => (value === undefined ? '' : String(value).trim());

function sheetNamed(book: Workbook, prefix: string): Sheet | null {
  for (const [name, sheet] of book) if (fold(name).startsWith(fold(prefix))) return sheet;
  return null;
}

/** PANEL: the value in column D beside the label in column B. */
function panelValue(panel: Sheet, label: string): Cell | undefined {
  const wanted = fold(label);
  for (let row = 1; row <= lastRow(panel); row++) {
    if (fold(panel.get(cell('B', row))).startsWith(wanted)) return panel.get(cell('D', row));
  }
  return undefined;
}

function readProfile(panel: Sheet | null): Partial<Profile> {
  if (!panel) return {};
  const n = (label: string) => num(panelValue(panel, label));
  const profile: Partial<Profile> = {};
  const start = n('Data startu');
  if (start !== null) profile.startDate = excelDate(start);
  const set = <K extends keyof Profile>(key: K, value: Profile[K] | null) => {
    if (value !== null) profile[key] = value;
  };
  set('startWeightKg', n('Waga startowa'));
  set('targetWeightKg', n('Waga docelowa'));
  set('heightCm', n('Wzrost'));
  set('age', n('Wiek'));
  const sex = fold(panelValue(panel, 'Płeć'));
  if (sex === 'm' || sex === 'k') set('sex', sex.toUpperCase() as Sex);
  set('activityMultiplier', n('Mnożnik aktywności'));
  set('baseSteps', n('Kroki bazowe'));
  set('targetSteps', n('CEL: kroki'));
  set('extraWeeklyKcal', n('Dodatkowy wysiłek'));
  set('kcalPer1000StepsPerKg', n('kcal na 1000 kroków'));
  set('kcalPerKg', n('Energia zawarta w 1 kg'));
  const kcal = n('kcal planowane dziennie');
  set('dailyKcal', kcal === null ? null : Math.round(kcal / 10) * 10);
  return profile;
}

/** The plan's own notes on its variants ("• 2 — z szejkiem malinowym…"). */
function readNotes(panel: Sheet | null): string[] {
  if (!panel) return [];
  const notes: string[] = [];
  for (let row = 1; row <= lastRow(panel); row++) {
    const text = str(panel.get(cell('B', row)));
    if (/^•\s*\d\s*[—-]/.test(text)) notes.push(text.replace(/^•\s*/, ''));
  }
  return notes;
}

interface Food extends Nutrients {
  name: string;
  protein: number;
  carbs: number;
  fat: number;
}

interface Tables {
  /** Catering dishes: half and whole pack. */
  dishes: { name: string; half: Food; whole: Food }[];
  /** Added to every dish preparation ("2 łyżki oliwy"). */
  oil: Food | null;
  /** One scoop of whey. */
  scoop: Food | null;
  pizzas: { name: string; whole: Food; half: Food; stores: string[] }[];
  /** Extras per 100 g. */
  per100: Food[];
}

function food(sheet: Sheet, row: number, first: 'C' | 'G', name: string): Food | null {
  const cols = first === 'C' ? ['C', 'D', 'E', 'F'] : ['G', 'H', 'I', 'J'];
  const [kcal, protein, carbs, fat] = cols.map((c) => num(sheet.get(cell(c, row))));
  if (kcal == null) return null;
  return { name, kcal, protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 };
}

/** "Pizza Capricciosa (Lidl, Kaufland, Dino, Intermarché)" -> the chains named in brackets. */
function storesIn(name: string): string[] {
  const inside = name.match(/\(([^)]*)\)/)?.[1];
  if (!inside) return [];
  return inside
    .replace(/\btylko\b/gi, '')
    .split(',')
    .map((part) => storeKey(part)?.key)
    .filter((key): key is string => !!key);
}

function readTables(dania: Sheet | null, dodatki: Sheet | null): Tables {
  const tables: Tables = { dishes: [], oil: null, scoop: null, pizzas: [], per100: [] };
  if (dania) {
    let inPizzas = false;
    for (let row = 1; row <= lastRow(dania); row++) {
      const name = str(dania.get(cell('B', row)));
      if (!name) continue;
      const folded = fold(name);
      if (folded.startsWith('pizza') && num(dania.get(cell('C', row))) === null) {
        inPizzas = true; // the pizza header row
        continue;
      }
      const first = food(dania, row, 'C', name);
      if (!first) continue;
      if (inPizzas) {
        const half = food(dania, row, 'G', name);
        if (half) tables.pizzas.push({ name, whole: first, half, stores: storesIn(name) });
      } else if (folded.includes('oliw')) tables.oil = first;
      else if (folded.includes('miark')) tables.scoop = first;
      else {
        const whole = food(dania, row, 'G', name);
        if (whole) tables.dishes.push({ name, half: first, whole });
      }
    }
  }
  if (dodatki) {
    for (let row = 1; row <= lastRow(dodatki); row++) {
      const name = str(dodatki.get(cell('B', row)));
      if (fold(name) === 'kalkulator') break; // the calculator below repeats the products with grams
      const f = name ? food(dodatki, row, 'C', name) : null;
      if (f && fold(name) !== 'produkt') tables.per100.push(f);
    }
  }
  return tables;
}

const scale = (f: Food, factor: number): Food => ({
  name: f.name,
  kcal: f.kcal * factor,
  protein: f.protein * factor,
  carbs: f.carbs * factor,
  fat: f.fat * factor,
});

function add(parts: Food[]): Nutrients {
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: r(parts.reduce((s, p) => s + p.kcal, 0)),
    protein: r(parts.reduce((s, p) => s + p.protein, 0)),
    carbs: r(parts.reduce((s, p) => s + p.carbs, 0)),
    fat: r(parts.reduce((s, p) => s + p.fat, 0)),
  };
}

/** A food whose folded name contains the first five letters of a word: "bataty" finds "batatami". */
function byStem<T extends { name: string }>(list: T[], word: string): T | null {
  const stem = fold(word).slice(0, 5);
  return stem.length >= 3 ? (list.find((f) => fold(f.name).includes(stem)) ?? null) : null;
}

const SPOON_G = 15;
const number = (text: string) => Number(text.replace(',', '.'));

/** One part like "skyr 450 g", "2 mk. whey", "musztarda 1 łyżka", "Masło 20 g". */
function component(text: string, t: Tables): Food | null {
  const part = text.trim();
  const scoops = part.match(/(\d+(?:[.,]\d+)?)\s*mk\.?\s*(.*)/i);
  if (scoops) {
    const [, count = ''] = scoops;
    const whey = byStem(t.per100, 'whey');
    if (t.scoop) return scale(t.scoop, number(count));
    return whey ? scale(whey, (number(count) * 28) / 100) : null;
  }
  const grams = part.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (grams) {
    const [, what = '', amount = ''] = grams;
    const f = byStem(t.per100, what.split(/\s+/)[0] ?? '');
    return f ? scale(f, number(amount) / 100) : null;
  }
  const spoons = part.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*łyż/i);
  if (spoons) {
    const [, what = '', amount = ''] = spoons;
    const f = byStem(t.per100, what.split(/\s+/)[0] ?? '');
    return f ? scale(f, (number(amount) * SPOON_G) / 100) : null;
  }
  return null;
}

/** An item's macros from the plan's own tables, or null when a part is unknown. */
export function itemNutrients(text: string, t: Tables): (Nutrients & { stores: string[] }) | null {
  const folded = fold(text);

  const pack = text.match(/^(1|½|1\/2)\s*opak\.?\s+(.+)$/i);
  if (pack) {
    const [, amount, what = ''] = pack;
    const dish = byStem(t.dishes, what);
    if (!dish) return null;
    const base = amount === '1' ? dish.whole : dish.half;
    // Every preparation of a dish takes the plan's two spoons of oil.
    return { ...add(t.oil ? [base, t.oil] : [base]), stores: [] };
  }

  if (folded.startsWith('pizza')) {
    const name = text.replace(/^pizza\s+/i, '').split(/\s+[—-]\s+/)[0];
    const pizza = t.pizzas.find((p) => fold(p.name).includes(fold(name)));
    if (!pizza) return null;
    return { ...add([/½|pol/.test(folded) ? pizza.half : pizza.whole]), stores: pizza.stores };
  }

  const body = text.replace(/^szejk:\s*/i, '');
  const parts = body.split('+').map((p) => component(p.replace(/\bw wodzie\b/i, ''), t));
  if (parts.some((p) => p === null)) return null;
  return { ...add(parts as Food[]), stores: [] };
}

const ITEM_COLUMNS = [
  ['D', 'E'],
  ['F', 'G'],
  ['H', 'I'],
  ['J', 'K'],
  ['L', 'M'],
] as const;

function readVariants(
  warianty: Sheet,
  t: Tables,
  warnings: string[],
): { templates: Record<string, PlanVariant[]>; order: string[] } {
  const templates: Record<string, PlanVariant[]> = {};
  const order: string[] = [];
  for (let row = 2; row <= lastRow(warianty); row++) {
    const key = str(warianty.get(cell('B', row)));
    const index = num(warianty.get(cell('C', row)));
    if (!key || index === null) continue;
    const items: PlanItem[] = [];
    for (const [textCol, kcalCol] of ITEM_COLUMNS) {
      const text = str(warianty.get(cell(textCol, row)));
      const kcal = num(warianty.get(cell(kcalCol, row)));
      if (!text || text === '0' || !kcal) continue;
      const derived = itemNutrients(text, t);
      items.push({
        text,
        // The plan's own number wins: it is what the user planned with.
        kcal,
        protein: derived?.protein ?? null,
        carbs: derived?.carbs ?? null,
        fat: derived?.fat ?? null,
        stores: derived?.stores ?? [],
      });
    }
    const totals: Nutrients = {
      kcal: num(warianty.get(cell('N', row))) ?? items.reduce((s, i) => s + i.kcal, 0),
      protein: num(warianty.get(cell('O', row))),
      carbs: num(warianty.get(cell('P', row))),
      fat: num(warianty.get(cell('Q', row))),
    };
    checkTotals(`${key}|${index}`, items, totals, warnings);
    if (!templates[key]) {
      templates[key] = [];
      order.push(key);
    }
    templates[key].push({ index, items, totals });
  }
  for (const variants of Object.values(templates)) variants.sort((a, b) => a.index - b.index);
  return { templates, order };
}

/** Derived item macros should add up to the variant's stated ones; say so when they do not. */
function checkTotals(key: string, items: PlanItem[], totals: Nutrients, warnings: string[]): void {
  if (items.some((i) => i.protein === null) || totals.protein === null) return;
  const sum = (k: 'protein' | 'carbs' | 'fat') => items.reduce((s, i) => s + (i[k] ?? 0), 0);
  for (const k of ['protein', 'carbs', 'fat'] as const) {
    const stated = totals[k];
    if (stated !== null && Math.abs(sum(k) - stated) > 3) {
      warnings.push(`${key}: ${k} wyliczone ${Math.round(sum(k))} g, w planie ${Math.round(stated)} g`);
    }
  }
}

function readLoggedDays(planSheet: Sheet | null): { days: string[]; logged: LoggedDay[]; start: string | null } {
  if (!planSheet) return { days: [], logged: [], start: null };
  const days: string[] = [];
  const logged: LoggedDay[] = [];
  let start: string | null = null;
  for (let row = 2; row <= lastRow(planSheet); row++) {
    const key = str(planSheet.get(cell('D', row)));
    const date = num(planSheet.get(cell('B', row)));
    if (!key || date === null) continue;
    const iso = excelDate(date);
    start ??= iso;
    days.push(key);
    const variant = num(planSheet.get(cell('E', row)));
    const steps = num(planSheet.get(cell('Y', row)));
    const weightKg = num(planSheet.get(cell('Z', row)));
    const extraKcal = num(planSheet.get(cell('V', row)));
    if ((variant !== null && variant !== 1) || steps !== null || weightKg !== null || extraKcal) {
      logged.push({
        date: iso,
        ...(variant !== null && variant !== 1 ? { variant } : {}),
        ...(steps !== null ? { steps } : {}),
        ...(weightKg !== null ? { weightKg } : {}),
        ...(extraKcal ? { extraKcal } : {}),
      });
    }
  }
  return { days, logged, start };
}

/** Today on the user's calendar: toISOString() is UTC, which is still yesterday just after midnight in Poland. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function importPlan(book: Workbook, id = 'excel'): ImportedPlan {
  const warnings: string[] = [];
  const panel = sheetNamed(book, 'PANEL');
  const warianty = sheetNamed(book, 'WARIANTY');
  if (!warianty) throw new Error('W pliku nie ma arkusza WARIANTY – to nie jest plan w znanym formacie.');
  const tables = readTables(sheetNamed(book, 'DANIA'), sheetNamed(book, 'DODATKI'));
  const { templates, order } = readVariants(warianty, tables, warnings);
  const { days, logged, start } = readLoggedDays(sheetNamed(book, 'PLAN'));
  const profile = readProfile(panel);

  const foods = new Map<string, PlanItem>();
  for (const variants of Object.values(templates))
    for (const v of variants) for (const item of v.items) if (!foods.has(item.text)) foods.set(item.text, item);

  const unknown = [...foods.values()].filter((f) => f.protein === null).map((f) => f.text);
  if (unknown.length) warnings.push(`Bez makroskładników (tylko kcal): ${unknown.join('; ')}`);

  const title = str(panel?.get('B2')) || 'Plan z Excela';
  const plan: Plan = {
    id,
    name: title,
    startDate: start ?? profile.startDate ?? localToday(),
    days: days.length ? days : order,
    templates,
    foods: [...foods.values()],
    notes: readNotes(panel),
  };
  return { profile, plan, days: logged, warnings };
}
