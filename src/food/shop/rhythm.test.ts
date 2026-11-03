import { describe, expect, test } from 'vitest';
import { cleanRhythm, isShopDay, nextShopDay, shopDays, shopPeriod, weekdayOf, type ShopRhythm } from './rhythm';

const saturday: ShopRhythm = { kind: 'weekdays', days: [6], at: '10:00' };
const tueFri: ShopRhythm = { kind: 'weekdays', days: [2, 5], at: '18:00' };
const every10: ShopRhythm = { kind: 'every', days: 10, from: '2026-11-07', at: '10:00' };

describe('shopping rhythm', () => {
  test('weekdays: 2026-11-07 is a Saturday', () => {
    expect(weekdayOf('2026-11-07')).toBe(6);
    expect(weekdayOf('2026-11-08')).toBe(7);
    expect(isShopDay(saturday, '2026-11-07')).toBe(true);
    expect(nextShopDay(saturday, '2026-11-03')).toBe('2026-11-07');
    expect(nextShopDay(saturday, '2026-11-07')).toBe('2026-11-07');
  });

  test('every N days counts both ways from its day', () => {
    expect(isShopDay(every10, '2026-11-17')).toBe(true);
    expect(isShopDay(every10, '2026-10-28')).toBe(true);
    expect(isShopDay(every10, '2026-11-08')).toBe(false);
    expect(shopDays(every10, '2026-11-01', '2026-11-30')).toEqual(['2026-11-07', '2026-11-17', '2026-11-27']);
  });

  test('the next trip buys up to the day before the one after it', () => {
    expect(shopPeriod(saturday, '2026-11-03')).toEqual({ shop: '2026-11-07', until: '2026-11-13', days: 7 });
    // Tuesday and Friday: Tuesday's trip covers 3 days, Friday's 4.
    expect(shopPeriod(tueFri, '2026-11-03')).toEqual({ shop: '2026-11-03', until: '2026-11-05', days: 3 });
    expect(shopPeriod(tueFri, '2026-11-04')).toEqual({ shop: '2026-11-06', until: '2026-11-09', days: 4 });
    expect(shopPeriod(every10, '2026-11-08').days).toBe(10);
  });

  test('cleanRhythm keeps what is sane', () => {
    expect(cleanRhythm({ kind: 'weekdays', days: [5, 2, 2, 9], at: '18:00' })).toEqual({ kind: 'weekdays', days: [2, 5], at: '18:00' });
    expect(cleanRhythm({ kind: 'weekdays', days: [] })).toBeNull();
    expect(cleanRhythm({ kind: 'every', days: 10, from: '2026-11-07', at: 'rano' })).toEqual({ ...every10, at: '10:00' });
    expect(cleanRhythm({ kind: 'every', days: 40, from: '2026-11-07' })).toBeNull();
    expect(cleanRhythm({ kind: 'every', days: 7, from: 'sobota' })).toBeNull();
    expect(cleanRhythm('sobota')).toBeNull();
  });
});
