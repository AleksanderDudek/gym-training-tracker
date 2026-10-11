import type { LatLon } from './types';

/**
 * Room around the asked-for circle: rounding moves the centre by at most
 * ~65 m (3 decimals: ~111 m of latitude, ~68 m of longitude in Poland), and
 * the rest lets a short walk reuse the same answer instead of asking again.
 */
export const QUERY_MARGIN_M = 250;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The circle actually sent to Overpass and cached: centre rounded to about
 * 100 m - the exact position never leaves the device - and the radius grown
 * by the margin so the user's own circle always fits inside it.
 */
export function queryCircle(center: LatLon, radius: number): LatLon & { radius: number } {
  return { lat: round3(center.lat), lon: round3(center.lon), radius: radius + QUERY_MARGIN_M };
}
