import { ex } from '../data/exercises';
import { e1rmFromSession } from './math';
import type { AppState, EffortKey, ExerciseId, LogEntry } from '../types';

/**
 * Historia w przekroju ćwiczenia, a nie sesji.
 *
 * Dziennik (`state.log`) trzyma zapisy ułożone po treningach: jeden wpis, w nim kilka
 * ćwiczeń. Profil pyta odwrotnie — „co się działo z przysiadem przez pół roku” — więc
 * te same dane trzeba przewrócić na drugą stronę. Liczone jest to z dziennika, a nie
 * z `prog[id].hist`, bo dziennik jest źródłem: `hist` bywa przycinany przez silnik
 * progresji, a tutaj chodzi o całość.
 */

export interface ExerciseRow {
  date: string;
  /** Najcięższy ciężar w tej sesji. `null` przy ćwiczeniach z masą ciała. */
  w: number | null;
  /** Wyniki wszystkich serii: powtórzenia albo sekundy, zależnie od ćwiczenia. */
  reps: number[];
  total: number;
  /** Kilogramy razy powtórzenia. Sekundy nie wchodzą — to inna jednostka. */
  tonnage: number;
  effort: EffortKey;
  /** Szacowane maksimum z najcięższej serii. `null`, gdy ciężaru nie ma. */
  e1rm: number | null;
}

const rowFrom = (entry: LogEntry, id: ExerciseId): ExerciseRow | null => {
  const item = entry.items.find((i) => i.id === id);
  if (!item || !item.sets.length) return null;

  const reps = item.sets.map((s) => s.reps);
  const weights = item.sets.map((s) => s.w).filter((w): w is number => w !== null && w > 0);
  const w = weights.length ? Math.max(...weights) : null;
  // Powtórzenia serii wykonanych najcięższym ciężarem — tylko one mówią coś o maksimum.
  const top = w === null ? [] : item.sets.filter((s) => s.w === w).map((s) => s.reps);

  return {
    date: entry.date,
    w,
    reps,
    total: reps.reduce((a, b) => a + b, 0),
    tonnage: item.sets.reduce((a, s) => a + s.reps * (s.w ?? 0), 0),
    effort: item.effort,
    e1rm: w !== null && top.length ? Math.round(e1rmFromSession(w, top, item.effort)) : null,
  };
};

/** Wszystkie sesje z danym ćwiczeniem, od najstarszej. */
export function exerciseRows(state: AppState, id: ExerciseId): ExerciseRow[] {
  return state.log
    .map((e) => rowFrom(e, id))
    .filter((r): r is ExerciseRow => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExerciseSummary {
  id: ExerciseId;
  sessions: number;
  first: string;
  last: string;
  /** Suma powtórzeń albo sekund — zależnie od jednostki ćwiczenia. */
  total: number;
  tonnage: number;
  /** Najlepsza pojedyncza seria i najcięższy użyty ciężar. */
  bestSet: number;
  bestWeight: number | null;
  e1rm: number | null;
  /** Ciąg do wykresu: szacowane maksimum, a przy jego braku wynik sesji. */
  series: number[];
}

const summarize = (id: ExerciseId, rows: ExerciseRow[]): ExerciseSummary => {
  const withE1rm = rows.filter((r) => r.e1rm !== null);
  const weights = rows.map((r) => r.w).filter((w): w is number => w !== null);
  return {
    id,
    sessions: rows.length,
    first: rows[0]!.date,
    last: rows[rows.length - 1]!.date,
    total: rows.reduce((a, r) => a + r.total, 0),
    tonnage: rows.reduce((a, r) => a + r.tonnage, 0),
    bestSet: Math.max(...rows.flatMap((r) => r.reps)),
    bestWeight: weights.length ? Math.max(...weights) : null,
    e1rm: withE1rm.length ? Math.max(...withE1rm.map((r) => r.e1rm!)) : null,
    // Wykres liczy się z tej samej wielkości od początku do końca. Mieszanie maksimum
    // z powtórzeniami dałoby linię, która skacze przy każdej zmianie ciężaru.
    series: withE1rm.length >= 3 ? withE1rm.map((r) => r.e1rm!) : rows.map((r) => r.total),
  };
};

/**
 * Ćwiczenia, które kiedykolwiek pojawiły się w dzienniku — od najczęstszego.
 * Lista bierze się z historii, a nie z katalogu: profil ma pokazywać przeszłość,
 * a nie to, co jeszcze można by zrobić.
 */
export function doneExercises(state: AppState): ExerciseSummary[] {
  const ids = new Set<ExerciseId>();
  state.log.forEach((e) => e.items.forEach((i) => ids.add(i.id)));

  return [...ids]
    .map((id) => {
      const rows = exerciseRows(state, id);
      return rows.length ? summarize(id, rows) : null;
    })
    .filter((s): s is ExerciseSummary => s !== null)
    .sort((a, b) => b.sessions - a.sessions || b.last.localeCompare(a.last));
}

export type TrendDir = 'up' | 'down' | 'flat';

export interface Trend {
  dir: TrendDir;
  /** Zmiana w procentach między początkiem a końcem okresu. */
  pct: number;
  /** Na czym liczona: szacowane maksimum, powtórzenia albo sekundy. */
  metric: 'e1rm' | 'reps' | 'secs';
  from: number;
  to: number;
  /** Ile sesji weszło do porównania po każdej stronie. */
  span: number;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Kierunek zmiany: średnia z pierwszej tercji sesji kontra średnia z ostatniej.
 *
 * Pojedyncze sesje skaczą — gorszy sen, cięższy dzień, inny sprzęt — więc porównywanie
 * pierwszego wyniku z ostatnim opowiadałoby głównie o szumie. Tercje wygładzają, a próg
 * pięciu procent oddziela realną zmianę od wahania. Poniżej czterech sesji nie ma czego
 * porównywać i funkcja mówi to wprost, zamiast zgadywać.
 */
export function trend(rows: ExerciseRow[], id: ExerciseId): Trend | null {
  if (rows.length < 4) return null;

  const useE1rm = rows.filter((r) => r.e1rm !== null).length >= 4;
  const src = useE1rm ? rows.filter((r) => r.e1rm !== null) : rows;
  const value = (r: ExerciseRow): number => (useE1rm ? r.e1rm! : r.total);
  if (src.length < 4) return null;

  const cut = Math.max(1, Math.floor(src.length / 3));
  const from = mean(src.slice(0, cut).map(value));
  const to = mean(src.slice(-cut).map(value));
  const pct = from === 0 ? 0 : ((to - from) / from) * 100;

  return {
    dir: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat',
    pct: Math.round(pct),
    metric: useE1rm ? 'e1rm' : ex(id).unit === 'secs' ? 'secs' : 'reps',
    from: Math.round(from),
    to: Math.round(to),
    span: cut,
  };
}

/** Ile tygodni dzieli pierwszy zapis od ostatniego. Zero znaczy „wszystko w jednym tygodniu”. */
export function weeksBetween(first: string, last: string): number {
  const ms = new Date(last).getTime() - new Date(first).getTime();
  return Math.max(0, Math.round(ms / (7 * 24 * 3600 * 1000)));
}
