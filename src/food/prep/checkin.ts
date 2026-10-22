import type { DayRow } from '../diet/db';
import { bmr, goalDirection, tdee } from '../diet/energy';
import { addDays, daysBetween, paceText } from '../diet/model';
import type { Profile } from '../diet/types';
import { formatNumber, plural } from '../lib/format';
import { pluralEn, text } from '../../i18n';

/**
 * The check-in before a new plan: what the scale and the log say about the person's real
 * expenditure, against what the energy model expects. Losing slower than the model expects on the
 * logged food means burning less than the formula says - the goal comes down; losing faster, it goes
 * up. The model is a population average; this is the person. Adaptive diet apps (MacroFactor's
 * weekly check-in) work this way.
 *
 * What a check-in measures stays in the profile (`kcalCorrection`) and in the model from then on:
 * the next check-in compares the scale with the corrected model, so it only moves the goal by what is
 * still wrong, never by the same error again.
 */

export type CheckInStatus = 'za-malo-danych' | 'zgodnie' | 'korekta' | 'cel';

export interface CheckIn {
  status: CheckInStatus;
  today: string;
  /** Weigh-ins in the window. */
  weighIns: number;
  /** Days logged in full (at least half the goal) between the first and the last weigh-in. */
  loggedDays: number;
  /** Days between the first and the last weigh-in. */
  spanDays: number;
  /** The trend's weight at the last weigh-in. */
  trendKg: number | null;
  /** kg a week, positive is losing. */
  observedPace: number | null;
  /** What the goal gives at the trend weight by the (corrected) model: the pace aimed at. */
  plannedPace: number;
  observedTdee: number | null;
  /** The model's expenditure at the trend weight, with the corrections already measured. */
  modelTdee: number;
  profileKcal: number;
  /** The goal for the next plan: the profile's when nothing needs to change. */
  suggestedKcal: number;
  /** The model's correction with this check-in (`Profile.kcalCorrection` once it is accepted). */
  correction: number;
  /** Why the suggestion is not the full correction: the floor (BMR, a minimum) or the step cap. */
  limited: 'floor' | 'cap' | null;
  reason: string;
}

/** Four weeks of data: long enough for a trend, short enough to be about now. */
export const WINDOW_DAYS = 28;
const MIN_WEIGH_INS = 5;
const MIN_SPAN = 14;
const MIN_LOGGED = 0.75;
/** A day logged at less than half the goal is a day half logged, not a day of fasting. */
const FULL_DAY = 0.5;
/** Below this the model is right enough: the scale cannot tell 100 kcal a day apart in a month. */
const TOLERANCE = 100;
/** One check-in moves the goal at most this much: a noisy month must not swing it. */
const STEP = 250;
/** Reaching the target, the goal moves to maintenance in steps of at most this. */
const MAINTENANCE_STEP = 500;
/** Only the part of the error beyond two standard errors of the trend is believed. */
const CONFIDENCE = 2;

const round10 = (n: number) => Math.round(n / 10) * 10;
const kcal = (n: number) => `${formatNumber(Math.round(n), 0)} kcal`;
const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
/** `paceText` in a sentence of its own: English needs the full stop the Polish abbreviation brings. */
const paceEn = (pace: string) => pace.replace(/\.$/, '');

const T = text({
  pl: {
    needData: (n: number, spanDays: number, logged: number) =>
      `Do dopasowania celu potrzebuję co najmniej ${MIN_WEIGH_INS} ważeń z ${MIN_SPAN} dni i pełnych zapisów jedzenia ` +
      `z ¾ tych dni (teraz: ${n} ${plural(n, 'ważenie', 'ważenia', 'ważeń')}` +
      `${spanDays ? ` z ${spanDays} dni, pełne zapisy z ${logged}` : ''}). Plan bierze cel z profilu.`,
    implausible: (observed: number, resting: number, low: boolean) =>
      `Z zapisów i wagi wychodzi spalanie ${kcal(observed)}, a to poza tym, co możliwe przy Twojej przemianie ` +
      `materii (${kcal(resting)}) — ${low ? 'zapisy jedzenia są chyba niepełne' : 'to pewnie woda, która schodzi na początku diety, albo zapisy z nadmiarem'}. Plan bierze cel z profilu.`,
    minimum: (floor: number, male: boolean) => `minimum ${kcal(floor)} ${male ? 'dla mężczyzn' : 'dla kobiet'}`,
    basal: (floor: number) => `Twoja podstawowa przemiana materii (${kcal(floor)})`,
    // `paceText` ends in "tydz.": the abbreviation's dot ends the sentence too.
    tempo: (spanDays: number, observed: string, planned: string) =>
      `Przez ostatnie ${spanDays} dni waga szła w tempie ${observed}, plan zakładał ${planned}`,
    reached: (target: number, trendKg: number) =>
      `Cel ${formatNumber(target, 1)} kg osiągnięty (trend: ${formatNumber(trendKg, 1)} kg).`,
    keepGoal: (done: string, keep: number) => `${done} Cel ${kcal(keep)} to już utrzymanie — zostaje.`,
    maintenance: (done: string, keep: number, maintenance: number | null) =>
      `${done} Na utrzymanie proponuję ${kcal(keep)}` +
      (maintenance !== null ? ` — do ${kcal(maintenance)} dojdziesz w kolejnych planach, po ${MAINTENANCE_STEP} kcal.` : '.'),
    noisy: (tempo: string, noise: number, goal: number) =>
      `${tempo} Waga skacze za bardzo, żeby to znaczyło coś pewnego (±${kcal(noise)} dziennie), więc cel zostaje: ${kcal(goal)}. Ważenie codziennie rano da pewniejszy wynik.`,
    onPlan: (tempo: string, goal: number) => `${tempo} To zgodnie z planem — cel zostaje: ${kcal(goal)}.`,
    burns: (observed: number, model: number) =>
      `Z dziennika i wagi wychodzi, że spalasz ok. ${kcal(observed)} dziennie, a model liczył ${kcal(model)}.`,
    atFloor: (tempo: string, burns: string, goal: number, below: boolean, floorWords: string) =>
      `${tempo} ${burns} Niżej nie schodzę: ${kcal(goal)} to już ${below ? 'mniej niż ' : ''}${floorWords} — dołóż kroków zamiast ucinać jedzenie.`,
    suggest: (tempo: string, burns: string, suggested: number, goal: number) =>
      `${tempo} ${burns} Proponuję ${kcal(suggested)} zamiast ${kcal(goal)}`,
    capped: ` — o ${STEP} kcal naraz, resztę pokaże kolejny check-in.`,
    floored: (floorWords: string) => ` Niżej nie schodzę: to ${floorWords}.`,
    tooFast: ' Szybsze chudnięcie niż w planie kosztuje mięśnie.',
  },
  en: {
    needData: (n: number, spanDays: number, logged: number) =>
      `To fit your goal I need at least ${MIN_WEIGH_INS} weigh-ins over ${MIN_SPAN} days and full food logs on ` +
      `¾ of those days (now: ${n} ${pluralEn(n, 'weigh-in', 'weigh-ins')}` +
      `${spanDays ? ` over ${spanDays} days, full logs on ${logged}` : ''}). The plan uses the goal from your profile.`,
    implausible: (observed: number, resting: number, low: boolean) =>
      `Your logs and weight point to burning ${kcal(observed)}, which is beyond what your metabolism ` +
      `(${kcal(resting)}) allows — ${low ? 'your food logs are probably incomplete' : 'probably water lost at the start of a diet, or logs with too much in them'}. The plan uses the goal from your profile.`,
    minimum: (floor: number, male: boolean) => `the minimum of ${kcal(floor)} ${male ? 'for men' : 'for women'}`,
    basal: (floor: number) => `your basal metabolic rate (${kcal(floor)})`,
    tempo: (spanDays: number, observed: string, planned: string) =>
      `Over the last ${spanDays} days your weight moved at ${paceEn(observed)}; the plan assumed ${paceEn(planned)}.`,
    reached: (target: number, trendKg: number) =>
      `Target of ${formatNumber(target, 1)} kg reached (trend: ${formatNumber(trendKg, 1)} kg).`,
    keepGoal: (done: string, keep: number) => `${done} Your goal of ${kcal(keep)} is already maintenance — it stays.`,
    maintenance: (done: string, keep: number, maintenance: number | null) =>
      `${done} For maintenance I suggest ${kcal(keep)}` +
      (maintenance !== null ? ` — you’ll get to ${kcal(maintenance)} over the next plans, ${MAINTENANCE_STEP} kcal at a time.` : '.'),
    noisy: (tempo: string, noise: number, goal: number) =>
      `${tempo} Your weight jumps around too much to be sure of anything (±${kcal(noise)} a day), so the goal stays at ${kcal(goal)}. Weighing yourself every morning gives a surer result.`,
    onPlan: (tempo: string, goal: number) => `${tempo} That’s on plan — the goal stays at ${kcal(goal)}.`,
    burns: (observed: number, model: number) =>
      `Your diary and weight say you burn about ${kcal(observed)} a day; the model expected ${kcal(model)}.`,
    atFloor: (tempo: string, burns: string, goal: number, below: boolean, floorWords: string) =>
      `${tempo} ${burns} I won’t go lower: ${kcal(goal)} is already ${below ? 'less than ' : ''}${floorWords} — add steps instead of cutting food.`,
    suggest: (tempo: string, burns: string, suggested: number, goal: number) =>
      `${tempo} ${burns} I suggest ${kcal(suggested)} instead of ${kcal(goal)}`,
    capped: ` — ${STEP} kcal at a time; the next check-in will show the rest.`,
    floored: (floorWords: string) => ` I won’t go lower: that’s ${floorWords}.`,
    tooFast: ' Losing faster than planned costs muscle.',
  },
});

/**
 * Least-squares line through (day, kg): the slope in kg a day, the value at a day, and the slope's
 * standard error - how sure the scale is about the slope (wide with few weigh-ins or a jumpy scale).
 */
function trend(points: { x: number; kg: number }[]): { slope: number; se: number; at: (x: number) => number } {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.kg, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.kg - my), 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  const at = (x: number) => my + slope * (x - mx);
  const residuals = points.reduce((s, p) => s + (p.kg - at(p.x)) ** 2, 0);
  const se = n > 2 && sxx > 0 ? Math.sqrt(residuals / (n - 2) / sxx) : Number.POSITIVE_INFINITY;
  return { slope, se, at };
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
  // This morning's weigh-in counts: it closes the days eaten before it.
  const weighIns = [...days]
    .filter((d): d is DayRow & { weightKg: number } => d.weightKg != null && d.date >= from && d.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = weighIns[0]?.date ?? null;
  const last = weighIns[weighIns.length - 1]?.date ?? null;
  const spanDays = first && last ? daysBetween(first, last) : 0;
  const span = first ? Array.from({ length: spanDays }, (_, i) => addDays(first, i)) : [];
  const logged = span.filter((d) => (eaten.get(d) ?? 0) >= FULL_DAY * profile.dailyKcal);

  const applied = profile.kcalCorrection ?? 0;
  const lastWeight = weighIns[weighIns.length - 1]?.weightKg ?? profile.startWeightKg;
  const facts = {
    today,
    weighIns: weighIns.length,
    loggedDays: logged.length,
    spanDays,
    profileKcal: profile.dailyKcal,
  };
  const paceAt = (expenditure: number) => ((expenditure - profile.dailyKcal) * 7) / profile.kcalPerKg;

  const unchanged = (status: CheckInStatus, reason: string, extra: Partial<CheckIn> = {}): CheckIn => {
    const modelTdee = tdee(profile, lastWeight);
    return {
      ...facts,
      status,
      trendKg: null,
      observedPace: null,
      plannedPace: paceAt(modelTdee),
      observedTdee: null,
      modelTdee,
      suggestedKcal: profile.dailyKcal,
      correction: applied,
      limited: null,
      reason,
      ...extra,
    };
  };

  if (weighIns.length < MIN_WEIGH_INS || spanDays < MIN_SPAN || logged.length < MIN_LOGGED * spanDays) {
    return unchanged('za-malo-danych', T.needData(weighIns.length, spanDays, logged.length));
  }

  const line = trend(weighIns.map((d) => ({ x: daysBetween(first!, d.date), kg: d.weightKg })));
  const trendKg = line.at(spanDays);
  const meanIntake = logged.reduce((s, d) => s + eaten.get(d)!, 0) / logged.length;
  const observedTdee = meanIntake - line.slope * profile.kcalPerKg;
  const modelTdee = tdee(profile, trendKg);
  const resting = bmr(profile, trendKg);
  // A log that leaves food out makes anyone look like they burn little; water lost in the first
  // days of a diet makes them look like they burn a lot.
  if (observedTdee < 0.8 * resting || observedTdee > 2.5 * resting)
    return unchanged('za-malo-danych', T.implausible(observedTdee, resting, observedTdee < resting));

  const observedPace = -line.slope * 7;
  const plannedPace = paceAt(modelTdee);
  const sexMinimum = profile.sex === 'M' ? 1500 : 1200;
  const floor = Math.max(round10(resting), sexMinimum);
  const floorWords = floor === sexMinimum ? T.minimum(floor, profile.sex === 'M') : T.basal(floor);
  const common = { ...facts, trendKg, observedPace, plannedPace, observedTdee, modelTdee };
  const tempo = T.tempo(spanDays, paceText(observedPace), paceText(plannedPace));

  // What the scale says the model still gets wrong - only the part the trend is sure of.
  const error = observedTdee - modelTdee;
  const noise = CONFIDENCE * line.se * profile.kcalPerKg;
  const sure = Math.sign(error) * Math.max(0, Math.abs(error) - noise);
  const step = clamp(sure, STEP);
  const correction = Math.round(applied + step);
  const noisy = Math.abs(error) >= TOLERANCE && Math.abs(sure) < TOLERANCE;

  const direction = goalDirection(profile);
  const reached =
    (direction === 'loss' && trendKg <= profile.targetWeightKg) ||
    (direction === 'gain' && trendKg >= profile.targetWeightKg);
  if (reached) {
    // Keeping the weight: the model's maintenance with what the scale measured, in steps.
    const maintenance = round10(modelTdee + step);
    const move = clamp(maintenance - profile.dailyKcal, MAINTENANCE_STEP);
    const keep = Math.abs(move) < TOLERANCE ? profile.dailyKcal : Math.max(floor, round10(profile.dailyKcal + move));
    const done = T.reached(profile.targetWeightKg, trendKg);
    return {
      ...common,
      status: 'cel',
      suggestedKcal: keep,
      correction,
      limited: keep === profile.dailyKcal ? null : keep === floor && floor > maintenance ? 'floor' : keep !== maintenance ? 'cap' : null,
      reason: keep === profile.dailyKcal ? T.keepGoal(done, keep) : T.maintenance(done, keep, keep !== maintenance ? maintenance : null),
    };
  }

  if (Math.abs(step) < TOLERANCE)
    return {
      ...common,
      status: 'zgodnie',
      suggestedKcal: profile.dailyKcal,
      correction: applied,
      limited: null,
      reason: noisy ? T.noisy(tempo, noise, profile.dailyKcal) : T.onPlan(tempo, profile.dailyKcal),
    };

  let suggested = round10(profile.dailyKcal + step);
  let limited: CheckIn['limited'] = Math.abs(sure) > STEP ? 'cap' : null;
  // Never lower below the floor; a goal already below it is not raised by a correction downwards.
  if (step < 0 && suggested < floor) {
    suggested = Math.max(suggested, Math.min(floor, profile.dailyKcal));
    limited = 'floor';
  }
  const burns = T.burns(round10(observedTdee), round10(modelTdee));
  if (suggested === profile.dailyKcal)
    return {
      ...common,
      status: 'zgodnie',
      suggestedKcal: suggested,
      correction,
      limited,
      reason: T.atFloor(tempo, burns, profile.dailyKcal, profile.dailyKcal < floor, floorWords),
    };
  const reason =
    T.suggest(tempo, burns, suggested, profile.dailyKcal) +
    (limited === 'cap' ? T.capped : '.') +
    (limited === 'floor' ? T.floored(floorWords) : '') +
    // Losing faster than planned is not a bonus: it costs muscle and patience.
    (direction === 'loss' && observedPace > plannedPace + 0.1 && step > 0 ? T.tooFast : '');
  return { ...common, status: 'korekta', suggestedKcal: suggested, correction, limited, reason };
}
