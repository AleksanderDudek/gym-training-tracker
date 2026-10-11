// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { useGeolocation } from './useGeolocation';

let pending: PositionCallback[] = [];

beforeEach(() => {
  window.localStorage.clear();
  pending = [];
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => pending.push(ok) },
  });
});

const answer = (lat: number, lon: number) => ({ coords: { latitude: lat, longitude: lon } }) as GeolocationPosition;

test('a slow GPS answer does not overwrite a place picked on the map meanwhile', () => {
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current[1].setManual({ lat: 50.06, lon: 19.94 }));
  act(() => pending.forEach((ok) => ok(answer(52.23, 21.01))));
  expect(result.current[0]).toMatchObject({ source: 'manual', position: { lat: 50.06, lon: 19.94 } });
});

test('asking again after a pick does use the new answer', () => {
  const { result } = renderHook(() => useGeolocation());
  act(() => result.current[1].setManual({ lat: 50.06, lon: 19.94 }));
  act(() => result.current[1].locate());
  act(() => pending.at(-1)!(answer(52.23, 21.01)));
  expect(result.current[0]).toMatchObject({ source: 'gps', position: { lat: 52.23, lon: 21.01 } });
});

test('the saved position is offered at once, marked as saved, never as current', () => {
  window.localStorage.setItem('produkty-pl:position', JSON.stringify({ lat: 52.1, lon: 21.1 }));
  const { result } = renderHook(() => useGeolocation());
  expect(result.current[0]).toMatchObject({ status: 'locating', source: 'saved', position: { lat: 52.1, lon: 21.1 } });
});
