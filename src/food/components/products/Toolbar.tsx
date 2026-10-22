import { Search, SlidersHorizontal, X } from 'lucide-react';
import { text } from '../../../i18n';
import { useDebouncedDraft } from '../../hooks/useDebouncedDraft';
import { SORT_OPTIONS } from '../../lib/labels';
import type { Sort } from '../../lib/sort';

const T = text({
  pl: {
    search: 'Szukaj produktu',
    placeholder: 'Nazwa, marka lub kod kreskowy',
    clear: 'Wyczyść wyszukiwanie',
    sort: 'Sortowanie',
    custom: 'Własne (z tabeli)',
    filters: 'Filtry',
    on: (n: number) => `, włączone: ${n}`,
  },
  en: {
    search: 'Search products',
    placeholder: 'Name, brand or barcode',
    clear: 'Clear search',
    sort: 'Sort',
    custom: 'Custom (from the table)',
    filters: 'Filters',
    on: (n: number) => `, active: ${n}`,
  },
});

interface Props {
  query: string;
  onQuery: (q: string) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  activeFilters: number;
  onOpenFilters: () => void;
}

/**
 * Wyszukiwarka, sortowanie i przycisk filtrów nad listą. Pole trzyma własny szkic i zapisuje go
 * do adresu po chwili przerwy (`useDebouncedDraft`), a od razu przy opuszczeniu pola i Enterze —
 * stuknięcie w produkt tuż po wpisaniu nie może zgubić wpisanego tekstu.
 */
export function Toolbar({ query, onQuery, sort, onSort, activeFilters, onOpenFilters }: Props) {
  const [draft, setDraft, flush] = useDebouncedDraft(query, onQuery, (a, b) => a.trim() === b.trim());
  const sortValue = `${sort.key}-${sort.dir}`;
  const inPresets = SORT_OPTIONS.some((o) => `${o.key}-${o.dir}` === sortValue);

  return (
    <div className="fd-toolbar">
      {/* `div`, nie `label`: przycisk w etykiecie dokleiłby się do nazwy pola („Szukaj produktu Wyczyść wyszukiwanie”). */}
      <div role="search" className="fd-search">
        <Search size={20} strokeWidth={2} aria-hidden />
        <input
          type="search"
          name="q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === 'Enter') flush();
          }}
          aria-label={T.search}
          // Krócej niż w Produktach PL („Szukaj: nazwa, marka lub kod kreskowy”): lupa mówi już „szukaj”,
          // a pełne zdanie ucinało się na telefonie w pół słowa.
          placeholder={T.placeholder}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
        {draft && (
          <button
            type="button"
            className="fd-search-clear"
            onClick={() => {
              setDraft('');
              onQuery('');
            }}
            aria-label={T.clear}
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="fd-tools">
        <select
          name="sort"
          className="fd-sort"
          value={sortValue}
          onChange={(e) => {
            const [key, dir] = e.target.value.split('-') as [Sort['key'], Sort['dir']];
            onSort({ key, dir });
          }}
          aria-label={T.sort}
        >
          {/* Nagłówek tabeli potrafi wybrać kierunek, którego nie ma wśród gotowych. */}
          {!inPresets && <option value={sortValue}>{T.custom}</option>}
          {SORT_OPTIONS.map((o) => (
            <option key={`${o.key}-${o.dir}`} value={`${o.key}-${o.dir}`}>
              {o.label}
            </option>
          ))}
        </select>

        <button type="button" className={`btn sm ghost fd-filters-btn${activeFilters > 0 ? ' on' : ''}`} onClick={onOpenFilters}>
          <SlidersHorizontal size={20} strokeWidth={2} aria-hidden />
          {T.filters}
          {activeFilters > 0 && (
            <>
              <span className="fd-badge" aria-hidden>
                {activeFilters}
              </span>
              <span className="sr-only">{T.on(activeFilters)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
