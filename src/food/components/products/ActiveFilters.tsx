import { X } from 'lucide-react';
import { text } from '../../../i18n';
import { activeFilterChips } from '../../lib/active-filters';
import { EMPTY_FILTERS, type Filters } from '../../lib/filters';
import type { Dictionaries } from '../../lib/types';

const T = text({
  pl: { list: 'Aktywne filtry', remove: (label: string) => `Usuń filtr: ${label}`, clear: 'Wyczyść wszystko' },
  en: { list: 'Active filters', remove: (label: string) => `Remove filter: ${label}`, clear: 'Clear all' },
});

interface Props {
  filters: Filters;
  dict: Dictionaries;
  onChange: (filters: Filters) => void;
}

/**
 * Co teraz zawęża listę — każdy filtr osobno do zdjęcia jednym stuknięciem, bez otwierania arkusza.
 * Żetony mają wygląd wybranej pozycji (`.chips` z `aria-pressed`), bo każdy z nich jest włączony.
 */
export function ActiveFilters({ filters, dict, onChange }: Props) {
  const chips = activeFilterChips(filters, dict);
  if (chips.length === 0) return null;

  return (
    <ul className="fd-active" aria-label={T.list}>
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            className="fd-chip"
            onClick={() => onChange(chip.remove(filters))}
            aria-label={T.remove(chip.label)}
          >
            <span>{chip.label}</span>
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </li>
      ))}
      <li>
        <button type="button" className="fd-clear" onClick={() => onChange(EMPTY_FILTERS)}>
          {T.clear}
        </button>
      </li>
    </ul>
  );
}
