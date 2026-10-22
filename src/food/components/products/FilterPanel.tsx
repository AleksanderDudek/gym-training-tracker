import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { text } from '../../../i18n';
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

const T = text({
  pl: {
    only: 'Pokaż tylko',
    diet: 'Dieta',
    nova: 'NOVA – stopień przetworzenia',
    novaNote: '1 – nieprzetworzone, 4 – ultraprzetworzone',
    nutrition: 'Wartości odżywcze na 100 g',
    price: 'Cena',
    priceNote: 'Ceny z Open Prices – ma je niewielka część produktów.',
    category: 'Kategoria',
    brand: 'Marka',
    store: 'Sklep',
    labelsTitle: 'Etykiety i certyfikaty',
    labelsNote: 'Produkt musi mieć wszystkie zaznaczone.',
    labels: 'Etykiety',
    allergens: 'Bez alergenów',
    without: (name: string) => `bez: ${name}`,
    allergensNote: 'Wyklucza też śladowe ilości. Pokazuje tylko produkty ze znanym składem – nieznany skład nie znaczy „bez alergenów”.',
    additives: 'Dodatki do żywności (E)',
  },
  en: {
    only: 'Show only',
    diet: 'Diet',
    nova: 'NOVA – degree of processing',
    novaNote: '1 – unprocessed, 4 – ultra-processed',
    nutrition: 'Nutrition facts per 100 g',
    price: 'Price',
    priceNote: 'Prices from Open Prices – only a small share of products have one.',
    category: 'Category',
    brand: 'Brand',
    store: 'Shop',
    labelsTitle: 'Labels and certificates',
    labelsNote: 'A product must have every one ticked.',
    labels: 'Labels',
    allergens: 'Allergen-free',
    without: (name: string) => `without: ${name}`,
    allergensNote: 'Also excludes traces. Shows only products with known ingredients – unknown ingredients don’t mean “allergen-free”.',
    additives: 'Food additives (E)',
  },
});

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
      <Section title={T.only}>
        <ul className="fd-checks">{PRESENCE_TOGGLES.map(toggleRow)}</ul>
      </Section>
      <Section title={T.diet}>
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

      <Section title={T.nova}>
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
        <p className="fd-note">{T.novaNote}</p>
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

      <Section title={T.nutrition}>
        {NUTRITION_RANGES.map((key) => (
          <RangeInput key={key} {...RANGE_LABELS[key]} range={filters.ranges[key]} onChange={(range) => setRange(key, range)} />
        ))}
      </Section>

      <Section title={T.price}>
        <RangeInput {...RANGE_LABELS.price} range={filters.ranges.price} onChange={(r) => setRange('price', r)} />
        <p className="fd-note">{T.priceNote}</p>
      </Section>

      <Section title={T.category}>{facet('categories', T.category)}</Section>
      <Section title={T.brand}>{facet('brands', T.brand)}</Section>
      <Section title={T.store}>{facet('stores', T.store)}</Section>
      <Section title={T.labelsTitle} open={false}>
        <p className="fd-note">{T.labelsNote}</p>
        {facet('labels', T.labels)}
      </Section>

      <Section title={T.allergens} open={false}>
        <ul className="fd-checks">
          {allergenOptions.map((tag) => (
            <li key={tag}>
              <label className="fd-check">
                <input
                  type="checkbox"
                  checked={filters.withoutAllergens.includes(tag)}
                  onChange={() => set({ withoutAllergens: toggled(filters.withoutAllergens, tag) })}
                />
                <span className="fd-check-name">{T.without(dict.allergens[tag] ?? tag)}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="fd-note">{T.allergensNote}</p>
      </Section>

      <Section title={T.additives} open={false}>
        <RangeInput {...RANGE_LABELS.additives} range={filters.ranges.additives} onChange={(r) => setRange('additives', r)} />
      </Section>
    </div>
  );
}
