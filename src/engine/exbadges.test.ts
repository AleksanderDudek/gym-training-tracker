import { describe, expect, it } from 'vitest';
import { ALL, EX } from '../data/exercises';
import { hasArt } from '../components/BadgeArt';
import { freshState } from './plan';
import { addSnack, removeSnack } from './snacks';
import { xpSummary } from './xp';
import { exerciseVolumes, periodKey, periodValue } from './volume';
import {
  EX_DEFS,
  EX_KINDS,
  EX_QUIPS,
  clock,
  exFamiliesOf,
  exFamilyId,
  exerciseTiers,
  nice,
} from './exbadges';
import {
  achCtx,
  achievementById,
  exerciseProgress,
  formatTier,
  revokeUnmet,
  syncBadges,
  tierKey,
  touchedExercises,
} from './badges';
import type { LogEntry } from '../types';

const entry = (iso: string, id: string, reps: number[]): LogEntry => ({
  date: iso,
  workout: 'A',
  ready: 'ok',
  items: [{ id, sets: reps.map((r) => ({ reps: r, w: null })), effort: 'solid' }],
});

describe('objętość ćwiczenia w okresach', () => {
  it('sumuje treningi i przekąski tego samego ćwiczenia', () => {
    const s = freshState();
    s.log = [entry('2026-09-21T18:00:00Z', 'squat_air', [20, 20, 15])];
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-21T09:00:00Z'));
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-23T09:00:00Z'));
    const v = exerciseVolumes(s.log, s.snacks)['squat_air']!;
    expect(v.total).toBe(75);
    expect(v.best.dzien).toBe(65);
    expect(v.best.tydzien).toBe(75);
    expect(v.sessions).toBe(1);
    expect(v.snacks).toBe(2);
  });

  it('tydzień zaczyna się w poniedziałek, miesiąc pierwszego', () => {
    expect(periodKey('2026-09-27', 'tydzien')).toBe('2026-09-21');
    expect(periodKey('2026-09-28', 'tydzien')).toBe('2026-09-28');
    expect(periodKey('2026-09-30', 'miesiac')).toBe('2026-09');
  });

  it('niedziela i poniedziałek to dwa różne tygodnie, trzydziesty i pierwszy — dwa miesiące', () => {
    const s = freshState();
    addSnack(s, 'squat_air', 30, null, Date.parse('2026-09-27T09:00:00Z'));
    addSnack(s, 'squat_air', 40, null, Date.parse('2026-09-28T09:00:00Z'));
    addSnack(s, 'squat_air', 50, null, Date.parse('2026-10-01T09:00:00Z'));
    const v = exerciseVolumes([], s.snacks)['squat_air']!;
    expect(v.best.tydzien).toBe(90);
    expect(v.best.miesiac).toBe(70);
    expect(periodValue(v, 'tydzien', '2026-10-01')).toBe(90);
    expect(periodValue(v, 'miesiac', '2026-10-01')).toBe(50);
    expect(periodValue(v, 'dzien', '2026-10-02')).toBe(0);
    expect(periodValue(undefined, 'dzien', '2026-10-02')).toBe(0);
  });
});

describe('progi odznak ćwiczeń', () => {
  it('okrągłe liczby: 168 to 150, 288 to 300, małe zostają całe', () => {
    expect(nice(168)).toBe(150);
    expect(nice(288)).toBe(300);
    expect(nice(1440)).toBe(1500);
    expect(nice(7)).toBe(7);
    expect(nice(0.3)).toBe(1);
  });

  it('każde ćwiczenie ma cztery rodziny z rosnącymi progami', () => {
    expect(EX_DEFS).toHaveLength(ALL.length * EX_KINDS.length);
    expect(new Set(EX_DEFS.map((d) => d.id)).size).toBe(EX_DEFS.length);
    EX_DEFS.forEach((d) => {
      expect(d.tiers.length, d.id).toBeGreaterThanOrEqual(5);
      d.tiers.forEach((t, i) => {
        expect(Number.isInteger(t), d.id).toBe(true);
        if (i > 0) expect(t, d.id).toBeGreaterThan(d.tiers[i - 1]!);
      });
      // Medal niesie albo napis okresu, albo figurkę ruchu.
      expect(hasArt(d.art) || d.mark.length > 0, d.id).toBe(true);
    });
  });

  it('progi idą za ćwiczeniem: podciąganie niżej niż przysiady bez obciążenia', () => {
    expect(exerciseTiers('pullup', 'dzien')[0]!).toBeLessThan(exerciseTiers('squat_air', 'dzien')[0]!);
  });

  it('pierwszy próg dnia to mniej więcej jedna pełna sesja', () => {
    ALL.forEach((id) => {
      const d = EX[id]!.def;
      const first = exerciseTiers(id, 'dzien')[0]!;
      expect(first / (d.sets * d.target), id).toBeGreaterThan(0.6);
      expect(first / (d.sets * d.target), id).toBeLessThan(1.6);
    });
  });

  it('ćwiczenia na czas dostają pełne minuty powyżej dwóch minut', () => {
    exerciseTiers('plank', 'miesiac').forEach((t) => {
      if (t >= 120) expect(t % 60).toBe(0);
    });
    expect(clock(90)).toBe('90 s');
    expect(clock(300)).toBe('5 min');
    expect(clock(437)).toBe('7 min 17 s');
    const fam = achievementById(exFamilyId('plank', 'lacznie'))!;
    expect(formatTier(fam, 600)).toBe('10 min');
  });

  it('ruch na stronę mówi o tym w jednostce', () => {
    const fam = achievementById(exFamilyId('lunge', 'dzien'))!;
    expect(formatTier(fam, 50)).toBe('50 powtórzeń na stronę');
  });

  it('puenty nie dokuczają', () => {
    Object.values(EX_QUIPS)
      .flat()
      .forEach((q) => expect(q).not.toMatch(/wstydź się|nieudacznik|żałosn|leniu|do niczego/i));
  });
});

describe('zdobywanie odznak ćwiczeń', () => {
  it('przekąski dokładają się do rekordu dnia razem z treningiem', () => {
    const s = freshState();
    const today = '2026-09-27';
    const first = exerciseTiers('squat_air', 'dzien')[0]!;
    // Sam trening nie dobija do progu, dopiero przekąska po nim.
    s.log = [entry(`${today}T08:00:00Z`, 'squat_air', [first - 10])];
    expect(syncBadges(s, achCtx(s, null, null, today)).map((h) => h.ach.id)).not.toContain(
      exFamilyId('squat_air', 'dzien'),
    );
    addSnack(s, 'squat_air', 10, null, Date.parse(`${today}T12:00:00Z`));
    const hits = syncBadges(s, achCtx(s, null, null, today));
    expect(hits.map((h) => h.ach.id)).toContain(exFamilyId('squat_air', 'dzien'));
    expect(s.award.badges[tierKey(exFamilyId('squat_air', 'dzien'), 1)]).toBe(today);
  });

  it('odznaki ćwiczeń nie zasypują dziennika planu', () => {
    const s = freshState();
    s.log = [entry('2026-09-27T08:00:00Z', 'squat_air', [200, 200, 200])];
    const hits = syncBadges(s, achCtx(s, null, null, '2026-09-27'));
    expect(hits.some((h) => h.ach.group === 'cwiczenia')).toBe(true);
    expect(s.events.some((e) => e.id.includes('ex:'))).toBe(false);
  });

  it('pasek rekordu okresu mierzy bieżący okres, nie stary rekord', () => {
    const s = freshState();
    const tiers = exerciseTiers('squat_air', 'dzien');
    // Tydzień temu rekord dnia na pierwszym progu, dziś połowa drugiego.
    addSnack(s, 'squat_air', tiers[0]!, null, Date.parse('2026-09-20T09:00:00Z'));
    addSnack(s, 'squat_air', Math.round(tiers[1]! / 2), null, Date.parse('2026-09-27T09:00:00Z'));
    const ctx = achCtx(s, null, null, '2026-09-27');
    const day = exerciseProgress(ctx, 'squat_air').find((r) => r.ach.id === exFamilyId('squat_air', 'dzien'))!;
    expect(day.tier).toBe(1);
    expect(day.current).toBe(Math.round(tiers[1]! / 2));
    expect(day.progress).toBeCloseTo(Math.round(tiers[1]! / 2) / tiers[1]!, 5);
    const total = exerciseProgress(ctx, 'squat_air').find((r) => r.ach.id === exFamilyId('squat_air', 'lacznie'))!;
    expect(total.current).toBeNull();
  });

  it('usunięta literówka cofa progi, które dała, i nic więcej', () => {
    const s = freshState();
    const today = '2026-09-27';
    const day = exFamilyId('squat_air', 'dzien');
    const tiers = exerciseTiers('squat_air', 'dzien');
    // Prawdziwy trening domyka pierwszy próg dnia, literówka w przekąsce — resztę.
    s.log = [entry(`${today}T08:00:00Z`, 'squat_air', [tiers[0]!])];
    const typo = addSnack(s, 'squat_air', 450, null, Date.parse(`${today}T12:00:00Z`));
    syncBadges(s, achCtx(s, null, null, today));
    expect(s.award.badges[tierKey(day, 3)]).toBe(today);
    expect(s.award.badges[tierKey('przekaski', 1)]).toBe(today);
    const xpWithTypo = xpSummary(s, today).total;

    removeSnack(s, typo.key);
    const n = revokeUnmet(
      s,
      achCtx(s, null, null, today),
      (d) => d.group === 'przekaski' || d.id.startsWith('ex:squat_air:'),
    );
    expect(n).toBeGreaterThan(2);
    expect(s.award.badges[tierKey(day, 1)]).toBe(today);
    expect(s.award.badges[tierKey(day, 2)]).toBeUndefined();
    expect(s.award.badges[tierKey('przekaski', 1)]).toBeUndefined();
    expect(s.events.some((e) => e.id === `badge:${tierKey('przekaski', 1)}`)).toBe(false);
    // Odznaki spoza filtra zostają, nawet jeśli dziś ich wartość jest niższa.
    expect(s.award.badges[tierKey('treningi', 1)]).toBe(today);
    expect(xpSummary(s, today).total).toBeLessThan(xpWithTypo);
  });

  it('lista ćwiczeń z odznakami to tylko ruchy, które już się pojawiły', () => {
    const s = freshState();
    expect(touchedExercises(achCtx(s, null, null, '2026-09-27'))).toEqual([]);
    addSnack(s, 'plank', 30, null, Date.parse('2026-09-27T09:00:00Z'));
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-27T09:00:00Z'));
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-27T10:00:00Z'));
    expect(touchedExercises(achCtx(s, null, null, '2026-09-27'))).toEqual(['squat_air', 'plank']);
    expect(exFamiliesOf('plank')).toHaveLength(4);
  });
});
