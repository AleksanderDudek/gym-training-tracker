import { useMemo, useState } from 'react';
import { LOCALE, text } from '../../../i18n';
import type { Counts } from '../../lib/browse';
import { formatNumber } from '../../lib/format';
import { normalizeForSearch } from '../../lib/text';

interface Props {
  label: string;
  counts: Counts;
  selected: string[];
  names: Record<string, string>;
  onChange: (selected: string[]) => void;
  limit?: number;
}

const collator = new Intl.Collator(LOCALE);

const T = text({
  pl: {
    none: 'Brak wartości dla bieżących filtrów.',
    search: (label: string) => `Szukaj: ${label.toLowerCase()}`,
    searchIn: (label: string) => `Szukaj w: ${label}`,
    nothing: 'Nic nie pasuje.',
    less: 'Pokaż mniej',
    more: (n: string) => `Pokaż więcej (${n})`,
  },
  en: {
    none: 'No values for the current filters.',
    search: (label: string) => `Search: ${label.toLowerCase()}`,
    searchIn: (label: string) => `Search in: ${label}`,
    nothing: 'Nothing matches.',
    less: 'Show less',
    more: (n: string) => `Show more (${n})`,
  },
});

/**
 * Lista pól wyboru dla jednej grupy (kategoria, marka, sklep, etykiety). Zaznaczone stoją na górze
 * i są widoczne także wtedy, gdy bieżące filtry nie zostawiają im żadnego produktu — inaczej wybór
 * mógłby zniknąć z listy, a dalej ją zawężać. Długie listy mają własne pole szukania.
 */
export function FacetList({ label, counts, selected, names, onChange, limit = 8 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const entries = useMemo(() => {
    const keys = new Set([...Object.keys(counts), ...selected]);
    return [...keys]
      .map((key) => ({ key, name: names[key] ?? key, count: counts[key] ?? 0, selected: selected.includes(key) }))
      .sort(
        (a, b) => Number(b.selected) - Number(a.selected) || b.count - a.count || collator.compare(a.name, b.name),
      );
  }, [counts, selected, names]);

  const needle = normalizeForSearch(search);
  const matching = needle ? entries.filter((e) => normalizeForSearch(e.name).includes(needle)) : entries;
  const visible = expanded || needle ? matching.slice(0, 200) : matching.slice(0, Math.max(limit, selected.length));

  if (entries.length === 0) return <p className="fd-note">{T.none}</p>;

  return (
    <div className="fd-facet">
      {entries.length > limit && (
        <input
          type="search"
          className="fd-facet-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={T.search(label)}
          aria-label={T.searchIn(label)}
          autoComplete="off"
        />
      )}
      <ul className="fd-checks">
        {visible.map((e) => (
          <li key={e.key}>
            <label className={`fd-check${e.count === 0 && !e.selected ? ' fd-prod-zero' : ''}`}>
              <input
                type="checkbox"
                checked={e.selected}
                onChange={() => onChange(e.selected ? selected.filter((k) => k !== e.key) : [...selected, e.key])}
              />
              <span className="fd-check-name">{e.name}</span>
              <span className="fd-check-n">{formatNumber(e.count, 0)}</span>
            </label>
          </li>
        ))}
      </ul>
      {needle && matching.length === 0 && <p className="fd-note">{T.nothing}</p>}
      {!needle && matching.length > limit && (
        <button type="button" className="fd-more" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
          {expanded ? T.less : T.more(formatNumber(matching.length - limit, 0))}
        </button>
      )}
    </div>
  );
}
