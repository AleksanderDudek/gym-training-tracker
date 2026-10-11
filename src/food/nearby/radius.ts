import { formatNumber } from '../lib/format';

/**
 * From a walk to the corner (500 m) to a drive across a suburb (10 km).
 * Past that "nearby" stops meaning anything, and the answer from Overpass for
 * a city grows to thousands of shops.
 */
export const RADIUS_STEPS = [500, 1000, 1500, 2000, 3000, 5000, 7500, 10_000] as const;
export const DEFAULT_RADIUS = 1000;

export function snapRadius(meters: number): number {
  if (!Number.isFinite(meters)) return DEFAULT_RADIUS;
  return RADIUS_STEPS.reduce((best, step) => (Math.abs(step - meters) < Math.abs(best - meters) ? step : best));
}

export function radiusLabel(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${formatNumber(meters / 1000, 1)} km`;
}
