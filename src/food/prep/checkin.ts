import type { DayRow } from '../diet/db';
import { bmr, goalDirection, tdee } from '../diet/energy';
import { addDays, daysBetween, paceText } from '../diet/model';
import type { Profile } from '../diet/types';
import { formatNumber, plural } from '../lib/format';

/**
 * The check-in before a new plan: what the scale and the log say about the person's real
 * expenditure, against what the energy model assumed. Losing slower than planned on the logged
 * food means burning less than the formula says - the goal comes down; losing faster, it goes up.
 * The model is a population average; this is the person. Adaptive diet apps (MacroFactor's weekly
 * check-in) work this way.
 */

export type CheckInStatus = 'za-malo-danych' | 'zgodnie' | 'korekta' | 'cel';

export interface CheckIn {
  status: CheckInStatus;
  today: string;
  /** Weigh-ins in the window. */
  weighIns: number;
  /** Days with something logged between the first and the last weigh-in. */
  loggedDays: number;
  /** Days between the first and the last weigh-in. */
  spanDays: number;
  /** The trend's weight at the last weigh-in. */
  trendKg: number | null;
  /** kg a week, positive is losing. */
  observedPace: number | null;
  /** What the profile's goal gives at the trend weight, by the model. */
  plannedPace: number;
  observedTdee: number | null;
  modelTdee: number;
  profileKcal: number;
  /** The goal for the next plan: the profile's when nothing needs to change. */
  suggestedKcal: number;
  /** Why the suggestion is not the full correction: the floor (BMR, a minimum) or the step cap. */
  limited: 'floor' | 'cap' | null;
  reason: string;
}

/** Four weeks of data: long enough for a trend, short enough to be about now. */
export const WINDOW_DAYS = 28;
const MIN_WEIGH_INS = 4;
const MIN_SPAN = 14;
const MIN_LOGGED = 0.75;
/** Below this the model is right enough: the scale cannot tell 100 kcal a day apart in a month. */
const TOLERANCE = 100;
/** One check-in moves the goal at most this much: a noisy month must not swing it. */
const STEP = 250;

const round10 = (n: number) => Math.round(n / 10) * 10;
const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;

/** Least-squares line through (day, kg): the slope in kg a day and the value at the last day. */
function trend(points: { x: number; kg: number }[]): { slope: number; at: (x: number) => number } {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.kg, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.kg - my), 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { slope, at: (x) => my + slope * (x - mx) };
}

export interface CheckInInput {
  profile: Profile;
  /** Diet days with the gym tracker's weigh-ins laid over them (`useMergedHistory`). */
  days: Iterable<DayRow>;
  /** Eaten kcal per date. */
  eaten: Map<string, number>;
  today: string;
}

export function checkIn({ profile, days, eaten, today }: CheckInInput): CheckIn {
  const from = addDays(today, -WINDOW_DAYS);
  const weighIns = [...days]
    .filter((d): d is DayRow & { weightKg: number } => d.weightKg != null && d.date >= from && d.date < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = weighIns[0]?.date ?? null;
  const last = weighIns[weighIns.length - 1]?.date ?? null;
  const spanDays = first && last ? daysBetween(first, last) : 0;
  const span = first ? Array.from({ length: spanDays }, (_, i) => addDays(first, i)) : [];
  const logged = span.filter((d) => eaten.has(d));

  const lastWeight = weighIns[weighIns.length - 1]?.weightKg ?? profile.startWeightKg;
  const base = {
    today,
    weighIns: weighIns.length,
    loggedDays: logged.length,
    spanDays,
    profileKcal: profile.dailyKcal,
  };

  const notEnough = (why: string): CheckIn => {
    const modelTdee = tdee(profile, lastWeight);
    return {
      ...base,
      status: 'za-malo-danych',
      trendKg: null,
      observedPace: null,
      plannedPace: ((modelTdee - profile.dailyKcal) * 7) / profile.kcalPerKg,
      observedTdee: null,
      modelTdee,
      suggestedKcal: profile.dailyKcal,
      limited: null,
      reason: why,
    };
  };

  if (weighIns.length < MIN_WEIGH_INS || spanDays < MIN_SPAN || logged.length < MIN_LOGGED * spanDays) {
    const n = weighIns.length;
    return notEnough(
      `Do dopasowania celu potrzebuję co najmniej ${MIN_WEIGH_INS} ważeń z ${MIN_SPAN} dni i zapisów jedzenia z ¾ tych dni ` +
        `(teraz: ${n} ${plural(n, 'ważenie', 'ważenia', 'ważeń')}` +
        `${spanDays ? ` z ${spanDays} dni, zapisy z ${logged.length}` : ''}). Plan bierze cel z profilu.`,
    );
  }

  const line = trend(weighIns.map((d) => ({ x: daysBetween(first!, d.date), kg: d.weightKg })));
  const trendKg = line.at(spanDays);
  const meanIntake = logged.reduce((s, d) => s + eaten.get(d)!, 0) / logged.length;
  const observedTdee = meanIntake - line.slope * profile.kcalPerKg;
  const modelTdee = tdee(profile, trendKg);
  const resting = bmr(profile, trendKg);
  // A log that leaves out a third of the food makes anyone look like they burn 1200 kcal.
  if (observedTdee < 0.8 * resting || observedTdee > 2.5 * resting)
    return notEnough(
      `Z zapisów i wagi wychodzi spalanie ${kcal(observedTdee)}, a to nie jest możliwe przy Twojej przemianie materii ` +
        `(${kcal(resting)}) — zapisy jedzenia są chyba niepełne. Plan bierze cel z profilu.`,
    );

  const observedPace = -line.slope * 7;
  const plannedPace = ((modelTdee - profile.dailyKcal) * 7) / profile.kcalPerKg;
  const floor = Math.max(round10(resting), profile.sex === 'M' ? 1500 : 1200);
  const common = { ...base, trendKg, observedPace, plannedPace, observedTdee, modelTdee };
  const tempo = `Przez ostatnie ${spanDays} dni waga szła w tempie ${paceText(observedPace)}, plan zakładał ${paceText(plannedPace)}.`;

  const direction = goalDirection(profile);
  const reached =
    (direction === 'loss' && trendKg <= profile.targetWeightKg) ||
    (direction === 'gain' && trendKg >= profile.targetWeightKg);
  if (reached) {
    const keep = Math.max(floor, round10(observedTdee));
    return {
      ...common,
      status: 'cel',
      suggestedKcal: keep,
      limited: keep > round10(observedTdee) ? 'floor' : null,
      reason:
        `Cel ${formatNumber(profile.targetWeightKg, 1)} kg osiągnięty (trend: ${formatNumber(trendKg, 1)} kg). ` +
        `Na utrzymanie proponuję ${kcal(keep)} — tyle wychodzi z Twoich zapisów i wagi.`,
    };
  }

  const error = observedTdee - modelTdee;
  if (Math.abs(error) < TOLERANCE)
    return {
      ...common,
      status: 'zgodnie',
      suggestedKcal: profile.dailyKcal,
      limited: null,
      reason: `${tempo} To zgodnie z planem — cel zostaje: ${kcal(profile.dailyKcal)}.`,
    };

  const step = Math.max(-STEP, Math.min(STEP, error));
  let suggested = round10(profile.dailyKcal + step);
  let limited: CheckIn['limited'] = Math.abs(error) > STEP ? 'cap' : null;
  if (suggested < floor && suggested < profile.dailyKcal) {
    suggested = Math.max(floor, Math.min(profile.dailyKcal, suggested));
    limited = 'floor';
  }
  const burns = `Z dziennika i wagi wychodzi, że spalasz ok. ${kcal(round10(observedTdee))} dziennie, a model liczył ${kcal(round10(modelTdee))}.`;
  if (suggested === profile.dailyKcal)
    return {
      ...common,
      status: 'zgodnie',
      suggestedKcal: suggested,
      limited,
      reason: `${tempo} ${burns} Niżej nie schodzę: ${kcal(profile.dailyKcal)} to już Twoja podstawowa przemiana materii albo minimum — dołóż kroków zamiast ucinać jedzenie.`,
    };
  const reason =
    `${tempo} ${burns} Proponuję ${kcal(suggested)} zamiast ${kcal(profile.dailyKcal)}` +
    (limited === 'cap' ? ` — o ${STEP} kcal naraz, resztę pokaże kolejne ważenie.` : '.') +
    (limited === 'floor' ? ' Niżej nie schodzę: to Twoja podstawowa przemiana materii.' : '') +
    // Losing faster than planned is not a bonus: it costs muscle and patience.
    (direction === 'loss' && error > 0 ? ' Szybsze chudnięcie niż w planie kosztuje mięśnie.' : '');
  return { ...common, status: 'korekta', suggestedKcal: suggested, limited, reason };
}
