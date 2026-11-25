import type { MealsBody } from '@gymtracker/link';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';

/**
 * Jadłospis od prowadzącego na stronie zalecenia: dzisiejszy dzień cyklu, posiłki do odhaczenia,
 * przepisy z katalogu. Zaczep rdzenia — wypełnia go część „Nawyki i jadłospis” (spec 2026-11-25).
 */
export function MealsAssignment({ stored, state }: { stored: Coached<MealsBody>; state: AppState }) {
  void stored;
  void state;
  return null;
}
