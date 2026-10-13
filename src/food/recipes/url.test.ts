import { expect, test } from 'vitest';
import { DEFAULT_RECIPES_STATE, recipesFromParams, recipesToParams } from './url';

test('the default state is an empty query', () => {
  expect(recipesToParams(DEFAULT_RECIPES_STATE).toString()).toBe('');
  expect(recipesFromParams(new URLSearchParams(''))).toEqual(DEFAULT_RECIPES_STATE);
});

test('store, kind, time tier and open product round-trip', () => {
  const state = {
    store: 'biedronka',
    kind: 'shake' as const,
    tier: 'szybkie' as const,
    product: '590',
    layout: 'sklepy' as const,
  };
  expect(recipesFromParams(recipesToParams(state))).toEqual(state);
  expect(recipesToParams(state).toString()).toBe('sklep=biedronka&typ=shake&czas=szybkie&p=590&uklad=sklepy');
  expect(recipesFromParams(new URLSearchParams('uklad=cokolwiek')).layout).toBe('czas');
});

test('every time tier round-trips under its Polish key', () => {
  for (const tier of ['szybkie', 'chwila', 'dluzej'] as const) {
    expect(recipesFromParams(new URLSearchParams(`czas=${tier}`)).tier).toBe(tier);
  }
});

test('an unknown time tier is dropped, and so is one inherited from Object', () => {
  expect(recipesFromParams(new URLSearchParams('czas=tydzien')).tier).toBeNull();
  expect(recipesFromParams(new URLSearchParams('czas=constructor')).tier).toBeNull();
  expect(recipesFromParams(new URLSearchParams('czas=')).tier).toBeNull();
});

test('an unknown kind is dropped', () => {
  expect(recipesFromParams(new URLSearchParams('typ=pizza')).kind).toBeNull();
});

test('a kind must be one of ours, not something inherited from Object', () => {
  expect(recipesFromParams(new URLSearchParams('typ=constructor')).kind).toBeNull();
  expect(recipesFromParams(new URLSearchParams('typ=toString')).kind).toBeNull();
});
