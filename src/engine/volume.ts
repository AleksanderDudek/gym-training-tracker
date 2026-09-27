import type { ExerciseId, LogEntry, Snack } from '../types';
import { dayKey, mondayOf } from './schedule';

/**
 * Objętość w przekroju jednego ćwiczenia: ile razy zrobione dziś, w tym tygodniu, w tym
 * miesiącu i od początku — z treningów i przekąsek razem, bo pompka zrobiona przy biurku
 * jest tą samą pompką, co w treningu.
 *
 * Okresy są kalendarzowe, nie przesuwane: tydzień od poniedziałku do niedzieli, miesiąc
 * od pierwszego. Tylko wtedy da się uczciwie pokazać „w tym tygodniu brakuje ci 20”, a nowy
 * tydzień zaczyna się od zera i od nowa daje szansę. Rekordy przesuwanego okna mają już
 * swoje miejsce w odznakach „Szczyty”.
 *
 * Liczone jest to, co wpisane: przy ćwiczeniu na stronę — powtórzenia na stronę, przy
 * ćwiczeniu na czas — sekundy. Suma w dorobku liczy strony podwójnie, ale tu człowiek
 * porównuje się z tym, co sam wpisuje w formularz.
 */

export type Period = 'dzien' | 'tydzien' | 'miesiac';

export const PERIODS: Period[] = ['dzien', 'tydzien', 'miesiac'];

export interface ExVolume {
  total: number;
  /** Suma na dzień `yyyy-mm-dd`. */
  byDay: Record<string, number>;
  /** Najlepszy dzień, tydzień i miesiąc kalendarzowy. */
  best: Record<Period, number>;
  /** Ile treningów miało to ćwiczenie i ile było przekąsek. */
  sessions: number;
  snacks: number;
}

/** Klucz okresu, do którego należy dzień: sam dzień, poniedziałek tygodnia albo `yyyy-mm`. */
export const periodKey = (day: string, p: Period): string =>
  p === 'dzien' ? day : p === 'tydzien' ? mondayOf(day) : day.slice(0, 7);

const empty = (): ExVolume => ({
  total: 0,
  byDay: {},
  best: { dzien: 0, tydzien: 0, miesiac: 0 },
  sessions: 0,
  snacks: 0,
});

export function exerciseVolumes(log: LogEntry[], snacks: Snack[]): Record<ExerciseId, ExVolume> {
  const out: Record<ExerciseId, ExVolume> = {};
  const add = (id: ExerciseId, day: string, n: number): ExVolume => {
    const v = (out[id] ??= empty());
    v.total += n;
    v.byDay[day] = (v.byDay[day] ?? 0) + n;
    return v;
  };

  log.forEach((e) => {
    const day = dayKey(e.date);
    e.items.forEach((it) => {
      const n = it.sets.reduce((a, s) => a + Math.max(0, s.reps), 0);
      if (n <= 0) return;
      add(it.id, day, n).sessions++;
    });
  });

  snacks.forEach((s) => {
    if (s.reps <= 0) return;
    add(s.ex, dayKey(s.at), s.reps).snacks++;
  });

  Object.values(out).forEach((v) => {
    (['tydzien', 'miesiac'] as const).forEach((p) => {
      const sums = new Map<string, number>();
      Object.entries(v.byDay).forEach(([d, n]) => {
        const k = periodKey(d, p);
        sums.set(k, (sums.get(k) ?? 0) + n);
      });
      v.best[p] = Math.max(0, ...sums.values());
    });
    v.best.dzien = Math.max(0, ...Object.values(v.byDay));
  });

  return out;
}

/** Ile zrobione w okresie, w którym leży `today` — dziś, w tym tygodniu, w tym miesiącu. */
export function periodValue(v: ExVolume | undefined, p: Period, today: string): number {
  if (!v) return 0;
  const k = periodKey(today, p);
  return Object.entries(v.byDay).reduce((a, [d, n]) => (periodKey(d, p) === k ? a + n : a), 0);
}
