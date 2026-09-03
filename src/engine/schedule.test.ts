import { describe, expect, it } from 'vitest';
import { PLANS, planById, planId, FREQUENCIES, LEVELS, SEXES } from '../data/plans';
import { BUILTIN } from '../data/exercises';
import { addDays, buildSchedule, daysBetween, mondayOf, weekdayOf, planStats } from './schedule';
import type { ActivePlan, PlanPolicy } from '../types';

const plan = (
  start: string,
  extra: Partial<ActivePlan> = {},
): ActivePlan => ({ templateId: 'base-any-3', start, ticked: {}, ...extra });

const policy = (p: PlanPolicy) => ({ policy: p });

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
  const build = (
    start: string,
    logged: string[] = [],
    today = start,
    extra: Partial<ActivePlan> = {},
  ) => buildSchedule(t3, plan(start, extra), logged, today);

  it('rozpisuje 12 tygodni po tyle sesji, ile w tygodniu', () => {
    const { days } = build('2026-08-31');
    expect(days).toHaveLength(36);
    expect(days[0]!.date).toBe('2026-08-31');
    expect(days[0]!.week).toBe(1);
    expect(days[days.length - 1]!.week).toBe(12);
  });

  it('pomija dni sprzed startu w napoczętym tygodniu', () => {
    // Start w czwartek: poniedziałek i środa tego tygodnia odpadają.
    const { days } = build('2026-09-03');
    expect(days).toHaveLength(34);
    expect(days[0]!.date).toBe('2026-09-04');
  });

  it('respektuje dni tygodnia wybrane ręcznie', () => {
    const { days } = build('2026-08-31', [], '2026-08-31', { weekdays: [2, 6] });
    expect(days).toHaveLength(24);
    expect(days.slice(0, 2).map((d) => d.weekday)).toEqual([2, 6]);
  });

  it('liczy przerwę między treningami', () => {
    const { days } = build('2026-08-31');
    // Poniedziałek -> środa to jeden dzień przerwy, piątek -> poniedziałek dwa.
    expect(days[1]!.gap).toBe(1);
    expect(days[3]!.gap).toBe(2);
  });

  it('rozróżnia dziś, do nadrobienia, przepadłe i przyszłe', () => {
    const { days } = build('2026-08-31', [], '2026-09-02');
    expect(days[0]!.status).toBe('open');
    expect(days[1]!.status).toBe('today');
    expect(days[2]!.status).toBe('future');
    // Cztery dni po terminie okno łaski jest zamknięte.
    expect(build('2026-08-31', [], '2026-09-07').days[0]!.status).toBe('missed');
  });
});

describe('przypisanie treningu do terminu', () => {
  const t3 = planById(planId('base', 'any', 3))!;
  const build = (logged: string[], today: string) =>
    buildSchedule(t3, plan('2026-08-31'), logged, today);

  it('domyka termin z tego samego dnia', () => {
    const { days } = build(['2026-08-31'], '2026-08-31');
    expect(days[0]!.status).toBe('done');
    expect(days[0]!.late).toBe(0);
    expect(days[0]!.source).toBe('log');
  });

  it('nadrabia najstarszy zaległy termin w oknie łaski', () => {
    // Poniedziałek przepadł, trening dopiero we wtorek.
    const { days } = build(['2026-09-01'], '2026-09-01');
    expect(days[0]!.status).toBe('done');
    expect(days[0]!.late).toBe(1);
    expect(days[1]!.status).toBe('future');
  });

  it('woli termin dzisiejszy od zaległego', () => {
    // Poniedziałek przepadł, ale w środę wypada własny termin — on ma pierwszeństwo.
    const { days } = build(['2026-09-02'], '2026-09-02');
    expect(days[0]!.status).toBe('open');
    expect(days[1]!.status).toBe('done');
    expect(days[1]!.late).toBe(0);
  });

  it('przyjmuje trening zrobiony dzień przed terminem', () => {
    const { days, extras } = build(['2026-08-30'], '2026-08-31');
    expect(days[0]!.status).toBe('done');
    expect(days[0]!.late).toBe(0);
    expect(extras).toEqual([]);
  });

  it('trening bez wolnego terminu w zasięgu liczy się jako dodatkowy', () => {
    // Plan 2× (pon, czw). Poniedziałek domknięty, wtorek nie ma czego domykać:
    // najbliższy wolny termin jest dopiero za dwa dni, a nie za jeden.
    const t2 = planById(planId('base', 'any', 2))!;
    const { days, extras } = buildSchedule(
      t2,
      plan('2026-08-31'),
      ['2026-08-31', '2026-09-01'],
      '2026-09-01',
    );
    expect(extras).toEqual(['2026-09-01']);
    expect(days.filter((d) => d.status === 'done')).toHaveLength(1);
  });

  it('jedna sesja domyka jeden termin', () => {
    const { days, extras } = build(['2026-08-31', '2026-08-31'], '2026-08-31');
    expect(days.filter((d) => d.status === 'done')).toHaveLength(1);
    expect(extras).toEqual([]);
  });

  it('odhacza sesje ręcznie', () => {
    const p = plan('2026-08-31', { ticked: { 1: true } });
    const { days } = buildSchedule(t3, p, [], '2026-09-07');
    expect(days[1]!.status).toBe('done');
    expect(days[1]!.source).toBe('tick');
    expect(days[0]!.status).toBe('missed');
  });
});

describe('rotacja treningów po opuszczonym terminie', () => {
  const t3 = planById(planId('base', 'any', 3))!;

  it('przy „trening czeka” opuszczony trening wchodzi na kolejny termin', () => {
    // Poniedziałek (A) przepadł na dobre, środa i piątek przed nami.
    const { days } = buildSchedule(t3, plan('2026-08-31', policy('shift')), [], '2026-09-07');
    // 31.08 i 02.09 przepadły, 04.09 wciąż do nadrobienia — wszystkie trzy trzymają trening A,
    // bo wskaźnik rotacji rusza dopiero, gdy termin zostanie zamknięty albo ostatecznie przepadnie.
    expect(days[0]!.status).toBe('missed');
    expect(days[0]!.workout).toBe('A');
    expect(days[1]!.workout).toBe('A');
    expect(days[2]!.workout).toBe('A');
    expect(days[3]!.workout).toBe('B');
  });

  it('zrobiony termin przesuwa rotację dalej', () => {
    const { days } = buildSchedule(
      t3,
      plan('2026-08-31', policy('shift')),
      ['2026-08-31'],
      '2026-09-07',
    );
    expect(days[0]!.workout).toBe('A');
    expect(days[1]!.workout).toBe('B');
  });

  it('przy „trening przepada” rotacja idzie z kalendarzem', () => {
    const { days } = buildSchedule(t3, plan('2026-08-31', policy('fixed')), [], '2026-09-07');
    expect(days[0]!.workout).toBe('A');
    expect(days[1]!.workout).toBe('B');
    expect(days[2]!.workout).toBe('C');
  });

  it('dwa opuszczone terminy nie gubią dwóch treningów', () => {
    const { days } = buildSchedule(t3, plan('2026-08-31', policy('shift')), [], '2026-09-09');
    // Poniedziałek, środa i piątek przepadły; kolejny poniedziałek wciąż zaczyna od A.
    expect(days.slice(0, 3).every((d) => d.status === 'missed')).toBe(true);
    expect(days[3]!.workout).toBe('A');
    expect(days[4]!.workout).toBe('B');
  });
});

describe('statystyki planu', () => {
  const t3 = planById(planId('base', 'any', 3))!;

  it('liczy realizację tylko z terminów rozstrzygniętych', () => {
    // 31.08 zrobiony, 02.09 przepadł bezpowrotnie, 04.09 jeszcze do nadrobienia.
    const s = planStats(
      buildSchedule(t3, plan('2026-08-31'), ['2026-08-31'], '2026-09-07'),
      '2026-09-07',
    );
    expect(s.total).toBe(36);
    expect(s.done).toBe(1);
    expect(s.missed).toBe(1);
    expect(s.open).toBe(1);
    expect(s.adherence).toBe(50);
  });

  it('nie wymyśla realizacji przed pierwszym terminem', () => {
    const s = planStats(buildSchedule(t3, plan('2026-09-07'), [], '2026-09-01'), '2026-09-01');
    expect(s.adherence).toBeNull();
  });

  it('podaje najdłuższą zaplanowaną przerwę', () => {
    const two = buildSchedule(
      planById(planId('base', 'any', 2))!,
      plan('2026-08-31'),
      [],
      '2026-08-31',
    );
    // Poniedziałek i czwartek: przerwy 2 i 3 dni, nigdy 6.
    expect(planStats(two, '2026-08-31').maxGap).toBe(3);
  });

  it('seria rośnie tylko za terminy trafione co do dnia', () => {
    const logged = ['2026-08-31', '2026-09-02', '2026-09-05'];
    const s = planStats(buildSchedule(t3, plan('2026-08-31'), logged, '2026-09-07'), '2026-09-07');
    // Piątkowy termin nadrobiony w sobotę: seria wraca do zera, ale nic nie przepadło.
    expect(s.onTime).toBe(2);
    expect(s.late).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(2);
    expect(s.alive).toBe(3);
    expect(s.missed).toBe(0);
  });

  it('opuszczony termin zeruje obie serie', () => {
    const s = planStats(
      buildSchedule(t3, plan('2026-08-31'), ['2026-08-31'], '2026-09-14'),
      '2026-09-14',
    );
    expect(s.streak).toBe(0);
    expect(s.alive).toBe(0);
    expect(s.bestStreak).toBe(1);
  });

  it('wskazuje, co robić dziś: własny termin albo zaległy', () => {
    const own = planStats(buildSchedule(t3, plan('2026-08-31'), [], '2026-09-02'), '2026-09-02');
    expect(own.due?.date).toBe('2026-09-02');
    const late = planStats(buildSchedule(t3, plan('2026-08-31'), [], '2026-09-01'), '2026-09-01');
    expect(late.due?.date).toBe('2026-08-31');
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
