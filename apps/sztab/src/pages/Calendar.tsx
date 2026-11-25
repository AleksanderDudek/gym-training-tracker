import { text } from '@gt/i18n';

/** Kalendarz wizyt prowadzącego. Zaczep rdzenia — wypełnia go część „Kalendarz wizyt” (spec 2026-11-25). */

const T = text({ pl: { title: 'Kalendarz' }, en: { title: 'Calendar' } });

export function Calendar() {
  return <h1>{T.title}</h1>;
}
