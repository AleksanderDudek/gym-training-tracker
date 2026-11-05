import type { MuscleId } from '../muscles';

/** Jeden widok ciała: viewBox i kontury (partia mięśniowa albo `null` — sylwetka). */
export interface BodyView {
  box: readonly [number, number, number, number];
  parts: [MuscleId | null, string][];
}

export interface BodyViews {
  front: BodyView;
  back: BodyView;
}
