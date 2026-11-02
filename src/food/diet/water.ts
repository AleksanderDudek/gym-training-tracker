import type { Profile } from './types';

/**
 * The day's drinks target (hydration card), ml. EFSA (2010, Scientific Opinion on Dietary Reference Values for
 * water): an adequate intake of total water of 2.0 l for women and 2.5 l for men, about 80 % of it
 * from drinks — 1.6 l and 2.0 l. Pregnancy adds 0.3 l, breastfeeding 0.7 l; the profile has one
 * flag for both, so the lower addition is the default and the profile says how to set more.
 */
export const WATER_ML = { K: 1600, M: 2000, pregnancy: 300, breastfeeding: 700 } as const;

/** The EFSA value for this person: by sex, plus pregnancy. */
export function defaultWaterMl(p: Pick<Profile, 'sex' | 'pregnancy'>): number {
  return WATER_ML[p.sex] + (p.sex === 'K' && p.pregnancy ? WATER_ML.pregnancy : 0);
}

/** The day's drinks target: the person's own, or the EFSA value. A bar, never a verdict. */
export function waterTargetMl(p: Pick<Profile, 'sex' | 'pregnancy' | 'waterMl'>): number {
  return p.waterMl ?? defaultWaterMl(p);
}
