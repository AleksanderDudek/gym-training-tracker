import { expect, test } from 'vitest';
import { DEFAULT_DIARY_STATE, diaryFromParams, diaryToParams } from './url';

test('dzień i „dodaj” przechodzą przez adres tam i z powrotem; domyślny stan nie pisze niczego', () => {
  expect(diaryToParams(DEFAULT_DIARY_STATE).toString()).toBe('');
  const state = { date: '2026-10-11', add: true };
  expect(diaryToParams(state).toString()).toBe('dzien=2026-10-11&dodaj=1');
  expect(diaryFromParams(diaryToParams(state))).toEqual(state);
});

test('zepsuty dzień i inne wartości „dodaj” wracają do domyślnych', () => {
  expect(diaryFromParams(new URLSearchParams('dzien=11.10.2026&dodaj=tak'))).toEqual(DEFAULT_DIARY_STATE);
});

test('dzień spoza kalendarza odpada, zamiast psuć stronę dalej', () => {
  expect(diaryFromParams(new URLSearchParams('dzien=2026-13-45')).date).toBeNull();
  expect(diaryFromParams(new URLSearchParams('dzien=2026-02-30')).date).toBeNull();
  expect(diaryFromParams(new URLSearchParams('dzien=2028-02-29')).date).toBe('2028-02-29');
});
