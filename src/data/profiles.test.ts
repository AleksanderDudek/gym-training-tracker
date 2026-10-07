import { describe, expect, it } from 'vitest';
import { BUILTIN, EX, PROFILE_WORKOUTS } from './exercises';
import { PROFILE_PLANS, planById } from './plans';
import { PROFILES, PROFILE_KEYS, gearsOf, parseProfileId, profilePlanId, profileWorkoutId } from './profiles';
import { planScene } from './scenes';
import { RULES, reviewPlan } from '../engine/design';
import { freshState } from '../engine/plan';
import { blocksOf } from '../engine/blocks';
import { STABILIZERS } from './muscles';
import { pairProblems } from '../engine/structure';

/**
 * Profile: ogólnorozwojowe całe ciało z akcentem. Test pilnuje, żeby akcent był naprawdę
 * akcentem — priorytet na początku, dodatki na końcu — a całe ciało zostało całym ciałem.
 */

describe('profile', () => {
  it('każdy profil ma plan na każdym sprzęcie, na którym jest dostępny, i dwa treningi', () => {
    PROFILE_KEYS.forEach((k) => {
      expect(gearsOf(k).length, k).toBeGreaterThanOrEqual(2);
      gearsOf(k).forEach((g) => {
        const t = planById(profilePlanId(k, g))!;
        expect(t.profile).toBe(k);
        expect(t.cycle).toEqual([profileWorkoutId(k, g, 0), profileWorkoutId(k, g, 1)]);
        t.cycle.forEach((id) => expect(BUILTIN.some((w) => w.id === id), id).toBe(true));
      });
    });
    expect(PROFILE_PLANS).toHaveLength(16);
    expect(PROFILE_WORKOUTS).toHaveLength(32);
  });

  it('ćwiczenie priorytetowe stoi na początku — po ruchu wybuchowym, jeśli jest', () => {
    PROFILE_WORKOUTS.forEach((w) => {
      const lead = PROFILES[w.profile!].lead?.[w.gear!];
      if (!lead) return;
      const first = w.items.findIndex((i) => EX[i.ex]!.mode !== 'ballistic' || i.ex === lead);
      expect({ w: w.id, first: w.items[first]?.ex }).toEqual({ w: w.id, first: lead });
    });
  });

  it('dodatki profilu są w każdym treningu profilu, a para dodatków przechodzi zasady par', () => {
    PROFILE_WORKOUTS.forEach((w) => {
      const [x1, x2] = PROFILES[w.profile!].extras[w.gear!]!;
      const ids = w.items.map((i) => i.ex);
      expect(ids, w.id).toContain(x1);
      expect(ids, w.id).toContain(x2);
      blocksOf(w.items)
        .filter((b) => b.kind === 'pair')
        .forEach((b) => expect({ w: w.id, why: pairProblems(b.ids[0]!, b.ids[1]!, w.gear) }).toEqual({ w: w.id, why: [] }));
      expect(new Set(ids).size, w.id).toBe(ids.length);
    });
  });

  it('plan profilu: 60 dni, bez ostrzeżeń doradcy, z kalendarzem 60 na ilustracji', () => {
    const s = freshState();
    PROFILE_PLANS.forEach((t) => {
      expect(t.days).toBe(60);
      const r = reviewPlan(s, t, BUILTIN);
      expect({ id: t.id, warn: r.notes.filter((n) => n.level === 'warn').map((n) => n.code) }).toEqual({ id: t.id, warn: [] });
      expect(r.notes.map((n) => n.code), t.id).not.toContain('weekly-max');
      r.weekly
        .filter((x) => !STABILIZERS.includes(x.muscle))
        .forEach((x) => expect(x.sets, `${t.id} ${x.muscle}`).toBeLessThanOrEqual(RULES.weeklyMax));
      expect(planScene(t).big).toBe('60');
    });
  });

  it('przekąski profilu to istniejące ćwiczenia, a identyfikatory czyta się z powrotem', () => {
    PROFILE_KEYS.forEach((k) => PROFILES[k].snacks.forEach((x) => expect(EX[x], `${k}: ${x}`).toBeDefined()));
    expect(parseProfileId('profil-pilka-gym-b')).toEqual({ key: 'pilka', gear: 'gym' });
    expect(parseProfileId('profil-pilka-gym')).toEqual({ key: 'pilka', gear: 'gym' });
    expect(parseProfileId('profil-constructor-gym')).toBeNull();
    expect(parseProfileId('A')).toBeNull();
  });
});
