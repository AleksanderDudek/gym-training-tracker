import { num, text } from '../../i18n';
import type { DayNeeds } from './now';
import type { MacroTargets } from './profiles';
import { kcalStatus } from './target';
import type { Nutrients } from './types';

const T = text({
  pl: {
    kcalOver: (kcal: number) => `${kcal} kcal ponad cel`,
    kcalUnder: (kcal: number) => `${kcal} kcal poniżej celu – za mało jedzenia też spowalnia`,
    kcalLeft: (kcal: number) => `zostało ${kcal} kcal`,
    onTarget: 'w normie',
    proteinShort: (g: string) => `brakuje ${g} białka`,
    proteinOk: 'białko w normie',
    carbsOver: (g: string) => `${g} węglowodanów ponad limit`,
    carbsLeft: (g: string) => `zostało ${g} węglowodanów`,
    fatOver: (g: string) => `${g} tłuszczu ponad limit`,
    fatShort: (g: string) => `za mało tłuszczu (${g} do minimum) – potrzebny do hormonów i witamin`,
    fatLeft: (g: string) => `zostało ${g} tłuszczu`,
    weekOnPlan: 'Ten tydzień idzie zgodnie z planem.',
    weekSurplus: (kcal: number, days: number) =>
      `W tym tygodniu zjedzone ${kcal} kcal ponad plan – rozkładam to na ${days} ${days === 1 ? 'dzień' : 'dni'}.`,
    weekDeficit: (kcal: number) => `W tym tygodniu ${kcal} kcal mniej niż w planie – możesz dziś zjeść trochę więcej.`,
  },
  en: {
    kcalOver: (kcal: number) => `${num(kcal)} kcal over the goal`,
    kcalUnder: (kcal: number) => `${num(kcal)} kcal under the goal – eating too little slows you down too`,
    kcalLeft: (kcal: number) => `${num(kcal)} kcal left`,
    onTarget: 'on target',
    proteinShort: (g: string) => `${g} protein to go`,
    proteinOk: 'protein on target',
    carbsOver: (g: string) => `${g} carbs over the limit`,
    carbsLeft: (g: string) => `${g} carbs left`,
    fatOver: (g: string) => `${g} fat over the limit`,
    fatShort: (g: string) => `too little fat (${g} to the minimum) – you need it for hormones and vitamins`,
    fatLeft: (g: string) => `${g} fat left`,
    weekOnPlan: 'This week is going to plan.',
    weekSurplus: (kcal: number, days: number) =>
      `This week you’ve eaten ${num(kcal)} kcal over the plan – I’m spreading it over ${days} ${days === 1 ? 'day' : 'days'}.`,
    weekDeficit: (kcal: number) => `This week you’re ${num(kcal)} kcal under the plan – you can eat a bit more today.`,
  },
});

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

// i18n-ignore: status keys (CSS classes, comparisons), not text
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
      ? { status: 'nadmiar', delta: kcalDelta, note: T.kcalOver(Math.round(kcalDelta)) }
      : dayDone && kcalDelta < -t.kcal * 0.15
        ? {
            // i18n-ignore: status key
            status: 'brak',
            delta: kcalDelta,
            note: T.kcalUnder(Math.round(-kcalDelta)),
          }
        : {
            status: 'ok',
            delta: kcalDelta,
            note: kcalDelta <= 0 ? T.kcalLeft(Math.round(-kcalDelta)) : T.onTarget,
          };

  const proteinDelta = eaten.protein - t.protein.target;
  const protein: MacroLine =
    eaten.protein < t.protein.min || (!dayDone && proteinDelta < 0)
      ? // i18n-ignore: status key
        { status: 'brak', delta: Math.round(proteinDelta), note: T.proteinShort(g(proteinDelta)) }
      : { status: 'ok', delta: Math.round(proteinDelta), note: T.proteinOk };

  const carbsDelta = eaten.carbs - t.carbs.target;
  const carbsCeiling = t.carbs.max ?? t.carbs.target * 1.25;
  const carbs: MacroLine =
    eaten.carbs > carbsCeiling
      ? {
          status: 'nadmiar',
          delta: Math.round(carbsDelta),
          note: T.carbsOver(g(eaten.carbs - carbsCeiling)),
        }
      : {
          status: 'ok',
          delta: Math.round(carbsDelta),
          note: carbsDelta <= 0 ? T.carbsLeft(g(carbsDelta)) : T.onTarget,
        };

  const fatDelta = eaten.fat - t.fat.target;
  const fatCeiling = t.fat.max ?? Number.POSITIVE_INFINITY;
  const fat: MacroLine =
    eaten.fat > fatCeiling
      ? { status: 'nadmiar', delta: Math.round(fatDelta), note: T.fatOver(g(eaten.fat - fatCeiling)) }
      : dayDone && eaten.fat < t.fat.min
        ? {
            // i18n-ignore: status key
            status: 'brak',
            delta: Math.round(fatDelta),
            note: T.fatShort(g(t.fat.min - eaten.fat)),
          }
        : {
            status: 'ok',
            delta: Math.round(fatDelta),
            note: fatDelta <= 0 ? T.fatLeft(g(fatDelta)) : T.onTarget,
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
 * Only logged days count; an unlogged day is not guessed. A day with its own
 * `goalKcal` (the goal after that day's activity) is judged against it: a lazy
 * Monday eaten to plan is a surplus, an active one is not.
 */
export function weeklyAdjustment(
  goal: number,
  history: { date: string; eatenKcal: number | null; goalKcal?: number }[],
  today: string,
): Adjustment {
  const monday = addDays(today, -weekday(today));
  const surplus = history
    .filter((d) => d.date >= monday && d.date < today && d.eatenKcal !== null)
    .reduce((sum, d) => sum + (d.eatenKcal! - (d.goalKcal ?? goal)), 0);
  const daysLeft = 7 - weekday(today);
  const raw = -surplus / daysLeft;
  const cap = goal * MAX_SHARE;
  // `|| 0`: no surplus makes -0, which would print as "-0 kcal".
  const delta = Math.round(Math.max(-cap, Math.min(cap, raw)) / 10) * 10 || 0;
  const explanation =
    surplus === 0
      ? T.weekOnPlan
      : surplus > 0
        ? T.weekSurplus(Math.round(surplus), daysLeft)
        : T.weekDeficit(Math.round(-surplus));
  return { adjusted: goal + delta, delta, surplus: Math.round(surplus), daysLeft, explanation };
}
