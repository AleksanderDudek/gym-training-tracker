import type { AppState, ExerciseId, LogEntry, Session } from '../types';

/**
 * Notatki do treningu i do ćwiczenia.
 *
 * Notatka ćwiczenia to zwykle rzecz do zapamiętania na następny raz — „wyżej siodełko”,
 * „chwyt szerzej”, „lewe kolano ucieka” — więc wraca przy kolejnej sesji tego ćwiczenia jako
 * „Ostatnio: …”. Notatka treningu mówi o całym dniu („po nocce”, „siłownia pełna”).
 *
 * Obie leżą w dzienniku treningów (`LogEntry.note`, `LogItem.note`), więc same wchodzą do kopii
 * zapasowej i znikają z „Usuń wszystkie dane”. W trakcie sesji notatki ćwiczeń czekają w sesji
 * (`Session.notes`) i trafiają do dziennika razem z wynikiem przy zamknięciu treningu.
 */

/** Najdłuższa notatka. Pięćset znaków to kilka zdań — dość na wskazówkę, za mało na dziennik. */
export const NOTE_MAX = 500;

/**
 * Notatka do zapisu: tekst bez spacji na brzegach i przycięty do `NOTE_MAX`. Pusta albo nie-tekst
 * to brak notatki (`undefined`) — w zapisie nie zostaje puste pole.
 */
export function cleanNote(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  // Przycięcie po znakach, nie po jednostkach UTF-16: emoji na granicy nie rozpada się na pół.
  const chars = [...t];
  return chars.length > NOTE_MAX ? chars.slice(0, NOTE_MAX).join('').trimEnd() : t;
}

/** Ustawia albo usuwa pole `note` obiektu — bez zostawiania `note: undefined` w zapisie. */
function put(o: { note?: string }, v: unknown): void {
  const n = cleanNote(v);
  if (n === undefined) delete o.note;
  else o.note = n;
}

/**
 * Przesiewa notatki w dzienniku i w trwającej sesji przy wczytaniu i imporcie: liczba, obiekt
 * albo pusty tekst odpadają, reszta jest przycinana. Trening i wynik zostają bez zmian.
 */
export function restoreNotes(state: Pick<AppState, 'log' | 'session'>): void {
  state.log.forEach((e) => {
    if (!e || typeof e !== 'object') return;
    if ('note' in e) put(e, e.note);
    if (Array.isArray(e.items))
      e.items.forEach((i) => {
        if (i && typeof i === 'object' && 'note' in i) put(i, i.note);
      });
  });
  const s = state.session;
  if (s && s.notes !== undefined) {
    const raw: unknown = s.notes;
    const ok =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? Object.entries(raw as Record<string, unknown>)
            .map(([id, v]) => [id, cleanNote(v)] as const)
            .filter((x): x is readonly [string, string] => x[1] !== undefined)
        : [];
    if (ok.length) s.notes = Object.fromEntries(ok);
    else delete s.notes;
  }
}

/** Notatka ćwiczenia w trwającej sesji: zapis, a pusty tekst ją usuwa. */
export function setSessionNote(session: Session, id: ExerciseId, v: string): void {
  const n = cleanNote(v);
  const notes = { ...(session.notes ?? {}) };
  if (n === undefined) delete notes[id];
  else notes[id] = n;
  if (Object.keys(notes).length) session.notes = notes;
  else delete session.notes;
}

/** Notatka ćwiczenia ze zwykłego odczytu sesji — pusty tekst, gdy jej nie ma. */
export const sessionNote = (session: Session | null, id: ExerciseId): string => session?.notes?.[id] ?? '';

/**
 * Ostatnia notatka ćwiczenia z dziennika: z najpóźniejszej sesji, w której ją wpisano — nie
 * tylko z ostatniej sesji, bo „wyżej siodełko” obowiązuje, dopóki ktoś go nie zmieni.
 */
export function lastNote(log: readonly LogEntry[], id: ExerciseId): { note: string; date: string } | null {
  let best: { note: string; date: string } | null = null;
  for (const e of log) {
    const note = e.items.find((i) => i.id === id && i.note)?.note;
    if (note && (!best || e.date > best.date)) best = { note, date: e.date };
  }
  return best;
}

/** Wpis dziennika po dacie zapisu — chwila z milisekundami jest jego kluczem w historii. */
const entryAt = (state: AppState, date: string): LogEntry | undefined => state.log.find((e) => e.date === date);

/**
 * Zmiana notatek zapisanego treningu: notatka całości i ćwiczeń naraz, jak w edycji w historii.
 * Ćwiczenie spoza wpisu jest pomijane. Zwraca, czy wpis się znalazł.
 */
export function setLogNotes(
  state: AppState,
  date: string,
  notes: { note?: string; items?: Partial<Record<ExerciseId, string>> },
): boolean {
  const e = entryAt(state, date);
  if (!e) return false;
  if ('note' in notes) put(e, notes.note);
  Object.entries(notes.items ?? {}).forEach(([id, v]) => {
    const item = e.items.find((i) => i.id === id);
    if (item) put(item, v);
  });
  return true;
}
