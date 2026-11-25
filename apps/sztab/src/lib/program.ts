import { AREAS, KINDS_BY_AREA, daysBetween } from '@gymtracker/link';
import type { Area, AssignmentKind } from '@gymtracker/link';
import { LOCALE } from '@gt/i18n';
import type { Connection, LibraryBody, LibraryItem, LibraryKind, ProgramStep } from './data';

/**
 * Harmonogram i programy — sama arytmetyka dat, bez sieci i bez Reacta.
 *
 * Wszystko liczy się w czasie przeglądarki prowadzącego: „dzień 3, 7:00” to 7:00 na jego zegarku,
 * także po zmianie czasu (`new Date(r, m, d + dzień, gg, mm)` — kalendarz, nie doby po 24 h).
 * Serwer dostaje gotową chwilę (`visible_from`) i do niej nie oddaje zalecenia telefonowi.
 */

/** Ostatni dzień programu (0 = dzień startu) — rok. */
export const MAX_DAY = 364;
/** Kroków w programie najwyżej tyle: telefon pobiera 200 ostatnich zaleceń, program nie może ich wypchnąć. */
export const MAX_STEPS = 120;
/** Zaplanować można najwyżej tyle dni kalendarza naprzód (do tego dnia włącznie, o dowolnej godzinie). */
export const MAX_AHEAD_DAYS = 365;
export const DEFAULT_TIME = '07:00';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `HH:MM` → [godzina, minuta]; cokolwiek innego — `null`. */
export function parseTime(s: string): [number, number] | null {
  const m = s.match(TIME);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** `RRRR-MM-DD` → [rok, miesiąc 1–12, dzień]; nieistniejąca data (30 lutego) — `null`. */
export function parseDay(s: string): [number, number, number] | null {
  const m = s.match(DATE);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(y, mo - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d ? [y, mo, d] : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Dzień w kalendarzu przeglądarki, `RRRR-MM-DD`. */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Dzień kalendarza o `n` dni dalej (bez dób po 24 h — zmiana czasu nic nie psuje). */
export function addLocalDays(day: string, n: number): string {
  const p = parseDay(day);
  if (!p) return day;
  return dayKey(new Date(p[0], p[1] - 1, p[2] + n));
}

export const today = (now: Date | number = Date.now()): string => dayKey(new Date(now));
export const tomorrow = (now: Date | number = Date.now()): string => addLocalDays(today(now), 1);

/** Najbliższy poniedziałek po dzisiejszym dniu (w poniedziałek — za tydzień). */
export function nextMonday(now: Date | number = Date.now()): string {
  const d = new Date(now);
  const wd = (d.getDay() + 6) % 7; // 0 = poniedziałek
  return addLocalDays(dayKey(d), 7 - wd);
}

/**
 * Chwila kroku programu: dzień startu + `day` dni, o `time` w czasie przeglądarki.
 * Godzina, której nie ma (przestawienie zegara w marcu), wypada godzinę później — tak liczy `Date`.
 */
export function stepAt(start: string, day: number, time: string): Date | null {
  const d = parseDay(start);
  const t = parseTime(time);
  if (!d || !t || !Number.isInteger(day) || day < 0 || day > MAX_DAY) return null;
  return new Date(d[0], d[1] - 1, d[2] + day, t[0], t[1]);
}

/** Dzień programu → tydzień (od 1) i dzień tego tygodnia (1–7, liczony od dnia startu). */
export const weekOf = (day: number): { week: number; weekday: number } => ({ week: Math.floor(day / 7) + 1, weekday: (day % 7) + 1 });

/** „Tydzień N, dzień D” → dzień programu (0…364). */
export function dayOf(week: number, weekday: number): number {
  const w = Math.max(1, Math.floor(week) || 1);
  const d = Math.min(7, Math.max(1, Math.floor(weekday) || 1));
  return Math.min(MAX_DAY, (w - 1) * 7 + (d - 1));
}

export const MAX_WEEK = weekOf(MAX_DAY).week;

/** Kroki po kolei: dzień, potem godzina (kopia — wejście zostaje nietknięte). */
export const sortSteps = (steps: readonly ProgramStep[]): ProgramStep[] =>
  [...steps].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

/** Kroki w tygodniach; `index` to miejsce kroku w `sortSteps(steps)`. */
export function weeksOf(steps: readonly ProgramStep[]): { week: number; steps: { step: ProgramStep; index: number }[] }[] {
  const out: { week: number; steps: { step: ProgramStep; index: number }[] }[] = [];
  sortSteps(steps).forEach((step, index) => {
    const { week } = weekOf(step.day);
    const last = out[out.length - 1];
    if (last && last.week === week) last.steps.push({ step, index });
    else out.push({ week, steps: [{ step, index }] });
  });
  return out;
}

const same = (a: ProgramStep, b: ProgramStep) => a.day === b.day && a.time === b.time && a.itemId === b.itemId;

/**
 * „Powiel tydzień”: kroki tygodnia `week` jeszcze raz, tydzień później. Taki sam krok, który już
 * tam jest, nie dubluje się; co wypadłoby za ostatni dzień albo ponad limit kroków — przepada.
 */
export function duplicateWeek(steps: readonly ProgramStep[], week: number): { steps: ProgramStep[]; added: number; dropped: number } {
  const out = sortSteps(steps);
  const src = out.filter((s) => weekOf(s.day).week === week);
  let added = 0;
  let dropped = 0;
  for (const s of src) {
    const copy = { ...s, day: s.day + 7 };
    if (out.some((x) => same(x, copy))) continue;
    if (copy.day > MAX_DAY || out.length >= MAX_STEPS) {
      dropped++;
      continue;
    }
    out.push(copy);
    added++;
  }
  return { steps: sortSteps(out), added, dropped };
}

/** Krok odsyła do elementu, którego nie ma już w bibliotece (albo do innego programu). */
export const isMissing = (step: ProgramStep, items: readonly LibraryItem[]): boolean =>
  !items.some((i) => i.id === step.itemId && i.kind !== 'program');

export interface ProgramSummary {
  /** Ile tygodni obejmuje program (od dnia startu do ostatniego kroku). */
  weeks: number;
  days: number;
  /** Rodzaj → ile kroków, w kolejności pierwszego wystąpienia. */
  byKind: [LibraryKind, number][];
  missing: number;
}

export function programSummary(steps: readonly ProgramStep[], items: readonly LibraryItem[]): ProgramSummary {
  const days = steps.reduce((n, s) => Math.max(n, s.day + 1), 0);
  const counts = new Map<LibraryKind, number>();
  let missing = 0;
  for (const s of sortSteps(steps)) {
    const item = items.find((i) => i.id === s.itemId);
    if (!item || item.kind === 'program') {
      missing++;
      continue;
    }
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  return { weeks: Math.ceil(days / 7), days, byKind: [...counts], missing };
}

/* ── Wysyłka z datą ──────────────────────────────────────────────────────────────── */

export type ScheduleError = 'invalid' | 'past' | 'far';

/**
 * Chwila „pokaż od” z pól daty i godziny: w przyszłości i najwyżej `MAX_AHEAD_DAYS` dni kalendarza
 * naprzód — tyle samo, ile pozwala pole daty (`max`), o każdej godzinie tego dnia.
 */
export function scheduleAt(day: string, time: string, now: number = Date.now()): { at: Date } | { error: ScheduleError } {
  const at = stepAt(day, 0, time);
  if (!at) return { error: 'invalid' };
  if (at.getTime() <= now) return { error: 'past' };
  if (day > addLocalDays(today(now), MAX_AHEAD_DAYS)) return { error: 'far' };
  return { at };
}

/** Dzień startu programu: dziś albo później, najwyżej `MAX_AHEAD_DAYS` naprzód. */
export function startError(start: string, now: number = Date.now()): ScheduleError | null {
  if (!parseDay(start)) return 'invalid';
  if (start < today(now)) return 'past';
  if (start > addLocalDays(today(now), MAX_AHEAD_DAYS)) return 'far';
  return null;
}

export interface DatedStep {
  step: ProgramStep;
  at: Date;
  /** Chwila już minęła (start dziś) — zalecenie pójdzie od razu. */
  now: boolean;
}

/** Program rozpisany na daty od dnia `start`, po kolei. Kroki z błędną datą odpadają. */
export function datedSteps(steps: readonly ProgramStep[], start: string, now: number = Date.now()): DatedStep[] {
  return sortSteps(steps)
    .flatMap((step) => {
      const at = stepAt(start, step.day, step.time);
      return at ? [{ step, at, now: at.getTime() <= now }] : [];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/* ── Odbiorcy ────────────────────────────────────────────────────────────────────── */

/** Obszary tego podopiecznego, w których może dostać ten rodzaj (w kolejności jego obszarów). */
export const areasFor = (c: Pick<Connection, 'areas'>, kind: AssignmentKind): Area[] => c.areas.filter((a) => KINDS_BY_AREA[a].includes(kind));

/**
 * Obszar, w którym ten podopieczny dostanie ten rodzaj: `prefer`, jeśli go ma i rodzaj tam pasuje,
 * a inaczej pierwszy z jego obszarów, który na to pozwala.
 */
export function areaFor(c: Pick<Connection, 'areas'>, kind: AssignmentKind, prefer: Area | null = null): Area | null {
  const ok = areasFor(c, kind);
  return prefer && ok.includes(prefer) ? prefer : (ok[0] ?? null);
}

/**
 * Wysyłka do wielu: obszary do wyboru raz dla całej partii — tylko gdy ktoś z odbiorców może dostać
 * któryś z rodzajów w dwóch obszarach albo więcej (inaczej wybór niczego nie zmienia). Kolejność jak `AREAS`.
 */
export function batchAreas(list: readonly Pick<Connection, 'areas' | 'status'>[], kinds: readonly AssignmentKind[]): Area[] {
  const out = new Set<Area>();
  for (const c of list) {
    if (c.status !== 'active') continue;
    for (const k of kinds) {
      const ok = areasFor(c, k);
      if (ok.length > 1) ok.forEach((a) => out.add(a));
    }
  }
  return AREAS.filter((a) => out.has(a));
}

export type SkipReason = 'ended' | 'kind';

type Recipient = Pick<Connection, 'id' | 'areas' | 'status'>;

/**
 * Wysyłka do wielu: komu i w jakim obszarze, a kogo pominąć i dlaczego. Każdy raz, w kolejności z listy.
 * `prefer` — obszar wybrany raz dla całej partii (gdy podopieczny go nie ma — jego pierwszy pasujący).
 */
export function planRecipients<C extends Recipient>(
  list: readonly C[],
  kind: AssignmentKind,
  prefer: Area | null = null,
): { send: { c: C; area: Area }[]; skip: { c: C; reason: SkipReason }[] } {
  const send: { c: C; area: Area }[] = [];
  const skip: { c: C; reason: SkipReason }[] = [];
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (c.status !== 'active') {
      skip.push({ c, reason: 'ended' });
      continue;
    }
    const area = areaFor(c, kind, prefer);
    if (area) send.push({ c, area });
    else skip.push({ c, reason: 'kind' });
  }
  return { send, skip };
}

export type StepSkip = 'missing' | 'kind' | 'invalid';

export interface LaunchTask extends DatedStep {
  item: LibraryItem | null;
  area: Area | null;
  /** Dlaczego ten krok nie pójdzie do tego podopiecznego; `null` — pójdzie. */
  skip: StepSkip | null;
}

/**
 * Uruchomienie programu dla jednego podopiecznego: każdy krok z elementem, obszarem i powodem
 * pominięcia. `valid` sprawdza treść tak jak telefon (w komponencie: `parseAssignment`); `prefer` —
 * obszar wybrany raz dla całej partii.
 */
export function planLaunch(
  c: Pick<Connection, 'areas'>,
  dated: readonly DatedStep[],
  items: readonly LibraryItem[],
  valid: (item: LibraryItem, area: Area) => boolean = () => true,
  prefer: Area | null = null,
): LaunchTask[] {
  return dated.map((d) => {
    const item = items.find((i) => i.id === d.step.itemId && i.kind !== 'program') ?? null;
    if (!item || item.kind === 'program') return { ...d, item: null, area: null, skip: 'missing' };
    const area = areaFor(c, item.kind, prefer);
    if (!area) return { ...d, item, area: null, skip: 'kind' };
    return { ...d, item, area, skip: valid(item, area) ? null : 'invalid' };
  });
}

/* ── Stałe daty w treści wysyłanej później ───────────────────────────────────────── */

/**
 * - `expired` — lista nawyków ma datę końca przed dniem, w którym podopieczny ją dostanie;
 * - `started` — jadłospis ma stały dzień startu przed tym dniem: podopieczny zacznie od dnia `dayIndex`
 *   cyklu (liczonego od 0), nie od pierwszego.
 */
export type DateIssue = { kind: 'expired'; until: string } | { kind: 'started'; start: string; dayIndex: number };

/**
 * Treść z biblioteki ze stałą datą, która w dniu wypuszczenia (`releaseDay`, kalendarz przeglądarki)
 * już minęła. Nic nie blokuje — prowadzący dostaje ostrzeżenie zamiast cicho wysłanej przeterminowanej listy.
 */
export function dateIssue(body: LibraryBody | null | undefined, releaseDay: string): DateIssue | null {
  if (!body) return null;
  if (body.kind === 'habits' && body.until && body.until < releaseDay) return { kind: 'expired', until: body.until };
  if (body.kind === 'meals' && body.start && body.start < releaseDay && body.days.length) {
    // Wypada akurat na początek cyklu — podopieczny i tak zaczyna od pierwszego dnia.
    const dayIndex = daysBetween(body.start, releaseDay) % body.days.length;
    return dayIndex ? { kind: 'started', start: body.start, dayIndex } : null;
  }
  return null;
}

/* ── Słowa o czasie ──────────────────────────────────────────────────────────────── */

/** „3 grudnia, 7:00” (z rokiem, gdy nie bieżący). */
export function fmtWhen(at: Date, now: Date | number = Date.now()): string {
  const year = at.getFullYear() !== new Date(now).getFullYear();
  const date = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) }).format(at);
  const time = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' }).format(at);
  return `${date}, ${time}`;
}

/** „3 grudnia” dla dnia `RRRR-MM-DD` (data z treści albo z pola daty — bez przesunięcia strefy). */
export function fmtCalendarDay(day: string): string {
  const p = parseDay(day);
  return p ? new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' }).format(new Date(p[0], p[1] - 1, p[2])) : day;
}

/** „czw., 3 grudnia” — dzień w podglądzie harmonogramu. */
export const fmtDay = (at: Date): string => new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long' }).format(at);

export const fmtTime = (at: Date): string => new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' }).format(at);
