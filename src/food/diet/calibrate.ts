import { bmr } from './energy';
import { addDays, daysBetween, mondayOf } from './model';
import {
  burnOf,
  hardMinOf,
  hidesKcal,
  impliedPace,
  isComplete,
  maintenanceOf,
  minTargetOf,
  pauseOn,
  r10,
  r50,
  safePace,
  safety,
  setTarget,
  snap05,
  targetFor,
  targetOn,
} from './target';
import { leastSquares, trendOn, type WeighIn } from './trend';
import type { CheckFacts, CheckReason, Profile, Reached, WeekCheck } from './types';

/**
 * The Monday check (spec 2026-10-24 §2.4): once a week it compares what was logged with the weight
 * trend of the last 4 weeks and either leaves the target alone or moves it by exactly 100 kcal.
 * Raises are applied (with „Zostaw”), a cut that comes from a lower burn is asked first, a person
 * who loses faster than planned never gets a cut, and after any change it does not turn back for 4
 * weeks unless the gap reaches 200. Safety first: a target under the floor goes up by 100 a week
 * whatever the data, and a reached target weight switches to maintenance.
 *
 * Pure functions: the store runs `weeklyCheck` in one transaction (`runWeeklyCheck`) and applies
 * the card's answers with `applyAnswer` (`answerCheck`).
 */

export const CHECK = {
  window: 28, // days [M−28, M−1]
  minWeighIns: 5,
  minSpan: 14,
  minCompleteShare: 0.75, // of non-paused days in [first weigh-in, last weigh-in)
  completeDay: 0.6,
  settleDays: 14,
  majorChange: 300,
  confidence: 1.5, // believe only the part of the error beyond 1.5 honest SE
  residualFloorKg: 0.35,
  r1Max: 0.6,
  r1Default: 0.3,
  r1MinN: 10,
  beliefStep: 150,
  offsetLimit: 1500,
  deadBand: 100,
  step: 100,
  holdDays: 28,
  holdEscape: 200,
  userCooldown: 14,
  paceGuard: 0.1, // kg/week
  noisy: 150, // "scale jumps" note when 1.5·SE ≥ 150 kcal
  plausible: [0.8, 2.5], // × BMR at the trend weight
  quietMin: { weighIns: 3, completeDays: 7 }, // no Monday text below this (28-day window)
  reachedAskAgainDays: 28,
  reachedBeyondKg: 1,
} as const;

/** On a Monday the check waits until 04:00: Sunday's dinner may still be logged. */
const MONDAY_FROM_HOUR = 4;
/** A move counts as coming from the burn when it moves the ideal target by at least this much. */
const BURN_PART = 50;
/** The stored pace range, kg a week (positive when losing). */
const PACE_RANGE = [-0.5, 1] as const;

const clampTo = (n: number, limit: number): number => Math.min(limit, Math.max(-limit, n)) || 0;
const sign = (n: number): -1 | 0 | 1 => (n > 0 ? 1 : n < 0 ? -1 : 0);
const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`);

/** Days from `from` (included) to `to` (excluded). */
function daysFrom(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** One weigh-in a day (the last given wins), oldest first, unreadable ones left out — as `trend.ts` reads them. */
function oneADay(weighIns: readonly WeighIn[]): WeighIn[] {
  const days = new Map<string, WeighIn>();
  for (const w of weighIns)
    if (Number.isFinite(w.kg) && w.kg > 0 && !Number.isNaN(noon(w.day))) days.set(w.day, { day: w.day, kg: w.kg });
  return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Whether this week's check is still to run: not yet this week, and not on a Monday before 04:00. */
export function checkDue(p: Pick<Profile, 'lastCheck'>, today: string, hour: number): boolean {
  const monday = mondayOf(today);
  if (p.lastCheck && p.lastCheck.week >= monday) return false;
  return !(today === monday && hour < MONDAY_FROM_HOUR);
}

export interface CheckInput<P extends Profile = Profile> {
  /** The profile as the normaliser gives it (`dailyKcal` is today's target). */
  profile: P;
  /** The gym weight log (`GymBridge.weights`). */
  weighIns: readonly WeighIn[];
  /** Logged kcal per date over [M−28, M−1] (dates without entries left out). */
  eaten: ReadonlyMap<string, number>;
  /** The person's word on a day's log (`DayRow.partial`) per date. */
  partial: ReadonlyMap<string, boolean>;
  today: string;
  /** The local hour now (the Monday check waits until 04:00). */
  hour: number;
}

export interface CheckOutcome<P extends Profile = Profile> {
  check: WeekCheck;
  /** The profile after the check, `lastCheck` included: what to store. */
  profile: P;
}

/** A new target from today, unless it is the target already (no history entry for nothing). */
function retarget<P extends Profile>(p: P, kcal: number, today: string, by: 'check' | 'user'): P {
  return kcal === p.dailyKcal ? p : setTarget(p, kcal, today, by, today);
}

/**
 * Honest uncertainty of the observed burn, kcal a day: the slope's honest SE (`leastSquares`)
 * times the energy in a kilogram, with the intake's SE (finite-population corrected over the span
 * days) added in quadrature.
 */
function burnSe(slopeSe: number, kcalPerKg: number, intakes: readonly number[], spanDays: number): number {
  const n = intakes.length;
  const mean = intakes.reduce((s, x) => s + x, 0) / n;
  const sd = n > 1 ? Math.sqrt(intakes.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const intakeSe = (sd / Math.sqrt(n)) * Math.sqrt(Math.max(0, 1 - n / spanDays));
  return Math.hypot(kcalPerKg * slopeSe, intakeSe);
}

/**
 * The trend was on the far side of the target weight when the person last set the target (a `user`,
 * `setup` or `migration` entry): only then is being there an arrival. A pace that came from a kept
 * or typed target while already at the target weight („Zostaw” for a maintainer) is not one.
 * Without a trend on that day there is nothing to contradict the arrival.
 */
function crossed(p: Profile, weighIns: readonly WeighIn[], losing: boolean): boolean {
  const set = [...p.goals].reverse().find((g) => g.by === 'user' || g.by === 'setup' || g.by === 'migration');
  const then = set ? trendOn(weighIns, set.from) : null;
  if (then === null) return true;
  return losing ? then > p.targetWeightKg + CROSS_KG : then < p.targetWeightKg - CROSS_KG;
}

/** How far on the far side the trend must have been when the target was set (kg). */
const CROSS_KG = 0.05;

/** The display trend has reached the target weight in the plan's direction (and may be asked about). */
function reachedNow(p: Profile, weighIns: readonly WeighIn[], monday: string): number | null {
  const lastDay = addDays(monday, -1);
  if (!weighIns.some((w) => w.day >= addDays(monday, -14) && w.day <= lastDay)) return null;
  const trend = trendOn(weighIns, lastDay);
  if (trend === null) return null;
  const losing = p.goalPace > 0;
  const there = (losing && trend <= p.targetWeightKg) || (p.goalPace < 0 && trend >= p.targetWeightKg);
  if (!there) return null;
  const before: Reached | null = p.reached;
  if (before === null && !crossed(p, weighIns, losing)) return null;
  const further = before !== null && (losing ? before.kg - trend : trend - before.kg) >= CHECK.reachedBeyondKg - 1e-9;
  const allowed = before === null || (before.askAgain !== null && monday >= before.askAgain) || further;
  return allowed ? trend : null;
}

/**
 * This week's check (§2.4), or null when there is nothing to do: already done this week, or a
 * Monday before 04:00. Every other outcome is stored as `lastCheck`, with what it changed.
 */
export function weeklyCheck<P extends Profile>(input: CheckInput<P>): CheckOutcome<P> | null {
  const { profile: p, today } = input;
  if (!checkDue(p, today, input.hour)) return null;
  const monday = mondayOf(today);
  const lastDay = addDays(monday, -1);
  const windowStart = addDays(monday, -CHECK.window);
  const cur = p.dailyKcal;
  const weighIns = oneADay(input.weighIns);
  const kgNow = trendOn(weighIns, lastDay) ?? p.startWeightKg;
  const done = (next: P, check: Partial<WeekCheck>): CheckOutcome<P> => {
    const full: WeekCheck = {
      week: monday,
      status: 'same',
      from: cur,
      to: cur,
      reason: null,
      note: null,
      settle: null,
      facts: null,
      missing: null,
      floor: null,
      offsetAfter: null,
      goalPace: next.goalPace,
      answer: null,
      ...check,
    };
    return { check: full, profile: { ...next, lastCheck: full } };
  };

  // 1. No check for minors and in pregnancy.
  if (p.age < 18 || p.pregnancy) return done(p, { status: 'off' });

  // 2. A break today or last week: nothing to compare.
  const paused = (d: string) => pauseOn(p, d) !== null;
  if (paused(today) || p.pauses.some((x) => x.from <= lastDay && x.to >= addDays(monday, -7)))
    return done(p, { status: 'paused' });

  // 3. Safety first: a target under the floor goes up by 100 a week, whatever the data says.
  const floor = minTargetOf(p, kgNow);
  if (cur < floor) {
    const to = Math.min(floor, cur + CHECK.step);
    const hold = { dir: -1 as const, until: addDays(monday, CHECK.holdDays) };
    return done({ ...retarget(p, to, today, 'check'), hold }, { status: 'changed', reason: 'floor-up', to, floor });
  }

  // 4. The target weight reached: maintenance (applied, or proposed when the person fits it alone).
  const reachedAt = reachedNow(p, weighIns, monday);
  if (reachedAt !== null) {
    const to = maintenanceOf(p, reachedAt);
    const reached: Reached = { at: monday, kg: reachedAt, prevPace: p.goalPace, prevKcal: cur, askAgain: null };
    if (!p.autoAdjust) return done({ ...p, reached }, { status: 'reached', reason: 'reached', to });
    const next = {
      ...retarget(p, to, today, 'check'),
      goalPace: 0,
      settle: { from: addDays(today, CHECK.settleDays), why: 'change' as const },
      reached,
    };
    return done(next, { status: 'reached', reason: 'reached', to });
  }

  // 5. Enough data since the last settle: ≥ 5 weigh-ins over ≥ 14 days, ¾ of the days logged in full.
  const complete = (d: string) => !paused(d) && isComplete(input.eaten.get(d), input.partial.get(d), targetOn(p, d));
  const missing = () => ({
    weighIns: weighIns.filter((w) => w.day >= windowStart && w.day <= lastDay).length,
    completeDays: daysFrom(windowStart, monday).filter(complete).length,
  });
  const start = p.settle.from > windowStart ? p.settle.from : windowStart;
  const used = weighIns.filter((w) => w.day >= start && w.day <= lastDay);
  const first = used[0]?.day ?? lastDay;
  const last = used.at(-1)?.day ?? lastDay;
  const span = daysBetween(first, last);
  if (used.length < CHECK.minWeighIns || span < CHECK.minSpan) {
    return p.settle.from > windowStart
      ? done(p, { status: 'settling', settle: p.settle.why, missing: missing() })
      : done(p, { status: 'data', missing: missing() });
  }
  const spanDays = daysFrom(first, last).filter((d) => !paused(d));
  const fullDays = spanDays.filter(complete);
  if (!fullDays.length || fullDays.length < CHECK.minCompleteShare * spanDays.length)
    return done(p, { status: 'data', missing: missing() });

  // 6. The estimate: what was really eaten against the weight's slope.
  const line = leastSquares(used)!;
  const trendKg = line.at(last);
  const intakes = fullDays.map((d) => input.eaten.get(d) ?? 0);
  const intake = intakes.reduce((s, x) => s + x, 0) / intakes.length;
  const observed = intake - line.slope * p.kcalPerKg;
  const se = burnSe(line.se, p.kcalPerKg, intakes, spanDays.length);
  const before = burnOf(p, trendKg);
  const factsFor = (offset: number): CheckFacts => ({
    from: first,
    to: last,
    weeks: Math.min(4, Math.max(2, Math.round(span / 7))),
    weighIns: used.length,
    completeDays: fullDays.length,
    spanDays: spanDays.length,
    pace: -line.slope * 7 || 0,
    paceSe: line.se * 7,
    intake: r10(intake),
    burn: r50(observed),
    burnSe: Math.max(50, r50(2 * se)),
    before: r50(before),
    after: r50(burnOf({ ...p, burnOffset: offset }, trendKg)),
    trendKg,
  });
  const rest = bmr(p, trendKg);
  if (observed < CHECK.plausible[0] * rest || observed > CHECK.plausible[1] * rest)
    return done(p, { status: 'implausible', facts: factsFor(p.burnOffset) });

  const err = observed - before;
  const sure = sign(err) * Math.max(0, Math.abs(err) - CHECK.confidence * se);
  const belief = clampTo(sure, CHECK.beliefStep);
  const offset = clampTo(p.burnOffset + belief, CHECK.offsetLimit);
  const learned: P = { ...p, burnOffset: offset, anchored: true };
  const facts = factsFor(offset);
  const idealOld = targetFor(p, trendKg);
  const ideal = targetFor(learned, trendKg);
  const gap = ideal - cur;
  const dir = sign(gap);
  const pace = -line.slope * 7;

  // 7. Decide.
  if (Math.abs(gap) < CHECK.deadBand) {
    const safe = safePace(learned, trendKg, learned.goalPace);
    const raw = r50(burnOf(learned, trendKg) - (safe * learned.kcalPerKg) / 7);
    const min = safe > 0 ? minTargetOf(learned, trendKg) : hardMinOf(learned);
    if (raw < min) return done(learned, { status: 'same', note: 'floor', floor: min, facts });
    return done(learned, { status: 'same', note: CHECK.confidence * se >= CHECK.noisy ? 'noisy' : null, facts });
  }
  const hold = p.hold;
  if (hold && monday < hold.until && (hold.dir === 0 || (hold.dir === dir && Math.abs(gap) < CHECK.holdEscape)))
    return done(learned, { status: 'same', note: 'held', facts });
  if (dir < 0 && pace > p.goalPace + CHECK.paceGuard) return done(learned, { status: 'same', note: 'pace', facts });
  if (dir > 0 && pace < p.goalPace - CHECK.paceGuard) return done(learned, { status: 'same', note: 'pace', facts });
  if (dir < 0 && hidesKcal(p)) return done(learned, { status: 'same', note: 'quiet', facts });

  // `ideal` never goes below `minTargetOf`, so a cut of 100 never crosses it.
  const next = cur + dir * CHECK.step;
  const burnPart = ideal - idealOld;
  const reason: CheckReason = (dir > 0 ? burnPart >= BURN_PART : burnPart <= -BURN_PART) ? 'burn' : 'weight';
  // A cut from a lower burn is asked first: under-logging biases the burn down. Nothing is learned yet.
  if (dir < 0 && burnPart <= -BURN_PART)
    return done(p, { status: 'ask', to: next, reason, offsetAfter: offset, facts: factsFor(p.burnOffset) });
  if (!p.autoAdjust) return done(learned, { status: 'suggested', to: next, reason, facts });
  const changed = {
    ...setTarget(learned, next, today, 'check', today),
    hold: { dir: sign(-dir), until: addDays(monday, CHECK.holdDays) },
  };
  return done(changed, { status: 'changed', to: next, reason, facts });
}

/** A `reached` check that switched to maintenance itself (its pace is 0), not a proposal. */
export const reachedApplied = (c: WeekCheck): boolean => c.status === 'reached' && c.goalPace === 0;

/**
 * The Monday card still waiting for an answer: a change, a question, a suggestion or a reached
 * target weight, unanswered, and the target not changed another way since (§2.4).
 */
export function waitingCheck(p: Pick<Profile, 'lastCheck' | 'dailyKcal'>): WeekCheck | null {
  const c = p.lastCheck;
  if (!c || c.answer !== null) return null;
  switch (c.status) {
    case 'changed':
      return p.dailyKcal === c.to ? c : null;
    case 'ask':
    case 'suggested':
      return p.dailyKcal === c.from ? c : null;
    case 'reached':
      return p.dailyKcal === (reachedApplied(c) ? c.to : c.from) ? c : null;
    default:
      return null;
  }
}

/**
 * Whether „Zostaw {from} kcal” is offered on an applied change from the burn or the weight: the pace
 * the old target implies stays within the safe pace, and the old target is not under the floor.
 */
export function keepAllowed(p: Profile, c: WeekCheck, kgNow: number): boolean {
  const implied = impliedPace(p, kgNow, c.from);
  const { maxLoss, maxGain } = safety(p, kgNow);
  return implied <= maxLoss + 1e-9 && implied >= -maxGain - 1e-9 && c.from >= minTargetOf(p, kgNow);
}

export interface AnswerContext {
  today: string;
  /** The weight the targets use now (`currentWeight`: the display trend, else the start weight). */
  kgNow: number;
}

/**
 * An answer to the Monday card (§2.4 „Answers”), as the profile to store; null when the card does
 * not take that answer (or is not waiting any more). Every answer records itself on `lastCheck`.
 */
export function applyAnswer<P extends Profile>(
  p: P,
  answer: NonNullable<WeekCheck['answer']>,
  ctx: AnswerContext,
): P | null {
  const c = waitingCheck(p);
  if (!c) return null;
  const dir = sign(c.to - c.from);
  const inFour = addDays(ctx.today, CHECK.holdDays);
  const fourAfterMonday = addDays(c.week, CHECK.holdDays);
  const answered = (next: P): P => ({ ...next, lastCheck: { ...c, answer } });
  switch (c.status) {
    case 'changed': {
      if (answer === 'ok') return answered(p);
      if (answer !== 'keep') return null;
      if (c.reason === 'floor-up') {
        // A target agreed with a doctor or dietitian: the floor is the hard minimum from now on.
        if (c.from < hardMinOf(p)) return null;
        const next = retarget({ ...p, belowFloorOk: true }, c.from, ctx.today, 'user');
        return answered({ ...next, hold: { dir, until: inFour } });
      }
      if (!keepAllowed(p, c, ctx.kgNow)) return null;
      // „A manual target is a pace, too” (§2.2): the kept target's pace, in the stored range.
      const implied = snap05(impliedPace(p, ctx.kgNow, c.from));
      const goalPace = Math.min(PACE_RANGE[1], Math.max(PACE_RANGE[0], implied)) || 0;
      return answered({ ...retarget(p, c.from, ctx.today, 'user'), goalPace, hold: { dir, until: inFour } });
    }
    case 'ask':
      if (answer === 'yes') {
        const learned = { ...p, burnOffset: c.offsetAfter ?? p.burnOffset, anchored: true };
        return answered({ ...retarget(learned, c.to, ctx.today, 'check'), hold: { dir: 1, until: fourAfterMonday } });
      }
      // „Nie zawsze”: the low burn is not learned, and no cut comes back for 4 weeks.
      if (answer === 'no') return answered({ ...p, hold: { dir: -1, until: fourAfterMonday } });
      return null;
    case 'suggested':
      if (answer === 'set')
        return answered({ ...retarget(p, c.to, ctx.today, 'check'), hold: { dir: sign(-dir), until: inFour } });
      if (answer === 'later') return answered({ ...p, hold: { dir, until: inFour } });
      return null;
    case 'reached': {
      if (!p.reached) return null;
      const askAgain = { ...p.reached, askAgain: fourAfterMonday };
      if (reachedApplied(c)) {
        if (answer === 'ok') return answered(p);
        if (answer !== 'continue') return null;
        const back = retarget({ ...p, goalPace: p.reached.prevPace }, p.reached.prevKcal, ctx.today, 'user');
        return answered({ ...back, reached: askAgain });
      }
      if (answer === 'set') {
        const next = {
          ...retarget({ ...p, goalPace: 0 }, c.to, ctx.today, 'check'),
          settle: { from: addDays(ctx.today, CHECK.settleDays), why: 'change' as const },
        };
        return answered(next);
      }
      if (answer === 'continue') return answered({ ...p, reached: askAgain });
      return null;
    }
    default:
      return null;
  }
}
