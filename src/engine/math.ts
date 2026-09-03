import { EFFORT } from '../data/exercises';
import { dayKey, daysBetween } from './schedule';
import type { AppState, EffortKey, LogEntry } from '../types';

export const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Wzór Epleya: 1RM = ciężar × (1 + powtórzenia / 30).
 * Wiarygodny mniej więcej do dziesięciu powtórzeń, dalej zaczyna zawyżać.
 */
export const epley = (w: number, r: number): number => w * (1 + r / 30);

/** Odwrócony Epley: ile powtórzeń na nowym ciężarze przy znanym maksimum. */
export const repsAt = (e1rm: number, w: number): number => Math.floor(30 * (e1rm / w - 1));

/**
 * Szacowane maksimum z serii sesji. Seria zakończona z zapasem dwóch powtórzeń
 * odpowiada serii o dwa powtórzenia dłuższej, dlatego zapas wchodzi do wzoru.
 */
export function e1rmFromSession(w: number, reps: number[], effort: EffortKey): number {
  const rir = EFFORT[effort]?.rir ?? 1.5;
  const best = Math.max(...reps);
  return round1(epley(w, best + rir));
}

/** Tonaż sesji. Liczony tylko z ćwiczeń z ciężarem — reszty nie da się uczciwie przeliczyć. */
export function sessionTonnage(entry: LogEntry): number {
  return entry.items.reduce(
    (sum, it) => sum + it.sets.reduce((s, x) => s + (x.w ?? 0) * (x.reps || 0), 0),
    0,
  );
}

/**
 * Stosunek obciążenia ostrego (7 dni) do przewlekłego (średnia tygodniowa z 28 dni).
 * Zakres 0,8–1,3 uchodzi w literaturze za bezpieczny, powyżej 1,5 rośnie ryzyko
 * przeciążenia. Wskaźnik bywa krytykowany, więc to sygnał ostrzegawczy, nie wyrocznia.
 */
export function acwr(state: AppState, now: number = Date.now()): number | null {
  const log = state.log;
  if (log.length < 4) return null;
  const first = new Date(log[0]!.date).getTime();
  if ((now - first) / 86_400_000 < 14) return null;

  const within = (days: number): number =>
    log
      .filter((e) => now - new Date(e.date).getTime() <= days * 86_400_000)
      .reduce((s, e) => s + sessionTonnage(e), 0);

  const chronic = within(28) / 4;
  if (chronic <= 0) return null;
  return round1(within(7) / chronic);
}

/**
 * Przerwa liczona w dniach kalendarzowych, a nie w pełnych dobach. Trening wczoraj wieczorem
 * i pytanie dziś rano to jeden dzień przerwy, nie zero — inaczej banery i progi przerwy
 * mówiłyby co innego niż kalendarz planu.
 */
export function daysSince(state: AppState, now: number = Date.now()): number | null {
  const last = state.log[state.log.length - 1];
  if (!last) return null;
  return Math.max(0, daysBetween(dayKey(last.date), dayKey(now)));
}

/** Średnia liczba sesji na tydzień z ostatnich czterech tygodni. */
export function weeklyRate(state: AppState, now: number = Date.now()): number | null {
  const recent = state.log.filter((e) => now - new Date(e.date).getTime() <= 28 * 86_400_000);
  if (recent.length < 2) return null;
  const span = Math.max(7, (now - new Date(recent[0]!.date).getTime()) / 86_400_000);
  return (recent.length / span) * 7;
}
