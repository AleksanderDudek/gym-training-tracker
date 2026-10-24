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
/**
 * The spot picked by hand in this tab (`sessionStorage`, rounded like the saved one): reloaded (also
 * by „Spróbuj ponownie” after the menus failed), the page keeps the pick instead of the GPS fix — the
 * pick itself, not the device's last position, which another tab's GPS may have moved. A new tab
 * asks the browser again.
 */
const PICK_KEY = 'produkty-pl:position-picked';

function loadPicked(): LatLon | null {
  try {
    const raw = window.sessionStorage.getItem(PICK_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<LatLon>) : null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { lat: p.lat!, lon: p.lon! } : null;
  } catch {
    return null;
  }
}

/** Notes the hand-picked spot for this tab, or forgets it (`null`: the browser's answer came since). */
function notePicked(position: LatLon | null): void {
  try {
    if (position) window.sessionStorage.setItem(PICK_KEY, JSON.stringify({ lat: rounded(position.lat), lon: rounded(position.lon) }));
    else window.sessionStorage.removeItem(PICK_KEY);
  } catch {
    // Blocked: a reload asks the browser again, as a new tab does.
  }
}

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

/** ~10 m: plenty for "shops near me", and no more precise than it needs to be. */
const rounded = (n: number) => Math.round(n * 1e4) / 1e4;

function save(position: LatLon): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ lat: rounded(position.lat), lon: rounded(position.lon) }));
  } catch {
    // Private mode or full: the next visit just asks again.
  }
}

/**
 * Where the user is: the saved spot at once, then the browser's answer — unless
 * the spot was picked by hand in this tab before a reload, then it stays. A
 * denial is ordinary (desktop browsers often say no), so the page offers a
 * click on the map instead; `setManual` is that click.
 */
export function useGeolocation(): [GeoState, { locate: () => void; setManual: (position: LatLon) => void }] {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [state, setState] = useState<GeoState>(() => {
    // Picked by hand in this tab before a reload: still the place asked about.
    const picked = loadPicked();
    if (picked) return { status: 'ready', position: picked, source: 'manual' };
    const saved = loadSaved();
    return { status: supported ? 'locating' : 'unavailable', position: saved, source: saved ? 'saved' : null };
  });
  /** The first render already had a hand-picked place: the browser is not asked by itself. */
  const [startedByHand] = useState(() => state.source === 'manual');

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
        notePicked(null);
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
    notePicked(position);
    setState({ status: 'ready', position, source: 'manual' });
  }, []);

  useEffect(() => {
    if (!startedByHand) request();
  }, [request, startedByHand]);

  return [state, { locate, setManual }];
}
