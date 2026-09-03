import type { PlannedDay } from '../types';
import type { PlanStats, Schedule } from './schedule';

/**
 * Punktacja nagradza obecność w terminie, nie tonaż. Ciężar i tak rozlicza silnik progresji,
 * a punkty za kilogramy popychałyby do przeciążenia dokładnie wtedy, gdy trzeba odpuścić.
 *
 * Nie ma punktów ujemnych. Karą za opuszczony termin jest zerwana seria i zatrzymany licznik,
 * a nie dług do odrobienia — wychodzenie z minusa zniechęca skuteczniej niż cokolwiek innego.
 */
export const POINTS = {
  /** Termin zrobiony co do dnia. */
  onTime: 100,
  /** Termin nadrobiony 1, 2 albo 3 dni po czasie. */
  late: [70, 45, 25],
  /** Trening poza planem: liczy się, ale mniej niż trafiony termin. */
  extra: 20,
  /** Dokładka za każdy kolejny termin z rzędu w terminie. */
  streakStep: 10,
  /** Sufit serii — powyżej dziesięciu premia przestaje rosnąć. */
  streakCap: 10,
  /** Tydzień planu domknięty bez ani jednego opuszczonego terminu. */
  cleanWeek: 150,
} as const;

export interface ScoreParts {
  sessions: number;
  streak: number;
  weeks: number;
  extra: number;
}

export interface Score {
  points: number;
  parts: ScoreParts;
  /** Tygodnie planu zamknięte bez opuszczonego terminu. */
  cleanWeeks: number;
}

const latePoints = (late: number): number =>
  POINTS.late[Math.min(late, POINTS.late.length) - 1] ?? POINTS.late[POINTS.late.length - 1]!;

/**
 * Punkty za trwający plan. Liczone od zera przy każdym wywołaniu, wyłącznie z kalendarza —
 * dzięki temu nie ma licznika, który mógłby rozjechać się z historią po imporcie danych
 * albo po zmianie dni tygodnia.
 */
export function scorePlan(schedule: Schedule): Score {
  const parts: ScoreParts = { sessions: 0, streak: 0, weeks: 0, extra: 0 };
  let streak = 0;

  schedule.days.forEach((d) => {
    if (d.status === 'missed') {
      streak = 0;
      return;
    }
    if (d.status !== 'done') return;

    if (d.late === 0) {
      parts.sessions += POINTS.onTime;
      streak++;
      parts.streak += Math.min(streak, POINTS.streakCap) * POINTS.streakStep;
    } else {
      parts.sessions += latePoints(d.late);
      streak = 0;
    }
  });

  const cleanWeeks = countCleanWeeks(schedule.days);
  parts.weeks = cleanWeeks * POINTS.cleanWeek;
  parts.extra = schedule.extras.length * POINTS.extra;

  return {
    points: parts.sessions + parts.streak + parts.weeks + parts.extra,
    parts,
    cleanWeeks,
  };
}

/** Tydzień liczy się jako czysty, gdy każdy jego termin jest już zrobiony. */
export function countCleanWeeks(days: PlannedDay[]): number {
  const weeks = new Map<number, PlannedDay[]>();
  days.forEach((d) => {
    const list = weeks.get(d.week) ?? [];
    list.push(d);
    weeks.set(d.week, list);
  });

  let n = 0;
  weeks.forEach((list) => {
    if (list.length && list.every((d) => d.status === 'done')) n++;
  });
  return n;
}

export interface Rank {
  name: string;
  at: number;
}

/** Progi tak dobrane, żeby pierwszy awans wypadł po niecałym tygodniu regularnych treningów. */
export const RANKS: Rank[] = [
  { name: 'Nowicjusz', at: 0 },
  { name: 'Regularny', at: 500 },
  { name: 'Wytrwały', at: 1500 },
  { name: 'Zaprawiony', at: 3000 },
  { name: 'Twardy', at: 5500 },
  { name: 'Żelazny', at: 9000 },
  { name: 'Weteran', at: 14000 },
  { name: 'Mistrz', at: 20000 },
];

export interface RankState {
  rank: Rank;
  index: number;
  next: Rank | null;
  /** Postęp do kolejnego stopnia, 0–1. Na ostatnim stopniu zawsze 1. */
  progress: number;
}

export function rankFor(points: number): RankState {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (points >= r.at) index = i;
  });
  const rank = RANKS[index]!;
  const next = RANKS[index + 1] ?? null;
  return {
    rank,
    index,
    next,
    progress: next ? (points - rank.at) / (next.at - rank.at) : 1,
  };
}

/**
 * Ile punktów da dzisiejszy trening. Służy do jednego: pokazać cenę zwłoki, zanim ktoś
 * odpuści dzień. „Dziś 180, jutro 70” działa lepiej niż jakiekolwiek napomnienie.
 */
export function pointsToday(stats: PlanStats, today: string): { now: number; kind: string } {
  const due = stats.due;
  if (!due) return { now: POINTS.extra, kind: 'extra' };

  if (due.date === today) {
    const bonus = Math.min(stats.streak + 1, POINTS.streakCap) * POINTS.streakStep;
    return { now: POINTS.onTime + bonus, kind: 'onTime' };
  }
  return { now: latePoints(Math.max(1, daysLate(due, today))), kind: 'late' };
}

const daysLate = (d: PlannedDay, today: string): number =>
  Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.date}T00:00:00Z`)) / 86_400_000,
  );
