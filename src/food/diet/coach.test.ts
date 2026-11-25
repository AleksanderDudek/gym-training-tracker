import { beforeEach, describe, expect, test } from 'vitest';
import { coachEdit } from './coach';
import { DietDb } from './db';
import { applyCoachTargets, readProfile, saveProfile } from './store';
import { floorOf, hardMinOf, maintenanceOf, targetOn } from './target';
import type { Profile } from './types';
import { newProfile } from './validate';

/**
 * Targets from a coach: the kcal target as typed in the profile (floor, hold, pace), the target weight
 * when it fits, the rest left alone — and the stored change in one transaction.
 */

const today = '2026-11-25';
const ctx = { today, kgNow: 80 };
// The default man: 35, 175 cm, 80 kg, losing 0.5 kg a week towards 75 kg, 2100 kcal.
const base: Profile = newProfile({}, today);

describe('coachEdit', () => {
  test('the coach kcal becomes the target from today, with the pace it implies and the hold of a manual change', () => {
    const e = coachEdit(base, { kcal: 2200, weightGoal: null }, ctx);
    expect(e.changed).toBe(true);
    expect(e.kcal).toEqual({ from: 2100, to: 2200 });
    expect(targetOn(e.next, today)).toBe(2200);
    expect(e.next.goals.at(-1)).toEqual({ from: today, kcal: 2200, by: 'user' });
    expect(e.next.hold).toEqual({ dir: 0, until: '2026-12-09' });
    expect(e.pace?.from).toBe(0.5);
    expect(e.pace!.to).toBeLessThan(0.5);
    expect(e.kcalAdjusted).toBeNull();
    expect(e.weight).toBeNull();
  });

  test('under the BMR floor: raised to the floor and said so; agreed with a doctor — down to the hard minimum, said as such', () => {
    const e = coachEdit(base, { kcal: 1300, weightGoal: null }, ctx);
    expect(e.kcal).toEqual({ from: 2100, to: floorOf(base, 80) });
    expect(e.kcalAdjusted).toBe('floor');
    const agreed = coachEdit({ ...base, belowFloorOk: true }, { kcal: 1550, weightGoal: null }, ctx);
    expect(agreed.kcal?.to).toBe(1550);
    expect(agreed.kcalAdjusted).toBeNull();
    // Box already ticked: nothing goes lower — the hard minimum, not „tick the box”.
    const tooLow = coachEdit({ ...base, belowFloorOk: true }, { kcal: 1300, weightGoal: null }, ctx);
    expect(tooLow.kcal?.to).toBe(hardMinOf(base));
    expect(tooLow.kcalAdjusted).toBe('min');
    // A light woman: her BMR floor is the hard minimum itself — again no checkbox to tick.
    const light = newProfile({ sex: 'K', age: 30, heightCm: 155, startWeightKg: 50, targetWeightKg: 48 }, today);
    expect(floorOf(light, 50)).toBe(hardMinOf(light));
    const lightEdit = coachEdit(light, { kcal: 1000, weightGoal: null }, { today, kgNow: 50 });
    expect(lightEdit.kcal?.to ?? targetOn(lightEdit.next, today)).toBe(hardMinOf(light));
    expect(lightEdit.kcalAdjusted).toBe('min');
  });

  test('no deficit in pregnancy or breastfeeding: a coach target under maintenance stays a proposal, one above it applies', () => {
    const pregnant = newProfile({ sex: 'K', age: 30, heightCm: 168, startWeightKg: 70, targetWeightKg: 70, pregnancy: true }, today);
    const kg = { today, kgNow: 70 };
    const keep = maintenanceOf(pregnant, 70);
    const e = coachEdit(pregnant, { kcal: 1500, weightGoal: null }, kg);
    expect(e.kept.kcal).toBe('pregnancy');
    expect(e.maintenance).toBe(keep);
    expect(e.changed).toBe(false);
    expect(e.kcal).toBeNull();
    expect(e.next).toBe(pregnant);
    // Just under maintenance — still a deficit, still not applied.
    expect(coachEdit(pregnant, { kcal: keep - 50, weightGoal: null }, kg).kept.kcal).toBe('pregnancy');
    const more = coachEdit(pregnant, { kcal: keep + 300, weightGoal: null }, kg);
    expect(more.kept.kcal).toBeUndefined();
    expect(more.kcal).toEqual({ from: targetOn(pregnant, today), to: keep + 300 });
    expect(more.next.goalPace).toBe(0);
  });

  test('no deficit with a BMI under 18.5 either', () => {
    const thin = newProfile({ sex: 'K', age: 30, heightCm: 170, startWeightKg: 52, targetWeightKg: 54, goalPace: -0.25 }, today);
    const e = coachEdit(thin, { kcal: 1300, weightGoal: null }, { today, kgNow: 52 });
    expect(e.kept.kcal).toBe('bmi');
    expect(e.changed).toBe(false);
    // Above maintenance (gaining a bit faster) — applied.
    const asked = targetOn(thin, today) + 100;
    expect(asked).toBeGreaterThan(maintenanceOf(thin, 52));
    const gain = coachEdit(thin, { kcal: asked, weightGoal: null }, { today, kgNow: 52 });
    expect(gain.kept.kcal).toBeUndefined();
    expect(gain.kcal?.to).toBe(asked);
  });

  test('over the stored range: capped', () => {
    const e = coachEdit(base, { kcal: 7000, weightGoal: null }, ctx);
    expect(e.kcal?.to).toBe(6000);
    expect(e.kcalAdjusted).toBe('max');
  });

  test('under 18 the kcal target stays; the rest still applies', () => {
    const teen = newProfile({ age: 16 }, today);
    const e = coachEdit(teen, { kcal: 1800, weightGoal: null }, ctx);
    expect(e.changed).toBe(false);
    expect(e.kept.kcal).toBe('minor');
    expect(e.next).toBe(teen);
  });

  test('the target weight: applied when it fits the direction, kept under BMI 18.5, on the wrong side or when the kcal keeps the weight', () => {
    const fits = coachEdit(base, { kcal: 2000, weightGoal: 72 }, ctx);
    expect(fits.weight).toEqual({ from: 75, to: 72 });
    expect(fits.next.targetWeightKg).toBe(72);
    expect(fits.protein).toBe(144);

    const thin = coachEdit(base, { kcal: null, weightGoal: 50 }, ctx);
    expect(thin.kept.weight).toBe('min');
    expect(thin.changed).toBe(false);

    const side = coachEdit(base, { kcal: null, weightGoal: 85 }, ctx);
    expect(side.kept.weight).toBe('side');
    expect(side.next.targetWeightKg).toBe(75);

    const keep = coachEdit({ ...base, goalPace: 0 }, { kcal: null, weightGoal: 72 }, ctx);
    expect(keep.kept.weight).toBe('keep');
  });

  test('the same targets: nothing changes, nothing to store', () => {
    const e = coachEdit(base, { kcal: null, weightGoal: 75 }, ctx);
    expect(e.changed).toBe(false);
    expect(e.protein).toBe(150);
  });
});

describe('applyCoachTargets', () => {
  let db: DietDb;
  beforeEach(() => {
    db = new DietDb(`test-${Math.random()}`);
  });

  test('without a profile: nothing, null', async () => {
    expect(await applyCoachTargets({ kcal: 2200, weightGoal: null }, { today, weighIns: [] }, db)).toBeNull();
    expect(await readProfile({ today, weighIns: [] }, db)).toBeNull();
  });

  test('stores the edit worked out on the stored row, keeps keys it does not know', async () => {
    await saveProfile(base, db);
    await db.profile.update('me', { unknownKey: 1 } as never);
    const e = await applyCoachTargets({ kcal: 2200, weightGoal: 72 }, { today, weighIns: [{ day: '2026-11-20', kg: 80 }] }, db);
    expect(e?.kcal).toEqual({ from: 2100, to: 2200 });
    const stored = await readProfile({ today, weighIns: [] }, db);
    expect(targetOn(stored!, today)).toBe(2200);
    expect(stored!.targetWeightKg).toBe(72);
    expect(((await db.profile.get('me')) as unknown as Record<string, unknown>).unknownKey).toBe(1);

    // Again: already set, nothing written.
    const again = await applyCoachTargets({ kcal: 2200, weightGoal: 72 }, { today, weighIns: [{ day: '2026-11-20', kg: 80 }] }, db);
    expect(again?.changed).toBe(false);
  });
});
