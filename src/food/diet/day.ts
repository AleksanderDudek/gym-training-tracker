import type { DayNeeds } from './now';
import { kcalStatus } from './target';
import type { Nutrients } from './types';

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Entries logged with calories only: the macro totals are a floor, not the truth. */
  unknownMacros: number;
}

export function totals(entries: Nutrients[]): DayTotals {
  const t: DayTotals = { kcal: 0, protein: 0, carbs: 0, fat: 0, unknownMacros: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    if (e.protein === null || e.carbs === null || e.fat === null) t.unknownMacros++;
    t.protein += e.protein ?? 0;
    t.carbs += e.carbs ?? 0;
    t.fat += e.fat ?? 0;
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(t.kcal),
    protein: r(t.protein),
    carbs: r(t.carbs),
    fat: r(t.fat),
    unknownMacros: t.unknownMacros,
  };
}

/**
 * Where a day stands for its headline („Zostało ok. 650 kcal i 54 g białka”), on the Today card,
 * the day card and „Co teraz?” alike. Counts what is eaten plus a planned bigger meal, as
 * `dayNeeds` does, and judges calories on the ±100 band (`kcalStatus`).
 */
export interface DayState {
  /** Nothing eaten and nothing planned yet, kcal left, within the band, over it. */
  kind: 'start' | 'left' | 'within' | 'over';
  /** The day's target, kcal. */
  target: number;
  /** `start`: the target; `left` / `over`: kcal left or over, rounded to 10; `within`: 0. */
  kcal: number;
  /** Protein still to eat, whole grams; 0 once the target is met. */
  protein: number;
  proteinDone: boolean;
  /** kcal of the planned bigger meal set aside in the numbers above; null when none is planned. */
  planned: number | null;
  /** Over only because of the planned meal: what is eaten alone is not over the band. */
  overPlanned: boolean;
}

/** The day's state from its needs (`dayNeeds` at `targetOn(profile, date)`) and what is eaten alone. */
export function dayState(needs: DayNeeds, eaten: DayTotals): DayState {
  const target = needs.targets.kcal;
  const plannedKcal = Math.round(needs.reserved.kcal - eaten.kcal);
  const planned = plannedKcal > 0 ? plannedKcal : null;
  const protein = Math.max(0, Math.round(needs.remaining.protein));
  const base = { target, protein, proteinDone: protein === 0, planned };
  if (planned === null && eaten.kcal <= 0 && eaten.protein <= 0)
    return { ...base, kind: 'start', kcal: target, overPlanned: false };
  const status = kcalStatus(target, needs.reserved.kcal);
  return {
    ...base,
    kind: status.kind,
    kcal: status.kcal,
    overPlanned: status.kind === 'over' && planned !== null && kcalStatus(target, eaten.kcal).kind !== 'over',
  };
}
