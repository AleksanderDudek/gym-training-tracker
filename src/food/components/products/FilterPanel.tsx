import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Facets } from '../../lib/browse';
import type { Filters, ListKey, RangeKey, ToggleKey } from '../../lib/filters';
import { formatNumber } from '../../lib/format';
import { ECO_COLORS, NOVA_COLORS, NUTRI_COLORS } from '../../lib/grades';
import {
  DIET_TOGGLES,
  NOVA_LABELS,
  NUTRITION_RANGES,
  PRESENCE_TOGGLES,
  RANGE_LABELS,
  TOGGLE_LABELS,
  gradeLabel,
} from '../../lib/labels';
import { ECO_GRADES, NOVA_GROUPS, NUTRI_GRADES, type Dictionaries } from '../../lib/types';
import { FacetList } from './FacetList';
import { RangeInput } from './RangeInput';

interface Props {
  filters: Filters;
  facets: Facets;
  dict: Dictionaries;
  /** Alergeny do wykluczenia, najczęstsze najpierw. */
  allergenOptions: string[];
  onChange: (filters: Filters) => void;
}

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="fd-fsec">
      <summary>
        {title}
        <ChevronDown size={20} strokeWidth={2} aria-hidden />
      </summary>
      <div className="fd-fsec-body">{children}</div>
    </details>
  );
}

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Ocena do wyboru: barwa normy, litera i liczba produktów. Wybraną znaczy obwódka i ✓, nie sam kolor. */
function Grade({
  label,
  title,
  count,
  active,
  colors,
  onClick,
}: {
  label: string;
  title: string;
  count: number;
  active: boolean;
  colors: { bg: string; fg: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={`${title} (${formatNumber(count, 0)})`}
      className={`fd-grade${count === 0 && !active ? ' fd-prod-zero' : ''}`}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      <b>
        {active && <Check size={16} strokeWidth={2} aria-hidden />}
        {label}
      </b>
      <span>{formatNumber(count, 0)}</span>
    </button>
  );
}

/**
 * Wszystkie filtry Produktów PL w jednej kolumnie arkusza: obecność danych, dieta, oceny, wartości
 * odżywcze, cena, kategorie, marki, sklepy, etykiety, alergeny i dodatki. Liczby przy pozycjach
 * mówią, ile produktów zostanie po zaznaczeniu.
 */
export function FilterPanel({ filters, facets, dict, allergenOptions, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const setRange = (key: RangeKey, range: Filters['ranges'][RangeKey]) => {
    const ranges = { ...filters.ranges };
    if (range) ranges[key] = range;
    else delete ranges[key];
    set({ ranges });
  };

  const toggleRow = (key: ToggleKey) => (
    <li key={key}>
      <label className="fd-check">
        <input
          type="checkbox"
          checked={filters.toggles.includes(key)}
          onChange={() => set({ toggles: toggled(filters.toggles, key) })}
        />
        <span className="fd-check-name">{TOGGLE_LABELS[key]}</span>
        <span className="fd-check-n">{formatNumber(facets.toggles[key], 0)}</span>
      </label>
    </li>
  );

  const facet = (key: ListKey, label: string) => (
    <FacetList
      label={label}
      counts={facets[key]}
      selected={filters[key]}
      names={dict[key]}
      onChange={(selected) => set({ [key]: selected })}
    />
  );

  return (
    <div className="fd-panel">
      <Section title="Pokaż tylko">
        <ul className="fd-checks">{PRESENCE_TOGGLES.map(toggleRow)}</ul>
      </Section>
      <Section title="Dieta">
        <ul className="fd-checks">{DIET_TOGGLES.map(toggleRow)}</ul>
      </Section>

      <Section title="Nutri-Score">
        <div className="fd-grades">
          {NUTRI_GRADES.map((g) => (
            <Grade
              key={g}
              label={gradeLabel(g)}
              title={`Nutri-Score ${gradeLabel(g)}`}
              count={facets.nutriscore[g] ?? 0}
              active={filters.nutriscore.includes(g)}
              colors={NUTRI_COLORS[g]}
              onClick={() => set({ nutriscore: toggled(filters.nutriscore, g) })}
            />
          ))}
        </div>
      </Section>

      <Section title="NOVA – stopień przetworzenia">
        <div className="fd-grades">
          {NOVA_GROUPS.map((g) => (
            <Grade
              key={g}
              label={String(g)}
              title={`NOVA ${g}: ${NOVA_LABELS[g]}`}
              count={facets.nova[g] ?? 0}
              active={filters.nova.includes(g)}
              colors={NOVA_COLORS[g]}
              onClick={() => set({ nova: toggled(filters.nova, g) })}
            />
          ))}
        </div>
        <p className="fd-note">1 – nieprzetworzone, 4 – ultraprzetworzone</p>
      </Section>

      <Section title="Eco-Score" open={false}>
        <div className="fd-grades">
          {ECO_GRADES.map((g) => (
            <Grade
              key={g}
              label={gradeLabel(g)}
              title={`Eco-Score ${gradeLabel(g)}`}
              count={facets.ecoscore[g] ?? 0}
              active={filters.ecoscore.includes(g)}
              colors={ECO_COLORS[g]}
              onClick={() => set({ ecoscore: toggled(filters.ecoscore, g) })}
            />
          ))}
        </div>
      </Section>

      <Section title="Wartości odżywcze na 100 g">
        {NUTRITION_RANGES.map((key) => (
          <RangeInput key={key} {...RANGE_LABELS[key]} range={filters.ranges[key]} onChange={(range) => setRange(key, range)} />
        ))}
      </Section>

      <Section title="Cena">
        <RangeInput {...RANGE_LABELS.price} range={filters.ranges.price} onChange={(r) => setRange('price', r)} />
        <p className="fd-note">Ceny z Open Prices – ma je niewielka część produktów.</p>
      </Section>

      <Section title="Kategoria">{facet('categories', 'Kategoria')}</Section>
      <Section title="Marka">{facet('brands', 'Marka')}</Section>
      <Section title="Sklep">{facet('stores', 'Sklep')}</Section>
      <Section title="Etykiety i certyfikaty" open={false}>
        <p className="fd-note">Produkt musi mieć wszystkie zaznaczone.</p>
        {facet('labels', 'Etykiety')}
      </Section>

      <Section title="Bez alergenów" open={false}>
        <ul className="fd-checks">
          {allergenOptions.map((tag) => (
            <li key={tag}>
              <label className="fd-check">
                <input
                  type="checkbox"
                  checked={filters.withoutAllergens.includes(tag)}
                  onChange={() => set({ withoutAllergens: toggled(filters.withoutAllergens, tag) })}
                />
                <span className="fd-check-name">bez: {dict.allergens[tag] ?? tag}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="fd-note">
          Wyklucza też śladowe ilości. Pokazuje tylko produkty ze znanym składem – nieznany skład nie znaczy „bez
          alergenów”.
        </p>
      </Section>

      <Section title="Dodatki do żywności (E)" open={false}>
        <RangeInput {...RANGE_LABELS.additives} range={filters.ranges.additives} onChange={(r) => setRange('additives', r)} />
      </Section>
    </div>
  );
}
