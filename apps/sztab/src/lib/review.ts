import { addDays, cleanCoaching, daysBetween, formDue, habitsFor, localDay, mealDayIndex, parseAssignment, weekdayOf } from '@gymtracker/link';
import type { CoachingV1, FormBody, HabitsBody, MealsBody, TickLog } from '@gymtracker/link';
import { plural } from '@gt/food/lib/format';
import { pluralEn, text } from '@gt/i18n';
import type { Connection, SentAssignment, SnapshotRead } from './data';
import type { Overview } from './metrics';

/**
 * „Do przejrzenia”: kto z podopiecznych potrzebuje dziś uwagi prowadzącego i dlaczego.
 *
 * Czyste funkcje — bez sieci, kryptografii i pamięci przeglądarki. Wejście to już odszyfrowana
 * paczka i lista zaleceń (`prepare`), nieprzeczytane wiadomości i chwila ostatniego otwarcia
 * podopiecznego; wyjście — liczby do kolumn, powody krótkimi słowami i wynik do sortowania.
 *
 * **Dni nawyków, jadłospisu i check-inu liczy się w strefie telefonu** (`snapshot.tz`), bo tam
 * podopieczny odhacza dzień — prowadzący z innej strefy zobaczy ten sam podział na dni co telefon.
 * Treningi idą przez `overview()`, czyli silnikiem GYM TRACKERa (dni jak w historii aplikacji).
 */

const DAY_MS = 86_400_000;
/** Dane starsze niż tyle dni — alarm „stare dane”. */
export const STALE_DAYS = 7;
/** Realizacja poniżej tego progu (%) — powód do przejrzenia, jak ostrzeżenie pulpitu. */
export const LOW_PCT = 60;
/** Nowy podopieczny ma tyle dni na pierwsze otwarcie aplikacji, zanim brak danych stanie się powodem. */
export const NO_DATA_GRACE_DAYS = 3;
/** Bez śladu otwarcia w tej przeglądarce „nowe odpowiedzi” to te z ostatnich 7 dni. */
export const NEW_ANSWERS_FALLBACK_MS = 7 * DAY_MS;

/* ── Dzień w strefie telefonu ──────────────────────────────────────────────────────── */

const fmts = new Map<string, Intl.DateTimeFormat | null>();

function formatter(tz: string): Intl.DateTimeFormat | null {
  if (!fmts.has(tz)) {
    let f: Intl.DateTimeFormat | null = null;
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      f = null;
    }
    fmts.set(tz, f);
  }
  return fmts.get(tz) ?? null;
}

/**
 * Dzień `YYYY-MM-DD` chwili `at` w strefie `tz` (z paczki — dane z zewnątrz: nieznana albo zepsuta
 * strefa daje dzień w strefie tej przeglądarki).
 */
export function dayIn(tz: string | null, at: number): string {
  const f = tz && tz.length <= 64 ? formatter(tz) : null;
  if (!f) return localDay(at);
  const parts = f.formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : localDay(at);
}

/* ── Wejście: paczka i zalecenia ───────────────────────────────────────────────────── */

export type CoachedBody = FormBody | HabitsBody | MealsBody;

export interface CoachedItem {
  id: string;
  body: CoachedBody;
  /** Od kiedy podopieczny ma zalecenie (ms): wysłanie albo „pokaż od” zaplanowanego. */
  sentAt: number;
}

/** To, co z jednej współpracy potrzebne do przeglądu — bez reszty paczki (nie trzymamy jej w pamięci). */
export interface ReviewData {
  /** Kiedy przyszła ostatnia paczka (ms); `null` — jeszcze żadna. */
  dataAt: number | null;
  /** Paczka jest, ale nie otwiera się kluczem z sejfu. */
  unreadable: boolean;
  /** Strefa telefonu z paczki. */
  tz: string | null;
  /** Odpowiedzi i odhaczenia; `null` — brak paczki albo telefon jeszcze bez tej części (starsza wersja). */
  coaching: CoachingV1 | null;
  /** Treningi w ostatnich 7 dniach wobec planu; `null` — podopieczny nie udostępnia treningów. */
  training: { done: number; expected: number | null } | null;
  /** Wysłane formularze, nawyki i jadłospisy, które obowiązują: nie wycofane, nie odrzucone, już widoczne. */
  items: CoachedItem[];
}

const isCoached = (b: { kind: string }): b is CoachedBody => b.kind === 'form' || b.kind === 'habits' || b.kind === 'meals';

/** Treningi w tygodniu wg planu: ostatnia zmiana dni, dni wybrane ręcznie, albo szablon. */
function planDaysPerWeek(read: SnapshotRead, o: Overview): number | null {
  if (!o.plan) return null;
  const p = read.snapshot?.training?.plan;
  const change = p?.changes?.filter((c) => c.from <= o.today).at(-1)?.weekdays;
  const days = (change ?? p?.weekdays)?.length;
  return days || o.plan.daysPerWeek || null;
}

/**
 * Składa `ReviewData` z odszyfrowanej paczki, wysłanych zaleceń i pulpitu (`overview()` z tej paczki;
 * `null`, gdy paczki nie ma albo silnik jej nie policzył).
 */
export function prepare(read: SnapshotRead, sent: readonly SentAssignment[], o: Overview | null, now: number): ReviewData {
  const s = read.snapshot;
  const items: CoachedItem[] = [];
  let workoutsTarget: { perWeek: number; at: number } | null = null;
  for (const x of sent) {
    if (x.withdrawnAt || x.receipt?.status === 'declined') continue;
    if (x.visibleFrom && Date.parse(x.visibleFrom) > now) continue;
    // Własne zalecenia prowadzącego, ale z bazy — ten sam filtr, przez który przechodzą w telefonie.
    const a = x.envelope ? parseAssignment(x.envelope) : null;
    if (!a) continue;
    if (isCoached(a.body)) items.push({ id: a.id, body: a.body, sentAt: a.sentAt });
    else if (a.body.kind === 'targets' && a.body.workoutsPerWeek && (!workoutsTarget || a.sentAt > workoutsTarget.at))
      workoutsTarget = { perWeek: a.body.workoutsPerWeek, at: a.sentAt };
  }

  let training: ReviewData['training'] = null;
  if (s?.training && o) {
    const since = addDays(o.today, -7);
    const done = o.sessions.filter((x) => x.day > since && x.day <= o.today).length;
    const planned = planDaysPerWeek(read, o);
    const perWeek = planned ?? workoutsTarget?.perWeek ?? null;
    const start = planned !== null ? (s.training.plan?.start ?? null) : workoutsTarget ? new Date(workoutsTarget.at).toISOString().slice(0, 10) : null;
    let expected: number | null = null;
    if (perWeek) {
      // Plan albo cel z tego tygodnia: oczekiwania proporcjonalnie do dni, które już minęły.
      const window = start ? Math.min(7, daysBetween(start, o.today) + 1) : 7;
      expected = window > 0 ? (perWeek * window) / 7 : null;
    }
    training = { done, expected };
  }

  return {
    dataAt: read.at ? Date.parse(read.at) : null,
    unreadable: read.unreadable,
    tz: s && typeof s.tz === 'string' ? s.tz : null,
    coaching: s && s.coaching !== undefined ? cleanCoaching(s.coaching) : null,
    training,
    items,
  };
}

/* ── Przegląd ──────────────────────────────────────────────────────────────────────── */

export type ReasonCode = 'unread' | 'checkin' | 'unreadable' | 'stale' | 'nodata' | 'answers' | 'training' | 'habits' | 'meals';

export interface Reason {
  code: ReasonCode;
  /** Liczba do zdania: wiadomości, odpowiedzi, dni, procent. */
  n: number;
  /** Ile ten powód dokłada do wyniku. */
  weight: number;
}

export interface Review {
  /** Czy przyszły już dane do przeglądu (paczka i zalecenia); bez nich — tylko to, co wiadomo z listy. */
  loaded: boolean;
  /** Pełne dni od ostatnich danych; `null` — jeszcze żadnych. */
  ageDays: number | null;
  stale: boolean;
  unread: number;
  /** Nowe odpowiedzi na formularze od ostatniego otwarcia; `null` — nie wiadomo. */
  newAnswers: number | null;
  /** Realizacja (%) z 7 dni; `null` — nie dotyczy albo nie wiadomo. */
  training: number | null;
  habits: number | null;
  meals: number | null;
  /** Cotygodniowe formularze bez odpowiedzi po swoim dniu tygodnia. */
  checkinsOverdue: number;
  /** Najważniejszy pierwszy. */
  reasons: Reason[];
  /** 0 — nic do przejrzenia. */
  score: number;
}

export interface ReviewContext {
  unread: number;
  /** Kiedy prowadzący ostatnio otworzył tego podopiecznego z listy (ms); `null` — nigdy w tej przeglądarce. */
  lastSeen: number | null;
  now: number;
}

/** Siedem pełnych dni przed dzisiejszym (dziś jeszcze trwa — nie karzemy za wieczorne odhaczanie). */
const lastWeek = (today: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(today, -1 - i));

function ticksOf(logs: readonly TickLog[], id: string): Record<string, Set<number>> {
  const out: Record<string, Set<number>> = {};
  for (const l of logs) {
    if (l.assignmentId !== id) continue;
    for (const [day, list] of Object.entries(l.days)) {
      const set = (out[day] ??= new Set());
      for (const i of list) set.add(i);
    }
  }
  return out;
}

/** Odhaczone z należnych (%) w ostatnich 7 pełnych dniach, łącznie ze wszystkich zaleceń danego rodzaju. */
function tickRate(d: ReviewData, coaching: CoachingV1, kind: 'habits' | 'meals', today: string): number | null {
  let due = 0;
  let done = 0;
  for (const it of d.items) {
    if (it.body.kind !== kind) continue;
    const sentDay = dayIn(d.tz, it.sentAt);
    const ticks = ticksOf(kind === 'habits' ? coaching.habits : coaching.meals, it.id);
    for (const day of lastWeek(today)) {
      if (day < sentDay) continue;
      let list: number[];
      if (it.body.kind === 'habits') list = habitsFor(it.body, day);
      else {
        const i = mealDayIndex(it.body, sentDay, day);
        list = i === null ? [] : (it.body.days[i]?.meals.map((_, j) => j) ?? []);
      }
      due += list.length;
      done += list.filter((i) => ticks[day]?.has(i)).length;
    }
  }
  return due ? Math.round((done / due) * 100) : null;
}

/** Cotygodniowe formularze, których dzień w tym tygodniu minął bez odpowiedzi. */
function overdueCheckins(d: ReviewData, coaching: CoachingV1, today: string): number {
  const wd = weekdayOf(today);
  let n = 0;
  for (const it of d.items) {
    if (it.body.kind !== 'form' || it.body.repeat !== 'weekly') continue;
    const due = it.body.weekday ?? 1;
    if (wd <= due) continue;
    // Formularz wysłany już po swoim dniu w tym tygodniu jeszcze nie jest zaległy.
    if (dayIn(d.tz, it.sentAt) > addDays(today, due - wd)) continue;
    const answered = new Set(coaching.answers.filter((a) => a.assignmentId === it.id).map((a) => a.period));
    if (formDue(it.body, answered, today)) n++;
  }
  return n;
}

const pctWeight = (pct: number, base: number, slope: number) => Math.round(base + (LOW_PCT - pct) / slope);

/** Przegląd jednej trwającej współpracy. `data` — `null`, póki paczka i zalecenia się wczytują. */
export function review(c: Pick<Connection, 'createdAt' | 'lastPushAt'>, data: ReviewData | null, ctx: ReviewContext): Review {
  const { now } = ctx;
  const reasons: Reason[] = [];
  const add = (code: ReasonCode, n: number, weight: number) => reasons.push({ code, n, weight });

  const pushed = c.lastPushAt ? Date.parse(c.lastPushAt) : null;
  const dataAt = Math.max(pushed ?? -Infinity, data?.dataAt ?? -Infinity);
  const has = Number.isFinite(dataAt);
  const ageDays = has ? Math.max(0, Math.floor((now - dataAt) / DAY_MS)) : null;
  const stale = has && now - dataAt > STALE_DAYS * DAY_MS;

  if (ctx.unread > 0) add('unread', ctx.unread, 40 + 2 * Math.min(ctx.unread, 10));
  if (stale) add('stale', ageDays!, 20 + Math.min(ageDays! - STALE_DAYS, 21));
  if (!has && now - Date.parse(c.createdAt) > NO_DATA_GRACE_DAYS * DAY_MS) add('nodata', 0, 15);
  if (data?.unreadable) add('unreadable', 0, 25);

  let newAnswers: number | null = null;
  let training: number | null = null;
  let habits: number | null = null;
  let meals: number | null = null;
  let checkinsOverdue = 0;

  if (data) {
    const t = data.training;
    if (t && t.expected !== null && t.expected >= 1) {
      training = Math.min(100, Math.round((t.done / t.expected) * 100));
      if (training < LOW_PCT) add('training', training, pctWeight(training, 10, 3));
    }
    if (data.coaching && !data.unreadable) {
      const today = dayIn(data.tz, now);
      const since = ctx.lastSeen ?? now - NEW_ANSWERS_FALLBACK_MS;
      newAnswers = data.coaching.answers.filter((a) => a.at > since).length;
      checkinsOverdue = overdueCheckins(data, data.coaching, today);
      habits = tickRate(data, data.coaching, 'habits', today);
      meals = tickRate(data, data.coaching, 'meals', today);
      if (checkinsOverdue) add('checkin', checkinsOverdue, 30 * Math.min(checkinsOverdue, 2));
      if (newAnswers) add('answers', newAnswers, 15 + Math.min(newAnswers, 10));
      if (habits !== null && habits < LOW_PCT) add('habits', habits, pctWeight(habits, 8, 4));
      if (meals !== null && meals < LOW_PCT) add('meals', meals, pctWeight(meals, 8, 4));
    }
  }

  reasons.sort((a, b) => b.weight - a.weight);
  return {
    loaded: data !== null,
    ageDays,
    stale,
    unread: ctx.unread,
    newAnswers,
    training,
    habits,
    meals,
    checkinsOverdue,
    reasons,
    score: reasons.reduce((s, r) => s + r.weight, 0),
  };
}

/** Kolejność „Do przejrzenia”: wynik, potem nieprzeczytane, potem wiek danych. */
export function compareReviews(a: Review, b: Review): number {
  return b.score - a.score || b.unread - a.unread || (b.ageDays ?? -1) - (a.ageDays ?? -1);
}

/* ── Słowa ─────────────────────────────────────────────────────────────────────────── */

const R = text({
  pl: {
    unread: (n: number) => `${n} ${plural(n, 'nowa wiadomość', 'nowe wiadomości', 'nowych wiadomości')}`,
    checkin: (n: number) => (n === 1 ? 'zaległy check-in' : `${n} ${plural(n, 'zaległy check-in', 'zaległe check-iny', 'zaległych check-inów')}`),
    unreadable: () => 'paczka się nie otwiera',
    stale: (n: number) => `dane sprzed ${n} dni`,
    nodata: () => 'jeszcze bez danych',
    answers: (n: number) => `${n} ${plural(n, 'nowa odpowiedź', 'nowe odpowiedzi', 'nowych odpowiedzi')}`,
    training: (n: number) => `trening ${n}% planu`,
    habits: (n: number) => `nawyki ${n}%`,
    meals: (n: number) => `jadłospis ${n}%`,
  } as Record<ReasonCode, (n: number) => string>,
  en: {
    unread: (n: number) => `${n} new ${pluralEn(n, 'message', 'messages')}`,
    checkin: (n: number) => (n === 1 ? 'check-in overdue' : `${n} check-ins overdue`),
    unreadable: () => 'data package won’t open',
    stale: (n: number) => `data ${n} days old`,
    nodata: () => 'no data yet',
    answers: (n: number) => `${n} new ${pluralEn(n, 'answer', 'answers')}`,
    training: (n: number) => `training ${n}% of plan`,
    habits: (n: number) => `habits ${n}%`,
    meals: (n: number) => `meal plan ${n}%`,
  } as Record<ReasonCode, (n: number) => string>,
});

/** Powód krótkim zdaniem, w języku tej wizyty. */
export const reasonText = (r: Pick<Reason, 'code' | 'n'>): string => R[r.code](r.n);
