import { expect, test } from 'vitest';
import { DEFAULT_DIET_STATE, dietFromParams, dietToParams } from './url';

test('view and day round-trip; the default writes nothing', () => {
  expect(dietToParams(DEFAULT_DIET_STATE).toString()).toBe('');
  const state = { view: 'postep' as const, date: '2026-10-11' };
  expect(dietFromParams(dietToParams(state))).toEqual(state);
});

test('unknown views and malformed days fall back', () => {
  expect(dietFromParams(new URLSearchParams('widok=hack&dzien=11.10.2026'))).toEqual(DEFAULT_DIET_STATE);
});

test('a day that is not on the calendar is dropped, not passed on to break the page', () => {
  expect(dietFromParams(new URLSearchParams('dzien=2026-13-45')).date).toBeNull();
  expect(dietFromParams(new URLSearchParams('dzien=2026-02-30')).date).toBeNull();
  expect(dietFromParams(new URLSearchParams('dzien=2028-02-29')).date).toBe('2028-02-29');
});
