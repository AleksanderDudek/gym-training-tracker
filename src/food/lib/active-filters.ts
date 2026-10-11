import { RANGE_KEYS, isActiveRange, type Filters, type ListKey, type Range, type RangeKey } from './filters';
import { formatNumber, formatPrice } from './format';
import { RANGE_LABELS, TOGGLE_LABELS, gradeLabel } from './labels';
import type { Dictionaries } from './types';

export interface FilterChip {
  id: string;
  label: string;
  remove: (filters: Filters) => Filters;
}

const LIST_PREFIX: Record<ListKey, string> = {
  categories: 'Kategoria',
  brands: 'Marka',
  stores: 'Sklep',
  labels: 'Etykieta',
};

function rangeText(key: RangeKey, range: Range): string {
  const { label, unit } = RANGE_LABELS[key];
  const value = (n: number) => (key === 'price' ? formatPrice(n) : `${formatNumber(n, 2)}${unit ? ` ${unit}` : ''}`);
  const bare = (n: number) => (key === 'price' ? formatPrice(n) : formatNumber(n, 2));
  if (range.min !== null && range.max !== null) return `${label}: ${bare(range.min)}–${value(range.max)}`;
  if (range.min !== null) return `${label}: od ${value(range.min)}`;
  return `${label}: do ${value(range.max!)}`;
}

/** What is filtering the list right now, each removable on its own. */
export function activeFilterChips(f: Filters, dict: Dictionaries): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.q.trim()) chips.push({ id: 'q', label: `„${f.q.trim()}”`, remove: (x) => ({ ...x, q: '' }) });

  for (const t of f.toggles) {
    chips.push({
      id: `t:${t}`,
      label: TOGGLE_LABELS[t],
      remove: (x) => ({ ...x, toggles: x.toggles.filter((v) => v !== t) }),
    });
  }
  for (const g of f.nutriscore) {
    chips.push({
      id: `ns:${g}`,
      label: `Nutri-Score ${gradeLabel(g)}`,
      remove: (x) => ({ ...x, nutriscore: x.nutriscore.filter((v) => v !== g) }),
    });
  }
  for (const g of f.nova) {
    chips.push({ id: `nova:${g}`, label: `NOVA ${g}`, remove: (x) => ({ ...x, nova: x.nova.filter((v) => v !== g) }) });
  }
  for (const g of f.ecoscore) {
    chips.push({
      id: `eco:${g}`,
      label: `Eco-Score ${gradeLabel(g)}`,
      remove: (x) => ({ ...x, ecoscore: x.ecoscore.filter((v) => v !== g) }),
    });
  }
  for (const a of f.withoutAllergens) {
    chips.push({
      id: `bez:${a}`,
      label: `bez: ${dict.allergens[a] ?? a}`,
      remove: (x) => ({ ...x, withoutAllergens: x.withoutAllergens.filter((v) => v !== a) }),
    });
  }
  for (const key of ['categories', 'brands', 'stores', 'labels'] as const) {
    for (const value of f[key]) {
      chips.push({
        id: `${key}:${value}`,
        label: `${LIST_PREFIX[key]}: ${dict[key][value] ?? value}`,
        remove: (x) => ({ ...x, [key]: x[key].filter((v) => v !== value) }),
      });
    }
  }
  for (const key of RANGE_KEYS) {
    const range = f.ranges[key];
    if (!isActiveRange(range)) continue;
    chips.push({
      id: `range:${key}`,
      label: rangeText(key, range),
      remove: (x) => {
        const ranges = { ...x.ranges };
        delete ranges[key];
        return { ...x, ranges };
      },
    });
  }
  return chips;
}
