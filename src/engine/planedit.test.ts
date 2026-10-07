import { describe, expect, it } from 'vitest';
import { GOAL_PLANS, PROFILE_PLANS, planById } from '../data/plans';
import { profilePlanId } from '../data/profiles';
import { advise } from './advice';
import { boost } from './boost';
import { freshState } from './plan';
import { spreadDays, withExtension, withWeekdays } from './planedit';
import { buildSchedule, planWeekdays, planWeeks, weekdaysOn } from './schedule';
import { snapshot } from './snapshot';
import type { ActivePlan, AppState, LogEntry } from '../types';

/**
 * Plan, który da się zmienić w trakcie: dni treningowe od dziś, dłuższy plan na koniec,
 * a w dni bez terminu — podpowiedź, co dorzucić, żeby postęp szedł dalej.
 */

const START = '2026-09-07'; // poniedziałek
const start = GOAL_PLANS.find((p) => p.id === 'cel-start-30')!; // pn, śr, pt — A, B

const active = (over: Partial<ActivePlan> = {}): ActivePlan => ({ templateId: start.id, start: START, ticked: {}, ...over });

const log = (day: string, workout = 'Trening A'): LogEntry => ({
  date: `${day}T08:00:00.000Z`,
  workout,
  ready: 'ok',
  items: [{ id: 'goblet', sets: [{ reps: 8, w: 16 }], effort: 'solid' }],
});

describe('zmiana dni od dziś', () => {
  it('terminy przed zmianą zostają, po niej idą nowe dni — historia się nie przepisuje', () => {
    const before = buildSchedule(start, active(), [], '2026-09-14');
    const plan = withWeekdays(active(), '2026-09-14', [2, 4]);
    const after = buildSchedule(start, plan, [], '2026-09-14');
    const past = (s: typeof before) => s.days.filter((d) => d.date < '2026-09-14').map((d) => d.date);
    expect(past(after)).toEqual(past(before));
    expect(after.days.filter((d) => d.date >= '2026-09-14').map((d) => d.weekday).slice(0, 4)).toEqual([2, 4, 2, 4]);
    expect(planWeekdays(start, plan)).toEqual([2, 4]);
    expect(weekdaysOn(start, plan, '2026-09-13')).toEqual([1, 3, 5]);
  });

  it('druga zmiana tego samego dnia zastępuje pierwszą, a dni są posortowane', () => {
    const p = withWeekdays(withWeekdays(active(), '2026-09-14', [2, 4]), '2026-09-14', [6, 1]);
    expect(p.changes).toEqual([{ from: '2026-09-14', weekdays: [1, 6] }]);
  });

  it('przedłużenie dokłada tygodnie na końcu, bez ruszania tego, co było', () => {
    const p = withExtension(active(), 4);
    expect(planWeeks(start, p)).toBe(start.weeks + 4);
    const s = buildSchedule(start, p, [], START);
    expect(s.days.length).toBe(buildSchedule(start, active(), [], START).days.length + 4 * 3);
    expect(withExtension(p, 4).extraWeeks).toBe(8);
  });

  it('dni do zdjęcia i dołożenia zostawiają przerwy jak najrówniejsze', () => {
    expect(spreadDays([1, 3, 5], -1)).toEqual([1, 5]);
    expect(spreadDays([1, 4], 1)).toHaveLength(3);
    const three = spreadDays([1, 4], 1);
    // Trzeci dzień nie wchodzi tuż obok żadnego z dwóch.
    expect(three.every((d, i) => i === 0 || d - three[i - 1]! >= 2)).toBe(true);
    expect(spreadDays([1], -1)).toEqual([1]);
  });
});

describe('doradca rytmu dla każdego planu', () => {
  it('plan z celem przy słabej realizacji podpowiada rzadsze dni zamiast zmiany szablonu', () => {
    const s = freshState();
    s.plan = active();
    // Trzy tygodnie, zrobiony jeden termin z dziewięciu.
    s.log.push(log('2026-09-07'));
    const snap = snapshot(s, '2026-09-28')!;
    const slower = advise(s, snap.template, snap.plan, snap.stats, '2026-09-28').find((a) => a.kind === 'slower')!;
    expect(slower.days).toEqual([1, 5]);
    expect(slower.freq).toBeUndefined();
  });
});

describe('podpowiedzi postępu w dzień bez terminu', () => {
  const profilePlan = (s: AppState) => {
    s.plan = { templateId: profilePlanId('podciaganie', 'kb'), start: START, ticked: {} };
    return s;
  };
  /** Terminy przed `day` zrobione — inaczej zaległy termin ma pierwszeństwo przed podpowiedziami. */
  const doneUntil = (s: AppState, day: string) => {
    ['2026-09-07', '2026-09-09', '2026-09-11'].filter((d) => d < day).forEach((d) => s.log.push(log(d)));
    return s;
  };

  it('plan z profilem podsuwa przekąskę profilu', () => {
    const s = doneUntil(profilePlan(freshState()), '2026-09-08');
    const b = boost(s, snapshot(s, '2026-09-08')!, '2026-09-08'); // wtorek, bez terminu
    const snack = b.find((x) => x.kind === 'snack')!;
    expect(['pullup', 'dead_hang', 'hollow']).toContain(snack.ex);
    expect(snack.text).toMatch(/zapas/);
  });

  it('ćwiczenie, które stoi w miejscu, dostaje lżejszą serię w dzień wolny', () => {
    const s = freshState();
    s.plan = active();
    doneUntil(s, '2026-09-08');
    s.prog.pushup!.stalls = 3;
    const b = boost(s, snapshot(s, '2026-09-08')!, '2026-09-08');
    expect(b.some((x) => x.kind === 'snack' && x.ex === 'pushup')).toBe(true);
  });

  it('w dzień terminu i po zrobionym dziś treningu nie dokłada niczego', () => {
    const s = freshState();
    s.plan = active();
    s.prog.pushup!.stalls = 3;
    expect(boost(s, snapshot(s, '2026-09-07')!, '2026-09-07')).toEqual([]);
    // Zaległy poniedziałek: najpierw nadrobić, potem dokładać.
    expect(boost(s, snapshot(s, '2026-09-08')!, '2026-09-08')).toEqual([]);
    s.log.push(log('2026-09-07'));
    s.log.push(log('2026-09-08', 'Trening dodatkowy'));
    expect(boost(s, snapshot(s, '2026-09-08')!, '2026-09-08')).toEqual([]);
  });

  it('trening dodatkowy tylko z zapasem: termin najwcześniej pojutrze i lekki trening dla sprzętu', () => {
    const s = doneUntil(profilePlan(freshState()), '2026-09-12');
    const p = planById(profilePlanId('podciaganie', 'kb'))!;
    expect(PROFILE_PLANS).toContain(p);
    // Sobota: kolejny termin w poniedziałek — dwa dni zapasu.
    const sat = boost(s, snapshot(s, '2026-09-12')!, '2026-09-12');
    expect(sat.find((x) => x.kind === 'extra')?.workout).toBe('D');
    // Wtorek: termin jutro — trening dodatkowy zabrałby siły na termin.
    const tue = doneUntil(profilePlan(freshState()), '2026-09-08');
    expect(boost(tue, snapshot(tue, '2026-09-08')!, '2026-09-08').some((x) => x.kind === 'extra')).toBe(false);
  });
});
