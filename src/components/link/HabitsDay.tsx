import type { HabitsBody } from '@gymtracker/link';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';

/**
 * Nawyki od prowadzącego na stronie zalecenia: dzisiejsza lista do odhaczenia i ostatnie dni.
 * Zaczep rdzenia — wypełnia go część „Nawyki i jadłospis” (spec 2026-11-25). Zapis: `setDayTicks`.
 */
export function HabitsAssignment({ stored, state }: { stored: Coached<HabitsBody>; state: AppState }) {
  void stored;
  void state;
  return null;
}
