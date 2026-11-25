import type { FormBody } from '@gymtracker/link';
import { text } from '@gt/i18n';

/**
 * Kreator formularza (wywiad, check-in, skala bólu, własne mierniki).
 * Zaczep rdzenia — pełny kreator dokłada część „Formularze” (spec 2026-11-25).
 */

const T = text({ pl: { title: 'Tytuł formularza' }, en: { title: 'Form title' } });

export const emptyForm = (): FormBody => ({ kind: 'form', title: '', intro: '', questions: [], repeat: 'once', weekday: null, intake: false });

export function FormForm({ value, onChange }: { value: FormBody; onChange: (v: FormBody) => void }) {
  return (
    <label className="field">
      <span>{T.title}</span>
      <input id="form-title" type="text" maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
    </label>
  );
}
