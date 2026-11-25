import type { FormBody, FormQuestion, HabitsBody, MealsBody } from './assignment';

/**
 * Prowadzenie dzień po dniu: odpowiedzi na formularze, odhaczone nawyki i posiłki — to, co telefon
 * odsyła w paczce (`SnapshotV1.coaching`) — oraz wiadomości i zdjęcia.
 *
 * **Dni to napisy `YYYY-MM-DD` w czasie telefonu** (jak dziennik jedzenia). Rachunek na nich idzie
 * w UTC, żeby ta sama data dawała ten sam dzień tygodnia i ten sam tydzień w każdej strefie —
 * telefon i przeglądarka prowadzącego muszą policzyć identycznie, który okres zamyka odpowiedź.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Dzień, który naprawdę istnieje — `2026-02-30` i `2026-13-45` mają kształt, ale nie przechodzą (rachunek dni dałby NaN). */
export const isDay = (v: unknown): v is string => {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false;
  const ms = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v;
};

const utc = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Dzień w strefie urządzenia (dziennik, odhaczenia). */
export function localDay(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const addDays = (day: string, n: number): string => fromUtc(utc(day) + n * DAY_MS);
export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS);

/** 1 = poniedziałek … 7 = niedziela. */
export const weekdayOf = (day: string): number => ((new Date(utc(day)).getUTCDay() + 6) % 7) + 1;

/** Tydzień ISO 8601: `2026-W48`. */
export function isoWeek(day: string): string {
  const thursday = utc(day) + (4 - weekdayOf(day)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/* ── Formularz ─────────────────────────────────────────────────────────────────────── */

/** Okres, który odpowiedź z danego dnia zamyka: `once`, dzień albo tydzień ISO. */
export function formPeriod(form: Pick<FormBody, 'repeat'>, day: string): string {
  return form.repeat === 'daily' ? day : form.repeat === 'weekly' ? isoWeek(day) : 'once';
}

/**
 * Czy formularz czeka na odpowiedź w tym dniu. Cotygodniowy — od swojego dnia tygodnia do niedzieli;
 * opuszczony tydzień przepada (następny przychodzi świeży), jak zwykły check-in.
 */
export function formDue(form: Pick<FormBody, 'repeat' | 'weekday'>, answered: ReadonlySet<string>, day: string): boolean {
  if (answered.has(formPeriod(form, day))) return false;
  if (form.repeat === 'weekly') return weekdayOf(day) >= (form.weekday ?? 1);
  return true;
}

export type AnswerValue = string | number | boolean | number[] | null;

/** Odpowiedzi sprawdzone pytanie po pytaniu; puste — `null`. Bez wymaganych — `null` całość. */
export function cleanAnswers(form: Pick<FormBody, 'questions'>, raw: unknown, opts: { partial?: boolean } = {}): Record<string, AnswerValue> | null {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, AnswerValue> = {};
  for (const q of form.questions) {
    const v = cleanValue(q, src[q.id]);
    if (v === null && q.required && !opts.partial) return null;
    out[q.id] = v;
  }
  return out;
}

function cleanValue(q: FormQuestion, v: unknown): AnswerValue {
  switch (q.type) {
    case 'text':
      return typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : null;
    case 'number':
    case 'scale': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      if (q.min !== null && v < q.min) return null;
      if (q.max !== null && v > q.max) return null;
      return q.type === 'scale' ? Math.round(v) : v;
    }
    case 'choice':
      return Number.isInteger(v) && (v as number) >= 0 && (v as number) < q.options.length ? (v as number) : null;
    case 'multi': {
      if (!Array.isArray(v)) return null;
      const picked = [...new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < q.options.length))].sort((a, b) => a - b);
      return picked.length ? picked : null;
    }
    case 'yesno':
      return typeof v === 'boolean' ? v : null;
  }
}

/* ── Nawyki i jadłospis ────────────────────────────────────────────────────────────── */

/** Punkty nawyków obowiązujące w tym dniu (numery w `items`). */
export function habitsFor(h: Pick<HabitsBody, 'items' | 'until'>, day: string): number[] {
  if (h.until && day > h.until) return [];
  const wd = weekdayOf(day);
  return h.items.flatMap((it, i) => (it.days.includes(wd) ? [i] : []));
}

/**
 * Który dzień jadłospisu przypada na dany dzień: cykl od `start` (albo od dnia wysłania).
 * `null` — przed startem.
 */
export function mealDayIndex(m: Pick<MealsBody, 'days' | 'start'>, sentDay: string, day: string): number | null {
  const start = m.start ?? sentDay;
  if (!isDay(start) || !isDay(day) || !m.days.length) return null;
  const n = daysBetween(start, day);
  if (!Number.isFinite(n) || n < 0) return null;
  return n % m.days.length;
}

/* ── Część paczki „coaching” ───────────────────────────────────────────────────────── */

export interface FormAnswer {
  assignmentId: string;
  /** `once`, dzień albo tydzień ISO — z `formPeriod`. */
  period: string;
  at: number;
  values: Record<string, AnswerValue>;
}

/** Odhaczenia dzień po dniu: dzień → numery punktów (nawyki) albo posiłków dnia (jadłospis). */
export interface TickLog {
  assignmentId: string;
  days: Record<string, number[]>;
}

export interface CoachingV1 {
  answers: FormAnswer[];
  habits: TickLog[];
  meals: TickLog[];
}

export const emptyCoaching = (): CoachingV1 => ({ answers: [], habits: [], meals: [] });

const ASSIGNMENT_ID = /^[\w-]{1,64}$/;
const PERIOD = /^(once|\d{4}-\d{2}-\d{2}|\d{4}-W\d{2})$/;

function cleanTicks(v: unknown): TickLog[] {
  if (!Array.isArray(v)) return [];
  const out: TickLog[] = [];
  for (const raw of v.slice(0, 100)) {
    if (!raw || typeof raw !== 'object') continue;
    const t = raw as Partial<TickLog>;
    if (typeof t.assignmentId !== 'string' || !ASSIGNMENT_ID.test(t.assignmentId) || !t.days || typeof t.days !== 'object') continue;
    const days: Record<string, number[]> = {};
    for (const [day, list] of Object.entries(t.days).slice(-400)) {
      if (!isDay(day) || !Array.isArray(list)) continue;
      const ok = [...new Set(list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 40))].sort((a, b) => a - b);
      days[day] = ok;
    }
    out.push({ assignmentId: t.assignmentId, days });
  }
  return out;
}

/**
 * Część paczki od telefonu — dla Sztabu to dane z zewnątrz. Wartości odpowiedzi przechodzą tu
 * tylko kształt; przeciw pytaniom formularza sprawdza je `cleanAnswers`, gdy formularz jest znany.
 */
export function cleanCoaching(v: unknown): CoachingV1 {
  if (!v || typeof v !== 'object') return emptyCoaching();
  const c = v as Partial<Record<keyof CoachingV1, unknown>>;
  const answers: FormAnswer[] = [];
  for (const raw of Array.isArray(c.answers) ? c.answers.slice(-1000) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Partial<FormAnswer>;
    if (typeof a.assignmentId !== 'string' || !ASSIGNMENT_ID.test(a.assignmentId)) continue;
    if (typeof a.period !== 'string' || !PERIOD.test(a.period) || typeof a.at !== 'number' || !Number.isFinite(a.at)) continue;
    if (!a.values || typeof a.values !== 'object' || Array.isArray(a.values)) continue;
    const values: Record<string, AnswerValue> = {};
    for (const [k, x] of Object.entries(a.values).slice(0, 40)) {
      if (!/^[a-z0-9]{1,8}$/.test(k)) continue;
      if (x === null || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x))) values[k] = x;
      else if (typeof x === 'string') values[k] = x.slice(0, 2000);
      else if (Array.isArray(x)) values[k] = x.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 12).slice(0, 12);
    }
    answers.push({ assignmentId: a.assignmentId, period: a.period, at: a.at, values });
  }
  return { answers, habits: cleanTicks(c.habits), meals: cleanTicks(c.meals) };
}

/* ── Wiadomości ────────────────────────────────────────────────────────────────────── */

export const MESSAGE_MAX = 4000;

/** Do czego wiadomość się odnosi: zamknięty trening (chwila zamknięcia z dziennika) albo zalecenie. */
export type MessageRef = { kind: 'session'; at: string; label: string } | { kind: 'assignment'; id: string; label: string };

export interface MessageV1 {
  v: 1;
  id: string;
  at: number;
  text: string;
  ref: MessageRef | null;
}

export function parseMessage(v: unknown): MessageV1 | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Partial<MessageV1>;
  if (m.v !== 1 || typeof m.id !== 'string' || !ASSIGNMENT_ID.test(m.id) || typeof m.at !== 'number' || !Number.isFinite(m.at)) return null;
  const text = typeof m.text === 'string' ? m.text.trim().slice(0, MESSAGE_MAX) : '';
  if (!text) return null;
  let ref: MessageRef | null = null;
  const r = m.ref as Partial<{ kind: string; at: string; id: string; label: string }> | null | undefined;
  const label = typeof r?.label === 'string' ? r.label.trim().slice(0, 120) : '';
  if (r?.kind === 'session' && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at))) ref = { kind: 'session', at: r.at, label };
  else if (r?.kind === 'assignment' && typeof r.id === 'string' && ASSIGNMENT_ID.test(r.id)) ref = { kind: 'assignment', id: r.id, label };
  return { v: 1, id: m.id, at: m.at, text, ref };
}

/* ── Zdjęcia sylwetki ──────────────────────────────────────────────────────────────── */

/** Najdłuższy bok wysyłanego zdjęcia i granica samego obrazu w base64 (szyfrogram w bazie ≤ 600 000). */
export const PHOTO_SIDE = 720;
export const PHOTO_MAX_CHARS = 560_000;
/** Ile ostatnich zdjęć idzie do jednego prowadzącego. */
export const PHOTO_LIMIT = 60;

export interface PhotoV1 {
  v: 1;
  id: string;
  day: string;
  w: number;
  h: number;
  /** JPEG w base64 (bez `data:`). */
  jpeg: string;
}

export function parsePhoto(v: unknown): PhotoV1 | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Partial<PhotoV1>;
  if (p.v !== 1 || typeof p.id !== 'string' || !ASSIGNMENT_ID.test(p.id) || !isDay(p.day)) return null;
  if (!Number.isInteger(p.w) || !Number.isInteger(p.h) || p.w! < 1 || p.h! < 1 || p.w! > 4000 || p.h! > 4000) return null;
  if (typeof p.jpeg !== 'string' || p.jpeg.length > PHOTO_MAX_CHARS || !/^[A-Za-z0-9+/]+=*$/.test(p.jpeg)) return null;
  return { v: 1, id: p.id, day: p.day, w: p.w!, h: p.h!, jpeg: p.jpeg };
}
