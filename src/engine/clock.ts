import type { Block } from './blocks';
import { loggedSets } from './steps';
import type { Step } from './steps';
import type { ExerciseId, LogEntry, LogTime, LogTimePart, Session, SessionClock, Workout } from '../types';

/**
 * Zegar sesji: ile naprawdę trwa trening i ile mija między ćwiczeniami.
 *
 * **Część** to blok treningu — ćwiczenie seriami pod rząd, para albo obwód. Para i obwód
 * przeplatają ćwiczenia z założenia, więc mierzenie ich osobno wymyślałoby liczby.
 *
 * **Start** treningu to „Zaczynam” po gotowości i rozgrzewce (w widoku listy — start sesji),
 * start kolejnej części to stuknięcie „Start: …” na karcie przejścia. **Koniec** części to
 * ostatnia seria albo pominięcie tego, co w niej zostało. **Przejście** to start następnej
 * części minus koniec poprzedniej — chodzenie do stojaka, nakładanie talerzy. Mierzy się tylko
 * dlatego, że start następnej części to chwila, którą ćwiczący sam zaznacza.
 *
 * Pauzy nie ma: prawdziwy trening ma przerwy, a pytanie brzmi, ile trwa naprawdę. Wszystko
 * zapisane jako chwile w ms, więc odświeżenie strony ani zgaszony ekran niczego nie gubią.
 */

/** Krótszy trening to raczej stuknięcie „Zaczynam” i od razu zamknięcie — nie liczy się do statystyk. */
export const TIMED_MIN = 3 * 60;
/** Dłuższy to zwykle zapomniane „Zamknij trening” — rekord z 14 godzin nikomu nie służy. */
export const TIMED_MAX = 4 * 3600;
/** Przejście do tylu sekund liczy się jako płynne. */
export const SMOOTH_GAP = 4 * 60;

/** Przejście przed częścią: część, przed którą wypadło, i ile trwało. */
export interface Gap {
  block: number;
  ex: ExerciseId[];
  secs: number;
}

/**
 * Start zegara — „Zaczynam” w prowadzeniu (razem z pierwszą częścią) albo pierwszy zapis
 * w widoku listy (bez części, bo lista nie ma przycisku startu). Zegar raz puszczony zostaje.
 */
export function startClock(s: Session, now: number, firstBlock: number | null): void {
  if (s.clock) return;
  s.clock = { begin: now, parts: firstBlock === null ? {} : { [firstBlock]: { start: now } } };
}

/**
 * Start części — „Start: …” na karcie przejścia. Wcześniejszego startu nie przesuwa: część
 * otwarta znów cofnięciem serii trwa od pierwszego startu. Bez zegara zakłada go od tej chwili.
 */
export function startPart(s: Session, block: number, now: number): void {
  s.clock ??= { begin: now, parts: {} };
  const p = s.clock.parts[block] ?? {};
  s.clock.parts[block] = { ...p, start: p.start ?? now };
}

/** Czy w bloku nic już nie czeka: każde ćwiczenie pominięte, zamknięte albo z kompletem serii. */
export const blockDone = (steps: readonly Step[], s: Session, block: number): boolean =>
  steps
    .filter((st) => st.block === block)
    .every((st) => s.skip[st.ex] || s.done[st.ex] || loggedSets(s, st.ex) >= st.set);

/**
 * Po każdej zmianie w bloku: koniec części, gdy blok się domknął, albo zdjęcie końca, gdy
 * cofnięcie serii otworzyło go z powrotem. Koniec raz zapisany się nie przesuwa — ocena zapasu
 * po ostatniej serii to już nie praca.
 *
 * Część bez startu i bez żadnego wyniku — pominięta w całości, zanim się zaczęła — końca nie
 * dostaje: nic się w niej nie wydarzyło, więc w historii byłaby pustą pozycją.
 */
export function settlePart(s: Session, steps: readonly Step[], block: number, now: number): void {
  if (!s.clock) return;
  const p = s.clock.parts[block] ?? {};
  const ids = steps.filter((st) => st.block === block).map((st) => st.ex);
  const happened = p.start !== undefined || ids.some((id) => !s.skip[id] && (s.done[id] || loggedSets(s, id) > 0));
  if (happened && blockDone(steps, s, block)) s.clock.parts[block] = { ...p, end: p.end ?? now };
  else if (p.end !== undefined) {
    if (p.start === undefined) delete s.clock.parts[block];
    else s.clock.parts[block] = { start: p.start };
  }
}

/**
 * Rozliczenie części po zmianie w podanych ćwiczeniach — raz na blok, nawet gdy zmiana dotyczy
 * obu ćwiczeń pary. Ćwiczenia spoza dzisiejszej kolejki nie mają części, więc nic nie zmieniają.
 */
export function settleExercises(s: Session, steps: readonly Step[], ids: readonly ExerciseId[], now: number): void {
  const blocks = new Set(ids.map((id) => steps.find((st) => st.ex === id)?.block));
  blocks.forEach((b) => {
    if (b !== undefined) settlePart(s, steps, b, now);
  });
}

/**
 * Zegar z widoku listy: lista nie ma „Zaczynam”, więc trening liczy się od startu sesji —
 * dopiero przy pierwszym zapisanym wyniku, bo samo pominięcie albo wyczyszczenie to nie trening.
 * Start z zepsutą datą albo z przyszłości (przestawiony zegar telefonu) — od teraz.
 */
export function startListClock(s: Session, now: number): void {
  const t = Date.parse(s.started);
  startClock(s, Number.isFinite(t) && t <= now ? t : now, null);
}

/**
 * Część, która czeka na „Start”: blok kursora bez zaznaczonego początku. Sesja bez zegara
 * (sprzed niego albo przed „Zaczynam”) nie czeka na nic — idzie dawnym trybem.
 */
export function waitingPart(s: Session, steps: readonly Step[], cursor: number): number | null {
  if (!s.clock || cursor < 0) return null;
  const block = steps[cursor]?.block;
  if (block === undefined) return null;
  return s.clock.parts[block]?.start === undefined ? block : null;
}

/**
 * Koniec, od którego liczy się przejście do chwili `at`: najpóźniejszy koniec nie późniejszy niż
 * ona. Każdy koniec, także części z widoku listy (bez startu), zamyka poprzednie przejście —
 * inaczej czas pracy w liście wpadłby do przejścia. `null` — przed tą chwilą nic się nie skończyło.
 */
export function lastEnd(ends: readonly number[], at: number): number | null {
  return ends.reduce<number | null>((m, e) => (e <= at && (m === null || e > m) ? e : m), null);
}

/** Chwila, od której liczy się trwające przejście na karcie przejścia — ta sama reguła co w dzienniku. */
export function waitingSince(s: Session, now: number): number | null {
  if (!s.clock) return null;
  const ends = Object.values(s.clock.parts).flatMap((p) => (p.end !== undefined ? [p.end] : []));
  return lastEnd(ends, now);
}

/**
 * Czas do dziennika: sekundy od startu, części po kolei. Część nieruszona wypada, niedokończona
 * kończy się teraz (trening zamknięty w jej trakcie), a ta z końcem przed startem — błąd zegara
 * telefonu — odpada, zamiast dać ujemne liczby.
 */
export function timeOf(s: Session, blocks: readonly Block[], now: number): LogTime | null {
  const c = s.clock;
  if (!c) return null;
  const sec = (ms: number) => Math.max(0, Math.round((ms - c.begin) / 1000));
  const parts: LogTimePart[] = [];
  blocks.forEach((b) => {
    const p = c.parts[b.n];
    if (!p || (p.start === undefined && p.end === undefined)) return;
    const end = p.end ?? now;
    if (p.start !== undefined && end < p.start) return;
    // Nazwa części to ćwiczenia naprawdę zrobione: pominięte z pary wypada. Cała pominięta po starcie
    // zostaje z pełną nazwą — czas przy stanowisku był, a pusta nazwa nic by nie mówiła.
    const done = b.ids.filter((id) => !s.skip[id]);
    const ex = done.length ? done : [...b.ids];
    parts.push({ block: b.n, ex, ...(p.start !== undefined ? { at: sec(p.start) } : {}), end: sec(end) });
  });
  parts.sort((a, b) => (a.at ?? a.end) - (b.at ?? b.end) || a.end - b.end);
  return { secs: sec(now), parts };
}

/**
 * Przejście przed każdą częścią z zaznaczonym startem: od najpóźniejszego końca innej części
 * nie późniejszego niż ten start (`lastEnd`). Część z widoku listy nie ma startu, więc przejścia
 * przed nią nie ma — lepiej żadna liczba niż zmyślona — ale jej koniec zamyka przejście przed
 * następną. Ujemnych nie ma: część zaczęta przed końcem poprzedniej (cofnięta seria) nie ma
 * przed sobą żadnego końca i przejścia nie dostaje.
 */
export function transitions(t: LogTime): Gap[] {
  const out: Gap[] = [];
  t.parts.forEach((p) => {
    if (p.at === undefined) return;
    const from = lastEnd(
      t.parts.filter((q) => q !== p).map((q) => q.end),
      p.at,
    );
    if (from !== null) out.push({ block: p.block, ex: p.ex, secs: p.at - from });
  });
  return out;
}

/** Podsumowanie treningu: całość, czas w częściach, suma przejść i najdłuższe z nich. */
export function summary(t: LogTime): { secs: number; work: number; gaps: number; longest: Gap | null } {
  const work = t.parts.reduce((n, p) => n + (p.at !== undefined ? p.end - p.at : 0), 0);
  const gaps = transitions(t);
  const longest = gaps.reduce<Gap | null>((m, g) => (!m || g.secs > m.secs ? g : m), null);
  return { secs: t.secs, work, gaps: gaps.reduce((n, g) => n + g.secs, 0), longest };
}

/** Czy czas treningu liczy się do statystyk i odznak: od 3 minut do 4 godzin. */
export const timed = (t: LogTime | null | undefined): t is LogTime => !!t && t.secs >= TIMED_MIN && t.secs <= TIMED_MAX;

/**
 * Średni czas tego treningu z ostatnich (najwyżej `last`) zapisów z policzonym czasem — obok
 * szacunku w podglądzie, bo do planowania dnia liczy się, ile trwa naprawdę. Wpisy sprzed
 * identyfikatora treningu pasują po nazwie, jak w przerwach po rundzie.
 */
export function averageTime(log: readonly LogEntry[], w: Pick<Workout, 'id' | 'name'>, last = 5): { secs: number; n: number } | null {
  const mine = log
    .filter((e) => (e.wid ? e.wid === w.id : e.workout === w.name) && timed(e.time))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-last);
  if (!mine.length) return null;
  return { secs: Math.round(mine.reduce((n, e) => n + e.time!.secs, 0) / mine.length), n: mine.length };
}

const moment = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Zegar z zapisu: start i części z chwilami — liczbami albo bez nich. Część z końcem przed
 * startem przechodzi (to bywa przestawiony zegar telefonu), a `timeOf` ją pomija; tekst,
 * `NaN` albo ujemna chwila to już zepsuty zapis i cały zegar odpada.
 */
export function validClock(c: unknown): c is SessionClock {
  if (!c || typeof c !== 'object') return false;
  const { begin, parts } = c as { begin?: unknown; parts?: unknown };
  if (!moment(begin) || !parts || typeof parts !== 'object' || Array.isArray(parts)) return false;
  return Object.values(parts).every((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const { start, end } = p as { start?: unknown; end?: unknown };
    return (start === undefined || moment(start)) && (end === undefined || moment(end));
  });
}

/**
 * Czas treningu z dziennika: sekundy i części z numerem bloku, ćwiczeniami i sekundami. Dziennik
 * pisze tylko `timeOf`, który nie zostawia ujemnych ani odwróconych części — taki wpis jest
 * zepsuty i traci czas (sam trening zostaje w historii).
 */
export function validLogTime(t: unknown): t is LogTime {
  if (!t || typeof t !== 'object') return false;
  const { secs, parts } = t as { secs?: unknown; parts?: unknown };
  if (!moment(secs) || !Array.isArray(parts)) return false;
  return parts.every((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const { block, ex, at, end } = p as { block?: unknown; ex?: unknown; at?: unknown; end?: unknown };
    return (
      moment(block) &&
      moment(end) &&
      (at === undefined || (moment(at) && at <= end)) &&
      Array.isArray(ex) &&
      ex.every((x) => typeof x === 'string')
    );
  });
}

/** „45 s”, „12 min”, „1 h 05 min” — czas treningu słowami, do minuty. */
export function durationText(secs: number): string {
  if (secs < 60) return `${secs} s`;
  const min = Math.round(secs / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
