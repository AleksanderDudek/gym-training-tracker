import { expect, test } from 'vitest';
import { DEFAULT_DIARY_STATE, diaryFromParams, diaryToParams, shoppingFromParams, shoppingToParams } from './url';

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

test('lista zakupów: źródło (`z`) i plan przez adres; nieznane źródło to brak wyboru', () => {
  expect(shoppingToParams({ plan: null }).toString()).toBe('');
  expect(shoppingToParams({ plan: 3, source: 'plan' }).toString()).toBe('z=plan&plan=3');
  expect(shoppingFromParams(new URLSearchParams('z=dziennik'))).toEqual({ plan: null, source: 'dziennik' });
  expect(shoppingFromParams(new URLSearchParams('z=sklep&plan=2'))).toEqual({ plan: 2, source: null });
});
