import type { HabitsBody } from '@gymtracker/link';
import { text } from '@gt/i18n';

/**
 * Kreator nawyków i suplementów (codzienna lista na dni tygodnia).
 * Zaczep rdzenia — pełny kreator dokłada część „Nawyki i jadłospis” (spec 2026-11-25).
 */

const T = text({ pl: { title: 'Nazwa listy nawyków' }, en: { title: 'Habit list name' } });

export const emptyHabits = (): HabitsBody => ({ kind: 'habits', title: '', items: [], note: '', until: null });

export function HabitsForm({ value, onChange }: { value: HabitsBody; onChange: (v: HabitsBody) => void }) {
  return (
    <label className="field">
      <span>{T.title}</span>
      <input id="habits-title" type="text" maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
    </label>
  );
}
