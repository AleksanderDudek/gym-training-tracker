import { describe, expect, it } from 'vitest';
import { ALL, BUILTIN, EX, NO_EQUIPMENT } from '../data/exercises';
import { EX_MUSCLES, MUSCLES, STABILIZERS } from '../data/muscles';
import { GOAL_PLANS, PLANS, planOf } from '../data/plans';
import { LIBRARY } from '../data/workouts';
import {
  RULES,
  autoDeload,
  exerciseLoads,
  orderRank,
  reviewPlan,
  reviewWorkout,
  setWeight,
  suggestedOrder,
  weekLayout,
  workoutLoads,
} from './design';
import { DELOAD_SHARE, freshState, plan } from './plan';
import { buildSchedule } from './schedule';
import type { PlanTemplate } from '../types';

const codes = (notes: { code: string }[]): string[] => notes.map((n) => n.code);

describe('mięśnie ćwiczeń', () => {
  it('każde ćwiczenie z atlasu ma główny mięsień, a żaden nie jest naraz główny i pomocniczy', () => {
    ALL.forEach((id) => {
      const u = EX_MUSCLES[id];
      expect(u, id).toBeDefined();
      expect(u!.p.length, id).toBeGreaterThan(0);
      [...u!.p, ...u!.s].forEach((m) => expect(MUSCLES, id).toContain(m));
      u!.p.forEach((m) => expect(u!.s, id).not.toContain(m));
    });
    expect(Object.keys(EX_MUSCLES).sort()).toEqual([...ALL].sort());
  });

  it('przysiad nie liczy się tyłowi uda — w badaniach Kubo nie urósł ani przy płytkim, ani przy głębokim', () => {
    ['squat_back', 'squat_front', 'goblet', 'legpress', 'hacksquat'].forEach((id) =>
      expect([...EX_MUSCLES[id]!.p, ...EX_MUSCLES[id]!.s]).not.toContain('dwuglowe'),
    );
  });

  it('seria liczy się głównemu w całości, pomocniczemu w połowie, a wybuchowa i na czas za pół', () => {
    expect(exerciseLoads('bench', 3)).toEqual({ klatka: 3, triceps: 1.5, 'bark-przod': 1.5 });
    expect(setWeight('swing2')).toBe(0.5);
    expect(setWeight('plank')).toBe(0.5);
    expect(setWeight('squat_back')).toBe(1);
    expect(exerciseLoads('swing2', 4).posladki).toBe(2);
  });
});

describe('doradca treningu', () => {
  const s = freshState();

  it('każdy gotowy trening przechodzi bez ostrzeżeń i bez uwag', () => {
    BUILTIN.forEach((w) => {
      const r = reviewWorkout(s, w.items.map((i) => i.ex), w.kind, w.items.map((i) => !!i.pair));
      expect({ id: w.id, notes: codes(r.notes) }).toEqual({ id: w.id, notes: ['ok'] });
      r.loads.forEach((l) => expect(l.sets, `${w.id} ${l.muscle}`).toBeLessThanOrEqual(RULES.sessionCap));
    });
  });

  it('biblioteka ma podziały, całe ciało i partie na oba zestawy sprzętu', () => {
    (['push', 'pull', 'legs', 'upper', 'lower', 'glutes', 'chest', 'shoulders', 'arms', 'core'] as const).forEach(
      (k) => {
        expect(LIBRARY.some((w) => w.kind === k && w.gear === 'gym'), `${k} gym`).toBe(true);
        expect(LIBRARY.some((w) => w.kind === k && w.gear === 'kb'), `${k} kb`).toBe(true);
      },
    );
    expect(new Set(BUILTIN.map((w) => w.id)).size).toBe(BUILTIN.length);
    LIBRARY.forEach((w) => {
      expect(w.desc?.length ?? 0, w.id).toBeGreaterThan(20);
      // Zestaw „kettlebell i dom” nie może wymagać sztangi ani maszyny.
      if (w.gear === 'kb')
        w.items.forEach((i) =>
          expect(['kettlebell', 'bodyweight', undefined], `${w.id}: ${i.ex}`).toContain(EX[i.ex]!.gear),
        );
    });
  });

  it('bez sprzętu znaczy bez sprzętu: tylko ćwiczenia z listy, bez ciężaru, drążka i kółka', () => {
    NO_EQUIPMENT.forEach((id) => {
      expect(EX[id], id).toBeDefined();
      expect(EX[id]!.def.w, id).toBeUndefined();
    });
    ['pullup', 'chinup', 'legraise_hang', 'abwheel', 'jumprope', 'boxjump'].forEach((id) =>
      expect(NO_EQUIPMENT.has(id), id).toBe(false),
    );
    const none = LIBRARY.filter((w) => w.gear === 'none');
    (['full', 'upper', 'lower', 'legs', 'push', 'glutes', 'core'] as const).forEach((k) =>
      expect(none.some((w) => w.kind === k), k).toBe(true),
    );
    none.forEach((w) => w.items.forEach((i) => expect(NO_EQUIPMENT.has(i.ex), `${w.id}: ${i.ex}`).toBe(true)));
  });

  it('plany bez sprzętu składają się wyłącznie z treningów bez sprzętu i mają każdą długość', () => {
    const none = GOAL_PLANS.filter((t) => t.gear === 'none');
    expect(new Set(none.map((t) => t.days))).toEqual(new Set([30, 60, 90]));
    none.forEach((t) =>
      t.cycle.forEach((c) => expect(BUILTIN.find((w) => w.id === c)?.gear, `${t.id}: ${c}`).toBe('none')),
    );
  });

  it('za dużo serii na jedną partię w sesji to ostrzeżenie', () => {
    const r = reviewWorkout(s, ['hipthrust', 'glutebridge', 'abduction', 'bulgarian', 'rdl_bb'], 'glutes');
    expect(codes(r.notes)).toContain('session-cap');
    expect(r.ok).toBe(false);
  });

  it('izolacja przed wielostawowym psuje kolejność, a propozycja stawia wybuchowe na początek', () => {
    const r = reviewWorkout(s, ['curl_db', 'plank', 'bench', 'swing2']);
    expect(codes(r.notes)).toContain('order');
    expect(r.order).toEqual(['swing2', 'bench', 'curl_db', 'plank']);
    expect(suggestedOrder(['plank', 'squat_back'])).toEqual(['squat_back', 'plank']);
    expect(orderRank('snatch_kb')).toBe(0);
    expect(orderRank('farmer')).toBe(3);
  });

  it('rodzaj treningu mówi doradcy, czego się spodziewać', () => {
    expect(codes(reviewWorkout(s, ['bench', 'row_bb'], 'push').notes)).toContain('push-has-pull');
    expect(codes(reviewWorkout(s, ['latpulldown', 'ohp_db'], 'pull').notes)).toContain('pull-has-push');
    expect(codes(reviewWorkout(s, ['squat_back', 'legext'], 'legs').notes)).toContain('no-hip');
    expect(codes(reviewWorkout(s, ['rdl_bb', 'hipthrust'], 'lower').notes)).toContain('no-knee');
    expect(codes(reviewWorkout(s, ['squat_back', 'bench'], 'full').notes)).toContain('full-missing');
    expect(codes(reviewWorkout(s, ['bench', 'ohp_db', 'pushdown'], 'upper').notes)).toContain('no-pull');
    expect(codes(reviewWorkout(s, ['bench'], 'glutes').notes)).toContain('focus-low');
  });

  it('za długi trening dostaje ostrzeżenie, a za dużo ćwiczeń — wskazówkę', () => {
    const many = ['squat_back', 'deadlift', 'bench', 'row_bb', 'ohp_bb', 'latpulldown', 'curl_bb', 'pushdown', 'lateral', 'legcurl', 'legext', 'calf_press'];
    const r = reviewWorkout(s, many);
    expect(codes(r.notes)).toContain('many');
    expect(codes(r.notes).some((c) => c === 'too-long' || c === 'long')).toBe(true);
  });

  it('serie idą za progresją: ćwiczenie z większą liczbą serii obciąża partię mocniej', () => {
    const t = freshState();
    const before = workoutLoads(t, ['goblet']).czworoglowe!;
    t.prog.goblet!.sets = 6;
    expect(workoutLoads(t, ['goblet']).czworoglowe).toBe(before * 2);
  });
});

describe('doradca planu', () => {
  const s = freshState();
  const shape = (cycle: string[], weekdays: number[], weeks = 8, deload: number[] = []) => ({
    cycle,
    weekdays,
    weeks,
    deload,
  });

  it('plany z celem: bez ostrzeżeń, główne partie w zakresie i nigdy ciężko dwa dni z rzędu', () => {
    GOAL_PLANS.forEach((t) => {
      const r = reviewPlan(s, t, BUILTIN);
      expect({ id: t.id, warn: r.notes.filter((n) => n.level === 'warn').map((n) => n.code) }).toEqual({
        id: t.id,
        warn: [],
      });
      expect(codes(r.notes), t.id).not.toContain('recovery');
      expect(codes(r.notes), t.id).not.toContain('weekly-max');
      r.weekly
        .filter((w) => !STABILIZERS.includes(w.muscle))
        .forEach((w) => expect(w.sets, `${t.id} ${w.muscle}`).toBeLessThanOrEqual(RULES.weeklyMax));
    });
  });

  it('plany z celem trwają 30, 60 albo 90 dni i odpoczywają przed końcem, a nie w ostatnim tygodniu', () => {
    GOAL_PLANS.forEach((t) => {
      expect([30, 60, 90]).toContain(t.days);
      expect(t.weeks * 7, t.id).toBeGreaterThanOrEqual(t.days! - 3);
      expect(t.weeks * 7, t.id).toBeLessThanOrEqual(t.days! + 3);
      (t.deload ?? []).forEach((w) => expect(w, t.id).toBeLessThan(t.weeks));
      if (t.weeks >= RULES.deloadMaxGap) expect(t.deload?.length, t.id).toBeGreaterThan(0);
      t.cycle.forEach((c) => expect(BUILTIN.some((w) => w.id === c), `${t.id}: ${c}`).toBe(true));
      expect(t.weekdays.length, t.id).toBe(t.daysPerWeek);
      expect(t.expect?.length ?? 0, t.id).toBeGreaterThan(40);
    });
    expect(new Set([...GOAL_PLANS, ...PLANS].map((p) => p.id)).size).toBe(GOAL_PLANS.length + PLANS.length);
  });

  it('ten sam ciężki trening dwa dni z rzędu łamie 48 godzin — także z niedzieli na poniedziałek', () => {
    expect(codes(reviewPlan(s, shape(['legs-gym', 'legs-gym'], [1, 2]), BUILTIN).notes)).toContain('recovery');
    expect(codes(reviewPlan(s, shape(['legs-gym', 'legs-gym'], [1, 7]), BUILTIN).notes)).toContain('recovery');
    expect(codes(reviewPlan(s, shape(['legs-gym', 'upper-gym'], [1, 2]), BUILTIN).notes)).not.toContain(
      'recovery',
    );
  });

  it('siedem dni bez przerwy i trening, którego nie ma, to ostrzeżenia', () => {
    expect(codes(reviewPlan(s, shape(['A'], [1, 2, 3, 4, 5, 6, 7]), BUILTIN).notes)).toContain('no-rest');
    expect(codes(reviewPlan(s, shape(['nie-ma'], [1]), BUILTIN).notes)).toContain('missing-workout');
    expect(reviewPlan(s, shape([], []), BUILTIN).ok).toBe(false);
  });

  it('długi plan bez tygodnia lżejszego dostaje wskazówkę', () => {
    expect(codes(reviewPlan(s, shape(['A', 'B'], [1, 4], 12), BUILTIN).notes)).toContain('deload');
    expect(codes(reviewPlan(s, shape(['A', 'B'], [1, 4], 12, [6]), BUILTIN).notes)).not.toContain('deload');
  });

  it('rotacja dłuższa niż tydzień liczy średnią z pełnego obrotu', () => {
    const a = workoutLoads(s, BUILTIN.find((w) => w.id === 'A')!.items.map((i) => i.ex));
    const b = workoutLoads(s, BUILTIN.find((w) => w.id === 'B')!.items.map((i) => i.ex));
    const r = reviewPlan(s, shape(['A', 'B'], [1, 3, 5]), BUILTIN);
    const glutes = r.weekly.find((w) => w.muscle === 'posladki')!.sets;
    expect(glutes).toBeCloseTo(1.5 * ((a.posladki ?? 0) + (b.posladki ?? 0)), 6);
  });

  it('tydzień lżejszy co sześć tygodni, nigdy w ostatnim', () => {
    expect(autoDeload(4)).toEqual([]);
    expect(autoDeload(9)).toEqual([6]);
    expect(autoDeload(12)).toEqual([6]);
    expect(autoDeload(13)).toEqual([6, 12]);
    expect(autoDeload(48)).toEqual([6, 12, 18, 24, 30, 36, 42]);
    expect(autoDeload(20, 0)).toEqual([]);
    expect(autoDeload(10, 4)).toEqual([4, 8]);
  });

  it('pierwszy tydzień słowami: dzień i trening', () => {
    expect(weekLayout(shape(['push-gym', 'pull-gym'], [5, 1]))).toEqual([
      { weekday: 1, name: 'poniedziałek', workout: 'push-gym' },
      { weekday: 5, name: 'piątek', workout: 'pull-gym' },
    ]);
  });
});

describe('tydzień lżejszy', () => {
  it('kalendarz oznacza terminy z tygodni lżejszych', () => {
    const t = GOAL_PLANS.find((p) => p.id === 'cel-ppl-60')!;
    const sch = buildSchedule(t, { templateId: t.id, start: '2026-09-28', ticked: {} }, [], '2026-09-28');
    expect(sch.days.filter((d) => d.deload).every((d) => d.week === 6)).toBe(true);
    expect(sch.days.filter((d) => d.deload)).toHaveLength(t.weekdays.length);
  });

  it('recepta ma o ok. 40% mniej serii i bez testu „ile dasz radę”', () => {
    const s = freshState();
    s.prog.goblet!.phase = 'work';
    s.prog.goblet!.sets = 5;
    s.prog.goblet!.probe = true;
    s.session = { workout: 'A', started: '2026-09-28T08:00:00Z', ready: 'ok', res: {}, done: {}, skip: {}, deload: true };
    const rows = plan(s, 'goblet');
    expect(rows).toHaveLength(Math.round(5 * DELOAD_SHARE));
    expect(rows.some((r) => r.amrap)).toBe(false);
    s.session.deload = false;
    expect(plan(s, 'goblet')).toHaveLength(5);
  });

  it('w tygodniu lżejszym próba czeka: jedna zwykła seria zamiast „ile dasz radę”', () => {
    const s = freshState();
    s.session = { workout: 'A', started: '2026-09-28T08:00:00Z', ready: 'ok', res: {}, done: {}, skip: {}, deload: true };
    expect(s.prog.goblet!.phase).toBe('calib');
    expect(plan(s, 'goblet').some((r) => r.amrap)).toBe(false);
    s.session.deload = false;
    expect(plan(s, 'goblet').some((r) => r.amrap)).toBe(true);
  });
});

describe('plany własne', () => {
  it('plan własny odnajduje się tak samo jak gotowy', () => {
    const s = freshState();
    const own: PlanTemplate = {
      id: 'p1',
      name: 'Mój',
      kind: 'own',
      level: 'base',
      sex: 'any',
      daysPerWeek: 2,
      weeks: 10,
      loadFactor: 0.7,
      cycle: ['A', 'B'],
      weekdays: [1, 4],
      desc: '',
      deload: [6],
    };
    s.plans = [own];
    expect(planOf(s, 'p1')).toBe(own);
    expect(planOf(s, 'cel-start-30')?.kind).toBe('goal');
    expect(planOf(freshState(), 'p1')).toBeUndefined();
  });
});
