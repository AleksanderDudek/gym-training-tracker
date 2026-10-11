import type { Block } from './blocks';
import { loggedSets } from './steps';
import type { Step } from './steps';
import type { ExerciseId, LogTime, LogTimePart, Session } from '../types';

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
 */
export function settlePart(s: Session, steps: readonly Step[], block: number, now: number): void {
  if (!s.clock) return;
  const p = s.clock.parts[block] ?? {};
  if (blockDone(steps, s, block)) s.clock.parts[block] = { ...p, end: p.end ?? now };
  else if (p.end !== undefined) {
    const open = { ...p };
    delete open.end;
    s.clock.parts[block] = open;
  }
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
    parts.push({ block: b.n, ex: [...b.ids], ...(p.start !== undefined ? { at: sec(p.start) } : {}), end: sec(end) });
  });
  parts.sort((a, b) => (a.at ?? a.end) - (b.at ?? b.end) || a.end - b.end);
  return { secs: sec(now), parts };
}

/**
 * Przejścia między kolejnymi częściami z zaznaczonym startem. Część z widoku listy nie ma
 * startu, więc przejścia przed nią nie ma — lepiej żadna liczba niż zmyślona. Ujemnych też nie
 * ma: część zaczęta przed końcem poprzedniej to cofnięcie serii, nie przejście.
 */
export function transitions(t: LogTime): Gap[] {
  const started = t.parts.filter((p) => p.at !== undefined);
  const out: Gap[] = [];
  for (let i = 1; i < started.length; i++) {
    const gap = started[i]!.at! - started[i - 1]!.end;
    if (gap >= 0) out.push({ block: started[i]!.block, ex: started[i]!.ex, secs: gap });
  }
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
export const timed = (t: LogTime | undefined): t is LogTime => !!t && t.secs >= TIMED_MIN && t.secs <= TIMED_MAX;

/** „45 s”, „12 min”, „1 h 05 min” — czas treningu słowami, do minuty. */
export function durationText(secs: number): string {
  if (secs < 60) return `${secs} s`;
  const min = Math.round(secs / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
