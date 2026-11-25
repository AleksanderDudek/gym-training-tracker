import type { MealsBody } from '@gymtracker/link';
import { text } from '@gt/i18n';

/**
 * Kreator jadłospisu (dni × posiłki, przepisy z katalogu GYM TRACKERa, makro).
 * Zaczep rdzenia — pełny kreator dokłada część „Nawyki i jadłospis” (spec 2026-11-25).
 */

const T = text({ pl: { title: 'Nazwa jadłospisu' }, en: { title: 'Meal plan name' } });

export const emptyMeals = (): MealsBody => ({ kind: 'meals', title: '', days: [], start: null, note: '' });

export function MealsForm({ value, onChange }: { value: MealsBody; onChange: (v: MealsBody) => void }) {
  return (
    <label className="field">
      <span>{T.title}</span>
      <input id="meals-title" type="text" maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
    </label>
  );
}
