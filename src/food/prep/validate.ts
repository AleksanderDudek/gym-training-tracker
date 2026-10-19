import { isCalendarDate } from '../diet/validate';
import type { MacroTargets } from '../diet/profiles';
import { DIET_PROFILE_IDS } from '../diet/profiles';
import type { DietProfileId } from '../diet/types';
import type { Macros } from '../recipes/macros';
import type { CheckIn, CheckInStatus } from './checkin';
import { MAX_DAYS, MIN_DAYS } from './types';
import type {
  Aisle,
  BoxRole,
  Choices,
  Exclusion,
  PrepBatch,
  PrepMeal,
  PrepPlan,
  PrepSettings,
  PrepShop,
  PrepSide,
  Role,
  ShoppingItem,
  ShoppingProduct,
  Slot,
  SlotKind,
} from './types';

/**
 * A plan from a backup file is outside input: one hand-edited field would sit in IndexedDB and
 * break the plan page and the shopping list after the restore has already replaced the good data.
 * A plan is kept whole or not at all - half a shopping list buys half a week.
 */

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string';
const orNull = <T>(v: unknown, ok: (x: unknown) => x is T): T | null => (ok(v) ? v : null);

const ROLES: readonly Role[] = ['breakfast', 'snack', 'lunch', 'dinner', 'lunchBox', 'dinnerBox'];
const BOX: readonly BoxRole[] = ['lunchBox', 'dinnerBox'];
const KINDS: readonly SlotKind[] = ['breakfast', 'snack', 'lunch', 'dinner'];
const EXCLUSIONS: readonly Exclusion[] = ['meat', 'fish', 'eggs'];
const AISLES: readonly Aisle[] = ['warzywa', 'pieczywo', 'nabial', 'mieso', 'mrozonki', 'suche', 'inne'];
const STATUSES: readonly CheckInStatus[] = ['za-malo-danych', 'zgodnie', 'korekta', 'cel'];
const one = <T extends string>(list: readonly T[], v: unknown): T | null => list.find((x) => x === v) ?? null;

/** Every element cleaned, or null when any one fails. */
function all<T>(v: unknown, clean: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(clean);
  return out.every((x) => x !== null) ? (out as T[]) : null;
}

function macros(v: unknown): Macros | null {
  if (!isObject(v) || ![v.kcal, v.protein, v.carbs, v.fat].every(finite)) return null;
  return { kcal: v.kcal as number, protein: v.protein as number, carbs: v.carbs as number, fat: v.fat as number };
}

function targets(v: unknown): MacroTargets | null {
  if (!isObject(v) || !finite(v.kcal) || !isObject(v.protein) || !isObject(v.carbs) || !isObject(v.fat)) return null;
  const { protein, carbs, fat } = v;
  if (![protein.target, protein.min, carbs.target, fat.target, fat.min].every(finite)) return null;
  const limit = (x: unknown) => (x === null ? null : finite(x) ? x : undefined);
  const carbsMax = limit(carbs.max);
  const fatMax = limit(fat.max);
  if (carbsMax === undefined || fatMax === undefined) return null;
  return {
    kcal: v.kcal,
    protein: { target: protein.target as number, min: protein.min as number },
    carbs: { target: carbs.target as number, max: carbsMax },
    fat: { target: fat.target as number, min: fat.min as number, max: fatMax },
  };
}

function settings(v: unknown): PrepSettings | null {
  if (!isObject(v) || !isCalendarDate(v.start) || !finite(v.days) || !Number.isInteger(v.days)) return null;
  if (v.days < MIN_DAYS || v.days > MAX_DAYS) return null;
  const meals = v.meals === 3 || v.meals === 4 || v.meals === 5 ? v.meals : null;
  const cooking = v.cooking === 'lunch' || v.cooking === 'both' ? v.cooking : null;
  if (!meals || !cooking || !text(v.store) || !(v.online === null || text(v.online)) || !finite(v.seed)) return null;
  const exclude = all(v.exclude, (x) => one(EXCLUSIONS, x));
  const avoid = Array.isArray(v.avoid) ? v.avoid.filter(text) : [];
  if (!exclude) return null;
  return { start: v.start, days: v.days, meals, cooking, store: v.store, online: v.online, exclude, seed: v.seed, avoid };
}

function shop(v: unknown): PrepShop | null {
  if (!isObject(v) || !text(v.key) || !text(v.name) || typeof v.online !== 'boolean') return null;
  return { key: v.key, name: v.name, online: v.online, url: orNull(v.url, text) };
}

function checkIn(v: unknown): CheckIn | null {
  if (!isObject(v)) return null;
  const status = one(STATUSES, v.status);
  if (!status || !text(v.reason) || !isCalendarDate(v.today) || ![v.profileKcal, v.suggestedKcal, v.plannedPace, v.modelTdee].every(finite))
    return null;
  const count = (x: unknown) => (finite(x) ? x : 0);
  return {
    status,
    today: v.today,
    weighIns: count(v.weighIns),
    loggedDays: count(v.loggedDays),
    spanDays: count(v.spanDays),
    trendKg: orNull(v.trendKg, finite),
    observedPace: orNull(v.observedPace, finite),
    plannedPace: v.plannedPace as number,
    observedTdee: orNull(v.observedTdee, finite),
    modelTdee: v.modelTdee as number,
    profileKcal: v.profileKcal as number,
    suggestedKcal: v.suggestedKcal as number,
    limited: v.limited === 'floor' || v.limited === 'cap' ? v.limited : null,
    reason: v.reason,
  };
}

function slot(v: unknown): Slot | null {
  const kind = isObject(v) ? one(KINDS, v.kind) : null;
  return isObject(v) && kind && text(v.name) && finite(v.share) ? { name: v.name, kind, share: v.share } : null;
}

function side(v: unknown): PrepSide | null {
  if (!isObject(v) || !text(v.ingredient) || !text(v.label) || !finite(v.grams) || !text(v.amount)) return null;
  const nutrients = macros(v.nutrients);
  return nutrients ? { ingredient: v.ingredient, label: v.label, grams: v.grams, amount: v.amount, nutrients } : null;
}

function meal(v: unknown): PrepMeal | null {
  if (!isObject(v) || !isCalendarDate(v.date) || !finite(v.slot) || !text(v.slotName) || !text(v.recipeId) || !text(v.name))
    return null;
  const role = one(ROLES, v.role);
  const sides = all(v.sides, side);
  const recipe = macros(v.recipe);
  const total = macros(v.total);
  if (!role || !sides || !recipe || !total || !finite(v.portion) || v.portion <= 0) return null;
  if (!(v.box === null || (finite(v.box) && Number.isInteger(v.box) && v.box >= 0))) return null;
  return {
    date: v.date,
    slot: v.slot,
    slotName: v.slotName,
    role,
    recipeId: v.recipeId,
    name: v.name,
    portion: v.portion,
    box: v.box,
    sides,
    recipe,
    total,
  };
}

function batch(v: unknown): PrepBatch | null {
  if (!isObject(v) || !isCalendarDate(v.date) || !text(v.recipeId) || !text(v.name)) return null;
  const role = one(BOX, v.role);
  const boxes = all(v.boxes, (b) => (isObject(b) && isCalendarDate(b.date) && text(b.slotName) ? { date: b.date, slotName: b.slotName } : null));
  const sides = all(v.sides, side);
  const ingredients = all(v.ingredients, (i) => (isObject(i) && text(i.label) && finite(i.grams) ? { label: i.label, grams: i.grams } : null));
  if (!role || !boxes || !sides || !ingredients || ![v.servings, v.factor, v.portion].every(finite)) return null;
  return {
    date: v.date,
    role,
    recipeId: v.recipeId,
    name: v.name,
    servings: v.servings as number,
    factor: v.factor as number,
    portion: v.portion as number,
    boxes,
    sides,
    ingredients,
  };
}

function product(v: unknown): ShoppingProduct | null {
  if (!isObject(v) || !text(v.code) || !text(v.name)) return null;
  return { code: v.code, name: v.name, brand: orNull(v.brand, text), quantity: orNull(v.quantity, text), url: orNull(v.url, text) };
}

function item(v: unknown): ShoppingItem | null {
  if (!isObject(v) || !text(v.key) || !text(v.ingredient) || !text(v.label) || !finite(v.grams)) return null;
  const role = v.role === 'store' || v.role === 'staple' || v.role === 'pantry' ? v.role : null;
  const group = v.group === 'visit' || v.group === 'order' || v.group === 'home' ? v.group : null;
  const aisle = one(AISLES, v.aisle);
  const freeze = all(v.freeze, (f) => (isObject(f) && isCalendarDate(f.date) && finite(f.grams) ? { date: f.date, grams: f.grams } : null));
  if (!role || !group || !aisle || !freeze || !(v.shop === null || text(v.shop))) return null;
  if (!(v.product === null || product(v.product))) return null;
  return {
    key: v.key,
    ingredient: v.ingredient,
    label: v.label,
    role,
    shop: v.shop,
    group,
    aisle,
    grams: v.grams,
    product: v.product === null ? null : product(v.product),
    packs: orNull(v.packs, finite),
    packGrams: orNull(v.packGrams, finite),
    pieces: orNull(v.pieces, finite),
    price: orNull(v.price, finite),
    freeze,
  };
}

function choices(v: unknown): Choices | null {
  if (!isObject(v)) return null;
  const out: Choices = {};
  for (const [key, ids] of Object.entries(v)) {
    const role = one(ROLES, key);
    if (!role || !Array.isArray(ids) || !ids.every(text)) return null;
    out[role] = ids;
  }
  return out;
}

/** A meal-prep plan from anything, or null: every part must be readable, and the parts must agree. */
export function cleanPrepPlan(raw: unknown): PrepPlan | null {
  if (!isObject(raw) || !text(raw.createdAt)) return null;
  const s = settings(raw.settings);
  const shops = all(raw.shops, shop);
  const g = raw.goal;
  const dietProfile = isObject(g) ? (DIET_PROFILE_IDS as string[]).find((id) => id === g.dietProfile) : undefined;
  const dayTargets = all(raw.dayTargets, (d) => {
    const t = isObject(d) && isCalendarDate(d.date) ? targets(d.targets) : null;
    return t && isObject(d) ? { date: d.date as string, targets: t } : null;
  });
  const slots = all(raw.slots, slot);
  const c = choices(raw.choices);
  const meals = all(raw.meals, meal);
  const batches = all(raw.batches, batch);
  const shopping = all(raw.shopping, item);
  if (!s || !shops?.length || !isObject(g) || !dietProfile || !dayTargets || !slots?.length || !c || !meals || !batches || !shopping)
    return null;
  if (![g.kcal, g.pace, g.weightKg].every(finite) || !text(g.styleLabel) || (g.source !== 'profile' && g.source !== 'checkin'))
    return null;
  // The parts must agree: a meal's box exists, its slot exists, every day has its targets.
  if (meals.some((m) => (m.box !== null && m.box >= batches.length) || m.slot >= slots.length)) return null;
  if (dayTargets.length !== s.days) return null;
  return {
    ...(finite(raw.id) && { id: raw.id }),
    createdAt: raw.createdAt,
    settings: s,
    shops,
    goal: {
      kcal: g.kcal as number,
      source: g.source,
      dietProfile: dietProfile as DietProfileId,
      styleLabel: g.styleLabel,
      pace: g.pace as number,
      weightKg: g.weightKg as number,
    },
    checkIn: raw.checkIn === null || raw.checkIn === undefined ? null : checkIn(raw.checkIn),
    dayTargets,
    slots,
    choices: c,
    meals,
    batches,
    shopping,
    bought: Array.isArray(raw.bought) ? raw.bought.filter(text) : [],
  };
}
