import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.__KB_LANG__ = 'en';
});

import { ALL, BUILTIN, EX, STAGES } from '../data/exercises';
import { GOAL_PLANS } from '../data/plans';
import { MUSCLE_ACC, MUSCLE_NAME } from '../data/muscles';
import { PROFILES } from '../data/profiles';
import { EQUIP_LABEL } from '../data/stations';
import { advise } from './advice';
import { boost } from './boost';
import { KIND_LABEL, reviewPlan, reviewWorkout, weekLayout } from './design';
import { MODE_NAMES, levelHint, whyText } from './hints';
import { journal } from './journal';
import { epley, round1 } from './math';
import { P, freshState, levelLabel, plan, planLabel, unitTag } from './plan';
import { applyLayoff, applyResult } from './progression';
import {
  CARDIO_EMPTY,
  CHEERS,
  COACH_TIPS,
  CTA,
  EMPTY_SHELF,
  LATE,
  LEVEL_UP,
  LOADING,
  MOTTOS,
  PROGRESS_TITLES,
  REMINDER_EVENING,
  REMINDER_MORNING,
  REMINDER_WEIGH,
  REST,
  SAVED,
  SIGNATORIES,
  SNACK_EMPTY,
  SNACK_SAVED,
  STAMPS,
  SUPPORT,
  SUPPORT_SHORT,
  TOASTS,
  massJoke,
  plural,
  repsJoke,
  timeJoke,
} from './quips';
import { restBetween, restLabel, roundRestOf } from './rests';
import { RANKS } from './score';
import { FREE_NOTE, PITCH, PROMO_EXTRAS, PROMO_TEXTS, TAGLINE, progressSubject, promoText, punchline, shareText } from './share';
import { buildSchedule } from './schedule';
import { snapshot } from './snapshot';
import { sessionSteps } from './steps';
import { pairProblems, restText, setupFor, warmupFor } from './structure';
import type { ActivePlan, AppState, LogEntry, Workout } from '../types';

/**
 * Teksty trenera i silnika po angielsku. Nazwy ćwiczeń, partii, etapów i treningów pochodzą
 * z danych (`src/data`), które tłumaczy się osobno — przed sprawdzeniem liter są wycinane.
 */

const POLISH = /[ąćęłńóśźż]/i;

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);
const DATA = [
  ...Object.values(EX).map((e) => e!.name),
  ...Object.values(MUSCLE_NAME),
  ...Object.values(MUSCLE_ACC),
  ...Object.values(STAGES).flat(),
  ...BUILTIN.map((w) => w.name),
  ...Object.values(PROFILES).map((p) => p.name),
  ...Object.values(EQUIP_LABEL),
]
  .flatMap((s) => [s, s.toLowerCase(), lowerFirst(s)])
  .sort((a, b) => b.length - a.length);

/** Tekst bez wstawek z danych. */
const own = (s: string): string => DATA.reduce((t, d) => (d ? t.split(d).join('·') : t), s);

const english = (texts: readonly (string | null | undefined)[]): void => {
  const list = texts.filter((t): t is string => typeof t === 'string');
  expect(list.length).toBeGreaterThan(0);
  list.forEach((t) => expect(own(t), t).not.toMatch(POLISH));
};

const calibrated = (): AppState => {
  const s = freshState();
  ALL.forEach((id) => {
    const p = P(s, id);
    const d = EX[id]!.def;
    p.phase = 'work';
    p.weight = d.w ?? null;
    p.target = d.target;
    p.e1rm = d.w ? round1(epley(d.w, d.target)) : null;
  });
  return s;
};

const START = '2026-09-07'; // poniedziałek
const GOAL = GOAL_PLANS.find((p) => p.id === 'cel-start-30')!;
const active = (over: Partial<ActivePlan> = {}): ActivePlan => ({ templateId: GOAL.id, start: START, ticked: {}, ...over });
const log = (day: string, workout = 'Trening A'): LogEntry => ({
  date: `${day}T08:00:00.000Z`,
  workout,
  ready: 'ok',
  items: [{ id: 'goblet', sets: [{ reps: 8, w: 16 }], effort: 'solid' }],
});

describe('coach’s lines in English', () => {
  it('every pool and blank is English', () => {
    const pools = [
      CHEERS,
      SAVED,
      REST,
      LATE,
      EMPTY_SHELF,
      SNACK_SAVED,
      SNACK_EMPTY,
      CARDIO_EMPTY,
      REMINDER_MORNING,
      REMINDER_EVENING,
      REMINDER_WEIGH,
      LEVEL_UP,
      LOADING,
      PROGRESS_TITLES,
      SUPPORT,
      SUPPORT_SHORT,
      MOTTOS,
      SIGNATORIES,
      CTA,
      TOASTS,
    ];
    pools.forEach((p) => {
      english(p);
      expect(new Set(p).size).toBe(p.length);
    });
    english(COACH_TIPS.flatMap((t) => [t.tip, t.joke]));
    english(STAMPS.flat());
    expect(SAVED[0]).toBe('Saved. Your muscles will find out tomorrow.');
    // Rada stoi sama, kawa przychodzi w żarcie — jak po polsku.
    COACH_TIPS.forEach((t) => {
      expect(t.tip).not.toMatch(/coffee|espresso/i);
      expect(t.joke).toMatch(/coffee|espresso|cup/i);
    });
    CTA.forEach((t) => expect(t).toMatch(/free/i));
  });

  it('mass, reps and time comparisons speak English', () => {
    expect(massJoke(1_800)).toBe('3 classic Minis');
    expect(massJoke(3_000)).toBe('4 bison');
    expect(massJoke(200_000)).toBe('4 tanks');
    expect(repsJoke(3_600)).toBe('at one a second, that would take 1 hour');
    expect(repsJoke(6_300)).toBe('at one a second, that would take 1 hour and 45 minutes');
    expect(repsJoke(120)).toContain('2 minutes');
    expect(timeJoke(10_080)).toBe('4 TV episodes');
    expect(timeJoke(1_200)).toBe('4 soft-boiled eggs');
    english([25, 70, 300, 6_000, 12_000, 50_000, 5_000_000].map(massJoke));
    english([130, 900, 6_000, 20_000].map(timeJoke));
  });

  it('Polish grammar helper keeps its three forms', () => {
    expect(plural(3, ['słoń', 'słonie', 'słoni'])).toBe('słonie');
  });

  it('ranks have English names', () => {
    english(RANKS.map((r) => r.name));
    expect(RANKS[0]!.name).toBe('Walk-in');
  });
});

describe('workout and plan advice in English', () => {
  const s = freshState();

  it('workout notes', () => {
    const notes = [
      reviewWorkout(s, ['curl', 'goblet', 'swing2'], 'full').notes,
      reviewWorkout(s, ['goblet', 'goblet', 'goblet', 'goblet', 'lunge', 'squat_air'], 'legs').notes,
      reviewWorkout(s, ['press', 'floor', 'dip', 'row'], 'pull').notes,
      reviewWorkout(s, ['row', 'press', 'floor', 'dip'], 'push').notes,
      reviewWorkout(s, ['press', 'floor', 'dip', 'pushup'], 'upper').notes,
      reviewWorkout(s, ALL.slice(0, 14), 'chest').notes,
      reviewWorkout(s, ['goblet', 'lunge'], undefined, [], { circuit: [true, true] }).notes,
      reviewWorkout(s, ['swing2', 'goblet'], 'light').notes,
    ].flat();
    expect(notes.length).toBeGreaterThan(8);
    english(notes.flatMap((n) => [n.title, n.text]));
    const codes = new Set(notes.map((n) => n.code));
    ['full-missing', 'pull-has-push', 'push-has-pull', 'order'].forEach((c) => expect(codes).toContain(c));
    const order = notes.find((n) => n.code === 'order')!;
    expect(order.title).toBe('Order needs fixing');
    english(Object.values(KIND_LABEL));
  });

  it('plan notes cite the research exactly', () => {
    const workouts = [...BUILTIN, ...s.workouts];
    const reviews = [
      reviewPlan(s, { cycle: ['A'], weekdays: [1], weeks: 12 }, workouts),
      reviewPlan(s, { cycle: ['A', 'B'], weekdays: [1, 2, 3, 4, 5, 6, 7], weeks: 12 }, workouts),
      reviewPlan(s, { cycle: ['nope'], weekdays: [], weeks: 4 }, workouts),
      reviewPlan(s, { cycle: GOAL.cycle, weekdays: GOAL.weekdays, weeks: GOAL.weeks, deload: GOAL.deload }, workouts),
    ];
    const notes = reviews.flatMap((r) => r.notes);
    english(notes.flatMap((n) => [n.title, n.text]));
    expect(notes.map((n) => n.text).join(' ')).toMatch(/WHO|ACSM \(2011\)/);
  });

  it('week layout uses English day names', () => {
    expect(weekLayout({ cycle: ['A', 'B'], weekdays: [1, 3, 7], weeks: 4 }).map((d) => d.name)).toEqual([
      'Monday',
      'Wednesday',
      'Sunday',
    ]);
  });
});

describe('progression messages in English', () => {
  it('level changes, holds and caps', () => {
    const out: (string | undefined)[] = [];
    const s = calibrated();
    s.session = { workout: 'A', started: '', ready: 'ok', res: {}, done: {}, skip: {} };
    const perfect = (id: string) => plan(s, id).map((r) => ({ reps: r.reps, w: r.w }));
    // Kolejne udane sesje: cel w górę, przejście, ciężkie serie, domknięcie.
    for (let i = 0; i < 14; i++) out.push(applyResult(s, 'goblet', perfect('goblet'), 'solid', false)?.text);
    for (let i = 0; i < 6; i++) out.push(applyResult(s, 'swing2', perfect('swing2'), 'easy', i === 2)?.text);
    for (let i = 0; i < 8; i++) out.push(applyResult(s, 'pushup', perfect('pushup'), 'solid', false)?.text);
    for (let i = 0; i < 8; i++) out.push(applyResult(s, 'dip', perfect('dip'), 'solid', false)?.text);
    for (let i = 0; i < 3; i++) out.push(applyResult(s, 'row', perfect('row'), 'max', false)?.text);
    for (let i = 0; i < 4; i++) out.push(applyResult(s, 'curl', [{ reps: 1, w: P(s, 'curl').weight }], 'solid', false)?.text);
    english(out);
    expect(out.join('\n')).toMatch(/target \d+ → \d+/);
    expect(out.join('\n')).toMatch(/comes into the first set/);

    // Kalibracja.
    const f = freshState();
    const cal: (string | undefined)[] = [];
    cal.push(applyResult(f, 'goblet', [{ reps: 30, w: P(f, 'goblet').weight }], 'solid', false)?.text);
    cal.push(applyResult(f, 'goblet', [{ reps: 2, w: P(f, 'goblet').weight }], 'solid', false)?.text);
    cal.push(applyResult(f, 'goblet', [{ reps: 9, w: P(f, 'goblet').weight }], 'solid', false)?.text);
    cal.push(applyResult(f, 'swing2', [{ reps: 15, w: P(f, 'swing2').weight }], 'easy', false)?.text);
    cal.push(applyResult(f, 'swing2', [{ reps: 15, w: P(f, 'swing2').weight }], 'solid', false)?.text);
    cal.push(applyResult(f, 'pushup', [{ reps: 40, w: null }], 'solid', false)?.text);
    english(cal);
    expect(cal.join('\n')).toMatch(/starting level set/);
  });

  it('layoff notices', () => {
    const notices = [15, 30, 70].map((d) => applyLayoff(calibrated(), d)!);
    english(notices.flatMap((n) => [n.title, n.text]));
    expect(notices[0]!.title).toBe('15-day break');
    expect(notices[2]!.title).toBe('10-week break');
  });
});

describe('hints and labels in English', () => {
  it('level hints for every kind of exercise', () => {
    const s = calibrated();
    const f = freshState();
    const ids = ['goblet', 'swing2', 'pushup', 'dip', 'farmer', 'deadlift'];
    const html: string[] = [];
    ids.forEach((id) => {
      html.push(levelHint(f, id, [], 'solid').html);
      html.push(levelHint(s, id, [], 'solid').html);
      html.push(levelHint(s, id, [1, 0], 'solid').html);
      html.push(levelHint(s, id, plan(s, id).map((r) => r.reps), 'max').html);
      html.push(levelHint(s, id, plan(s, id).map((r) => r.reps), 'solid').html);
      html.push(whyText(s, id), whyText(f, id));
    });
    P(s, 'goblet').probe = true;
    html.push(levelHint(s, 'goblet', [], 'solid').html);
    P(s, 'row').trans = { to: P(s, 'row').weight! + 4, heavySets: 1, reps: 6 };
    html.push(levelHint(s, 'row', [], 'solid').html, whyText(s, 'row'));
    P(s, 'goblet').stalls = 1;
    P(s, 'goblet').maxHolds = 1;
    html.push(whyText(s, 'goblet'));
    english(html);
    expect(html.join(' ')).toMatch(/Test session|Hit /);
    english(Object.values(MODE_NAMES));
  });

  it('plan labels', () => {
    const s = calibrated();
    const f = freshState();
    english(ALL.flatMap((id) => [planLabel(s, id), planLabel(f, id), levelLabel(s, id)]));
    expect(unitTag('goblet')).toBe(' reps');
  });

  it('rests, structure and warm-up', () => {
    expect(restLabel(90)).toBe('1.5 min');
    expect(restText(95)).toBe('1.5–2 min');
    expect(restText(60)).toBe('about 1 min');
    const s = calibrated();
    const w: Workout = {
      id: 'x',
      name: 'X',
      items: [{ ex: 'swing2' }, { ex: 'goblet' }, { ex: 'deadlift' }, { ex: 'row', circuit: true }, { ex: 'press', circuit: true }],
    };
    s.log.push({
      date: '2026-09-07T08:00:00.000Z',
      workout: 'X',
      wid: 'x',
      ready: 'ok',
      items: [
        { id: 'row', sets: [{ reps: 10, w: null }, { reps: 5, w: null }], effort: 'solid' },
        { id: 'press', sets: [{ reps: 10, w: null }, { reps: 5, w: null }], effort: 'solid' },
      ],
    });
    P(s, 'goblet').hist.push({ d: '2026-09-07', w: 16, reps: [10, 6], eff: 'solid', e1rm: null });
    const st = sessionSteps(s, w);
    const whys = st.map((a, i) => restBetween(s, w, a, st[i + 1] ?? null)?.why);
    const texts = [
      ...pairProblems('swing2', 'goblet', 'kb'),
      ...pairProblems('deadlift', 'rdl_bb', 'gym'),
      roundRestOf(s, w).why,
      ...whys,
      warmupFor(s, w).general,
      warmupFor(s, { ...w, gear: 'gym' }).general,
      warmupFor(s, w).after,
      ...warmupFor(s, w).ramps.map((r) => r.text),
      ...setupFor(s, w).kettlebells.flatMap((k) => k.for),
    ];
    english(texts);
    expect(texts.join(' ')).toMatch(/longer than/);
  });
});

describe('plan advice, extras and journal in English', () => {
  it('advice', () => {
    const s = freshState();
    s.plan = active();
    s.log.push(log('2026-09-07'));
    const texts = ['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-28', '2027-03-01'].flatMap((day) => {
      const snap = snapshot(s, day)!;
      return advise(s, snap.template, snap.plan, snap.stats, day).flatMap((a) => [a.title, a.text]);
    });
    english(texts);
    expect(texts).toContain('Due today');
  });

  it('extras on a day without a deadline', () => {
    const s = freshState();
    s.plan = active();
    ['2026-09-07', '2026-09-09', '2026-09-11'].forEach((d) => s.log.push(log(d)));
    s.prog.pushup!.stalls = 3;
    const b = boost(s, snapshot(s, '2026-09-12')!, '2026-09-12');
    expect(b.length).toBeGreaterThan(0);
    english(b.flatMap((x) => [x.title, x.text]));
  });

  it('journal entries', () => {
    const s = freshState();
    s.plan = active();
    const schedule = buildSchedule(GOAL, active({ ticked: { 1: true } }), ['2026-09-07', '2026-09-10', '2026-09-13', '2026-09-14', '2026-09-16', '2026-09-18'], '2026-10-01');
    const entries = journal(schedule, [], () => 'Workout');
    english(entries.flatMap((e) => [e.title, e.text]));
    expect(entries.some((e) => e.title === 'Workout — on time')).toBe(true);
  });
});

describe('share texts in English', () => {
  it('slogans and posts', () => {
    english([TAGLINE, FREE_NOTE, PITCH, PROMO_EXTRAS, ...PROMO_TEXTS, promoText(1)]);
    const prog = progressSubject({ workouts: 48, reps: 6288, sets: 480, tonnage: 99_100, secs: 7680 }, RANKS[2]!.name, 3);
    expect(prog.lines[0]).toBe('48 workouts · 6,288 reps');
    expect(prog.lines[1]).toBe('480 sets · 99.1 t');
    const one = progressSubject({ workouts: 1, reps: 10, sets: 1, tonnage: 0, secs: 0 }, RANKS[0]!.name, 0);
    expect(one.lines[0]).toBe('1 workout · 10 reps');
    const posts: string[] = [];
    for (let seed = 0; seed < 6; seed++) {
      posts.push(shareText({ ...prog, seed }));
      posts.push(shareText({ kind: 'badge', title: 'Dense week', band: 'bronze', lines: ['3 workouts in 7 days'], punch: 'Nice.', seed }));
      posts.push(shareText({ kind: 'session', title: 'Workout A done', lines: ['12 sets'], punch: 'Sofa.', seed }));
      posts.push(punchline(seed * 20_000, seed * 2_000, seed));
    }
    english(posts);
    expect(posts.join('\n')).toMatch(/Free for now|free/);
  });
});
