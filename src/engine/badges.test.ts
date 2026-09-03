import { describe, expect, it } from 'vitest';
import { planById, planId } from '../data/plans';
import { freshState } from './plan';
import { buildSchedule, planStats } from './schedule';
import { BADGES, syncBadges } from './badges';
import { advise } from './advice';
import { bankPoints, snapshot } from './snapshot';
import type { ActivePlan, AppState, LogEntry } from '../types';

const t3 = planById(planId('base', 'any', 3))!;
const activePlan = (start: string): ActivePlan => ({
  templateId: t3.id,
  start,
  weekdays: t3.weekdays,
  policy: 'shift',
  ticked: {},
});

const entry = (date: string): LogEntry => ({
  date: `${date}T18:00:00.000Z`,
  workout: 'A',
  ready: 'ok',
  items: [{ id: 'swing2', sets: [{ reps: 10, w: 16 }], effort: 'solid' }],
});

const withLog = (dates: string[]): AppState => {
  const s = freshState();
  s.log = dates.map(entry);
  s.plan = activePlan('2026-08-31');
  return s;
};

const ctx = (s: AppState, today: string) => {
  const schedule = buildSchedule(t3, s.plan!, [...new Set(s.log.map((e) => e.date.slice(0, 10)))].sort(), today);
  return { state: s, schedule, stats: planStats(schedule, today), today };
};

describe('odznaki', () => {
  it('każda odznaka ma opis i unikalny identyfikator', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    BADGES.forEach((b) => {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.desc.length).toBeGreaterThan(0);
    });
  });

  it('pierwszy trening odblokowuje pierwszą odznakę', () => {
    const s = withLog(['2026-08-31']);
    const fresh = syncBadges(s, ctx(s, '2026-08-31'));
    expect(fresh).toContain('pierwszy-krok');
    expect(s.award.badges['pierwszy-krok']).toBe('2026-08-31');
  });

  it('nie przyznaje tej samej odznaki dwa razy', () => {
    const s = withLog(['2026-08-31']);
    syncBadges(s, ctx(s, '2026-08-31'));
    const again = syncBadges(s, ctx(s, '2026-09-02'));
    expect(again).not.toContain('pierwszy-krok');
    expect(s.events.filter((e) => e.id === 'badge:pierwszy-krok')).toHaveLength(1);
  });

  it('seria trzech terminów w terminie daje odznakę serii', () => {
    const s = withLog(['2026-08-31', '2026-09-02', '2026-09-04']);
    const fresh = syncBadges(s, ctx(s, '2026-09-04'));
    expect(fresh).toContain('seria-3');
    expect(fresh).toContain('czysty-tydzien');
  });

  it('nadrobiony termin daje odznakę za nadrobienie', () => {
    const s = withLog(['2026-09-01']);
    expect(syncBadges(s, ctx(s, '2026-09-01'))).toContain('nadrabiacz');
  });

  it('trening po dwóch tygodniach przerwy daje odznakę powrotu', () => {
    const s = withLog(['2026-08-31', '2026-09-16']);
    expect(syncBadges(s, ctx(s, '2026-09-16'))).toContain('powrot');
  });

  it('odznaka raz zdobyta zostaje po zmianie planu', () => {
    const s = withLog(['2026-08-31']);
    syncBadges(s, ctx(s, '2026-08-31'));
    s.plan = null;
    expect(s.award.badges['pierwszy-krok']).toBeTruthy();
  });

  it('każda odznaka trafia do dziennika', () => {
    const s = withLog(['2026-08-31']);
    const fresh = syncBadges(s, ctx(s, '2026-08-31'));
    fresh.forEach((id) => {
      expect(s.events.some((e) => e.id === `badge:${id}`)).toBe(true);
    });
  });
});

describe('dorobek', () => {
  it('punkty z zamkniętego planu przechodzą do dorobku', () => {
    const s = withLog(['2026-08-31']);
    const before = snapshot(s, '2026-08-31')!.score.points;
    const banked = bankPoints(s, '2026-08-31');
    expect(banked).toBe(before);
    expect(s.award.banked).toBe(before);
  });

  it('dorobek doliczany do punktów kolejnego planu', () => {
    const s = withLog(['2026-08-31']);
    s.award.banked = 1000;
    const snap = snapshot(s, '2026-08-31')!;
    expect(snap.points).toBe(1000 + snap.score.points);
  });
});

describe('podpowiedzi', () => {
  const tip = (s: AppState, today: string) => {
    const snap = snapshot(s, today)!;
    return advise(s, snap.template, snap.plan, snap.stats, today);
  };

  it('w dniu terminu zachęca do treningu', () => {
    const s = withLog([]);
    expect(tip(s, '2026-08-31')[0]!.kind).toBe('due');
  });

  it('po terminie proponuje nadrobienie i podaje, ile zostało czasu', () => {
    const s = withLog([]);
    const a = tip(s, '2026-09-01')[0]!;
    expect(a.kind).toBe('makeup');
    expect(a.text).toContain('nadrobienie');
  });

  it('w dzień wolny mówi o przerwie, nie o zaległości', () => {
    const s = withLog(['2026-08-31']);
    expect(tip(s, '2026-08-31')[0]!.kind).toBe('rest');
  });

  it('przy niskiej realizacji proponuje rzadszy wariant', () => {
    const s = withLog(['2026-08-31']);
    const a = tip(s, '2026-09-21').find((x) => x.kind === 'slower');
    expect(a).toBeDefined();
    expect(a!.freq).toBe(2);
  });

  it('przy pełnej realizacji proponuje gęstszy wariant', () => {
    const dates = buildSchedule(t3, activePlan('2026-08-31'), [], '2026-08-31')
      .days.slice(0, 9)
      .map((d) => d.date);
    const s = withLog(dates);
    const a = tip(s, dates[dates.length - 1]!).find((x) => x.kind === 'faster');
    expect(a).toBeDefined();
    expect(a!.freq).toBe(4);
  });

  it('po długiej przerwie ostrzega przed ciężkim wejściem', () => {
    const s = withLog(['2026-08-31']);
    expect(tip(s, '2026-09-21').some((x) => x.kind === 'layoff')).toBe(true);
  });
});
