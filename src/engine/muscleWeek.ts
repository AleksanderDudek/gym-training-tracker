import { MUSCLES } from '../data/muscles';
import type { MuscleId } from '../data/muscles';
import type { AppState } from '../types';
import { RULES, exerciseLoads, sumLoads } from './design';
import { addDays, dayKey, mondayOf } from './schedule';

/**
 * Mięśnie w tym tygodniu: serie ułamkowe na każdą z szesnastu partii z treningów zamkniętych od
 * poniedziałku do niedzieli. Ten sam model co doradca (`exerciseLoads`): główny mięsień dostaje
 * całą serię, pomocniczy pół, a seria wybuchowa i na czas sama liczy się za pół.
 *
 * Liczone są serie naprawdę zrobione (z wynikiem powyżej zera), a nie przepisane — trening
 * skończony w połowie ćwiczenia daje tyle serii, ile poszło.
 *
 * Tydzień jest tygodniem silnika: dni w UTC (`dayKey`), od poniedziałku, tak jak kalendarz
 * planu i odznaki tygodnia — inaczej karta i plan różniłyby się o trening z niedzieli wieczorem.
 *
 * **Przekąski nie wchodzą do serii.** Przekąska nie jest treningiem (README, „Przekąski
 * ruchowe”): dziesięć przysiadów przy czajniku nie jest serią pod przyrost mięśni, a liczone
 * jak seria pompowałyby partie, które ktoś tylko rozruszał. Karta mówi tylko, ile ich było.
 *
 * Nic z tego nie jest zapisywane — liczy się od zera z dziennika przy każdym otwarciu.
 */

export interface MuscleWeek {
  /** Poniedziałek i niedziela tygodnia, `yyyy-mm-dd`. */
  from: string;
  to: string;
  /** Zamknięte treningi w tym tygodniu. */
  sessions: number;
  /** Przekąski ruchowe w tym tygodniu — osobno, nie w seriach. */
  snacks: number;
  /** Serie ułamkowe na partię — wszystkie 16 partii, w kolejności `MUSCLES`. */
  muscles: { muscle: MuscleId; sets: number }[];
}

export function muscleWeek(state: Pick<AppState, 'log' | 'snacks'>, now: number = Date.now()): MuscleWeek {
  const from = mondayOf(dayKey(now));
  const to = addDays(from, 6);
  const inWeek = (iso: string): boolean => {
    const d = dayKey(iso);
    return d >= from && d <= to;
  };
  const entries = state.log.filter((e) => typeof e.date === 'string' && !Number.isNaN(Date.parse(e.date)) && inWeek(e.date));

  const total = sumLoads(
    entries.flatMap((e) => e.items.map((i) => exerciseLoads(i.id, i.sets.filter((s) => s.reps > 0).length))),
  );

  return {
    from,
    to,
    sessions: entries.length,
    snacks: (state.snacks ?? []).filter((s) => inWeek(s.at)).length,
    muscles: MUSCLES.map((m) => ({
      muscle: m,
      sets: total[m] ?? 0,
    })),
  };
}

/**
 * Odniesienie z badań: serie na partię tygodniowo (Schoenfeld, Ogborn i Krieger, 2017) — te same
 * liczby, na których stoi doradca planu.
 */
export const WEEK_REFERENCE = { from: RULES.weeklyTarget, to: RULES.weeklyMax } as const;

/**
 * Stopień zabarwienia na rysunku: 0 — bez serii, 1 — poniżej 4, 2 — 4 do 10, 3 — 10 do 20,
 * 4 — ponad 20. Progi to te same liczby, którymi doradca opisuje tydzień (podtrzymanie, zakres
 * z badań); na karcie stoją same liczby, bez słów o tym, czy to dobrze.
 */
export function shade(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0;
  if (sets < RULES.weeklyMin) return 1;
  if (sets < WEEK_REFERENCE.from) return 2;
  if (sets <= WEEK_REFERENCE.to) return 3;
  return 4;
}
