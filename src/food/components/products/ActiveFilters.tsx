import { X } from 'lucide-react';
import { activeFilterChips } from '../../lib/active-filters';
import { EMPTY_FILTERS, type Filters } from '../../lib/filters';
import type { Dictionaries } from '../../lib/types';

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
    <ul className="fd-active" aria-label="Aktywne filtry">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            className="fd-chip"
            onClick={() => onChange(chip.remove(filters))}
            aria-label={`Usuń filtr: ${chip.label}`}
          >
            <span>{chip.label}</span>
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </li>
      ))}
      <li>
        <button type="button" className="fd-clear" onClick={() => onChange(EMPTY_FILTERS)}>
          Wyczyść wszystko
        </button>
      </li>
    </ul>
  );
}
