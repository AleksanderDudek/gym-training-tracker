import { describe, expect, it } from 'vitest';
import { freshState } from './plan';
import { EVENING_AT, HORIZON_DAYS, MORNING_AT, localDay, reminderItems, remindersOf } from './reminders';
import { GOAL_PLANS } from '../data/plans';
import { REMINDER_EVENING, REMINDER_MORNING } from './quips';
import { validItem } from '../../server/push/api';
import type { AppState, LogEntry } from '../types';

/**
 * Lista przypomnień, którą telefon wysyła serwerowi: rano w dni treningu z planu, wieczorem
 * codziennie. Serwer nic nie wie o planach, więc wszystko, co ma sens, musi się zgadzać tutaj.
 */

// 2026-10-05 to poniedziałek. Plan startowy: poniedziałek, środa, piątek, trening A i B.
const MONDAY = '2026-10-05';

const withPlan = (start = MONDAY): AppState => {
  const s = freshState();
  s.plan = { templateId: 'cel-start-30', start, ticked: {} };
  return s;
};

const done = (date: string): LogEntry => ({ date: `${date}T06:00:00.000Z`, workout: 'A', ready: 'ok', items: [] });

describe('poranne przypomnienia o treningu', () => {
  it('stoją w dni z planu, o 7:30, z nazwą treningu', () => {
    const items = reminderItems(withPlan(), { morning: true, evening: false }, MONDAY, 0);
    const plan = GOAL_PLANS.find((p) => p.id === 'cel-start-30')!;
    expect(plan.weekdays).toEqual([1, 3, 5]);
    expect(items.map((i) => i.date).slice(0, 4)).toEqual(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12']);
    expect(items.every((i) => i.tag === 'trening' && i.time === MORNING_AT && i.url === '#/sesja')).toBe(true);
    expect(items[0]!.title).toBe('Dziś trening: Trening A');
    expect(items[1]!.title).toBe('Dziś trening: Trening B');
    expect(REMINDER_MORNING).toContain(items[0]!.body);
  });

  it('tylko na trzy tygodnie naprzód — gdy aplikacja nie jest otwierana, przypomnienia same gasną', () => {
    const items = reminderItems(withPlan(), { morning: true, evening: false }, MONDAY, 0);
    expect(items.every((i) => i.date < '2026-10-26')).toBe(true);
    expect(HORIZON_DAYS).toBe(21);
  });

  it('trening już zrobiony dziś nie przypomina się o 7:30', () => {
    const s = withPlan();
    s.log.push(done(MONDAY));
    const items = reminderItems(s, { morning: true, evening: false }, MONDAY, 5 * 60);
    expect(items[0]!.date).toBe('2026-10-07');
  });

  it('dzisiejsza godzina, która już minęła, nie wraca — po 7:30 lista zaczyna się od jutra', () => {
    const items = reminderItems(withPlan(), { morning: true, evening: false }, MONDAY, 7 * 60 + 30);
    expect(items[0]!.date).toBe('2026-10-07');
  });

  it('bez planu rano nie ma o czym przypominać', () => {
    expect(reminderItems(freshState(), { morning: true, evening: false }, MONDAY, 0)).toEqual([]);
  });
});

describe('wieczorne przypomnienia o ruchu', () => {
  it('codziennie o 19:30, także bez planu, i otwierają ekran kroków', () => {
    const items = reminderItems(freshState(), { morning: false, evening: true }, MONDAY, 12 * 60);
    expect(items).toHaveLength(HORIZON_DAYS);
    expect(items.every((i) => i.tag === 'ruch' && i.time === EVENING_AT && i.url === '#/cardio')).toBe(true);
    expect(REMINDER_EVENING).toContain(items[0]!.body);
    // Teksty się zmieniają z dnia na dzień, żeby wieczór nie brzmiał jak automat.
    expect(new Set(items.slice(0, 4).map((i) => i.body)).size).toBeGreaterThan(1);
  });

  it('po 19:30 dzisiejsze już przepadło', () => {
    const items = reminderItems(freshState(), { morning: false, evening: true }, MONDAY, 20 * 60);
    expect(items[0]!.date).toBe('2026-10-06');
  });
});

describe('ustawienia i kontrakt z serwerem', () => {
  it('bez wyboru oba przypomnienia są włączone, a wyłączone nic nie wysyłają', () => {
    expect(remindersOf(freshState())).toEqual({ morning: true, evening: true });
    expect(reminderItems(withPlan(), { morning: false, evening: false }, MONDAY, 0)).toEqual([]);
  });

  it('każde przypomnienie przechodzi walidację serwera i jest posortowane w czasie', () => {
    const items = reminderItems(withPlan(), { morning: true, evening: true }, MONDAY, 0);
    expect(items.every(validItem)).toBe(true);
    const keys = items.map((i) => `${i.date} ${i.time}`);
    expect(keys).toEqual([...keys].sort());
    expect(items.length).toBeLessThanOrEqual(100);
  });

  it('długa nazwa własnego treningu jest przycięta do limitu serwera', () => {
    const s = withPlan();
    s.plans = [{ ...GOAL_PLANS[0]!, id: 'own-1', kind: 'own', cycle: ['w1'] }];
    s.plan = { templateId: 'own-1', start: MONDAY, ticked: {} };
    s.workouts = [{ id: 'w1', name: 'Bardzo '.repeat(20), items: [{ ex: 'squat_air' }] }];
    const items = reminderItems(s, { morning: true, evening: false }, MONDAY, 0);
    expect(items[0]!.title.length).toBeLessThanOrEqual(80);
    expect(validItem(items[0])).toBe(true);
  });

  it('dzień z zegara telefonu, a nie UTC — o 1:30 w nocy w Polsce UTC wciąż ma wczoraj', () => {
    // Data zbudowana z czasu lokalnego: 7 października, 1:30 — niezależnie od strefy testu.
    const d = new Date(2026, 9, 7, 1, 30);
    expect(localDay(d)).toBe('2026-10-07');
  });
});
