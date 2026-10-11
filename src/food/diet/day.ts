import type { MacroTargets } from './profiles';
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

export type Status = 'brak' | 'ok' | 'nadmiar';
export interface MacroLine {
  status: Status;
  /** Eaten minus target, in kcal or grams. */
  delta: number;
  note: string;
}
export type DayStatus = Record<'kcal' | 'protein' | 'carbs' | 'fat', MacroLine>;

const g = (n: number) => `${Math.round(Math.abs(n))} g`;

/**
 * Where the day stands, macro by macro. `dayDone` changes the tone: at noon
 * protein short is just "still to eat", at night it is a real shortfall. An
 * excess is an excess at any hour.
 */
export function macroStatus(t: MacroTargets, eaten: DayTotals, dayDone: boolean): DayStatus {
  const kcalDelta = eaten.kcal - t.kcal;
  const kcal: MacroLine =
    kcalDelta > t.kcal * 0.05
      ? { status: 'nadmiar', delta: kcalDelta, note: `${Math.round(kcalDelta)} kcal ponad cel` }
      : dayDone && kcalDelta < -t.kcal * 0.15
        ? {
            status: 'brak',
            delta: kcalDelta,
            note: `${Math.round(-kcalDelta)} kcal poniżej celu – za mało jedzenia też spowalnia`,
          }
        : {
            status: 'ok',
            delta: kcalDelta,
            note: kcalDelta <= 0 ? `zostało ${Math.round(-kcalDelta)} kcal` : 'w normie',
          };

  const proteinDelta = eaten.protein - t.protein.target;
  const protein: MacroLine =
    eaten.protein < t.protein.min || (!dayDone && proteinDelta < 0)
      ? { status: 'brak', delta: Math.round(proteinDelta), note: `brakuje ${g(proteinDelta)} białka` }
      : { status: 'ok', delta: Math.round(proteinDelta), note: 'białko w normie' };

  const carbsDelta = eaten.carbs - t.carbs.target;
  const carbsCeiling = t.carbs.max ?? t.carbs.target * 1.25;
  const carbs: MacroLine =
    eaten.carbs > carbsCeiling
      ? {
          status: 'nadmiar',
          delta: Math.round(carbsDelta),
          note: `${g(eaten.carbs - carbsCeiling)} węglowodanów ponad limit`,
        }
      : {
          status: 'ok',
          delta: Math.round(carbsDelta),
          note: carbsDelta <= 0 ? `zostało ${g(carbsDelta)} węglowodanów` : 'w normie',
        };

  const fatDelta = eaten.fat - t.fat.target;
  const fatCeiling = t.fat.max ?? Number.POSITIVE_INFINITY;
  const fat: MacroLine =
    eaten.fat > fatCeiling
      ? { status: 'nadmiar', delta: Math.round(fatDelta), note: `${g(eaten.fat - fatCeiling)} tłuszczu ponad limit` }
      : dayDone && eaten.fat < t.fat.min
        ? {
            status: 'brak',
            delta: Math.round(fatDelta),
            note: `za mało tłuszczu (${g(t.fat.min - eaten.fat)} do minimum) – potrzebny do hormonów i witamin`,
          }
        : {
            status: 'ok',
            delta: Math.round(fatDelta),
            note: fatDelta <= 0 ? `zostało ${g(fatDelta)} tłuszczu` : 'w normie',
          };

  return { kcal, protein, carbs, fat };
}

/** Monday-based day of the week, 0..6, for a YYYY-MM-DD read as a calendar date. */
function weekday(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Adjustment {
  adjusted: number;
  delta: number;
  surplus: number;
  daysLeft: number;
  explanation: string;
}

const MAX_SHARE = 0.1;

/**
 * Today's goal corrected by this week so far: a surplus is paid back, a
 * deficit given back, spread over the days left to Sunday, and never more
 * than 10% of the goal a day - a party is not repaid with a starvation day.
 * Only logged days count; an unlogged day is not guessed.
 */
export function weeklyAdjustment(
  goal: number,
  history: { date: string; eatenKcal: number | null }[],
  today: string,
): Adjustment {
  const monday = addDays(today, -weekday(today));
  const surplus = history
    .filter((d) => d.date >= monday && d.date < today && d.eatenKcal !== null)
    .reduce((sum, d) => sum + (d.eatenKcal! - goal), 0);
  const daysLeft = 7 - weekday(today);
  const raw = -surplus / daysLeft;
  const cap = goal * MAX_SHARE;
  // `|| 0`: no surplus makes -0, which would print as "-0 kcal".
  const delta = Math.round(Math.max(-cap, Math.min(cap, raw)) / 10) * 10 || 0;
  const explanation =
    surplus === 0
      ? 'Ten tydzień idzie zgodnie z planem.'
      : surplus > 0
        ? `W tym tygodniu zjedzone ${Math.round(surplus)} kcal ponad plan – rozkładam to na ${daysLeft} ${daysLeft === 1 ? 'dzień' : 'dni'}.`
        : `W tym tygodniu ${Math.round(-surplus)} kcal mniej niż w planie – możesz dziś zjeść trochę więcej.`;
  return { adjusted: goal + delta, delta, surplus: Math.round(surplus), daysLeft, explanation };
}
