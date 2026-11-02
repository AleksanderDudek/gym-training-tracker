import { describe, expect, test } from 'vitest';
import {
  fastState,
  fastingAllowed,
  fastingOn,
  hoursMinutes,
  localStamp,
  parseStamp,
  startFrom,
  suggestedStart,
} from './fasting';

/** A local moment, the way the card sees the clock. */
const at = (day: string, time: string) => parseStamp(`${day}T${time}`);

describe('local stamps', () => {
  test('round trip, local time', () => {
    const d = new Date(2026, 10, 2, 7, 5);
    expect(localStamp(d)).toBe('2026-11-02T07:05');
    expect(parseStamp('2026-11-02T07:05').getTime()).toBe(d.getTime());
  });
});

describe('who gets the option', () => {
  test('off by default, on with a split', () => {
    expect(fastingOn({ sex: 'M', pregnancy: false, fastPlan: null })).toBe(false);
    expect(fastingOn({ sex: 'M', pregnancy: false, fastPlan: '16:8' })).toBe(true);
  });

  test('never in pregnancy or while breastfeeding — even with a split stored before', () => {
    expect(fastingAllowed({ sex: 'K', pregnancy: true })).toBe(false);
    expect(fastingOn({ sex: 'K', pregnancy: true, fastPlan: '16:8' })).toBe(false);
    expect(fastingAllowed({ sex: 'K', pregnancy: false })).toBe(true);
  });
});

describe('fastState', () => {
  test('no fast yet: idle', () => {
    expect(fastState(null, '16:8', at('2026-11-02', '10:00'))).toEqual({ kind: 'idle' });
  });

  test('16:8 from 20:15: at 08:35 the next day 3 h 40 min are left, until 12:15', () => {
    const fast = { start: '2026-11-01T20:15', end: null };
    expect(fastState(fast, '16:8', at('2026-11-02', '08:35'))).toEqual({
      kind: 'fasting',
      start: '2026-11-01T20:15',
      until: '2026-11-02T12:15',
      left: 220,
      over: 0,
    });
  });

  test('past the planned end it keeps going until the person ends it, counting the minutes over', () => {
    const fast = { start: '2026-11-01T20:15', end: null };
    expect(fastState(fast, '16:8', at('2026-11-02', '13:00'))).toMatchObject({ kind: 'fasting', left: 0, over: 45 });
  });

  test('a fast left running for over 48 h, or starting in the future, is not shown', () => {
    expect(fastState({ start: '2026-10-30T20:00', end: null }, '16:8', at('2026-11-02', '10:00'))).toEqual({ kind: 'idle' });
    expect(fastState({ start: '2026-11-02T20:00', end: null }, '16:8', at('2026-11-02', '10:00'))).toEqual({ kind: 'idle' });
  });

  test('ended at 10:00 on 16:8: the window lasts 8 h, until 18:00', () => {
    const fast = { start: '2026-11-01T18:00', end: '2026-11-02T10:00' };
    expect(fastState(fast, '16:8', at('2026-11-02', '12:00'))).toEqual({
      kind: 'eating',
      end: '2026-11-02T10:00',
      until: '2026-11-02T18:00',
      open: true,
    });
    expect(fastState(fast, '16:8', at('2026-11-02', '19:00'))).toMatchObject({ kind: 'eating', open: false });
  });

  test('a window closed more than a day ago: idle again', () => {
    const fast = { start: '2026-10-30T18:00', end: '2026-10-31T10:00' };
    expect(fastState(fast, '16:8', at('2026-11-02', '10:00'))).toEqual({ kind: 'idle' });
  });

  test('the split sets the hours: 12:12 and 18:6', () => {
    const fast = { start: '2026-11-01T20:00', end: null };
    expect(fastState(fast, '12:12', at('2026-11-02', '06:00'))).toMatchObject({ until: '2026-11-02T08:00', left: 120 });
    expect(fastState(fast, '18:6', at('2026-11-02', '06:00'))).toMatchObject({ until: '2026-11-02T14:00', left: 480 });
  });
});

describe('the suggested start', () => {
  test('the last entry eaten up to now', () => {
    const now = at('2026-11-02', '21:00');
    expect(suggestedStart([{ time: '08:00' }, { time: '19:40' }, { time: '13:10' }], now)).toBe('19:40');
  });

  test('an entry later than now (logged ahead) does not count; no entries — now', () => {
    const now = at('2026-11-02', '18:30');
    expect(suggestedStart([{ time: '12:00' }, { time: '20:00' }], now)).toBe('12:00');
    expect(suggestedStart([], now)).toBe('18:30');
  });

  test('a start typed as HH:MM is today, or yesterday when still ahead today', () => {
    expect(startFrom('19:40', at('2026-11-02', '21:00'))).toBe('2026-11-02T19:40');
    expect(startFrom('20:15', at('2026-11-02', '00:30'))).toBe('2026-11-01T20:15');
  });
});

test('hoursMinutes', () => {
  expect(hoursMinutes(220)).toEqual({ h: 3, min: 40 });
  expect(hoursMinutes(45)).toEqual({ h: 0, min: 45 });
});
