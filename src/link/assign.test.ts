import { describe, expect, it } from 'vitest';
import type { AssignmentV1 } from '@gymtracker/link';
import { BUILTIN } from '../data/exercises';
import { freshState } from '../engine/plan';
import { coachId, importPlan, importWorkout, isFromCoach } from './assign';

/** Plan i trening od prowadzącego jako własne: osobne numery, pominięte nieznane ćwiczenia. */

const AID = '1a2b3c4d-1234-4abc-8def-000000000001';
const builtin = BUILTIN[0]!;

const plan: Extract<AssignmentV1['body'], { kind: 'plan' }> = {
  kind: 'plan',
  plan: {
    id: 'sila',
    name: 'Siła 8 tyg.',
    level: 'base',
    sex: 'any',
    daysPerWeek: 2,
    weeks: 8,
    loadFactor: 1,
    cycle: ['a', 'b', 'zly', builtin.id],
    weekdays: [1, 4],
    desc: 'Plan na siłę',
    kind: 'own',
  },
  workouts: [
    { id: 'a', name: 'Góra A', items: [{ ex: 'swing2' }, { ex: 'nie-ma-takiego' }] },
    { id: 'b', name: 'Tylko nieznane', items: [{ ex: 'xyz' }] },
  ],
  videos: {},
  note: '',
};

describe('plan od prowadzącego', () => {
  it('dostaje numery w przestrzeni prowadzącego, rotacja wskazuje kopie', () => {
    const r = importPlan(freshState(), AID, plan, 'Anna · Trener')!;
    expect(r.planId).toBe('coach-1a2b3c4d-sila');
    expect(isFromCoach(r.planId)).toBe(true);
    const p = r.next.plans!.find((x) => x.id === r.planId)!;
    // „b” nie ma żadnego znanego ćwiczenia, „zly” nie istnieje; gotowy trening z biblioteki zostaje.
    expect(p.cycle).toEqual([coachId(AID, 'a'), builtin.id]);
    expect(p.kind).toBe('own');
    expect(p.desc).toContain('Anna · Trener');
    expect(r.next.workouts.map((w) => w.id)).toEqual([coachId(AID, 'a')]);
    expect(r.next.workouts[0]!.items.map((i) => i.ex)).toEqual(['swing2']);
    expect(r.skipped.sort()).toEqual(['nie-ma-takiego', 'xyz']);
  });

  it('drugie uruchomienie podmienia kopię zamiast dokładać drugą', () => {
    const once = importPlan(freshState(), AID, plan, '')!;
    const twice = importPlan(once.next, AID, plan, '')!;
    expect(twice.next.plans).toHaveLength(1);
    expect(twice.next.workouts).toHaveLength(1);
  });

  it('plan, z którego nic nie da się uruchomić — `null`', () => {
    const bad = { ...plan, plan: { ...plan.plan, cycle: ['b'] } };
    expect(importPlan(freshState(), AID, bad, '')).toBeNull();
  });

  it('nie rusza własnych planów i treningów podopiecznego', () => {
    const s = freshState();
    s.workouts = [{ id: 'a', name: 'Mój A', items: [{ ex: 'swing2' }] }];
    const r = importPlan(s, AID, plan, '')!;
    expect(r.next.workouts.find((w) => w.id === 'a')!.name).toBe('Mój A');
    expect(s.workouts).toHaveLength(1);
  });
});

describe('trening od prowadzącego', () => {
  it('trafia do własnych treningów z numerem prowadzącego', () => {
    const r = importWorkout(freshState(), AID, { kind: 'workout', workout: plan.workouts[0]!, videos: {}, note: '' }, 'Anna')!;
    expect(r.workoutId).toBe('coach-1a2b3c4d-a');
    expect(r.next.workouts[0]!.items).toEqual([{ ex: 'swing2' }]);
    expect(r.skipped).toEqual(['nie-ma-takiego']);
  });

  it('bez żadnego znanego ćwiczenia — `null`', () => {
    expect(importWorkout(freshState(), AID, { kind: 'workout', workout: plan.workouts[1]!, videos: {}, note: '' }, '')).toBeNull();
  });
});
