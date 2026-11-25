import type { PlanTemplate, Workout, WorkoutKind } from '../../../src/types';
import type { Area } from './areas';
import { isArea } from './areas';
import type { Profession } from './invite';

/**
 * Zalecenia od prowadzącego, wersja 1 — i potwierdzenia od podopiecznego.
 *
 * Plan i trening jadą w kształcie GYM TRACKERa (`PlanTemplate`, `Workout`): po stronie
 * podopiecznego to po prostu plan i trening własny z dopiskiem, od kogo, a progresja,
 * kalendarz i odznaki działają jak dla każdego innego.
 *
 * **Dla telefonu to dane z zewnątrz.** `parseAssignment` przepuszcza tylko znane rodzaje, przycina
 * teksty i odrzuca zepsute struktury; to, czy ćwiczenie istnieje w atlasie, sprawdza już aplikacja.
 */

export const ASSIGNMENT_KINDS = ['plan', 'workout', 'targets', 'labs', 'note', 'form', 'habits', 'meals'] as const;
export type AssignmentKind = (typeof ASSIGNMENT_KINDS)[number];

export const isAssignmentKind = (v: unknown): v is AssignmentKind =>
  typeof v === 'string' && (ASSIGNMENT_KINDS as readonly string[]).includes(v);

/**
 * Co który obszar może wysłać. Wgląd nie układa planów — zleca badania, pyta formularzem i pisze
 * zalecenia. Formularz i nawyki ma każdy, kto prowadzi: wywiad, check-in, skala bólu, sen, suplementy.
 */
export const KINDS_BY_AREA: Record<Area, readonly AssignmentKind[]> = {
  training: ['plan', 'workout', 'targets', 'note', 'form', 'habits'],
  nutrition: ['targets', 'labs', 'note', 'meals', 'form', 'habits'],
  rehab: ['plan', 'workout', 'note', 'form', 'habits'],
  insight: ['labs', 'note', 'form'],
};

/** Własne wideo prowadzącego do ćwiczeń: id ćwiczenia → adres. */
export type CoachVideos = Record<string, string>;

/* ── Formularz ─────────────────────────────────────────────────────────────────────── */

export const QUESTION_TYPES = ['text', 'number', 'scale', 'choice', 'multi', 'yesno'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface FormQuestion {
  /** Krótki znak pytania (`q1`…): odpowiedź trzyma go zamiast treści. */
  id: string;
  type: QuestionType;
  label: string;
  help: string;
  required: boolean;
  /** Liczba: jednostka do podpisu (`kg`, `h`). */
  unit: string;
  /** Liczba i skala: granice. Skala bez granic to 0–10. */
  min: number | null;
  max: number | null;
  /** Wybór i wielokrotny wybór: odpowiedzi do zaznaczenia (odpowiedź trzyma ich numery). */
  options: string[];
}

/** Jednorazowy, codzienny albo cotygodniowy (check-in) — od tego zależy, jaki okres zamyka odpowiedź. */
export const FORM_REPEATS = ['once', 'daily', 'weekly'] as const;
export type FormRepeat = (typeof FORM_REPEATS)[number];

export interface FormBody {
  kind: 'form';
  title: string;
  intro: string;
  questions: FormQuestion[];
  repeat: FormRepeat;
  /** Cotygodniowy: od którego dnia tygodnia (1 = poniedziałek … 7) telefon przypomina. */
  weekday: number | null;
  /** Wywiad na start: telefon pokazuje go na wierzchu, aż odpowiedź pójdzie. */
  intake: boolean;
}

/* ── Nawyki ────────────────────────────────────────────────────────────────────────── */

export const HABIT_TIMES = ['morning', 'midday', 'evening', 'any'] as const;
export type HabitTime = (typeof HABIT_TIMES)[number];

export interface HabitItem {
  label: string;
  /** Dawka albo ilość („5 g”, „2 l”); pusty — bez. */
  dose: string;
  when: HabitTime;
  /** Dni tygodnia 1–7 (poniedziałek = 1), w które punkt obowiązuje. */
  days: number[];
}

export interface HabitsBody {
  kind: 'habits';
  title: string;
  items: HabitItem[];
  note: string;
  /** Do kiedy (dzień, włącznie); `null` — bez końca. */
  until: string | null;
}

/* ── Jadłospis ─────────────────────────────────────────────────────────────────────── */

export interface PlannedMeal {
  /** Pora posiłku po ludzku („Śniadanie”, „Po treningu”). */
  slot: string;
  name: string;
  /** Przepis z katalogu GYM TRACKERa (`RECIPES`), gdy posiłek nim jest. */
  recipe: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  note: string;
}

export interface MealDay {
  label: string;
  meals: PlannedMeal[];
}

export interface MealsBody {
  kind: 'meals';
  title: string;
  days: MealDay[];
  /** Od którego dnia liczyć cykl (dzień); `null` — od dnia wysłania. */
  start: string | null;
  note: string;
}

export type AssignmentBody =
  | { kind: 'plan'; plan: PlanTemplate; workouts: Workout[]; videos: CoachVideos; note: string }
  | { kind: 'workout'; workout: Workout; videos: CoachVideos; note: string }
  | {
      kind: 'targets';
      kcal: number | null;
      protein: number | null;
      steps: number | null;
      workoutsPerWeek: number | null;
      weightGoal: number | null;
      /** Tempo zmiany masy, kg na tydzień (ujemne — chudnięcie). */
      weeklyRate: number | null;
      note: string;
    }
  | { kind: 'labs'; tests: { name: string; note: string }[]; by: string | null; note: string }
  | { kind: 'note'; title: string; text: string; checklist: string[] }
  | FormBody
  | HabitsBody
  | MealsBody;

export interface AssignmentV1 {
  v: 1;
  id: string;
  area: Area;
  sentAt: number;
  from: { name: string; profession: Profession };
  body: AssignmentBody;
}

export const RECEIPT_STATUSES = ['seen', 'started', 'done', 'declined'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export interface ReceiptV1 {
  v: 1;
  assignmentId: string;
  status: ReceiptStatus;
  at: number;
  /** Lista zalecenia: które punkty odhaczone (indeksy). */
  ticked: number[];
  comment: string;
}

/* ── Sprawdzanie ───────────────────────────────────────────────────────────────────── */

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
const ID = /^[\w-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WORKOUT_KINDS: readonly WorkoutKind[] = [
  'full', 'push', 'pull', 'legs', 'upper', 'lower', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'core', 'light',
];
const URL_OK = /^https:\/\/[^\s"'<>]{4,300}$/;

function cleanVideos(v: unknown): CoachVideos {
  const out: CoachVideos = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, url] of Object.entries(v as Record<string, unknown>).slice(0, 60)) {
    if (ID.test(k) && typeof url === 'string' && URL_OK.test(url)) out[k] = url;
  }
  return out;
}

export function cleanWorkout(v: unknown): Workout | null {
  if (!v || typeof v !== 'object') return null;
  const w = v as Partial<Workout>;
  const id = str(w.id, 64);
  const name = str(w.name, 80);
  if (!ID.test(id) || !name || !Array.isArray(w.items)) return null;
  const items = w.items
    .slice(0, 40)
    .filter((i): i is Workout['items'][number] => !!i && typeof i === 'object' && ID.test(String(i.ex)))
    .map((i) => ({ ex: String(i.ex), ...(i.pair ? { pair: true } : {}), ...(i.circuit ? { circuit: true } : {}) }));
  if (!items.length) return null;
  const out: Workout = { id, name, items };
  const rest = num(w.rest, 10, 600);
  const roundRest = num(w.roundRest, 10, 900);
  if (rest !== null) out.rest = rest;
  if (roundRest !== null) out.roundRest = roundRest;
  const kind = WORKOUT_KINDS.find((k) => k === w.kind);
  if (kind) out.kind = kind;
  if (w.gear === 'none' || w.gear === 'kb' || w.gear === 'gym') out.gear = w.gear;
  const desc = str(w.desc, 400);
  if (desc) out.desc = desc;
  if (typeof w.base === 'string' && ID.test(w.base)) out.base = w.base;
  return out;
}

export function cleanPlan(v: unknown): PlanTemplate | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Partial<PlanTemplate>;
  const id = str(p.id, 64);
  const name = str(p.name, 80);
  const weeks = num(p.weeks, 1, 52);
  const days = num(p.daysPerWeek, 1, 7);
  const cycle = Array.isArray(p.cycle) ? p.cycle.filter((c) => typeof c === 'string' && ID.test(c)).slice(0, 14) : [];
  const weekdays = Array.isArray(p.weekdays)
    ? [...new Set(p.weekdays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
    : [];
  if (!ID.test(id) || !name || weeks === null || days === null || !cycle.length || !weekdays.length) return null;
  const level = p.level === 'zero' || p.level === 'strong' ? p.level : 'base';
  const sex = p.sex === 'f' || p.sex === 'm' ? p.sex : 'any';
  const out: PlanTemplate = {
    id,
    name,
    level,
    sex,
    daysPerWeek: Math.round(days),
    weeks: Math.round(weeks),
    loadFactor: num(p.loadFactor, 0.3, 2) ?? 1,
    cycle,
    weekdays,
    desc: str(p.desc, 600),
    kind: 'own',
  };
  if (Array.isArray(p.deload)) out.deload = p.deload.filter((d) => Number.isInteger(d) && d >= 1 && d <= 52).slice(0, 26);
  const every = num(p.deloadEvery, 0, 12);
  if (every !== null) out.deloadEvery = Math.round(every);
  const goal = str(p.goal, 200);
  if (goal) out.goal = goal;
  if (p.gear === 'none' || p.gear === 'kb' || p.gear === 'gym') out.gear = p.gear;
  return out;
}

const QID = /^[a-z0-9]{1,8}$/;
/** Dzień kalendarza naprawdę istniejący (`2026-13-45` ma kształt, ale nie istnieje — i wywracałby rachunek dni). */
const realDay = (v: unknown): v is string =>
  typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const RECIPE_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const weekdays = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : [];

export function cleanQuestion(v: unknown): FormQuestion | null {
  if (!v || typeof v !== 'object') return null;
  const q = v as Record<string, unknown>;
  const type = QUESTION_TYPES.find((t) => t === q.type);
  const id = typeof q.id === 'string' && QID.test(q.id) ? q.id : null;
  const label = str(q.label, 200);
  if (!type || !id || !label) return null;
  const options = type === 'choice' || type === 'multi'
    ? (Array.isArray(q.options) ? q.options.map((o) => str(o, 80)).filter(Boolean).slice(0, 12) : [])
    : [];
  if ((type === 'choice' || type === 'multi') && options.length < 2) return null;
  let min = type === 'number' || type === 'scale' ? num(q.min, -100000, 100000) : null;
  let max = type === 'number' || type === 'scale' ? num(q.max, -100000, 100000) : null;
  if (type === 'scale') {
    min = min === null ? 0 : Math.round(min);
    max = max === null ? 10 : Math.round(max);
    if (max <= min || max - min > 20) return null;
  }
  if (min !== null && max !== null && max < min) return null;
  return {
    id,
    type,
    label,
    help: str(q.help, 300),
    required: q.required === true,
    unit: type === 'number' ? str(q.unit, 12) : '',
    min,
    max,
    options,
  };
}

export function cleanForm(b: Record<string, unknown>): FormBody | null {
  const title = str(b.title, 120);
  const questions: FormQuestion[] = [];
  for (const raw of Array.isArray(b.questions) ? b.questions.slice(0, 40) : []) {
    const q = cleanQuestion(raw);
    if (!q) return null;
    if (questions.some((x) => x.id === q.id)) return null;
    questions.push(q);
  }
  if (!title || !questions.length) return null;
  const repeat = FORM_REPEATS.find((r) => r === b.repeat) ?? 'once';
  const wd = num(b.weekday, 1, 7);
  return {
    kind: 'form',
    title,
    intro: str(b.intro, 2000),
    questions,
    repeat,
    weekday: repeat === 'weekly' ? (wd === null ? 1 : Math.round(wd)) : null,
    intake: repeat === 'once' && b.intake === true,
  };
}

export function cleanHabits(b: Record<string, unknown>): HabitsBody | null {
  const title = str(b.title, 120);
  const items: HabitItem[] = [];
  for (const raw of Array.isArray(b.items) ? b.items.slice(0, 20) : []) {
    if (!raw || typeof raw !== 'object') return null;
    const h = raw as Record<string, unknown>;
    const label = str(h.label, 120);
    const days = weekdays(h.days);
    if (!label || !days.length) return null;
    items.push({ label, dose: str(h.dose, 60), when: HABIT_TIMES.find((t) => t === h.when) ?? 'any', days });
  }
  if (!title || !items.length) return null;
  return { kind: 'habits', title, items, note: str(b.note, 2000), until: realDay(b.until) ? b.until : null };
}

export function cleanMeals(b: Record<string, unknown>): MealsBody | null {
  const title = str(b.title, 120);
  const days: MealDay[] = [];
  for (const raw of Array.isArray(b.days) ? b.days.slice(0, 14) : []) {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const meals: PlannedMeal[] = [];
    for (const m0 of Array.isArray(d.meals) ? d.meals.slice(0, 8) : []) {
      if (!m0 || typeof m0 !== 'object') return null;
      const m = m0 as Record<string, unknown>;
      const name = str(m.name, 120);
      if (!name) return null;
      meals.push({
        slot: str(m.slot, 30),
        name,
        recipe: typeof m.recipe === 'string' && RECIPE_ID.test(m.recipe) ? m.recipe : null,
        kcal: num(m.kcal, 0, 5000),
        protein: num(m.protein, 0, 500),
        carbs: num(m.carbs, 0, 1000),
        fat: num(m.fat, 0, 500),
        note: str(m.note, 300),
      });
    }
    if (!meals.length) return null;
    days.push({ label: str(d.label, 40), meals });
  }
  if (!title || !days.length) return null;
  return { kind: 'meals', title, days, start: realDay(b.start) ? b.start : null, note: str(b.note, 2000) };
}

function cleanBody(v: unknown): AssignmentBody | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;
  switch (b.kind) {
    case 'plan': {
      const plan = cleanPlan(b.plan);
      const workouts = Array.isArray(b.workouts) ? b.workouts.slice(0, 14).map(cleanWorkout) : [];
      if (!plan || workouts.some((w) => !w)) return null;
      return { kind: 'plan', plan, workouts: workouts as Workout[], videos: cleanVideos(b.videos), note: str(b.note, 2000) };
    }
    case 'workout': {
      const workout = cleanWorkout(b.workout);
      return workout ? { kind: 'workout', workout, videos: cleanVideos(b.videos), note: str(b.note, 2000) } : null;
    }
    case 'targets': {
      const t = {
        kind: 'targets' as const,
        kcal: num(b.kcal, 800, 8000),
        protein: num(b.protein, 10, 500),
        steps: num(b.steps, 500, 60000),
        workoutsPerWeek: num(b.workoutsPerWeek, 1, 14),
        weightGoal: num(b.weightGoal, 25, 350),
        weeklyRate: num(b.weeklyRate, -2, 2),
        note: str(b.note, 2000),
      };
      const any = t.kcal ?? t.protein ?? t.steps ?? t.workoutsPerWeek ?? t.weightGoal ?? t.weeklyRate;
      return any === null && !t.note ? null : t;
    }
    case 'labs': {
      const tests = Array.isArray(b.tests)
        ? b.tests
            .slice(0, 60)
            .map((t) => ({ name: str((t as { name?: unknown })?.name, 120), note: str((t as { note?: unknown })?.note, 300) }))
            .filter((t) => t.name)
        : [];
      if (!tests.length) return null;
      const by = typeof b.by === 'string' && DAY.test(b.by) ? b.by : null;
      return { kind: 'labs', tests, by, note: str(b.note, 2000) };
    }
    case 'note': {
      const title = str(b.title, 120);
      const text = str(b.text, 6000);
      const checklist = Array.isArray(b.checklist) ? b.checklist.map((c) => str(c, 200)).filter(Boolean).slice(0, 30) : [];
      return title && (text || checklist.length) ? { kind: 'note', title, text, checklist } : null;
    }
    case 'form':
      return cleanForm(b);
    case 'habits':
      return cleanHabits(b);
    case 'meals':
      return cleanMeals(b);
    default:
      return null;
  }
}

/** Zalecenie po odszyfrowaniu albo `null`. `area` musi pozwalać na ten rodzaj (`KINDS_BY_AREA`). */
export function parseAssignment(v: unknown): AssignmentV1 | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Partial<AssignmentV1>;
  // Chwila wysłania w rozsądnym zakresie (do roku 2200): z niej telefon liczy dzień startu jadłospisu.
  if (a.v !== 1 || typeof a.id !== 'string' || !isArea(a.area) || typeof a.sentAt !== 'number') return null;
  if (!Number.isFinite(a.sentAt) || a.sentAt <= 0 || a.sentAt >= 7_258_118_400_000) return null;
  const body = cleanBody(a.body);
  if (!body || !KINDS_BY_AREA[a.area].includes(body.kind)) return null;
  const from = a.from as Partial<AssignmentV1['from']> | undefined;
  const name = str(from?.name, 80);
  if (!name) return null;
  const profession = (['trainer', 'dietitian', 'physio', 'doctor', 'other'] as const).find((p) => p === from?.profession) ?? 'other';
  return { v: 1, id: a.id, area: a.area, sentAt: a.sentAt, from: { name, profession }, body };
}

export function parseReceipt(v: unknown): ReceiptV1 | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Partial<ReceiptV1>;
  if (r.v !== 1 || typeof r.assignmentId !== 'string' || typeof r.at !== 'number') return null;
  if (!RECEIPT_STATUSES.includes(r.status as ReceiptStatus)) return null;
  const ticked = Array.isArray(r.ticked) ? r.ticked.filter((i) => Number.isInteger(i) && i >= 0 && i < 30) : [];
  return { v: 1, assignmentId: r.assignmentId, status: r.status as ReceiptStatus, at: r.at, ticked, comment: str(r.comment, 1000) };
}
