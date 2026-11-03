import { addDays } from '../diet/model';
import type { Entry } from '../diet/db';
import type { FoodSet } from '../diet/foods';
import { entryParts, servingsIn, type EntryPart } from '../diet/parts';
import { brandLine } from '../lib/display';
import { formatNumber, formatPrice } from '../lib/format';
import type { Dictionaries, IndexedProduct } from '../lib/types';
import { LOCALE, text } from '../../i18n';
import { AISLE, AISLE_LABELS, AISLE_ORDER } from '../prep/aisles';
import { rangeLabel, shortDate } from '../prep/format';
import { amountText, itemName, packSize, packsFor, priceOf, priceSum, pricedEnough, shoppingList, type SideUse } from '../prep/shopping';
import type { Aisle, ShoppingItem } from '../prep/types';
import { INGREDIENTS, type IngredientId } from '../recipes/ingredients';
import type { Basket, Candidates } from '../recipes/resolve';
import { shopPeriod, type ShopRhythm } from './rhythm';

const T = text({
  pl: {
    portions: (n: number, label: string) => `${n} × ${label}`,
    portion: 'porcja',
    title: (shop: string, range: string) => `Zakupy z dziennika · ${shop} (jedzenie na ${range})`,
    basis: (days: number) => `Średnia z ${days} zapisanych dni z ostatnich 4 tygodni — zajrzyj do lodówki.`,
    list: 'Lista',
    sometimes: 'Czasem (zjedzone raz)',
    home: 'Sprawdź w domu',
    about: (price: string) => ` · ok. ${price}`,
    total: (total: string, known: string, all: string) => `Razem ok. ${total} (ceny znane dla ${known} z ${all} pozycji).`,
  },
  en: {
    portions: (n: number, label: string) => `${n} × ${label}`,
    portion: 'serving',
    title: (shop: string, range: string) => `Shopping from the diary · ${shop} (food for ${range})`,
    basis: (days: number) => `Average of ${days} logged days from the last 4 weeks — check the fridge.`,
    list: 'List',
    sometimes: 'Sometimes (eaten once)',
    home: 'Check at home',
    about: (price: string) => ` · about ${price}`,
    total: (total: string, known: string, all: string) => `Total about ${total} (prices known for ${known} of ${all} items).`,
  },
});

/** The diary looked back on: four weeks before today (today is still going on). */
export const WINDOW_DAYS = 28;
/** Fewer logged days than this say nothing about a week of eating. */
export const MIN_LOGGED_DAYS = 3;
/** Eaten on at least this many different days: a regular, bought every time. */
export const REGULAR_DAYS = 2;

/** Where a line comes from: an ingredient of a recipe eaten, a product logged by barcode, the person's own food. */
export type HistorySource = 'recipe' | 'product' | 'own';

export interface HistoryItem extends ShoppingItem {
  from: HistorySource;
  /** Different days of the window it was eaten on. */
  days: number;
  /** A food logged without grams (an own food, a product by the piece): portions as logged, not packs. */
  portions: { count: number; label: string } | null;
}

export interface HistoryInput {
  /** The diary; anything outside the window is ignored, so a wider read is fine. */
  entries: readonly Entry[];
  /** The person's sets by id, as stored now (`entryParts`). */
  sets?: ReadonlyMap<number, FoodSet>;
  today: string;
  rhythm: ShopRhythm;
  /** Products by barcode, for lines logged from the product base; absent or unknown: the entry's own name, no pack. */
  product?: (code: string) => IndexedProduct | undefined;
  /** What the recipe ingredients are bought as: the preferred shop, or anywhere (`[]`). */
  basket: Basket;
  candidates: Candidates;
  dict: Dictionaries;
}

export interface HistoryList {
  /** The window: first and last day looked at (yesterday). */
  from: string;
  to: string;
  /** Days of the window with at least one entry: the divisor. */
  logged: number;
  /** The trip and the days it buys for (`shopPeriod`). */
  period: { shop: string; until: string; days: number };
  /** Enough logged days for a list at all. */
  enough: boolean;
  /** Eaten on two or more days: the list, aisle by aisle. */
  main: HistoryItem[];
  /** Eaten on one day only: a suggestion, not a purchase. */
  sometimes: HistoryItem[];
  /** Pantry goods (spices, oil, protein powder): check before going. */
  home: HistoryItem[];
  /** Entries of the window the list cannot buy: restaurants, photo dishes, plan items, quick entries. */
  skipped: number;
}

/** A diary food the list counts: a product (by barcode) or an own food. Everything else is not bought from here. */
const BOUGHT_KEY = /^(product|custom):/;

interface Tally {
  grams: number;
  /** Occurrences with grams. */
  weighed: number;
  /** Occurrences without grams, as servings. */
  portions: number;
  labels: Map<string, number>;
  dates: Set<string>;
  name: string;
}

const tally = (name: string): Tally => ({ grams: 0, weighed: 0, portions: 0, labels: new Map(), dates: new Set(), name });

/** The first ingredient whose matcher takes the product, for its aisle; `inne` when none does. */
function aisleOf(p: IndexedProduct, cache: Map<string, Aisle>): Aisle {
  let aisle = cache.get(p.code);
  if (aisle) return aisle;
  aisle = 'inne';
  for (const def of Object.values(INGREDIENTS)) {
    if (def.match?.(p)) {
      aisle = AISLE[def.id as IngredientId] ?? 'inne';
      break;
    }
  }
  cache.set(p.code, aisle);
  return aisle;
}

/** The label seen most often („1 porcja”, „1 kromka”), the first one on a tie. */
function usualLabel(labels: Map<string, number>): string {
  let best = '';
  let n = 0;
  for (const [label, count] of labels) if (count > n) [best, n] = [label, count];
  return best;
}

/**
 * The parts of an entry the list can buy, each with its kcal when known (a product logged in
 * pieces is weighed from its kcal and the label's kcal per 100 g). A set's part that is a recipe
 * is opened into the recipe's ingredients, like a recipe logged on its own.
 */
function boughtParts(e: Entry, sets: ReadonlyMap<number, FoodSet>): { part: EntryPart; kcal: number | null }[] {
  const parts = entryParts(e, sets);
  const setId = e.key?.startsWith('set:') ? Number(e.key.slice(4)) : NaN;
  const set = Number.isInteger(setId) ? sets.get(setId) : undefined;
  const fromSet = !!set?.parts.length && parts.length === set.parts.length && !parts[0]?.ingredient;
  const out: { part: EntryPart; kcal: number | null }[] = [];
  parts.forEach((part, i) => {
    const kcal = fromSet ? (set!.parts[i]?.kcal ?? null) : parts.length === 1 && !part.ingredient ? e.kcal : null;
    if (fromSet && part.key?.startsWith('recipe:')) {
      // A recipe inside a set: its ingredients, at the servings the part was.
      for (const inner of entryParts({ ...e, key: part.key, amountLabel: part.amountLabel })) if (inner.ingredient) out.push({ part: inner, kcal: null });
      return;
    }
    out.push({ part, kcal });
  });
  return out;
}

const byAisle = (a: HistoryItem, b: HistoryItem): number =>
  AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) || itemName(a).localeCompare(itemName(b), LOCALE);

/**
 * The shopping list from what the person actually ate: the average of a logged day over the last
 * four weeks, times the days the next trip buys for. Recipe servings become their ingredients and
 * go through the plan list's own rules (`shoppingList`: the basket's product, packs, pieces, aisle,
 * price); products logged by barcode are their own lines, in packs of the product. A day without
 * entries is no data, not a fast, so only logged days divide.
 */
export function historyList(input: HistoryInput): HistoryList {
  const { today, rhythm, basket, candidates, dict } = input;
  const sets = input.sets ?? new Map<number, FoodSet>();
  const from = addDays(today, -WINDOW_DAYS);
  const to = addDays(today, -1);
  const period = shopPeriod(rhythm, today);
  const inWindow = input.entries.filter((e) => e.date >= from && e.date <= to);
  const loggedDates = new Set(inWindow.map((e) => e.date));
  const logged = loggedDates.size;
  const base = { from, to, logged, period, enough: logged >= MIN_LOGGED_DAYS };
  if (!base.enough) return { ...base, main: [], sometimes: [], home: [], skipped: 0 };

  const ingredients = new Map<IngredientId, Tally>();
  const foods = new Map<string, Tally>();
  let skipped = 0;
  for (const e of inWindow) {
    let counted = false;
    for (const { part, kcal } of boughtParts(e, sets)) {
      if (part.ingredient) {
        if (!part.grams || part.grams <= 0) continue;
        const t = ingredients.get(part.ingredient) ?? tally(part.name);
        t.grams += part.grams;
        t.dates.add(e.date);
        ingredients.set(part.ingredient, t);
        counted = true;
        continue;
      }
      if (!part.key || !BOUGHT_KEY.test(part.key)) continue;
      const t = foods.get(part.key) ?? tally(part.name);
      let grams = part.grams;
      const product = part.key.startsWith('product:') ? input.product?.(part.key.slice('product:'.length)) : undefined;
      const per100 = product?.nutrition.kcal;
      if (grams === null && kcal !== null && kcal > 0 && per100) grams = (kcal * 100) / per100;
      if (grams !== null) {
        t.grams += grams;
        t.weighed++;
      } else {
        t.portions += servingsIn(part.amountLabel);
        if (part.amountLabel) t.labels.set(part.amountLabel, (t.labels.get(part.amountLabel) ?? 0) + 1);
      }
      t.dates.add(e.date);
      foods.set(part.key, t);
      counted = true;
    }
    if (!counted) skipped++;
  }

  const scale = period.days / logged;
  const days = new Map<string, number>();

  // Ingredients: one side per ingredient on the shopping day, bought by the plan list's rules.
  const sides: SideUse[] = [];
  for (const [ingredient, t] of ingredients) {
    days.set(ingredient, t.dates.size);
    sides.push({ ingredient, grams: t.grams * scale, date: period.shop });
  }
  const items: HistoryItem[] = shoppingList({ uses: [], sides, basket, candidates, dict, start: period.shop }).map((item) => ({
    ...item,
    from: 'recipe',
    days: days.get(item.key) ?? 0,
    portions: null,
  }));

  // A product logged by barcode that is also the product a recipe's ingredient is bought as (the
  // same skyr in a bowl and on its own): one line, both amounts.
  const twins = new Map<string, HistoryItem>();
  for (const item of items) if (item.product && item.group !== 'home' && !twins.has(item.product.code)) twins.set(item.product.code, item);
  const merged = new Set<HistoryItem>();

  const aisles = new Map<string, Aisle>();
  for (const [key, t] of foods) {
    const code = key.startsWith('product:') ? key.slice('product:'.length) : null;
    const product = code ? input.product?.(code) : undefined;
    const known = t.grams > 0;
    // Occurrences without grams take the average of the ones with: the same yoghurt, logged two ways.
    const grams = known ? t.grams + (t.grams / t.weighed) * t.portions : 0;
    const twin = product && known ? twins.get(product.code) : undefined;
    let need = grams * scale;
    let dates = t.dates;
    if (twin) {
      merged.add(twin);
      need += twin.grams;
      dates = new Set([...t.dates, ...(ingredients.get(twin.key as IngredientId)?.dates ?? [])]);
    }
    const packG = product && known ? packSize(product.quantity) : null;
    const packs = packG !== null ? packsFor(need, packG) : null;
    const portions = known ? null : { count: Math.max(1, Math.ceil(t.portions * scale - 0.1)), label: usualLabel(t.labels) || T.portion };
    items.push({
      key,
      ingredient: '',
      label: product?.name ?? t.name,
      role: 'store',
      shop: null,
      group: 'visit',
      aisle: twin ? twin.aisle : product ? aisleOf(product, aisles) : 'inne',
      grams: Math.round(need),
      product: product
        ? { code: product.code, name: product.name, brand: brandLine(product, dict) || null, quantity: product.quantity, url: null }
        : null,
      packs,
      packGrams: packG,
      pieces: null,
      price: product && known ? priceOf(product, null, packs, packG, need) : null,
      freeze: [],
      from: code ? 'product' : 'own',
      days: dates.size,
      portions,
    });
  }

  const kept = items.filter((i) => !merged.has(i));
  const home = kept.filter((i) => i.group === 'home').sort(byAisle);
  const rest = kept.filter((i) => i.group !== 'home' && (i.grams > 0 || i.portions));
  return {
    ...base,
    main: rest.filter((i) => i.days >= REGULAR_DAYS).sort(byAisle),
    sometimes: rest.filter((i) => i.days < REGULAR_DAYS).sort(byAisle),
    home,
    skipped,
  };
}

/** What to take: portions as logged („3 × 1 kromka”), otherwise the plan list's packs, pieces or grams. */
export const historyAmount = (item: HistoryItem): string =>
  item.portions ? T.portions(item.portions.count, item.portions.label) : amountText(item);

/** The list as plain text, to send or paste into notes: the list aisle by aisle, then the rest. */
export function historyText(list: HistoryList, bought: ReadonlySet<string>): string {
  const out = [T.title(shortDate(list.period.shop), rangeLabel(list.period.shop, list.period.until))];
  const line = (item: HistoryItem) => {
    const price = item.price !== null ? T.about(formatPrice(item.price)) : '';
    return `  ${bought.has(item.key) ? '[x]' : '[ ]'} ${itemName(item)} — ${historyAmount(item)}${price}`;
  };
  let aisle: string | null = null;
  if (list.main.length) out.push('', T.list);
  for (const item of list.main) {
    if (item.aisle !== aisle) {
      aisle = item.aisle;
      out.push(`  ${AISLE_LABELS[item.aisle]}`);
    }
    out.push(line(item));
  }
  for (const [title, items] of [
    [T.sometimes, list.sometimes],
    [T.home, list.home],
  ] as const) {
    if (!items.length) continue;
    out.push('', title, ...items.map(line));
  }
  const sum = priceSum(list.main);
  if (pricedEnough(sum))
    out.push('', T.total(formatPrice(sum.total), formatNumber(sum.known, 0), formatNumber(sum.known + sum.unknown, 0)));
  out.push('', T.basis(list.logged));
  return out.join('\n');
}
