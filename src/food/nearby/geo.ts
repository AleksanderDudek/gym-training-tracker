import { formatNumber } from '../lib/format';
import type { LatLon } from './types';

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance (haversine): exact enough for a shop down the road and one 10 km away. */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m", "1,2 km", "12 km": metres are rounded to tens, a precision GPS does not have anyway. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${formatNumber(Math.round(meters / 10) * 10, 0)} m`;
  return `${formatNumber(meters / 1000, meters < 10_000 ? 1 : 0)} km`;
}
