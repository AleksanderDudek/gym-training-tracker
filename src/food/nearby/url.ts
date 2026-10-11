import { DEFAULT_RADIUS, snapRadius } from './radius';

/**
 * The page's state in its query string. The POSITION is deliberately not
 * part of it: a shared link would tell whoever opens it where you were.
 */
export interface NearbyState {
  radius: number;
  store: string | null;
  product: string | null;
}

export function nearbyToParams(state: NearbyState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.radius !== DEFAULT_RADIUS) params.set('r', String(state.radius));
  if (state.store) params.set('sklep', state.store);
  if (state.product) params.set('p', state.product);
  return params;
}

/** `fallbackRadius`: what to use when the link names none (the last one used here). */
export function nearbyFromParams(params: URLSearchParams, fallbackRadius = DEFAULT_RADIUS): NearbyState {
  const r = params.get('r');
  return {
    radius: r === null ? snapRadius(fallbackRadius) : snapRadius(Number(r)),
    store: params.get('sklep') || null,
    product: params.get('p') || null,
  };
}
