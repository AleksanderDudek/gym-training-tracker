import type { Profile } from './types';

type Body = Pick<Profile, 'sex' | 'age' | 'heightCm'>;

/** Mifflin-St Jeor, the workbook's formula. */
export function bmr(p: Body, weightKg: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'M' ? 5 : -161);
}

/** Losing, gaining or keeping: where the target weight lies from the start. */
export type GoalDirection = 'loss' | 'gain' | 'keep';

/** Half a kilogram either way is keeping: the scale moves more than that between two mornings. */
const KEEP_KG = 0.5;

export function goalDirection(p: Pick<Profile, 'startWeightKg' | 'targetWeightKg'>): GoalDirection {
  const gap = p.targetWeightKg - p.startWeightKg;
  return gap < -KEEP_KG ? 'loss' : gap > KEEP_KG ? 'gain' : 'keep';
}
