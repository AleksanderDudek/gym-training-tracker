import { say } from '../../i18n';
import type { CustomFood, Food, FoodSet, FoodSource, MealRole, SetPart } from './foods';
import type { DayRow, Entry, Favorite, PlannedCheat } from './db';
import type { Plan, PlanItem, PlanVariant } from './plan';
import { DIET_PROFILE_IDS } from './profiles';
import type { Nutrients, Profile } from './types';

/**
 * What may be stored, whoever wrote it. A backup file and a workbook are
 * outside input: one hand-edited number ("kcal": "650", "kcalPerKg": 0)
 * would otherwise sit in IndexedDB and break every render after it - and a
 * restore has already replaced the good data by then. Bad numbers fall back
 * to the defaults, out-of-range ones are clamped to what the profile form
 * accepts, and rows that cannot be read are dropped.
 */

/** A real calendar date: 2026-02-30 matches the pattern and is not one. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const orNull = (v: unknown): number | null => (finite(v) ? v : null);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The profile form's own bounds; the energy model divides by some of these. */
export const PROFILE_RANGES = {
  age: [14, 100],
  heightCm: [120, 230],
  startWeightKg: [30, 350],
  targetWeightKg: [30, 350],
  activityMultiplier: [1, 2.5],
  baseSteps: [0, 30_000],
  targetSteps: [0, 50_000],
  kcalPer1000StepsPerKg: [0, 2],
  extraWeeklyKcal: [0, 20_000],
  kcalPerKg: [3000, 9000],
  dailyKcal: [800, 6000],
  kcalCorrection: [-2000, 2000],
} as const satisfies Partial<Record<keyof Profile, readonly [number, number]>>;

/** A profile from anything: each field kept when it is valid, clamped when out of range, the default otherwise. */
export function cleanProfile(input: unknown, defaults: Profile): Profile {
  const raw = isObject(input) ? input : {};
  const profile: Profile = { ...defaults };
  for (const [key, [min, max]] of Object.entries(PROFILE_RANGES) as [
    keyof typeof PROFILE_RANGES,
    readonly [number, number],
  ][]) {
    const value = raw[key];
    if (finite(value)) profile[key] = Math.min(max, Math.max(min, value));
  }
  if (raw.sex === 'M' || raw.sex === 'K') profile.sex = raw.sex;
  if (isCalendarDate(raw.startDate)) profile.startDate = raw.startDate;
  if (typeof raw.dietProfile === 'string' && (DIET_PROFILE_IDS as string[]).includes(raw.dietProfile))
    profile.dietProfile = raw.dietProfile as Profile['dietProfile'];
  if (typeof raw.adaptWeekly === 'boolean') profile.adaptWeekly = raw.adaptWeekly;
  if (typeof raw.adaptActivity === 'boolean') profile.adaptActivity = raw.adaptActivity;
  if (raw.preferredStore === null || typeof raw.preferredStore === 'string')
    profile.preferredStore = raw.preferredStore;
  if (isCalendarDate(raw.goalSince)) profile.goalSince = raw.goalSince;
  return profile;
}

function cleanNutrients(raw: Record<string, unknown>): Nutrients | null {
  if (!finite(raw.kcal) || raw.kcal < 0) return null;
  return { kcal: raw.kcal, protein: orNull(raw.protein), carbs: orNull(raw.carbs), fat: orNull(raw.fat) };
}

export function cleanEntry(raw: unknown): Entry | null {
  if (!isObject(raw) || !isCalendarDate(raw.date) || typeof raw.name !== 'string') return null;
  const n = cleanNutrients(raw);
  if (!n) return null;
  return {
    ...(finite(raw.id) && { id: raw.id }),
    date: raw.date,
    time: typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : '12:00',
    name: raw.name,
    amountLabel: typeof raw.amountLabel === 'string' ? raw.amountLabel : '',
    ...n,
    source:
      (['product', 'recipe', 'plan', 'custom', 'set', 'restaurant', 'quick'] as const).find((s) => s === raw.source) ??
      'quick',
    ...(typeof raw.key === 'string' && { key: raw.key }),
    ...(finite(raw.planIndex) && { planIndex: raw.planIndex }),
  };
}

export function cleanDay(raw: unknown): DayRow | null {
  if (!isObject(raw) || !isCalendarDate(raw.date)) return null;
  const choices = isObject(raw.choices) ? raw.choices : null;
  const cheat = cleanCheat(raw.cheat);
  return {
    date: raw.date,
    weightKg: finite(raw.weightKg) && raw.weightKg > 0 ? raw.weightKg : null,
    steps: finite(raw.steps) && raw.steps >= 0 ? raw.steps : null,
    ...(typeof raw.training === 'boolean' && { training: raw.training }),
    ...(choices && {
      choices: {
        ...(finite(choices.variant) && { variant: choices.variant }),
        ...(isObject(choices.swaps) && {
          swaps: Object.fromEntries(
            Object.entries(choices.swaps).flatMap(([k, v]) => (cleanItem(v) ? [[k, cleanItem(v)!]] : [])),
          ),
        }),
        ...(Array.isArray(choices.skipped) && { skipped: choices.skipped.filter(finite) }),
      },
    }),
    ...(finite(raw.autoSeed) && { autoSeed: raw.autoSeed }),
    ...(typeof raw.note === 'string' && { note: raw.note }),
    ...(cheat && { cheat }),
  };
}

/** A planned cheat meal from a backup: a name and calories, macros when they are numbers. */
function cleanCheat(raw: unknown): PlannedCheat | null {
  if (!isObject(raw)) return null;
  const n = cleanNutrients(raw);
  if (!n || n.kcal <= 0) return null;
  const items = Array.isArray(raw.items)
    ? raw.items.filter((i): i is string => typeof i === 'string').slice(0, 12).map((i) => i.slice(0, 80))
    : [];
  return { name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '', ...n, ...(items.length && { items }) };
}

function cleanItem(raw: unknown): PlanItem | null {
  if (!isObject(raw) || typeof raw.text !== 'string') return null;
  const n = cleanNutrients(raw);
  return n
    ? {
        text: raw.text,
        ...n,
        stores: Array.isArray(raw.stores) ? raw.stores.filter((s): s is string => typeof s === 'string') : [],
      }
    : null;
}

function cleanVariant(raw: unknown): PlanVariant | null {
  if (!isObject(raw) || !finite(raw.index) || !Array.isArray(raw.items) || !isObject(raw.totals)) return null;
  const items = raw.items.map(cleanItem);
  const totals = cleanNutrients(raw.totals);
  return items.every(Boolean) && totals ? { index: raw.index, items: items as PlanItem[], totals } : null;
}

/** A plan is kept whole or not at all: half a plan would show days with lines missing. */
export function cleanPlan(raw: unknown): Plan | null {
  if (
    !isObject(raw) ||
    typeof raw.id !== 'string' ||
    !isCalendarDate(raw.startDate) ||
    !Array.isArray(raw.days) ||
    !isObject(raw.templates)
  )
    return null;
  if (!raw.days.every((d) => typeof d === 'string')) return null;
  const templates: Plan['templates'] = {};
  for (const [key, variants] of Object.entries(raw.templates)) {
    if (!Array.isArray(variants)) return null;
    const clean = variants.map(cleanVariant);
    if (!clean.every(Boolean)) return null;
    templates[key] = clean as PlanVariant[];
  }
  const foods = Array.isArray(raw.foods) ? raw.foods.map(cleanItem) : [];
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Plan',
    startDate: raw.startDate,
    days: raw.days as string[],
    templates,
    foods: foods.filter((f): f is PlanItem => f !== null),
    notes: Array.isArray(raw.notes) ? raw.notes.filter((n): n is string => typeof n === 'string') : [],
  };
}

export function cleanCustomFood(raw: unknown): (CustomFood & { id?: number }) | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  const n = cleanNutrients(raw);
  if (!n) return null;
  return {
    ...(finite(raw.id) && { id: raw.id }),
    name: raw.name,
    amountLabel: typeof raw.amountLabel === 'string' ? raw.amountLabel : say('1 porcja', '1 serving'),
    ...n,
  };
}

function cleanPart(raw: unknown): SetPart | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  const n = cleanNutrients(raw);
  if (!n) return null;
  return {
    name: raw.name,
    amountLabel: typeof raw.amountLabel === 'string' ? raw.amountLabel : '',
    ...n,
    ...(typeof raw.key === 'string' && { key: raw.key }),
  };
}

/** A set is kept whole or not at all: a set missing a part would log a different meal. */
export function cleanSet(raw: unknown): FoodSet | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || !raw.name.trim() || !Array.isArray(raw.parts)) return null;
  const parts = raw.parts.map(cleanPart);
  if (!parts.length || !parts.every(Boolean)) return null;
  return { ...(finite(raw.id) && { id: raw.id }), name: raw.name, parts: parts as SetPart[] };
}

const SOURCES: FoodSource[] = ['product', 'recipe', 'plan', 'custom', 'set', 'restaurant'];
const ROLES: MealRole[] = ['main', 'light', 'addon'];

/** A food snapshot from a backup: the fields the app reads, each of the right kind, or nothing. */
function cleanFood(raw: unknown): Food | null {
  if (!isObject(raw) || typeof raw.key !== 'string' || !raw.key || typeof raw.name !== 'string' || !raw.name.trim())
    return null;
  const nutrients = isObject(raw.nutrients) ? cleanNutrients(raw.nutrients) : null;
  const source = SOURCES.find((s) => s === raw.source);
  const role = ROLES.find((r) => r === raw.role);
  if (!nutrients || !source || !role) return null;
  const p = isObject(raw.per100) ? raw.per100 : null;
  const per100 =
    p && [p.kcal, p.protein, p.carbs, p.fat].every(finite)
      ? { kcal: p.kcal as number, protein: p.protein as number, carbs: p.carbs as number, fat: p.fat as number }
      : null;
  return {
    key: raw.key,
    name: raw.name,
    detail: typeof raw.detail === 'string' ? raw.detail : '',
    source,
    amountLabel: typeof raw.amountLabel === 'string' ? raw.amountLabel : '',
    nutrients,
    per100,
    grams: per100 && finite(raw.grams) && raw.grams > 0 ? raw.grams : null,
    stores: Array.isArray(raw.stores) ? raw.stores.filter((s): s is string => typeof s === 'string') : [],
    atHome: raw.atHome === true,
    ...(raw.everywhere === true && { everywhere: true }),
    role,
  };
}

/** A favourite from a backup: its key must be its food's key. */
export function cleanFavorite(raw: unknown): Favorite | null {
  if (!isObject(raw)) return null;
  const food = cleanFood(raw.food);
  if (!food || raw.key !== food.key) return null;
  return {
    key: food.key,
    food,
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date(0).toISOString(),
    uses: finite(raw.uses) && raw.uses >= 0 ? Math.floor(raw.uses) : 0,
    lastUsed: typeof raw.lastUsed === 'string' ? raw.lastUsed : null,
  };
}

/** Keeps the rows that can be read; reports how many could not. */
export function cleanRows<T>(rows: unknown, clean: (raw: unknown) => T | null): { rows: T[]; dropped: number } {
  const list = Array.isArray(rows) ? rows : [];
  const kept = list.map(clean).filter((r): r is T => r !== null);
  return { rows: kept, dropped: list.length - kept.length };
}
