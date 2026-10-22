import { say } from '../../i18n';
import type { Recipe } from './catalog';

/**
 * How long a recipe takes, in three steps a person actually decides between:
 * something now, something that needs the stove for a moment, and a proper
 * cook at home. Derived from `minutes`, never stored, so a recipe cannot sit
 * in a tier its own time contradicts.
 */
export type TimeTier = 'szybkie' | 'chwila' | 'dluzej';

/** Polish keys: they are what a link shows (`?czas=szybkie`). Ordered fastest first. */
export const TIER_LABELS: Record<TimeTier, string> = {
  szybkie: say('Szybkie', 'Quick'),
  chwila: say('Chwilę dłużej', 'A bit longer'),
  dluzej: say('Dłużej, w domu', 'Longer, at home'),
};

/** What the tab promised before the longer tiers existed: ready in under eight minutes. */
export const QUICK_MAX_MINUTES = 7;
/** Still a weekday meal: the stove, but no oven and no waiting. */
export const CHWILA_MAX_MINUTES = 20;

const ORDER = Object.keys(TIER_LABELS) as TimeTier[];

export function tierOf(minutes: number): TimeTier {
  if (minutes <= QUICK_MAX_MINUTES) return 'szybkie';
  if (minutes <= CHWILA_MAX_MINUTES) return 'chwila';
  return 'dluzej';
}

/**
 * Quick first, then by time. The tier leads even though it follows from the
 * minutes, so moving a boundary can never put a slow recipe above a quick
 * one; equal times keep the catalog's order (Array.sort is stable).
 */
export function byTime(a: Recipe, b: Recipe): number {
  return ORDER.indexOf(tierOf(a.minutes)) - ORDER.indexOf(tierOf(b.minutes)) || a.minutes - b.minutes;
}
