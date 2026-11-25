import type { FormBody } from '@gymtracker/link';
import type { Coached } from '../../link/today';
import type { AppState } from '../../types';

/**
 * Formularz od prowadzącego na stronie zalecenia: pytania, odpowiedź za dzisiejszy okres, historia.
 * Zaczep rdzenia — wypełnia go część „Formularze” (spec 2026-11-25). Zapis: `saveAnswer` w `link/sync.ts`.
 */
export function FormAssignment({ stored, state, onToast }: { stored: Coached<FormBody>; state: AppState; onToast: (m: string) => void }) {
  void stored;
  void state;
  void onToast;
  return null;
}
