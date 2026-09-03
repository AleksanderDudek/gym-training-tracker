import { describe, expect, it } from 'vitest';
import { PLANS, planById, planId, FREQUENCIES, LEVELS, SEXES } from '../data/plans';
import { BUILTIN } from '../data/exercises';
import { addDays, buildSchedule, daysBetween, mondayOf, weekdayOf, planStats } from './schedule';
import type { ActivePlan } from '../types';

const plan = (start: string, ticked: Record<number, true> = {}): ActivePlan => ({
  templateId: 'base-any-3',
  start,
  ticked,
});

describe('daty planu', () => {
  it('liczy dni tygodnia i poniedziałki', () => {
    // 2026-09-02 to środa.
    expect(weekdayOf('2026-09-02')).toBe(3);
    expect(mondayOf('2026-09-02')).toBe('2026-08-31');
    expect(weekdayOf(mondayOf('2026-09-02'))).toBe(1);
  });

  it('dodaje dni przez przełom miesiąca', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(daysBetween('2026-08-31', '2026-09-03')).toBe(3);
  });
});

describe('katalog planów', () => {
  it('pokrywa każdy poziom, płeć i częstotliwość', () => {
    expect(PLANS).toHaveLength(LEVELS.length * SEXES.length * FREQUENCIES.length);
    for (const l of LEVELS)
      for (const s of SEXES)
        for (const d of FREQUENCIES) expect(planById(planId(l, s, d))).toBeDefined();
  });

  it('każdy plan trwa 12 tygodni i ma tyle dni, ile obiecuje', () => {
    for (const t of PLANS) {
      expect(t.weeks).toBe(12);
      expect(t.weekdays).toHaveLength(t.daysPerWeek);
    }
  });

  it('rotacja używa wyłącznie istniejących treningów', () => {
    const ids = new Set(BUILTIN.map((w) => w.id));
    for (const t of PLANS) for (const id of t.cycle) expect(ids.has(id)).toBe(true);
  });

  it('im częściej, tym większy udział dnia lekkiego', () => {
    const share = (days: number): number => {
      const c = planById(planId('base', 'any', days))!.cycle;
      return c.filter((x) => x === 'D').length / c.length;
    };
    expect(share(2)).toBe(0);
    expect(share(5)).toBeGreaterThan(0);
    expect(share(7)).toBeGreaterThan(share(5));
  });

  it('cięższy poziom znaczy większe obciążenie startowe, a płeć tylko je przesuwa', () => {
    const at = (l: 'zero' | 'base' | 'strong', s: 'f' | 'm' | 'any') =>
      planById(planId(l, s, 3))!.loadFactor;
    expect(at('zero', 'any')).toBeLessThan(at('base', 'any'));
    expect(at('base', 'any')).toBeLessThan(at('strong', 'any'));
    expect(at('base', 'f')).toBeLessThan(at('base', 'm'));
    // Program jest ten sam — różni się wyłącznie mnożnik ciężaru.
    const f = planById(planId('base', 'f', 4))!;
    const m = planById(planId('base', 'm', 4))!;
    expect(f.cycle).toEqual(m.cycle);
    expect(f.weekdays).toEqual(m.weekdays);
  });
});

describe('rozpisanie planu', () => {
  const t3 = planById(planId('base', 'any', 3))!;

  it('rozpisuje 12 tygodni po tyle sesji, ile w tygodniu', () => {
    const days = buildSchedule(t3, plan('2026-08-31'), new Set(), '2026-08-31');
    expect(days).toHaveLength(36);
    expect(days[0]!.date).toBe('2026-08-31');
    expect(days[0]!.week).toBe(1);
    expect(days[days.length - 1]!.week).toBe(12);
  });

  it('pomija dni sprzed startu w napoczętym tygodniu', () => {
    // Start w czwartek: poniedziałek i środa tego tygodnia odpadają.
    const days = buildSchedule(t3, plan('2026-09-03'), new Set(), '2026-09-03');
    expect(days).toHaveLength(34);
    expect(days[0]!.date).toBe('2026-09-04');
  });

  it('powtarza ten sam układ co tydzień, żeby grafik dało się zapamiętać', () => {
    const days = buildSchedule(t3, plan('2026-08-31'), new Set(), '2026-08-31');
    expect(days.slice(0, 3).map((d) => d.workout)).toEqual(['A', 'B', 'C']);
    // Ten sam dzień tygodnia to ten sam trening również w kolejnym tygodniu.
    expect(days[3]!.workout).toBe(days[0]!.workout);
    expect(days[3]!.weekday).toBe(days[0]!.weekday);
  });

  it('liczy przerwę między treningami', () => {
    const days = buildSchedule(t3, plan('2026-08-31'), new Set(), '2026-08-31');
    // Poniedziałek -> środa to jeden dzień przerwy, piątek -> poniedziałek dwa.
    expect(days[1]!.gap).toBe(1);
    expect(days[3]!.gap).toBe(2);
  });

  it('odhacza sesje z historii treningów i ręcznie', () => {
    const done = new Set(['2026-08-31']);
    const days = buildSchedule(t3, plan('2026-08-31', { 1: true }), done, '2026-09-07');
    expect(days[0]!.status).toBe('done');
    expect(days[1]!.status).toBe('done');
    expect(days[2]!.status).toBe('missed');
  });

  it('rozróżnia dziś, zaległe i przyszłe', () => {
    const days = buildSchedule(t3, plan('2026-08-31'), new Set(), '2026-09-02');
    expect(days[0]!.status).toBe('missed');
    expect(days[1]!.status).toBe('today');
    expect(days[2]!.status).toBe('future');
  });
});

describe('statystyki planu', () => {
  const t3 = planById(planId('base', 'any', 3))!;

  it('liczy realizację tylko z sesji, których termin minął', () => {
    const days = buildSchedule(t3, plan('2026-08-31'), new Set(['2026-08-31']), '2026-09-04');
    const s = planStats(days, '2026-09-04');
    expect(s.total).toBe(36);
    expect(s.done).toBe(1);
    // Środa przepadła, piątek jest dzisiaj — dzisiejszy termin jeszcze nie jest zaległością.
    expect(s.missed).toBe(1);
    expect(s.adherence).toBe(50);
    expect(s.next?.date).toBe('2026-09-04');
  });

  it('nie wymyśla realizacji przed pierwszym terminem', () => {
    const days = buildSchedule(t3, plan('2026-09-07'), new Set(), '2026-09-01');
    expect(planStats(days, '2026-09-01').adherence).toBeNull();
  });

  it('podaje najdłuższą zaplanowaną przerwę', () => {
    const two = buildSchedule(planById(planId('base', 'any', 2))!, plan('2026-08-31'), new Set(), '2026-08-31');
    // Poniedziałek i czwartek: przerwy 2 i 3 dni, nigdy 6.
    expect(planStats(two, '2026-08-31').maxGap).toBe(3);
  });
});

describe('odmiana liczebników', () => {
  // Ta sama reguła, co w widoku planu — trzymana tu, żeby nie rozjechała się po cichu.
  const word = (n: number): string => {
    const last = n % 10;
    const teen = n % 100 >= 12 && n % 100 <= 14;
    if (n === 1) return 'trening';
    return !teen && last >= 2 && last <= 4 ? 'treningi' : 'treningów';
  };

  it('odmienia liczbę treningów po polsku', () => {
    expect(word(1)).toBe('trening');
    expect(word(24)).toBe('treningi');
    expect(word(72)).toBe('treningi');
    expect(word(36)).toBe('treningów');
    expect(word(12)).toBe('treningów');
    expect(word(84)).toBe('treningi');
  });
});
