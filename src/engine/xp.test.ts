import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { addSnack } from './snacks';
import { achCtx, syncBadges, tierKey } from './badges';
import { exFamilyId } from './exbadges';
import { LEVEL_TITLES, XP, levelFor, snackXpLeft, titleFor, xpForLevel, xpItems, xpSummary } from './xp';
import type { LogEntry } from '../types';

const entry = (iso: string): LogEntry => ({
  date: iso,
  workout: 'A',
  ready: 'ok',
  items: [{ id: 'swing2', sets: [{ reps: 10, w: 16 }], effort: 'solid' }],
});

describe('źródła doświadczenia', () => {
  it('trening daje stałą pulę, kolejny tego samego dnia — niewiele', () => {
    const s = freshState();
    s.log = [
      entry('2026-09-27T08:00:00Z'),
      entry('2026-09-27T18:00:00Z'),
      entry('2026-09-28T08:00:00Z'),
    ];
    const w = xpItems(s).filter((i) => i.source === 'trening');
    expect(w.map((i) => i.xp)).toEqual([XP.workout, XP.workoutAgain, XP.workout]);
  });

  it('przekąski płacą do dziennego sufitu, dalej już tylko liczą się do odznak', () => {
    const s = freshState();
    for (let i = 0; i < XP.snackCap + 3; i++)
      addSnack(s, 'squat_air', 10, null, Date.parse(`2026-09-27T0${i}:00:00Z`));
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-28T08:00:00Z'));
    const sum = xpSummary(s, '2026-09-28');
    expect(sum.parts.przekaska).toBe((XP.snackCap + 1) * XP.snack);
    expect(snackXpLeft(s, '2026-09-27')).toBe(0);
    expect(snackXpLeft(s, '2026-09-28')).toBe(XP.snackCap - 1);
  });

  it('próg odznaki płaci według tworzywa, a odznaka ćwiczenia połowę', () => {
    const s = freshState();
    s.award.badges[tierKey('treningi', 1)] = '2026-09-27';
    s.award.badges[tierKey('ranny-ptaszek', 1)] = '2026-09-27';
    s.award.badges[tierKey(exFamilyId('squat_air', 'dzien'), 5)] = '2026-09-27';
    const xp = xpItems(s)
      .filter((i) => i.source === 'odznaka')
      .map((i) => i.xp);
    // Pierwszy z dziewięciu progów to brąz, odznaka jednorazowa — złoto,
    // ostatni próg ćwiczenia — szmaragd za pół stawki.
    expect(xp).toEqual([XP.band[1], XP.band[3], XP.band[5]! * XP.exerciseShare]);
  });

  it('klucze po nieistniejących rodzinach i progach nie dają niczego', () => {
    const s = freshState();
    s.award.badges['nie-ma-takiej:1'] = '2026-09-27';
    s.award.badges[tierKey('treningi', 99)] = '2026-09-27';
    expect(xpItems(s)).toEqual([]);
  });

  it('dzisiaj i ostatnie siedem dni liczą się z dat', () => {
    const s = freshState();
    s.log = [entry('2026-09-20T08:00:00Z'), entry('2026-09-21T08:00:00Z'), entry('2026-09-27T08:00:00Z')];
    const sum = xpSummary(s, '2026-09-27');
    expect(sum.today).toBe(XP.workout);
    expect(sum.week).toBe(2 * XP.workout);
    expect(sum.total).toBe(3 * XP.workout);
  });

  it('ruch dziś to trening albo przekąska, nie próg dopisany dziś', () => {
    const s = freshState();
    s.log = [entry('2026-09-20T08:00:00Z')];
    s.award.badges[tierKey('treningi', 1)] = '2026-09-27';
    const sum = xpSummary(s, '2026-09-27');
    expect(sum.today).toBe(XP.band[1]);
    expect(sum.move).toBe(0);
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-27T09:00:00Z'));
    expect(xpSummary(s, '2026-09-27').move).toBe(XP.snack);
  });

  it('suma nie jest zapamiętana: import tej samej historii daje ten sam wynik', () => {
    const s = freshState();
    s.log = [entry('2026-09-27T08:00:00Z')];
    addSnack(s, 'squat_air', 10, null, Date.parse('2026-09-27T09:00:00Z'));
    syncBadges(s, achCtx(s, null, null, '2026-09-27'));
    const copy = JSON.parse(JSON.stringify(s));
    expect(xpSummary(copy, '2026-09-27')).toEqual(xpSummary(s, '2026-09-27'));
  });
});

describe('poziom postaci', () => {
  it('pierwszy awans po pierwszym treningu, każdy kolejny o sto droższy', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(XP.workout - 1).level).toBe(1);
    expect(levelFor(XP.workout).level).toBe(2);
    for (let n = 1; n < 60; n++) expect(xpForLevel(n + 1) - xpForLevel(n)).toBe(100 * n);
  });

  it('poziom zgadza się z progami także na granicach', () => {
    for (let n = 1; n < 80; n++) {
      expect(levelFor(xpForLevel(n)).level).toBe(n);
      if (n > 1) expect(levelFor(xpForLevel(n) - 1).level).toBe(n - 1);
    }
  });

  it('postęp i brakujące doświadczenie mówią to samo', () => {
    const l = levelFor(350);
    expect(l.level).toBe(3);
    expect(l.floor).toBe(300);
    expect(l.ceil).toBe(600);
    expect(l.toNext).toBe(250);
    expect(l.progress).toBeCloseTo(50 / 300, 5);
    expect(levelFor(-50).level).toBe(1);
  });

  it('tytuły rosną z poziomem i zawsze któryś pasuje', () => {
    LEVEL_TITLES.forEach((t, i) => {
      if (i > 0) expect(t.at).toBeGreaterThan(LEVEL_TITLES[i - 1]!.at);
      expect(titleFor(t.at)).toBe(t.name);
    });
    expect(titleFor(1)).toBe(LEVEL_TITLES[0]!.name);
    expect(titleFor(999)).toBe(LEVEL_TITLES[LEVEL_TITLES.length - 1]!.name);
    expect(levelFor(xpForLevel(7)).nextTitle).toEqual({ level: 8, name: titleFor(8) });
  });

  it('tytuły opisują goryla, nie dokuczają człowiekowi', () => {
    LEVEL_TITLES.forEach((t) =>
      expect(t.name).not.toMatch(/wstydź się|nieudacznik|żałosn|leniu|do niczego|słab|leń/i),
    );
  });
});
