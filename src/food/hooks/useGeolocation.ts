import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLon } from '../nearby/types';

export type GeoStatus = 'locating' | 'ready' | 'denied' | 'unavailable' | 'error';
export type GeoSource = 'gps' | 'manual' | 'saved';

export interface GeoState {
  status: GeoStatus;
  position: LatLon | null;
  source: GeoSource | null;
}

const KEY = 'produkty-pl:position';

/** The last position, kept on this device only, so the map opens where you were. */
function loadSaved(): LatLon | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<LatLon>) : null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat!, lon: p.lon! } : null;
  } catch {
    return null;
  }
}

function save(position: LatLon): void {
  try {
    // ~10 m: plenty for "shops near me", and no more precise than it needs to be.
    const round = (n: number) => Math.round(n * 1e4) / 1e4;
    window.localStorage.setItem(KEY, JSON.stringify({ lat: round(position.lat), lon: round(position.lon) }));
  } catch {
    // Private mode or full: the next visit just asks again.
  }
}

/**
 * Where the user is: the saved spot at once, then the browser's answer. A
 * denial is ordinary (desktop browsers often say no), so the page offers a
 * click on the map instead; `setManual` is that click.
 */
export function useGeolocation(): [GeoState, { locate: () => void; setManual: (position: LatLon) => void }] {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [state, setState] = useState<GeoState>(() => {
    const saved = loadSaved();
    return { status: supported ? 'locating' : 'unavailable', position: saved, source: saved ? 'saved' : null };
  });

  // Each request (and each manual pick) takes a number; an answer to an older
  // one is ignored. Otherwise a slow GPS fix, arriving after the user picked a
  // place on the map, would throw the pick away.
  const sequence = useRef(0);

  // Only the browser's callbacks set state, so the first request can run in an
  // effect without a synchronous re-render.
  const request = useCallback(() => {
    if (!supported) return;
    const mine = ++sequence.current;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (mine !== sequence.current) return;
        const position = { lat: coords.latitude, lon: coords.longitude };
        save(position);
        setState({ status: 'ready', position, source: 'gps' });
      },
      (error) => {
        if (mine !== sequence.current) return;
        setState((s) => ({ ...s, status: error.code === error.PERMISSION_DENIED ? 'denied' : 'error' }));
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  }, [supported]);

  /** "Moja lokalizacja": say we are looking, then ask again. */
  const locate = useCallback(() => {
    setState((s) => ({ ...s, status: supported ? 'locating' : 'unavailable' }));
    request();
  }, [request, supported]);

  const setManual = useCallback((position: LatLon) => {
    sequence.current++;
    save(position);
    setState({ status: 'ready', position, source: 'manual' });
  }, []);

  useEffect(() => {
    request();
  }, [request]);

  return [state, { locate, setManual }];
}
