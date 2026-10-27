import { say } from '../../i18n';
import type { CustomFood, Food, FoodSet, FoodSource, MealRole, SetPart } from './foods';
import type { DayRow, Entry, Favorite, PlannedCheat } from './db';
import { goalDirection } from './energy';
import { addDays, mondayOf } from './model';
import type { Plan, PlanItem, PlanVariant } from './plan';
import { DIET_PROFILE_IDS } from './profiles';
import { safePace, setTarget, targetFor, targetOn } from './target';
import {
  MODEL_DEFAULTS,
  type ActivityLevel,
  type CheckFacts,
  type CheckNote,
  type CheckReason,
  type CheckStatus,
  type GoalBy,
  type GoalChange,
  type Hold,
  type LegacyFields,
  type Nutrients,
  type Pause,
  type Profile,
  type Reached,
  type Settle,
  type WeekCheck,
} from './types';
import { upgradeProfile, type BaseKeys, type LegacyRow } from './upgrade';

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
// `|| 0`: clamping −0 keeps −0, which `Object.is` (and so idempotence) tells apart from 0.
const clamp = (n: number, [min, max]: readonly [number, number]): number => Math.min(max, Math.max(min, n)) || 0;
const oneOf = <T extends string | number>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** The profile form's own bounds; the energy model divides by some of these. */
export const PROFILE_RANGES = {
  age: [14, 100],
  heightCm: [120, 230],
  startWeightKg: [30, 350],
  targetWeightKg: [30, 350],
  kcalPerKg: [3000, 9000],
  dailyKcal: [800, 6000],
  /** kg a week, positive when losing. */
  goalPace: [-0.5, 1],
  /** What the Monday check learned, kcal a day. */
  burnOffset: [-1500, 1500],
} as const satisfies Partial<Record<keyof Profile, readonly [number, number]>>;

/**
 * The old model's ranges. Its keys pass through a profile when valid (a code revert reads them as
 * before) and are dropped when not; only the upgrade reads them.
 */
export const LEGACY_RANGES = {
  activityMultiplier: [1, 2.5],
  baseSteps: [0, 30_000],
  targetSteps: [0, 50_000],
  kcalPer1000StepsPerKg: [0, 2],
  extraWeeklyKcal: [0, 20_000],
  kcalCorrection: [-2000, 2000],
} as const satisfies Partial<Record<keyof LegacyFields, readonly [number, number]>>;

/** The stored range of a target (history entries keep what they had inside it). */
const KCAL_RANGE = PROFILE_RANGES.dailyKcal;
const GOALS_KEPT = 200;
const PAUSES_KEPT = 12;
const PAUSE_MAX_DAYS = 28;

const SHARED_NUMBERS = ['age', 'heightCm', 'startWeightKg', 'targetWeightKg', 'kcalPerKg', 'dailyKcal'] as const;
const SHARED_KEYS: readonly BaseKeys[] = [...SHARED_NUMBERS, 'sex', 'startDate', 'dietProfile', 'preferredStore'];
const LEVELS: readonly ActivityLevel[] = ['inactive', 'low', 'active', 'very'];
const GOAL_BY: readonly GoalBy[] = ['setup', 'user', 'check', 'migration', 'break', 'safety'];
const SETTLE_WHY: readonly Settle['why'][] = ['start', 'change', 'pause'];
const STATUSES: readonly CheckStatus[] = [
  'setup',
  'migrated',
  'changed',
  'ask',
  'suggested',
  'reached',
  'same',
  'data',
  'settling',
  'implausible',
  'paused',
  'off',
];
const REASONS: readonly CheckReason[] = ['burn', 'weight', 'floor-up', 'reached'];
const NOTES: readonly CheckNote[] = ['held', 'noisy', 'floor', 'pace', 'quiet'];
const ANSWERS: readonly NonNullable<WeekCheck['answer']>[] = ['ok', 'keep', 'yes', 'no', 'set', 'later', 'continue'];

/** The first pace by the goal's direction (spec §3.1), lowered to what is safe. */
const FIRST_PACE = { loss: 0.5, keep: 0, gain: -0.25 } as const;

/** The check of a new profile: nothing to look at yet, its week is this week. */
const setupCheck = (today: string, kcal: number, goalPace: number): WeekCheck => ({
  week: mondayOf(today),
  status: 'setup',
  from: kcal,
  to: kcal,
  reason: null,
  note: null,
  settle: null,
  facts: null,
  missing: null,
  floor: null,
  offsetAfter: null,
  goalPace,
  answer: null,
});

/**
 * A new profile (version 2) from what is given, the defaults for the rest (spec §3.5). The target
 * is the estimate — `targetFor` at the start weight and the first pace, 2100 for the default man —
 * unless given, and the target history starts with it from `today`. For app code and tests:
 * outside input goes through `cleanProfile`.
 */
export function newProfile(partial: Partial<Profile & LegacyFields>, today: string): Profile & LegacyFields {
  const merged = {
    sex: 'M' as const,
    age: 35,
    heightCm: 175,
    startWeightKg: 80,
    targetWeightKg: 75,
    startDate: today,
    activityLevel: 'inactive' as const,
    ...MODEL_DEFAULTS,
    burnOffset: 0,
    anchored: false,
    autoAdjust: true,
    hideKcal: false,
    pregnancy: false,
    belowFloorOk: false,
    pauses: [],
    hold: null,
    reached: null,
    notice: null,
    dietProfile: 'redukcja' as const,
    preferredStore: null,
    ...partial,
  };
  const goalPace = partial.goalPace ?? safePace(merged, merged.startWeightKg, FIRST_PACE[goalDirection(merged)]);
  const estimate = targetFor({ ...merged, goalPace }, merged.startWeightKg);
  const dailyKcal =
    partial.dailyKcal ?? (partial.goals?.length ? targetOn({ goals: partial.goals, dailyKcal: estimate }, today) : estimate);
  // Every read of the profile comes through here: a malformed start date must not throw in `addDays`.
  const start = isCalendarDate(merged.startDate) ? merged.startDate : today;
  return {
    ...merged,
    version: 2,
    goalPace,
    dailyKcal,
    goals: partial.goals ?? [{ from: today, kcal: dailyKcal, by: 'setup' }],
    settle: partial.settle ?? { from: addDays(start, 14), why: 'start' },
    lastCheck: partial.lastCheck !== undefined ? partial.lastCheck : setupCheck(today, dailyKcal, goalPace),
  };
}

/** The fields both models share, each only when valid; numbers clamped to the form's bounds. */
function sharedFields(raw: Record<string, unknown>): Partial<Pick<Profile, BaseKeys>> {
  const out: Partial<Pick<Profile, BaseKeys>> = {};
  for (const key of SHARED_NUMBERS) {
    const value = raw[key];
    if (finite(value)) out[key] = clamp(value, PROFILE_RANGES[key]);
  }
  if (raw.sex === 'M' || raw.sex === 'K') out.sex = raw.sex;
  if (isCalendarDate(raw.startDate)) out.startDate = raw.startDate;
  if (oneOf(DIET_PROFILE_IDS, raw.dietProfile)) out.dietProfile = raw.dietProfile;
  if (raw.preferredStore === null || typeof raw.preferredStore === 'string') out.preferredStore = raw.preferredStore;
  return out;
}

/** The old model's keys that are valid, clamped to their old ranges; the rest dropped. */
function legacyFields(raw: Record<string, unknown>): LegacyFields {
  const out: LegacyFields = {};
  for (const [key, range] of Object.entries(LEGACY_RANGES) as [keyof typeof LEGACY_RANGES, readonly [number, number]][]) {
    const value = raw[key];
    if (finite(value)) out[key] = clamp(value, range);
  }
  if (typeof raw.adaptWeekly === 'boolean') out.adaptWeekly = raw.adaptWeekly;
  if (typeof raw.adaptActivity === 'boolean') out.adaptActivity = raw.adaptActivity;
  if (isCalendarDate(raw.goalSince)) out.goalSince = raw.goalSince;
  return out;
}

function cleanGoal(raw: unknown): GoalChange | null {
  if (!isObject(raw) || !isCalendarDate(raw.from) || !finite(raw.kcal) || !oneOf(GOAL_BY, raw.by)) return null;
  return { from: raw.from, kcal: clamp(raw.kcal, KCAL_RANGE), by: raw.by };
}

/** The target history: valid entries, one a day (the last given wins), oldest first, the newest 200. */
function cleanGoals(raw: unknown): GoalChange[] {
  const byDay = new Map<string, GoalChange>();
  for (const g of Array.isArray(raw) ? raw.map(cleanGoal) : []) if (g) byDay.set(g.from, g);
  return [...byDay.values()].sort((a, b) => (a.from < b.from ? -1 : 1)).slice(-GOALS_KEPT);
}

/** A break, at most 28 days long. */
function cleanPause(raw: unknown): Pause | null {
  if (!isObject(raw) || !isCalendarDate(raw.from) || !isCalendarDate(raw.to) || raw.to < raw.from || !finite(raw.kcal))
    return null;
  const last = addDays(raw.from, PAUSE_MAX_DAYS - 1);
  return { from: raw.from, to: raw.to < last ? raw.to : last, kcal: clamp(raw.kcal, KCAL_RANGE) };
}

/** Breaks oldest first, the last 12. */
function cleanPauses(raw: unknown): Pause[] {
  const pauses = (Array.isArray(raw) ? raw.map(cleanPause) : []).filter((x): x is Pause => x !== null);
  return pauses.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)).slice(-PAUSES_KEPT);
}

function cleanHold(raw: unknown): Hold | null {
  return isObject(raw) && oneOf([-1, 0, 1] as const, raw.dir) && isCalendarDate(raw.until)
    ? { dir: raw.dir, until: raw.until }
    : null;
}

function cleanSettle(raw: unknown): Settle | null {
  return isObject(raw) && isCalendarDate(raw.from) && oneOf(SETTLE_WHY, raw.why) ? { from: raw.from, why: raw.why } : null;
}

function cleanReached(raw: unknown): Reached | null {
  if (
    !isObject(raw) ||
    !isCalendarDate(raw.at) ||
    !finite(raw.kg) ||
    raw.kg <= 0 ||
    !finite(raw.prevPace) ||
    !finite(raw.prevKcal) ||
    !(raw.askAgain === null || isCalendarDate(raw.askAgain))
  )
    return null;
  return {
    at: raw.at,
    kg: raw.kg,
    prevPace: clamp(raw.prevPace, PROFILE_RANGES.goalPace),
    prevKcal: clamp(raw.prevKcal, KCAL_RANGE),
    askAgain: raw.askAgain,
  };
}

const FACT_NUMBERS = [
  'weeks',
  'weighIns',
  'completeDays',
  'spanDays',
  'pace',
  'paceSe',
  'intake',
  'burn',
  'burnSe',
  'before',
  'after',
  'trendKg',
] as const satisfies readonly (keyof CheckFacts)[];

/** What a check saw: every field readable, or `undefined` (unreadable). */
function cleanFacts(raw: unknown): CheckFacts | null | undefined {
  if (raw === null) return null;
  if (!isObject(raw) || !isCalendarDate(raw.from) || !isCalendarDate(raw.to)) return undefined;
  const facts: Partial<CheckFacts> = { from: raw.from, to: raw.to };
  for (const key of FACT_NUMBERS) {
    const value = raw[key];
    if (!finite(value)) return undefined;
    facts[key] = value;
  }
  return facts as CheckFacts;
}

function cleanMissing(raw: unknown): WeekCheck['missing'] | undefined {
  if (raw === null) return null;
  return isObject(raw) && finite(raw.weighIns) && finite(raw.completeDays)
    ? { weighIns: raw.weighIns, completeDays: raw.completeDays }
    : undefined;
}

const nullOr = <T extends string>(list: readonly T[], v: unknown): v is T | null => v === null || oneOf(list, v);
const nullOrNumber = (v: unknown): v is number | null => v === null || finite(v);

/** The last Monday check, checked field by field: one unreadable field and there is none. */
function cleanCheck(raw: unknown): WeekCheck | null {
  if (!isObject(raw)) return null;
  const facts = cleanFacts(raw.facts);
  const missing = cleanMissing(raw.missing);
  if (
    !isCalendarDate(raw.week) ||
    !oneOf(STATUSES, raw.status) ||
    !finite(raw.from) ||
    !finite(raw.to) ||
    !nullOr(REASONS, raw.reason) ||
    !nullOr(NOTES, raw.note) ||
    !nullOr(SETTLE_WHY, raw.settle) ||
    facts === undefined ||
    missing === undefined ||
    !nullOrNumber(raw.floor) ||
    !nullOrNumber(raw.offsetAfter) ||
    !finite(raw.goalPace) ||
    !nullOr(ANSWERS, raw.answer)
  )
    return null;
  return {
    week: raw.week,
    status: raw.status,
    from: raw.from,
    to: raw.to,
    reason: raw.reason,
    note: raw.note,
    settle: raw.settle,
    facts,
    missing,
    floor: raw.floor,
    offsetAfter: raw.offsetAfter,
    goalPace: raw.goalPace,
    answer: raw.answer,
  };
}

/** The version-2 fields that are valid (the others take the defaults). */
function v2Fields(raw: Record<string, unknown>): Partial<Profile> {
  const out: Partial<Profile> = {};
  if (oneOf(LEVELS, raw.activityLevel)) out.activityLevel = raw.activityLevel;
  if (finite(raw.goalPace)) out.goalPace = clamp(raw.goalPace, PROFILE_RANGES.goalPace);
  if (finite(raw.burnOffset)) out.burnOffset = clamp(raw.burnOffset, PROFILE_RANGES.burnOffset);
  for (const key of ['anchored', 'autoAdjust', 'hideKcal', 'pregnancy', 'belowFloorOk'] as const) {
    const value = raw[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  out.pauses = cleanPauses(raw.pauses);
  out.hold = cleanHold(raw.hold);
  const settle = cleanSettle(raw.settle);
  if (settle) out.settle = settle;
  out.reached = cleanReached(raw.reached);
  if (raw.notice === 'show' || raw.notice === 'seen' || raw.notice === null) out.notice = raw.notice;
  return out;
}

/**
 * What every profile gets last: a target an old tab changed kept as the person's (pre-upgrade code
 * writes `dailyKcal` together with `goalSince`); `dailyKcal` as the mirror of today's target, which
 * also moves it across the end of a break without a write; no pace under 18 or in pregnancy.
 */
function inStep(p: Profile & LegacyFields, today: string): Profile & LegacyFields {
  let next = p;
  const since = next.goalSince;
  const newest = next.goals.at(-1)?.from;
  // `≥`, not `>`: an old tab that changes the target twice on one day writes the same `goalSince`.
  if (since && newest && since >= newest && since <= today && next.dailyKcal !== targetOn(next, since))
    next = setTarget(next, next.dailyKcal, since, 'user', today);
  next = { ...next, dailyKcal: targetOn(next, today) };
  if ((next.age < 18 || next.pregnancy) && next.goalPace !== 0) next = { ...next, goalPace: 0 };
  return next;
}

export interface CleanContext {
  /** Today, YYYY-MM-DD: the day `dailyKcal` mirrors. */
  today: string;
  /** The weight the upgrade reads the old burn at (the latest gym weigh-in); without it the start weight. */
  weightKg?: number;
  /** A workbook import of a new profile: an old-format profile is a setup, not an upgrade. */
  fresh?: boolean;
}

/**
 * The one way a profile enters the app (spec §3.3): the stored row on every read (`useProfile`), a
 * backup (`restoreAll`), a workbook (`importWorkbook`). A row without `version: 2` is upgraded
 * (`upgradeProfile`, §3.4); a version-2 row gets its fields checked — each kept when valid, clamped
 * when out of range, the default otherwise; the target history sorted, one entry a day, never
 * re-clamped inside the stored range. The old model's keys pass through when valid; keys nobody
 * knows are dropped. Idempotent: `cleanProfile(cleanProfile(x)) ≡ cleanProfile(x)`.
 */
export function cleanProfile(input: unknown, ctx: CleanContext): Profile & LegacyFields {
  const raw = isObject(input) ? input : {};
  const shared = sharedFields(raw);
  const legacy = legacyFields(raw);
  if (raw.version !== 2) {
    const base = newProfile(shared, ctx.today);
    const row = Object.fromEntries(SHARED_KEYS.map((key) => [key, base[key]])) as Pick<Profile, BaseKeys>;
    const upgraded = upgradeProfile({ ...row, ...legacy } satisfies LegacyRow, ctx);
    return inStep(upgraded, ctx.today);
  }
  const goals = cleanGoals(raw.goals);
  // With a history and an unreadable `dailyKcal`, the mirror comes from the history, not the estimate.
  const fields = { ...shared, ...legacy, ...v2Fields(raw), ...(goals.length ? { goals } : {}), lastCheck: null };
  const base = newProfile(fields, ctx.today);
  return inStep(
    {
      ...base,
      goals: goals.length ? goals : [{ from: base.startDate, kcal: base.dailyKcal, by: 'setup' }],
      lastCheck: cleanCheck(raw.lastCheck),
    },
    ctx.today,
  );
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
      (['product', 'recipe', 'plan', 'custom', 'set', 'restaurant', 'dish', 'quick'] as const).find((s) => s === raw.source) ??
      'quick',
    ...(typeof raw.key === 'string' && { key: raw.key }),
    ...(finite(raw.planIndex) && { planIndex: raw.planIndex }),
  };
}

/**
 * A day row from a backup: what the app wrote comes back as it was — a key the row did not have is
 * not added (a weight or steps that cannot be read become `null`), the person's word on the day's
 * log (`partial`) included.
 */
export function cleanDay(raw: unknown): DayRow | null {
  if (!isObject(raw) || !isCalendarDate(raw.date)) return null;
  const choices = isObject(raw.choices) ? raw.choices : null;
  const cheat = cleanCheat(raw.cheat);
  return {
    date: raw.date,
    ...('weightKg' in raw && { weightKg: finite(raw.weightKg) && raw.weightKg > 0 ? raw.weightKg : null }),
    ...('steps' in raw && { steps: finite(raw.steps) && raw.steps >= 0 ? raw.steps : null }),
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
    ...(typeof raw.partial === 'boolean' && { partial: raw.partial }),
    ...(isObject(raw.labHabits) && { labHabits: cleanHabits(raw.labHabits) }),
  };
}

/** Habit ticks of a day: small whole counts under short keys. */
function cleanHabits(raw: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(raw).flatMap(([k, v]) => (k.length <= 40 && finite(v) && Number.isInteger(v) && v > 0 && v <= 20 ? [[k, v]] : [])),
  );
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

const SOURCES: FoodSource[] = ['product', 'recipe', 'plan', 'custom', 'set', 'restaurant', 'dish'];
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
