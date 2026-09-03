import { describe, expect, it } from 'vitest';
import { planById, planId } from '../data/plans';
import { buildSchedule, planStats } from './schedule';
import { POINTS, RANKS, countCleanWeeks, pointsToday, rankFor, scorePlan } from './score';
import { journal } from './journal';
import type { ActivePlan } from '../types';

const t3 = planById(planId('base', 'any', 3))!;
const plan = (start: string): ActivePlan => ({ templateId: t3.id, start, ticked: {} });

/** Terminy planu 3× startującego 31.08.2026: poniedziałki, środy i piątki. */
const build = (logged: string[], today: string) =>
  buildSchedule(t3, plan('2026-08-31'), logged, today);

describe('punkty', () => {
  it('termin w terminie daje stawkę podstawową plus premię za serię', () => {
    const s = scorePlan(build(['2026-08-31'], '2026-08-31'));
    expect(s.parts.sessions).toBe(POINTS.onTime);
    expect(s.parts.streak).toBe(POINTS.streakStep);
    expect(s.points).toBe(POINTS.onTime + POINTS.streakStep);
  });

  it('premia za serię rośnie z każdym kolejnym terminem', () => {
    const s = scorePlan(build(['2026-08-31', '2026-09-02', '2026-09-04'], '2026-09-04'));
    expect(s.parts.sessions).toBe(3 * POINTS.onTime);
    expect(s.parts.streak).toBe((1 + 2 + 3) * POINTS.streakStep);
  });

  it('premia za serię ma sufit', () => {
    // Dwanaście terminów z rzędu: premia przestaje rosnąć po dziesiątym.
    const days: string[] = [];
    let d = '2026-08-31';
    const all = buildSchedule(t3, plan('2026-08-31'), [], '2026-08-31').days;
    all.slice(0, 12).forEach((x) => days.push(x.date));
    d = days[days.length - 1]!;
    const s = scorePlan(build(days, d));
    const expected = (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 10 + 10) * POINTS.streakStep;
    expect(s.parts.streak).toBe(expected);
  });

  it('nadrobiony termin płaci mniej i zeruje serię', () => {
    // Poniedziałek nadrobiony we wtorek, środa w terminie.
    const s = scorePlan(build(['2026-09-01', '2026-09-02'], '2026-09-02'));
    expect(s.parts.sessions).toBe(POINTS.late[0]! + POINTS.onTime);
    // Seria startuje od nowa dopiero na środzie.
    expect(s.parts.streak).toBe(POINTS.streakStep);
  });

  it('opuszczony termin nic nie zabiera, tylko zeruje serię', () => {
    const kept = scorePlan(build(['2026-08-31', '2026-09-02'], '2026-09-02'));
    // Ten sam komplet, ale ze środą opuszczoną na dobre i piątkiem zrobionym w terminie.
    const broken = scorePlan(build(['2026-08-31', '2026-09-04'], '2026-09-09'));
    expect(broken.parts.sessions).toBe(kept.parts.sessions);
    expect(broken.parts.streak).toBeLessThan(kept.parts.streak);
    expect(broken.points).toBeGreaterThan(0);
  });

  it('trening poza planem liczy się, ale mniej niż trafiony termin', () => {
    const s = scorePlan(
      buildSchedule(
        planById(planId('base', 'any', 2))!,
        { templateId: 'base-any-2', start: '2026-08-31', ticked: {} },
        ['2026-08-31', '2026-09-01'],
        '2026-09-01',
      ),
    );
    expect(s.parts.extra).toBe(POINTS.extra);
    expect(POINTS.extra).toBeLessThan(POINTS.onTime);
  });

  it('czysty tydzień dokłada premię, tydzień z dziurą już nie', () => {
    const clean = build(['2026-08-31', '2026-09-02', '2026-09-04'], '2026-09-07');
    expect(countCleanWeeks(clean.days)).toBe(1);
    expect(scorePlan(clean).parts.weeks).toBe(POINTS.cleanWeek);

    const holed = build(['2026-08-31', '2026-09-04'], '2026-09-07');
    expect(countCleanWeeks(holed.days)).toBe(0);
  });
});

describe('stopnie', () => {
  it('zaczyna od pierwszego stopnia i awansuje na progach', () => {
    expect(rankFor(0).rank.name).toBe(RANKS[0]!.name);
    expect(rankFor(RANKS[1]!.at).rank.name).toBe(RANKS[1]!.name);
    expect(rankFor(RANKS[1]!.at - 1).rank.name).toBe(RANKS[0]!.name);
  });

  it('postęp do kolejnego stopnia mieści się w zakresie 0–1', () => {
    const r = rankFor(RANKS[1]!.at + 1);
    expect(r.progress).toBeGreaterThan(0);
    expect(r.progress).toBeLessThan(1);
    expect(rankFor(RANKS[RANKS.length - 1]!.at).progress).toBe(1);
    expect(rankFor(RANKS[RANKS.length - 1]!.at).next).toBeNull();
  });
});

describe('ile dziś do wzięcia', () => {
  it('termin trafiony co do dnia jest wart najwięcej', () => {
    const onTime = pointsToday(planStats(build([], '2026-08-31'), '2026-08-31'), '2026-08-31');
    const late = pointsToday(planStats(build([], '2026-09-01'), '2026-09-01'), '2026-09-01');
    expect(onTime.kind).toBe('onTime');
    expect(late.kind).toBe('late');
    expect(onTime.now).toBeGreaterThan(late.now);
  });

  it('cena zwłoki rośnie z każdym dniem', () => {
    const d1 = pointsToday(planStats(build([], '2026-09-01'), '2026-09-01'), '2026-09-01');
    const d2 = pointsToday(planStats(build([], '2026-09-02'), '2026-09-02'), '2026-09-02');
    // Drugiego dnia dzisiejszy termin bije zaległy, więc porównujemy same stawki spóźnień.
    expect(POINTS.late[0]!).toBeGreaterThan(POINTS.late[1]!);
    expect(d1.now).toBe(POINTS.late[0]);
    expect(d2.kind).toBe('onTime');
  });

  it('w dzień bez terminu liczy się stawka dodatkowa', () => {
    const s = planStats(build(['2026-08-31'], '2026-08-31'), '2026-08-31');
    expect(pointsToday(s, '2026-08-31').now).toBe(POINTS.extra);
  });
});

describe('dziennik', () => {
  const name = (id: string): string => `Trening ${id}`;

  it('zapisuje zrobione, nadrobione i opuszczone terminy', () => {
    const schedule = build(['2026-08-31', '2026-09-03'], '2026-09-14');
    const items = journal(schedule, [], name);
    const kinds = items.map((e) => e.kind);
    expect(kinds).toContain('done');
    expect(kinds).toContain('late');
    expect(kinds).toContain('missed');
  });

  it('opuszczony dzień trafia do dziennika, choćby aplikacja była wtedy zamknięta', () => {
    const items = journal(build([], '2026-09-14'), [], name);
    expect(items.filter((e) => e.kind === 'missed').length).toBeGreaterThanOrEqual(4);
  });

  it('idzie od najnowszych i nie powtarza tego samego zdarzenia', () => {
    const items = journal(build(['2026-08-31'], '2026-09-14'), [], name);
    const ids = items.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(items[0]!.date >= items[items.length - 1]!.date).toBe(true);
  });
});
