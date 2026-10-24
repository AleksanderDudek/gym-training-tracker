// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { useGeolocation } from './useGeolocation';

let pending: PositionCallback[] = [];

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
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

test('a place picked by hand survives a reload of the same tab (e.g. after the menus failed): kept, the browser not asked', () => {
  const first = renderHook(() => useGeolocation());
  act(() => first.result.current[1].setManual({ lat: 50.06, lon: 19.94 }));
  first.unmount();
  pending = [];
  // The reload: a new page in the same tab, its session storage still there.
  const { result } = renderHook(() => useGeolocation());
  expect(result.current[0]).toMatchObject({ status: 'ready', source: 'manual', position: { lat: 50.06, lon: 19.94 } });
  expect(pending).toHaveLength(0);
  // „Moja lokalizacja” still asks.
  act(() => result.current[1].locate());
  act(() => pending.at(-1)!(answer(52.23, 21.01)));
  expect(result.current[0]).toMatchObject({ source: 'gps', position: { lat: 52.23, lon: 21.01 } });
});

test('…but after a GPS fix, or in a new tab, the next page asks the browser again', () => {
  const first = renderHook(() => useGeolocation());
  act(() => pending.forEach((ok) => ok(answer(52.23, 21.01))));
  first.unmount();
  pending = [];
  const again = renderHook(() => useGeolocation());
  expect(again.result.current[0]).toMatchObject({ status: 'locating', source: 'saved' });
  expect(pending).toHaveLength(1);
  again.unmount();
  // A hand-picked place, then a new tab (no session storage): asked again too.
  const picked = renderHook(() => useGeolocation());
  act(() => picked.result.current[1].setManual({ lat: 50.06, lon: 19.94 }));
  picked.unmount();
  window.sessionStorage.clear();
  pending = [];
  const tab = renderHook(() => useGeolocation());
  expect(tab.result.current[0]).toMatchObject({ status: 'locating', source: 'saved', position: { lat: 50.06, lon: 19.94 } });
  expect(pending).toHaveLength(1);
});

test('another tab’s GPS fix does not replace this tab’s pick: the pick itself is kept per tab, not the device’s last position', () => {
  const tabA = renderHook(() => useGeolocation());
  act(() => tabA.result.current[1].setManual({ lat: 50.06, lon: 19.94 }));
  tabA.unmount();
  // Tab B (same device, own session) gets a GPS fix: the shared last position moves.
  window.localStorage.setItem('produkty-pl:position', JSON.stringify({ lat: 52.23, lon: 21.01 }));
  pending = [];
  const reloadedA = renderHook(() => useGeolocation());
  expect(reloadedA.result.current[0]).toMatchObject({ status: 'ready', source: 'manual', position: { lat: 50.06, lon: 19.94 } });
  expect(pending).toHaveLength(0);
});
