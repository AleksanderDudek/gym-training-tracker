import { describe, expect, test } from 'vitest';
import { applyAnswer, CHECK, checkDue, keepAllowed, reachedApplied, waitingCheck, weeklyCheck } from './calibrate';
import { addDays } from './model';
import { eer, maintenanceOf } from './target';
import type { WeighIn } from './trend';
import type { Profile, WeekCheck } from './types';
import { newProfile } from './validate';

/*
 * The Monday check (spec §2.4) on synthetic weeks: every number is from the spec's examples or
 * worked out next to the test. Weigh-ins lie on a straight line; the ±0,02 kg alternating on top
 * keeps the scale's noise at the 0,35 kg floor with no autocorrelation, so the honest SE of 28
 * daily weigh-ins is the spec's 61,4 kcal and 1,5 SE is 92 kcal.
 */

const M = '2026-10-26'; // a Monday
const at = (offset: number) => addDays(M, offset);
const START = '2026-08-03';

/** M 35 y, 175 cm, inactive, −0,5 kg a week, target 2100, offset 0, started in August. */
const man = (over: Partial<Profile> = {}): Profile =>
  newProfile(
    { sex: 'M', age: 35, heightCm: 175, startWeightKg: 82, targetWeightKg: 70, startDate: START, goalPace: 0.5, dailyKcal: 2100, ...over },
    START,
  );

/** The upgraded owner (§2.10 A): offset −241, 1860, −0,5 kg a week, anchored. */
const owner = (over: Partial<Profile> = {}): Profile =>
  man({ dailyKcal: 1860, burnOffset: -241, anchored: true, goals: [{ from: '2026-09-01', kcal: 1860, by: 'migration' }], ...over });

/** Daily weigh-ins from M+`from` to M+`to` on a line ending at `endKg`, losing `perWeek` kg a week. */
function weighIns(endKg: number, perWeek: number, { from = -28, to = -1, jitter = 0.02 } = {}): WeighIn[] {
  const out: WeighIn[] = [];
  for (let d = from; d <= to; d++)
    out.push({ day: at(d), kg: endKg + (perWeek / 7) * (to - d) + (d % 2 ? jitter : -jitter) });
  return out;
}

/** The same kcal logged every day from M+`from` to M+`to`. */
function eatenEvery(kcal: number, from = -28, to = -1): Map<string, number> {
  const out = new Map<string, number>();
  for (let d = from; d <= to; d++) out.set(at(d), kcal);
  return out;
}

function check(
  profile: Profile,
  w: readonly WeighIn[],
  eaten: Map<string, number>,
  { today = M, hour = 9, partial = new Map<string, boolean>() } = {},
) {
  return weeklyCheck({ profile, weighIns: w, eaten, partial, today, hour });
}

/** The check that ran, asserted to exist. */
function ran(profile: Profile, w: readonly WeighIn[], eaten: Map<string, number>, opts = {}) {
  const out = check(profile, w, eaten, opts);
  if (!out) throw new Error('the check did not run');
  return out;
}

describe('A1 — a Monday cut is asked first (example F)', () => {
  // 28 daily weigh-ins 80,000 − 0,025·i; 2100 kcal logged every day.
  const exact = Array.from({ length: 28 }, (_, i) => ({ day: at(-28 + i), kg: 80 - 0.025 * i }));
  const p = man({ startWeightKg: 80 });

  test('trend 79,325, prior 2630, observed 2287,5, SE 61,4 → belief −150, ideal 1950 → „ask” 2000', () => {
    const { check: c, profile } = ran(p, exact, eatenEvery(2100));
    expect(c).toMatchObject({ week: M, status: 'ask', from: 2100, to: 2000, reason: 'burn', offsetAfter: -150, answer: null });
    expect(c.facts).toMatchObject({
      from: at(-28),
      to: at(-1),
      weeks: 4,
      weighIns: 28,
      completeDays: 27,
      spanDays: 27,
      intake: 2100,
      burn: 2300,
      burnSe: 100,
      before: 2650,
      after: 2650,
    });
    expect(c.facts!.trendKg).toBeCloseTo(79.325, 9);
    expect(c.facts!.pace).toBeCloseTo(0.175, 9);
    // Nothing is applied and nothing is learned until the answer.
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: 0, anchored: false, lastCheck: c });
    expect(profile.goals).toEqual(p.goals);
  });

  test('„Tak — ustaw” → 2000 from today, offset −150, no raise back for 4 weeks', () => {
    const asked = ran(p, exact, eatenEvery(2100)).profile;
    const yes = applyAnswer(asked, 'yes', { today: M, kgNow: 79.4 })!;
    expect(yes).toMatchObject({ dailyKcal: 2000, burnOffset: -150, anchored: true, hold: { dir: 1, until: at(28) } });
    expect(yes.goals.at(-1)).toEqual({ from: M, kcal: 2000, by: 'check' });
    expect(yes.lastCheck?.answer).toBe('yes');
    // Answered: the card is gone, a second answer changes nothing.
    expect(waitingCheck(yes)).toBeNull();
    expect(applyAnswer(yes, 'yes', { today: M, kgNow: 79.4 })).toBeNull();
  });

  test('A15 „Nie zawsze — zostaw” → 2100 stays, nothing learned, no cut for 4 weeks', () => {
    const asked = ran(p, exact, eatenEvery(2100)).profile;
    const no = applyAnswer(asked, 'no', { today: M, kgNow: 79.4 })!;
    expect(no).toMatchObject({ dailyKcal: 2100, burnOffset: 0, hold: { dir: -1, until: at(28) } });
    expect(no.goals).toEqual(p.goals);
    expect(no.lastCheck).toMatchObject({ status: 'ask', answer: 'no' });
  });
});

describe('A2–A3 — eating over the target is not punished; noise is named', () => {
  // Eats 2250 (target 2100 + 150) and loses what the prior predicts at that intake.
  const trend = 79.3;
  const pace = ((eer(man(), trend) - 2250) * 7) / 7500;

  test('A2 intake = target + 150, weight following the prior → „same”, no change', () => {
    const { check: c, profile } = ran(man(), weighIns(trend, pace), eatenEvery(2250));
    expect(c).toMatchObject({ status: 'same', from: 2100, to: 2100, note: null });
    expect(profile.dailyKcal).toBe(2100);
    expect(Math.abs(profile.burnOffset)).toBeLessThan(1);
    expect(profile.anchored).toBe(true);
  });

  test('A3 an exact 28-point line is not noisy: 1,5 SE = 92 < 150', () => {
    // Example F's line (80 − 0,025·i, trend 79,325, 0,175 kg a week), eaten what the prior predicts.
    const exact = Array.from({ length: 28 }, (_, i) => ({ day: at(-28 + i), kg: 80 - 0.025 * i }));
    const p = man({ startWeightKg: 80 });
    const { check: c } = ran(p, exact, eatenEvery(eer(p, 79.325) - 187.5));
    expect(c).toMatchObject({ status: 'same', note: null });
    // ±max(50, round50(2 SE)): 2 × 61,4 → 100.
    expect(c.facts?.burnSe).toBe(100);
  });

  test('A3 six weigh-ins over 14 days, ±0,8 kg → „noisy”, because 1,5 SE ≥ 150', () => {
    const days = [-15, -12, -9, -7, -4, -1];
    const w = days.map((d, i) => ({ day: at(d), kg: 80 + (i % 2 ? -0.8 : 0.8) }));
    const { check: c } = ran(man(), w, eatenEvery(2250, -15, -1));
    expect(c).toMatchObject({ status: 'same', note: 'noisy' });
    expect(c.facts).toMatchObject({ weighIns: 6, spanDays: 14, weeks: 2 });
    // burnSe is 2 SE rounded to 50: 1,5 SE ≥ 150 means 2 SE ≥ 200.
    expect(c.facts!.burnSe).toBeGreaterThanOrEqual(200);
  });
});

describe('A4 — the dead band and the fixed step', () => {
  test('a gap of 60 → „same”', () => {
    const p = man({ dailyKcal: 2040 });
    const pace = ((eer(p, 79.3) - 2250) * 7) / 7500;
    const { check: c, profile } = ran(p, weighIns(79.3, pace), eatenEvery(2250));
    expect(c).toMatchObject({ status: 'same', to: 2040 });
    expect(profile.dailyKcal).toBe(2040);
  });

  test('burn up so the ideal is the target + 250 → „changed” by exactly 100, applied, no cut back for 4 weeks', () => {
    // Loses 0,5 kg a week on 2450 kcal: observed ≈ 2986 against a prior of 2630 → belief +150 → ideal 2250.
    const p = man({ dailyKcal: 2000 });
    const { check: c, profile } = ran(p, weighIns(79.3, 0.5), eatenEvery(2450));
    expect(c).toMatchObject({ status: 'changed', from: 2000, to: 2100, reason: 'burn' });
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: 150, anchored: true, hold: { dir: -1, until: at(28) } });
    expect(profile.goals.at(-1)).toEqual({ from: M, kcal: 2100, by: 'check' });
    expect(c.facts).toMatchObject({ before: 2650, after: 2800 });
  });

  test('the owner’s 1860 with an ideal of 1750 (the floor) → asked, to 1760 — no re-rounding', () => {
    // Loses 0,3 kg a week on 1700 kcal: observed ≈ 2021 against a prior of 2398,5 → belief −150 → raw 1700, floor 1750.
    const { check: c } = ran(owner(), weighIns(80, 0.3), eatenEvery(1700));
    expect(c).toMatchObject({ status: 'ask', from: 1860, to: 1760, reason: 'burn', offsetAfter: -391 });
  });
});

describe('A5 — the floor', () => {
  test('a man at 80 kg (floor 1750), target 1800, raw ideal 1600 → „same” with the floor note', () => {
    // Offset −500 already learned and confirmed (observed = prior): raw r50(2139,5 − 535,7) = 1600.
    const p = man({ startWeightKg: 80, dailyKcal: 1800, burnOffset: -500 });
    const { check: c } = ran(p, weighIns(80, 0.5), eatenEvery(eer(p, 80) - 500 - 535.7));
    expect(c).toMatchObject({ status: 'same', note: 'floor', floor: 1750, to: 1800 });
  });

  test('floor-up: 1650 with no weigh-ins at all → „changed” to 1750, reason „floor-up”', () => {
    const p = man({ startWeightKg: 80, dailyKcal: 1650 });
    const { check: c, profile } = ran(p, [], new Map());
    expect(c).toMatchObject({ status: 'changed', reason: 'floor-up', from: 1650, to: 1750, floor: 1750 });
    expect(profile.dailyKcal).toBe(1750);
    expect(profile.goals.at(-1)).toEqual({ from: M, kcal: 1750, by: 'check' });
  });

  test('floor-up moves 100 a week at most', () => {
    const { check: c } = ran(man({ startWeightKg: 80, dailyKcal: 1550 }), [], new Map());
    expect(c).toMatchObject({ status: 'changed', reason: 'floor-up', to: 1650 });
  });

  test('a doctor- or dietitian-agreed target (belowFloorOk) is not raised', () => {
    const { check: c, profile } = ran(man({ startWeightKg: 80, dailyKcal: 1650, belowFloorOk: true }), [], new Map());
    expect(c.status).toBe('data');
    expect(profile.dailyKcal).toBe(1650);
  });
});

describe('A6 — once a week', () => {
  const data = [weighIns(79.3, 0.5), eatenEvery(2450)] as const;

  test('the same week again → nothing', () => {
    const first = ran(man({ dailyKcal: 2000 }), ...data).profile;
    expect(check(first, ...data)).toBeNull();
    expect(check(first, ...data, { today: at(3), hour: 20 })).toBeNull();
  });

  test('a stored check for a later week → nothing', () => {
    const later = man({ lastCheck: { ...man().lastCheck!, week: at(7) } });
    expect(check(later, ...data)).toBeNull();
  });

  test('due: not yet this week, and not on a Monday before 04:00', () => {
    const p = man();
    expect(checkDue(p, M, 3)).toBe(false);
    expect(checkDue(p, M, 4)).toBe(true);
    expect(checkDue(p, at(1), 1)).toBe(true);
    expect(checkDue({ lastCheck: null }, M, 9)).toBe(true);
    expect(checkDue({ lastCheck: { ...p.lastCheck!, week: M } }, at(2), 9)).toBe(false);
  });
});

describe('A7 — settling after a change', () => {
  test('a user change of −400 on M−5 (settle until M+9) → „settling”, why „change”', () => {
    const p = man({
      dailyKcal: 2100,
      goals: [
        { from: START, kcal: 2500, by: 'setup' },
        { from: at(-5), kcal: 2100, by: 'user' },
      ],
      settle: { from: at(9), why: 'change' },
      hold: { dir: 0, until: at(9) },
    });
    const { check: c } = ran(p, weighIns(79.3, 0.5), eatenEvery(2100));
    expect(c).toMatchObject({ status: 'settling', settle: 'change', missing: { weighIns: 28, completeDays: 28 } });
  });

  test('a change of −200 has no settle, but the 2-week hold → „same” with „held”', () => {
    const p = man({
      dailyKcal: 1900,
      goals: [
        { from: START, kcal: 2100, by: 'setup' },
        { from: at(-5), kcal: 1900, by: 'user' },
      ],
      hold: { dir: 0, until: at(9) },
    });
    const pace = ((eer(p, 79.3) - 2100) * 7) / 7500;
    // Observed = prior → the ideal is the chips' 2100, 200 above the target: held.
    const { check: c, profile } = ran(p, weighIns(79.3, pace), eatenEvery(2100));
    expect(c).toMatchObject({ status: 'same', note: 'held', to: 1900 });
    expect(profile.dailyKcal).toBe(1900);
  });
});

describe('A8 — breaks and missing data', () => {
  const data = [weighIns(79.3, 0.5), eatenEvery(2450)] as const;

  test('a break on [M−10, M−3] → „paused”', () => {
    const { check: c } = ran(man({ pauses: [{ from: at(-10), to: at(-3), kcal: 2100 }] }), ...data);
    expect(c.status).toBe('paused');
  });

  test('a break covering today → „paused”', () => {
    const { check: c } = ran(man({ pauses: [{ from: at(0), to: at(6), kcal: 2100 }] }), ...data);
    expect(c.status).toBe('paused');
  });

  test('a break that ended before last week is no pause', () => {
    const { check: c } = ran(man({ pauses: [{ from: at(-30), to: at(-29), kcal: 2100 }] }), ...data);
    expect(c.status).not.toBe('paused');
  });

  test('no weigh-ins → „data”, with what is there', () => {
    const { check: c } = ran(man(), [], eatenEvery(2000));
    expect(c).toMatchObject({ status: 'data', missing: { weighIns: 0, completeDays: 28 } });
  });

  test('weigh-ins but half the days logged → „data”', () => {
    const half = new Map([...eatenEvery(2000)].filter((_, i) => i % 2 === 0));
    const { check: c } = ran(man(), weighIns(79.3, 0.5), half);
    expect(c).toMatchObject({ status: 'data', missing: { weighIns: 28, completeDays: 14 } });
  });

  test('a day marked incomplete does not count; under 60 % of the target does not either; marked whole, it does', () => {
    const eaten = eatenEvery(2000);
    eaten.set(at(-3), 1000); // < 60 % of 2100
    const partial = new Map([
      [at(-2), true],
      [at(-4), false],
    ]);
    eaten.set(at(-4), 500); // marked whole: counts
    const { check: c } = ran(man(), [], eaten, { partial });
    expect(c.missing).toEqual({ weighIns: 0, completeDays: 26 });
  });
});

describe('A9 — the target weight reached', () => {
  const flat = (kg: number, to = -1) => weighIns(kg, 0, { from: to - 27, to, jitter: 0 });
  const p = man({ targetWeightKg: 75 });

  test('losing, the trend 74,9 ≤ 75 → maintenance applied, pace 0, settle', () => {
    const { check: c, profile } = ran(p, flat(74.9), eatenEvery(2100));
    const maintenance = maintenanceOf(p, 74.9);
    expect(maintenance).toBe(2550);
    expect(c).toMatchObject({ status: 'reached', reason: 'reached', from: 2100, to: 2550, goalPace: 0 });
    expect(reachedApplied(c)).toBe(true);
    expect(profile).toMatchObject({
      dailyKcal: 2550,
      goalPace: 0,
      settle: { from: at(14), why: 'change' },
      reached: { at: M, kg: 74.9, prevPace: 0.5, prevKcal: 2100, askAgain: null },
    });
    expect(profile.goals.at(-1)).toEqual({ from: M, kcal: 2550, by: 'check' });
  });

  test('„Chcę dalej chudnąć” → the previous pace and target back, asked again in 4 weeks', () => {
    const reached = ran(p, flat(74.9), eatenEvery(2100)).profile;
    const back = applyAnswer(reached, 'continue', { today: M, kgNow: 74.9 })!;
    expect(back).toMatchObject({ dailyKcal: 2100, goalPace: 0.5, reached: { askAgain: at(28) } });
    expect(back.goals.at(-1)).toEqual({ from: M, kcal: 2100, by: 'user' });

    // Next Monday, 0,3 kg further: not asked again (settling instead); 1,1 kg further: asked again.
    const next = { today: at(7) };
    expect(ran(back, flat(74.6, 6), eatenEvery(2100, -21, 6), next).check.status).not.toBe('reached');
    expect(ran(back, flat(73.8, 6), eatenEvery(2100, -21, 6), next).check.status).toBe('reached');
  });

  test('„Dobrze” keeps maintenance', () => {
    const reached = ran(p, flat(74.9), eatenEvery(2100)).profile;
    expect(applyAnswer(reached, 'ok', { today: M, kgNow: 74.9 })).toMatchObject({ dailyKcal: 2550, goalPace: 0 });
  });

  test('without „Dopasowuj cel co tydzień”: a proposal — nothing changes until „Przejdź na utrzymanie”', () => {
    const q = man({ targetWeightKg: 75, autoAdjust: false });
    const { check: c, profile } = ran(q, flat(74.9), eatenEvery(2100));
    expect(c).toMatchObject({ status: 'reached', to: 2550, goalPace: 0.5 });
    expect(reachedApplied(c)).toBe(false);
    expect(profile).toMatchObject({ dailyKcal: 2100, goalPace: 0.5 });
    const set = applyAnswer(profile, 'set', { today: M, kgNow: 74.9 })!;
    expect(set).toMatchObject({ dailyKcal: 2550, goalPace: 0, settle: { from: at(14), why: 'change' } });
    const later = applyAnswer(profile, 'continue', { today: M, kgNow: 74.9 })!;
    expect(later).toMatchObject({ dailyKcal: 2100, reached: { askAgain: at(28) } });
  });

  test('no weigh-in in the last 14 days: not reached', () => {
    const { check: c } = ran(p, flat(74.9, -15), eatenEvery(2100));
    expect(c.status).not.toBe('reached');
  });

  test('already at the target weight when the target was set („Zostaw” for a maintainer): not an arrival', () => {
    const kept = { ...p, goals: [...p.goals, { from: at(-20), kcal: 2100, by: 'user' as const }] };
    expect(ran(kept, flat(74.9), eatenEvery(2100)).check.status).not.toBe('reached');
    // Above the target when it was set, then down to it: an arrival.
    const crossed = ran(kept, weighIns(73.5, 0.7, { jitter: 0 }), eatenEvery(2100)).check;
    expect(crossed.status).toBe('reached');
  });

  test('gaining toward a higher target works the same way', () => {
    const gain = man({ startWeightKg: 70, targetWeightKg: 75, goalPace: -0.25, dailyKcal: 2700 });
    expect(ran(gain, flat(75.2), eatenEvery(2700)).check.status).toBe('reached');
  });
});

describe('A10 — no check under 18 or in pregnancy', () => {
  test('age 16 → „off”; pregnancy → „off”', () => {
    const data = [weighIns(79.3, 0.5), eatenEvery(2450)] as const;
    expect(ran(man({ age: 16 }), ...data).check.status).toBe('off');
    expect(ran(man({ sex: 'K', pregnancy: true }), ...data).check.status).toBe('off');
  });
});

describe('A11 — no turning back for 4 weeks unless the gap reaches 200', () => {
  // After last Monday's raise: hold {−1, last Monday + 28}.
  const raised = (offset: number) => man({ burnOffset: offset, hold: { dir: -1, until: at(21) } });

  test('a gap of −150 → „same”, „held”', () => {
    // Loses 0,3 kg a week on 1900 kcal: belief −150 → offset −150 → ideal 1950.
    const { check: c, profile } = ran(raised(0), weighIns(79.3, 0.3), eatenEvery(1900));
    expect(c).toMatchObject({ status: 'same', note: 'held' });
    // What it learned stays learned.
    expect(profile.burnOffset).toBe(-150);
  });

  test('a gap of −250 → asked', () => {
    // From offset −100: belief −150 → offset −250 → ideal 1850.
    const { check: c } = ran(raised(-100), weighIns(79.3, 0.3), eatenEvery(1800));
    expect(c).toMatchObject({ status: 'ask', to: 2000 });
  });

  test('a hold for the other direction does not stop a raise', () => {
    const { check: c } = ran(man({ dailyKcal: 2000, hold: { dir: -1, until: at(21) } }), weighIns(79.3, 0.5), eatenEvery(2450));
    expect(c.status).toBe('changed');
  });
});

describe('A12 — the pace guard', () => {
  test('losing 0,75 kg a week on a 0,5 plan, ideal 150 lower → no cut („same”, „pace”)', () => {
    // Observed ≈ 2254 against a prior of 2630 → belief −150 → ideal 1950.
    const { check: c, profile } = ran(man(), weighIns(79.3, 0.75), eatenEvery(1450));
    expect(c).toMatchObject({ status: 'same', note: 'pace', to: 2100 });
    expect(c.facts!.pace).toBeCloseTo(0.75, 2);
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: -150 });
  });

  test('losing 0,3 kg a week on a 0,5 plan, ideal 150 higher → no raise („same”, „pace”)', () => {
    // Observed ≈ 3021 against a prior of 2630 → belief +150 → ideal 2250.
    const { check: c, profile } = ran(man(), weighIns(79.3, 0.3), eatenEvery(2700));
    expect(c).toMatchObject({ status: 'same', note: 'pace', to: 2100 });
    expect(c.facts!.pace).toBeCloseTo(0.3, 2);
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: 150 });
  });

  test('without the guard’s reason the same cut goes on: losing 0,55 on a 0,5 plan is asked', () => {
    const { check: c } = ran(man(), weighIns(79.3, 0.55), eatenEvery(1650));
    expect(c).toMatchObject({ status: 'ask', to: 2000 });
  });
});

describe('A13 — no-numbers mode never cuts', () => {
  test('a lower burn → „same”, „quiet”: the offset is learned, the target stays', () => {
    const { check: c, profile } = ran(man({ hideKcal: true }), weighIns(79.3, 0.3), eatenEvery(1900));
    expect(c).toMatchObject({ status: 'same', note: 'quiet' });
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: -150 });
  });

  test('a higher burn still raises the target', () => {
    const { check: c } = ran(man({ hideKcal: true, dailyKcal: 2000 }), weighIns(79.3, 0.5), eatenEvery(2450));
    expect(c).toMatchObject({ status: 'changed', to: 2100 });
  });
});

describe('A14 — „Zostaw” on a raise (example G)', () => {
  // The owner loses 0,5 kg a week at 80 kg on 2150 kcal: observed 2685,7, prior 2398,5 → belief +150.
  const raise = () => ran(owner({ startWeightKg: 80 }), weighIns(80, 0.5), eatenEvery(2150));

  test('the offset −241 learns +150 → −91; the ideal at 0,5 is 2000, so 1860 → 1960', () => {
    const { check: c, profile } = raise();
    expect(c).toMatchObject({ status: 'changed', from: 1860, to: 1960, reason: 'burn' });
    expect(profile).toMatchObject({ dailyKcal: 1960, burnOffset: -91 });
    expect(waitingCheck(profile)).toEqual(c);
    expect(keepAllowed(profile, c, 80)).toBe(true);
  });

  test('„Zostaw 1860 kcal” → 1860 from today, the pace it implies (0,65), no raise for 4 weeks', () => {
    const kept = applyAnswer(raise().profile, 'keep', { today: M, kgNow: 80 })!;
    expect(kept).toMatchObject({ dailyKcal: 1860, goalPace: 0.65, hold: { dir: 1, until: at(28) } });
    expect(kept.goals.at(-1)).toEqual({ from: M, kcal: 1860, by: 'user' });
    expect(kept.lastCheck?.answer).toBe('keep');

    // The same data a week later: the ideal at 0,65 is close to 1860 → no change.
    const next = ran(kept, weighIns(80, 0.5, { from: -21, to: 6 }), eatenEvery(2150, -21, 6), { today: at(7) });
    expect(next.check).toMatchObject({ status: 'same', to: 1860 });
    expect(next.profile.dailyKcal).toBe(1860);
  });

  test('a „Zostaw” that would mean more than 0,8 kg a week is not offered', () => {
    const c: WeekCheck = { ...raise().check, from: 1500, to: 1600 };
    const p = owner({ startWeightKg: 80, burnOffset: -91, belowFloorOk: true, dailyKcal: 1600, lastCheck: c });
    // (2548,5 − 1500) × 7 / 7500 = 0,98 kg a week.
    expect(keepAllowed(p, c, 80)).toBe(false);
    expect(applyAnswer(p, 'keep', { today: M, kgNow: 80 })).toBeNull();
    expect(applyAnswer(p, 'ok', { today: M, kgNow: 80 })?.lastCheck?.answer).toBe('ok');
  });

  test('„Zostaw” on a floor-up keeps it as agreed with a doctor or dietitian', () => {
    const { profile } = ran(man({ startWeightKg: 80, dailyKcal: 1650 }), [], new Map());
    const kept = applyAnswer(profile, 'keep', { today: M, kgNow: 80 })!;
    expect(kept).toMatchObject({ dailyKcal: 1650, belowFloorOk: true });
    expect(kept.goals.at(-1)).toEqual({ from: M, kcal: 1650, by: 'user' });
  });
});

describe('A16 — when it runs', () => {
  const data = [weighIns(79.3, 0.5), eatenEvery(2450)] as const;

  test('Monday 03:00 → nothing (Sunday’s dinner may still be logged)', () => {
    expect(check(man({ dailyKcal: 2000 }), ...data, { hour: 3 })).toBeNull();
  });

  test('a missed Monday runs on Tuesday at 01:00, for the same week', () => {
    const out = check(man({ dailyKcal: 2000 }), ...data, { today: at(1), hour: 1 });
    expect(out?.check).toMatchObject({ week: M, status: 'changed' });
    // The change counts from the day it ran.
    expect(out?.profile.goals.at(-1)).toEqual({ from: at(1), kcal: 2100, by: 'check' });
  });
});

describe('suggestions without „Dopasowuj cel co tydzień”', () => {
  const p = man({ dailyKcal: 2000, autoAdjust: false });
  const data = [weighIns(79.3, 0.5), eatenEvery(2450)] as const;

  test('a raise is suggested, the offset learned, the target unchanged', () => {
    const { check: c, profile } = ran(p, ...data);
    expect(c).toMatchObject({ status: 'suggested', from: 2000, to: 2100 });
    expect(profile).toMatchObject({ dailyKcal: 2000, burnOffset: 150 });
  });

  test('„Ustaw” applies it (no cut back for 4 weeks); „Nie teraz” keeps the target (no raise for 4 weeks)', () => {
    const suggested = ran(p, ...data).profile;
    const set = applyAnswer(suggested, 'set', { today: at(1), kgNow: 79.3 })!;
    expect(set).toMatchObject({ dailyKcal: 2100, hold: { dir: -1, until: at(29) } });
    expect(set.goals.at(-1)).toEqual({ from: at(1), kcal: 2100, by: 'check' });
    const later = applyAnswer(suggested, 'later', { today: at(1), kgNow: 79.3 })!;
    expect(later).toMatchObject({ dailyKcal: 2000, hold: { dir: 1, until: at(29) } });
  });
});

describe('the card', () => {
  test('waits until answered, and only while the target is still the one it was about', () => {
    const { profile, check: c } = ran(man({ dailyKcal: 2000 }), weighIns(79.3, 0.5), eatenEvery(2450));
    expect(waitingCheck(profile)).toEqual(c);
    // Changed another way since (the profile page): the card hides, an answer does nothing.
    const moved = { ...profile, dailyKcal: 2200 };
    expect(waitingCheck(moved)).toBeNull();
    expect(applyAnswer(moved, 'keep', { today: M, kgNow: 79.3 })).toBeNull();
  });

  test('statuses without a card take no answer; a wrong answer for a card does nothing', () => {
    const same = ran(man(), [], eatenEvery(2000)).profile;
    expect(waitingCheck(same)).toBeNull();
    expect(applyAnswer(same, 'ok', { today: M, kgNow: 80 })).toBeNull();
    const changed = ran(man({ dailyKcal: 2000 }), weighIns(79.3, 0.5), eatenEvery(2450)).profile;
    expect(applyAnswer(changed, 'yes', { today: M, kgNow: 79.3 })).toBeNull();
  });

  test('the weekly constants are the spec’s', () => {
    expect(CHECK).toMatchObject({ window: 28, deadBand: 100, step: 100, holdDays: 28, holdEscape: 200, confidence: 1.5 });
  });
});

describe('an implausible week', () => {
  test('food and weight that cannot both be true → „implausible”, nothing learned', () => {
    // Losing 2 kg a week on 3000 kcal: observed 5143 kcal, over 2,5 × BMR.
    const { check: c, profile } = ran(man(), weighIns(79.3, 2), eatenEvery(3000));
    expect(c.status).toBe('implausible');
    expect(profile).toMatchObject({ dailyKcal: 2100, burnOffset: 0, anchored: false });
  });
});
