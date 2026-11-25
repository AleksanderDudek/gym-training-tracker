import { cleanCoaching } from '@gymtracker/link';
import type { CoachingV1 } from '@gymtracker/link';
import { plural } from '@gt/food/lib/format';
import { pluralEn, text } from '@gt/i18n';
import { adherenceOf, weekRates } from './adherence';
import { fullDaysBefore, hasCoaching, isCoached, isKind, sortSent } from './coached';
import type { CoachedBody, LiveItem } from './coached';
import type { Connection, SentAssignment, SnapshotRead } from './data';
import { formState, formsOf } from './forms';
import type { Overview } from './metrics';

/**
 * „Do przejrzenia”: kto z podopiecznych potrzebuje dziś uwagi prowadzącego i dlaczego.
 *
 * Czyste funkcje — bez sieci, kryptografii i pamięci przeglądarki. Wejście to już odszyfrowana
 * paczka i lista zaleceń (`prepare`), nieprzeczytane wiadomości i chwila ostatniego otwarcia
 * podopiecznego; wyjście — liczby do kolumn, powody krótkimi słowami i wynik do sortowania.
 *
 * **Bez drugiego rachunku.** Które zalecenia obowiązują i które dni się liczą — `coached.ts`;
 * nawyki i jadłospis — funkcje zakładki „Realizacja” (`adherence.ts`); stan formularzy — ten sam
 * `formState` co w zakładce „Odpowiedzi” (`forms.ts`). Lista i karta podopiecznego pokazują to samo.
 * Dni nawyków, jadłospisu i formularzy liczą się w strefie telefonu (`snapshot.tz`); treningi idą
 * przez `overview()`, czyli silnikiem GYM TRACKERa (dni jak w historii aplikacji) — w tym samym oknie
 * siedmiu pełnych dni przed `min(dziś, dzień paczki)`.
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

export { dayIn } from './coached';

/* ── Wejście: paczka i zalecenia ───────────────────────────────────────────────────── */

export type CoachedItem = LiveItem<CoachedBody>;

/** To, co z jednej współpracy potrzebne do przeglądu — bez reszty paczki (nie trzymamy jej w pamięci). */
export interface ReviewData {
  /** Kiedy przyszła ostatnia paczka (ms); `null` — jeszcze żadna. */
  dataAt: number | null;
  /** Chwila paczki z zegara telefonu (`snapshot.at`) — od niej dzień paczki; `null` — brak paczki. */
  snapAt: number | null;
  /** Paczka jest, ale nie otwiera się kluczem z sejfu. */
  unreadable: boolean;
  /** Strefa telefonu z paczki. */
  tz: string | null;
  /** Odpowiedzi i odhaczenia; `null` — brak paczki albo telefon jeszcze bez tej części (starsza wersja). */
  coaching: CoachingV1 | null;
  /** Treningi w 7 pełnych dniach wobec planu; `null` — podopieczny nie udostępnia treningów. */
  training: { done: number; expected: number | null } | null;
  /** Formularze, nawyki i jadłospisy, które obowiązują (`sortSent(...).live`). */
  items: CoachedItem[];
  /**
   * Najbliższa chwila „pokaż od” zaplanowanego zalecenia (ms): wtedy przegląd trzeba policzyć od nowa,
   * bo zalecenie zacznie obowiązywać; `null` — nic nie czeka.
   */
  refreshAt: number | null;
}

/** Treningi w tygodniu wg planu: ostatnia zmiana dni, dni wybrane ręcznie, albo szablon. */
function planDaysPerWeek(read: SnapshotRead, o: Overview, day: string): number | null {
  if (!o.plan) return null;
  const p = read.snapshot?.training?.plan;
  const change = p?.changes?.filter((c) => c.from <= day).at(-1)?.weekdays;
  const days = (change ?? p?.weekdays)?.length;
  return days || o.plan.daysPerWeek || null;
}

/** Dzień chwili tak, jak liczy go silnik GYM TRACKERa (`dayKey`: data UTC) — dni sesji w `overview()`. */
const engineDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Składa `ReviewData` z odszyfrowanej paczki, wysłanych zaleceń i pulpitu (`overview()` z tej paczki;
 * `null`, gdy paczki nie ma albo silnik jej nie policzył).
 */
export function prepare(read: SnapshotRead, sent: readonly SentAssignment[], o: Overview | null, now: number): ReviewData {
  const s = read.snapshot;
  const sorted = sortSent(sent, now);
  let workoutsTarget: { perWeek: number; at: number } | null = null;
  for (const x of sorted.live.filter(isKind('targets')))
    if (x.body.workoutsPerWeek && (!workoutsTarget || x.sentAt > workoutsTarget.at)) workoutsTarget = { perWeek: x.body.workoutsPerWeek, at: x.sentAt };

  let training: ReviewData['training'] = null;
  if (s?.training && o) {
    // To samo okno co nawyki: 7 pełnych dni przed `min(dziś, dzień paczki)` — treningi po paczce
    // są nieznane, nie opuszczone.
    const window = fullDaysBefore(o.today, engineDay(s.at));
    const inWindow = new Set(window);
    const done = o.sessions.filter((x) => inWindow.has(x.day)).length;
    const planned = planDaysPerWeek(read, o, window.at(-1)!);
    const perWeek = planned ?? workoutsTarget?.perWeek ?? null;
    const start = planned !== null ? (s.training.plan?.start ?? null) : workoutsTarget ? engineDay(workoutsTarget.at) : null;
    let expected: number | null = null;
    if (perWeek) {
      // Plan albo cel z tego tygodnia: oczekiwania proporcjonalnie do dni okna, w których już obowiązywał.
      const days = start ? window.filter((d) => d >= start).length : window.length;
      expected = days > 0 ? (perWeek * days) / 7 : null;
    }
    training = { done, expected };
  }

  // Zaplanowane zacznie obowiązywać o swojej porze — wtedy przegląd liczy się od nowa (`reviewLoad`).
  const next = sorted.scheduled[0]?.visibleAt ?? null;

  return {
    dataAt: read.at ? Date.parse(read.at) : null,
    snapAt: s ? s.at : null,
    unreadable: read.unreadable,
    tz: s && typeof s.tz === 'string' ? s.tz : null,
    coaching: hasCoaching(s) ? cleanCoaching(s!.coaching) : null,
    training,
    items: sorted.live.filter(isCoached),
    refreshAt: next,
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
  /** Formularze zaległe tak jak w zakładce „Odpowiedzi” (`formStatus`): cotygodniowy po swoim dniu, codzienny bez wczoraj. */
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
    if (data.coaching && data.snapAt !== null && !data.unreadable) {
      const since = ctx.lastSeen ?? now - NEW_ANSWERS_FALLBACK_MS;
      // Formularze: ten sam stan co w zakładce „Odpowiedzi” (jedna odpowiedź na okres, zaległy wg `formStatus`).
      const forms = formsOf(data.items).map((f) => formState(f, data.coaching, data.tz, now));
      newAnswers = forms.reduce((n, f) => n + f.rows.filter((r) => r.at > since).length, 0);
      checkinsOverdue = forms.filter((f) => f.status.kind === 'overdue').length;
      // Nawyki i jadłospis: te same rachunki co zakładka „Realizacja”, bez siatki dni.
      const week = weekRates(adherenceOf({ tz: data.tz, at: data.snapAt, coaching: data.coaching }, data.items, now, 0));
      habits = week.habits.pct;
      meals = week.meals.pct;
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
    checkin: (n: number) => (n === 1 ? 'zaległy formularz' : `${n} ${plural(n, 'zaległy formularz', 'zaległe formularze', 'zaległych formularzy')}`),
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
    checkin: (n: number) => (n === 1 ? 'form overdue' : `${n} forms overdue`),
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
