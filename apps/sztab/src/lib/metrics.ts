import type { SnapshotV1 } from '@gymtracker/link';
import { weightTrend } from '@gt/engine/body';
import { stepsOn } from '@gt/engine/cardio';
import { doneExercises, exerciseRows, trend } from '@gt/engine/history';
import type { Trend } from '@gt/engine/history';
import { sessionTonnage } from '@gt/engine/math';
import { freshState } from '@gt/engine/plan';
import { addDays, dayKey } from '@gt/engine/schedule';
import { snapshot as planSnapshot } from '@gt/engine/snapshot';
import { EX } from '@gt/data/exercises';
import { registerCatalog, restoreCatalog } from '@gt/data/catalog/adopt';
import type { AppState, LogEntry } from '@gt/types';

/**
 * Pulpit podopiecznego liczony z paczki **silnikiem GYM TRACKERa**. Paczka niesie dziennik,
 * wagę, ruch i plan w kształcie zapisu aplikacji, więc wystarczy złożyć z niej stan i zawołać te
 * same funkcje, z których liczy telefon — prowadzący i podopieczny widzą jedną realizację planu,
 * jeden tonaż i jeden kierunek zmiany.
 */

/** Stan aplikacji z paczki: to, czego nie udostępniono, zostaje puste. */
export function stateOf(s: SnapshotV1): AppState {
  // Ćwiczenia z katalogu podopiecznego: definicja przyszła w paczce, rejestr daje nazwy i jednostki.
  registerCatalog(restoreCatalog(s.training?.catalog));
  const base = freshState();
  return {
    ...base,
    cfg: { ...base.cfg, ...(s.body?.height ? { height: s.body.height } : {}) },
    log: s.training?.log ?? [],
    workouts: s.training?.workouts ?? [],
    plans: s.training?.plans ?? [],
    plan: s.training?.plan ?? null,
    snacks: s.training?.snacks ?? [],
    cardio: s.movement?.cardio ?? [],
    ...(s.movement?.watch ? { watch: s.movement.watch } : {}),
    ...(s.movement?.phone ? { phone: s.movement.phone } : {}),
    body: s.body?.body ?? [],
    measures: s.body?.measures ?? [],
  };
}

export interface SessionRow {
  date: string;
  day: string;
  name: string;
  minutes: number | null;
  tonnage: number;
  sets: number;
  note: string | null;
  deload: boolean;
}

export interface ExerciseTrendRow {
  id: string;
  name: string;
  sessions: number;
  last: string;
  e1rm: number | null;
  trend: Trend | null;
}

export interface FoodWeek {
  days: number;
  kcal: number | null;
  protein: number | null;
  targetKcal: number | null;
  targetProtein: number | null;
}

export interface Overview {
  today: string;
  /** Treningi w tygodniu, średnio z 4 tygodni. */
  perWeek: number | null;
  plan: {
    name: string;
    week: number;
    weeks: number;
    daysPerWeek: number;
    /** Procent zrobionych terminów z rozstrzygniętych, jak w GYM TRACKERze (0–100). */
    adherence: number | null;
    missed: number;
    next: string | null;
  } | null;
  weight: { avg: number | null; delta: number | null; series: { day: string; kg: number }[] };
  food: FoodWeek | null;
  steps: number | null;
  sessions: SessionRow[];
  exercises: ExerciseTrendRow[];
  /** Ostrzeżenia dla prowadzącego, najważniejsze pierwsze. */
  flags: string[];
}

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Dzień treningu po stronie podopiecznego: `LogEntry.date` to ISO, dzień — jak w historii aplikacji. */
const dayOf = (e: LogEntry): string => dayKey(e.date);

export function overview(s: SnapshotV1, now = Date.now()): Overview {
  const state = stateOf(s);
  const today = dayKey(now);
  const flags: string[] = [];

  const since28 = addDays(today, -27);
  const recent = state.log.filter((e) => dayOf(e) >= since28);
  const perWeek = s.training ? recent.length / 4 : null;

  const snap = s.training ? planSnapshot(state, today) : null;
  const plan = snap
    ? {
        name: snap.template.name,
        week: snap.stats.week,
        weeks: snap.template.weeks + (snap.plan.extraWeeks ?? 0),
        daysPerWeek: snap.template.daysPerWeek,
        adherence: snap.stats.adherence,
        missed: snap.stats.missed,
        next: snap.stats.next?.date ?? null,
      }
    : null;

  const wt = s.body ? weightTrend(state, today) : null;
  const from56 = addDays(today, -55);
  const series = (s.body?.body ?? []).filter((b) => b.day >= from56).map((b) => ({ day: b.day, kg: b.kg }));

  let food: FoodWeek | null = null;
  if (s.food) {
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -1 - i));
    const totals = last7
      .map((d) => {
        const entries = s.food!.entries.filter((e) => e.date === d);
        if (!entries.length) return null;
        const meta = s.food!.days.find((x) => x.date === d);
        if (meta?.partial === true) return null;
        return {
          kcal: entries.reduce((a, e) => a + e.kcal, 0),
          protein: entries.reduce((a, e) => a + (e.protein ?? 0), 0),
          tk: meta?.targetKcal ?? null,
          tp: meta?.targetProtein ?? null,
        };
      })
      .filter((x): x is { kcal: number; protein: number; tk: number | null; tp: number | null } => x !== null);
    const tk = totals.map((t) => t.tk).filter((x): x is number => x !== null);
    const tp = totals.map((t) => t.tp).filter((x): x is number => x !== null);
    food = {
      days: totals.length,
      kcal: avg(totals.map((t) => t.kcal)),
      protein: avg(totals.map((t) => t.protein)),
      targetKcal: avg(tk),
      targetProtein: avg(tp),
    };
  }

  const steps = s.movement
    ? avg(
        Array.from({ length: 7 }, (_, i) => stepsOn(state, addDays(today, -1 - i))).filter((n) => n > 0),
      )
    : null;

  const sessions: SessionRow[] = [...state.log]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      date: e.date,
      day: dayOf(e),
      name: e.workout,
      minutes: e.time ? Math.round(e.time.secs / 60) : null,
      tonnage: sessionTonnage(e),
      sets: e.items.reduce((n, i) => n + i.sets.length, 0),
      note: e.note ?? null,
      deload: !!e.deload,
    }));

  const exercises: ExerciseTrendRow[] = s.training
    ? doneExercises(state)
        .slice(0, 12)
        .map((x) => ({
          id: x.id,
          name: EX[x.id]?.name ?? x.id,
          sessions: x.sessions,
          last: x.last,
          e1rm: x.e1rm,
          trend: trend(exerciseRows(state, x.id), x.id),
        }))
    : [];

  // Ostrzeżenia: tylko to, co prowadzący może z tym zrobić teraz.
  const lastAt = s.at;
  if (now - lastAt > 7 * 86_400_000) flags.push('stale');
  if (s.training && plan && plan.adherence !== null && plan.adherence < 60) flags.push('adherence');
  // Tylko u kogoś, kto już trenował — nowy podopieczny bez historii to nie przerwa.
  if (s.training && state.log.length && !state.log.some((e) => dayOf(e) >= addDays(today, -13))) flags.push('no_training');
  if (wt?.delta !== null && wt?.avg && wt.delta !== undefined && Math.abs(wt.delta) / wt.avg > 0.01) flags.push('weight_fast');
  if (food && food.protein !== null && food.targetProtein && food.protein < food.targetProtein * 0.8) flags.push('protein_low');

  return {
    today,
    perWeek,
    plan,
    weight: { avg: wt?.avg ?? null, delta: wt?.delta ?? null, series },
    food,
    steps,
    sessions,
    exercises,
    flags,
  };
}

/** Dni jedzenia od najnowszego: sumy dnia i cel. */
export function foodDays(s: SnapshotV1) {
  if (!s.food) return [];
  const byDay = new Map<string, typeof s.food.entries>();
  for (const e of s.food.entries) {
    if (!byDay.has(e.date)) byDay.set(e.date, []);
    byDay.get(e.date)!.push(e);
  }
  const days = new Set([...byDay.keys(), ...s.food.days.map((d) => d.date)]);
  return [...days]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const entries = (byDay.get(date) ?? []).sort((a, b) => a.time.localeCompare(b.time));
      const meta = s.food!.days.find((d) => d.date === date);
      const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => entries.reduce((a, e) => a + (e[k] ?? 0), 0);
      return {
        date,
        entries,
        kcal: sum('kcal'),
        protein: sum('protein'),
        carbs: sum('carbs'),
        fat: sum('fat'),
        drinksMl: meta?.drinksMl ?? null,
        targetKcal: meta?.targetKcal ?? null,
        targetProtein: meta?.targetProtein ?? null,
        partial: meta?.partial ?? null,
        note: meta?.note ?? null,
      };
    });
}
