import { packagedFood, type Food } from '../diet/foods';
import type { DietProfile, Fit, FitLevel } from '../diet/profiles';
import { brandLine } from '../lib/display';
import { packGrams } from '../lib/quantity';
import type { Dictionaries, NutriGrade, Product } from '../lib/types';
import type { OffProduct, Per100 } from './off';

/**
 * A scanned product as the result card and the comparison show it: a snapshot of what is known at
 * the moment of the scan, so the comparison works without the dataset loaded and keeps products
 * only Open Food Facts knows.
 */
export interface ScanItem {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  image: string | null;
  nutriscore: NutriGrade | null;
  per100: Per100;
  /** The latest reported price (Open Prices), for the pack or per kg - products of the dataset only. */
  price: { value: number; perKg: boolean } | null;
  /** The app's own dataset, or Open Food Facts asked at the scan. */
  source: 'base' | 'off';
  /** When it was (last) scanned. */
  addedAt: number;
}

export function itemFromProduct(p: Product, dict: Dictionaries, now: number): ScanItem {
  return {
    code: p.code,
    name: p.name,
    brand: brandLine(p, dict) || null,
    quantity: p.quantity,
    image: p.images.front ?? null,
    nutriscore: p.nutriscore ?? null,
    per100: { ...p.nutrition },
    price: p.price ? { value: p.price.value, perKg: p.price.perKg } : null,
    source: 'base',
    addedAt: now,
  };
}

export function itemFromOff(p: OffProduct, now: number): ScanItem {
  return {
    code: p.code,
    name: p.name,
    brand: p.brands,
    quantity: p.quantity,
    image: p.image,
    nutriscore: p.nutriscore,
    per100: p.per100,
    price: null,
    source: 'off',
    addedAt: now,
  };
}

/** One pack as a food for the diary and the favourites; `null` without all four numbers. */
export function scanFood(item: ScanItem): Food | null {
  return packagedFood({ ...item, stores: [] });
}

/** Grams (or ml) in one pack as the label says, multipacks counted whole; `null` when it does not say. */
export function packWeight(quantity: string | null): number | null {
  if (!quantity) return null;
  const t = quantity.toLowerCase().replace(',', '.');
  const multi = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|ml)\b/);
  if (multi) return Number(multi[1]) * Number(multi[2]);
  const single = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (!single) return null;
  const grams = Number(single[1]) * (single[2] === 'kg' || single[2] === 'l' ? 1000 : 1);
  return grams > 0 && grams <= 10_000 ? grams : null;
}

/** What one pack is as a portion: the product's own (`packGrams`, a family pack is no portion). */
export const portionOf = (item: ScanItem): number | null => packGrams(item.quantity);

/** Price per 100 g; `null` without a price or a pack weight to divide it by. */
export function pricePer100(item: ScanItem): number | null {
  if (!item.price) return null;
  if (item.price.perKg) return item.price.value / 10;
  const grams = packWeight(item.quantity);
  return grams ? (item.price.value / grams) * 100 : null;
}

/** Price of 10 g of protein - what protein shopping is about; `null` without a price or protein. */
export function pricePer10gProtein(item: ScanItem): number | null {
  const per100 = pricePer100(item);
  const protein = item.per100.protein;
  return per100 !== null && protein ? (per100 / protein) * 10 : null;
}

/**
 * What decides "better for my goal": protein per 100 kcal for a cut, a balanced or an athletic diet
 * (more of what keeps muscle for the same energy), carbohydrates per 100 kcal for low carb and keto
 * (fewer is better). Both are ratios, the same per 100 g or per pack.
 */
export type GoalMetric = 'protein' | 'carbs';

export function goalMetric(profile: DietProfile): GoalMetric {
  return profile.id === 'lowcarb' || profile.id === 'keto' ? 'carbs' : 'protein';
}

/** Grams of the metric's macro per 100 kcal; `null` when unknown or without energy. */
export function perKcal(item: ScanItem, metric: GoalMetric): number | null {
  const { kcal } = item.per100;
  const grams = metric === 'protein' ? item.per100.protein : item.per100.carbs;
  return kcal && grams !== null ? (grams / kcal) * 100 : null;
}

export interface RankedItem {
  item: ScanItem;
  /** The diet profile's verdict on its proportions; `null` without all four numbers. */
  fit: Fit | null;
  /** The goal metric (`perKcal`). */
  value: number | null;
  winner: boolean;
}

const LEVEL: Record<FitLevel, number> = { great: 3, ok: 2, avoid: 1 };

/**
 * The products best first for the diet profile: its verdict on the proportions first (a product
 * that "does not fit" never wins on one number), then the goal metric, then the lighter one. A
 * product without complete numbers goes last and cannot win; a winner needs someone to beat.
 */
export function rankForGoal(items: ScanItem[], profile: DietProfile): RankedItem[] {
  const metric = goalMetric(profile);
  const ranked = items.map((item) => {
    const { kcal, protein, carbs, fat } = item.per100;
    const fit = kcal === null || protein === null || carbs === null || fat === null ? null : profile.fit({ kcal, protein, carbs, fat });
    return { item, fit, value: perKcal(item, metric), winner: false };
  });
  const level = (r: RankedItem) => (r.fit && r.value !== null ? LEVEL[r.fit.level] : 0);
  ranked.sort(
    (a, b) =>
      level(b) - level(a) ||
      (a.value === null || b.value === null ? 0 : metric === 'protein' ? b.value - a.value : a.value - b.value) ||
      (a.item.per100.kcal ?? Infinity) - (b.item.per100.kcal ?? Infinity) ||
      a.item.name.localeCompare(b.item.name, 'pl'),
  );
  const first = ranked[0];
  if (first && ranked.length > 1 && level(first) > 0) first.winner = true;
  return ranked;
}
