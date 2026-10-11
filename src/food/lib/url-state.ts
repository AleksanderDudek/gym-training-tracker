import {
  EMPTY_FILTERS,
  RANGE_KEYS,
  TOGGLE_KEYS,
  isActiveRange,
  type Filters,
  type Range,
  type RangeKey,
} from './filters';
import { DEFAULT_SORT, SORT_KEYS, type Sort, type SortDir, type SortKey } from './sort';
import { ECO_GRADES, NOVA_GROUPS, NUTRI_GRADES } from './types';

export type View = 'cards' | 'table';

/** Everything on screen, so a link or a reload reproduces it. */
export interface ViewState {
  filters: Filters;
  sort: Sort;
  view: View;
  page: number;
  /** The code of the product whose detail is open. */
  product: string | null;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT,
  view: 'cards',
  page: 1,
  product: null,
};

// Short names keep links readable. Multi-values are comma-joined: no tag,
// brand key or store key contains a comma.
const LIST_PARAMS = {
  toggles: 'only',
  nutriscore: 'ns',
  nova: 'nova',
  ecoscore: 'eco',
  withoutAllergens: 'bez',
  labels: 'label',
  categories: 'cat',
  brands: 'brand',
  stores: 'store',
} as const;

function setList(params: URLSearchParams, name: string, values: readonly (string | number)[]) {
  if (values.length) params.set(name, values.join(','));
}

function formatRange(range: Range): string {
  return `${range.min ?? ''}-${range.max ?? ''}`;
}

export function toSearchParams(state: ViewState): URLSearchParams {
  const params = new URLSearchParams();
  const f = state.filters;
  if (f.q.trim()) params.set('q', f.q.trim());
  for (const [key, name] of Object.entries(LIST_PARAMS) as [keyof typeof LIST_PARAMS, string][]) {
    setList(params, name, f[key]);
  }
  for (const key of RANGE_KEYS) {
    const range = f.ranges[key];
    if (isActiveRange(range)) params.set(key, formatRange(range));
  }
  if (state.sort.key !== DEFAULT_SORT.key || state.sort.dir !== DEFAULT_SORT.dir) {
    params.set('sort', `${state.sort.key}-${state.sort.dir}`);
  }
  if (state.view !== DEFAULT_VIEW_STATE.view) params.set('view', state.view);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.product) params.set('p', state.product);
  return params;
}

function readList<T extends string | number>(
  params: URLSearchParams,
  name: string,
  allowed: readonly T[] | null,
  parse: (raw: string) => T = (raw) => raw as T,
): T[] {
  const raw = params.get(name);
  if (!raw) return [];
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map(parse);
  const valid = allowed ? values.filter((v) => allowed.includes(v)) : values;
  return [...new Set(valid)];
}

function readNumber(raw: string): number | null {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
}

function readRange(raw: string | null): Range | null {
  if (!raw || !raw.includes('-')) return null;
  // `includes('-')` above: always two halves.
  const [minRaw = '', maxRaw = ''] = raw.split('-', 2);
  const min = readNumber(minRaw);
  const max = readNumber(maxRaw);
  // A half that does not parse is dropped; the other half still counts.
  const range = { min: Number.isNaN(min) ? null : min, max: Number.isNaN(max) ? null : max };
  return isActiveRange(range) ? range : null;
}

function readSort(raw: string | null): Sort {
  const [, key, dir] = raw?.match(/^([a-z]+)-(asc|desc)$/) ?? [];
  if (!key || !(SORT_KEYS as readonly string[]).includes(key)) return DEFAULT_SORT;
  return { key: key as SortKey, dir: dir as SortDir };
}

export function fromSearchParams(params: URLSearchParams): ViewState {
  const ranges: Partial<Record<RangeKey, Range>> = {};
  for (const key of RANGE_KEYS) {
    const range = readRange(params.get(key));
    if (range) ranges[key] = range;
  }

  const page = Number(params.get('page'));
  return {
    filters: {
      q: params.get('q') ?? '',
      toggles: readList(params, LIST_PARAMS.toggles, TOGGLE_KEYS),
      nutriscore: readList(params, LIST_PARAMS.nutriscore, NUTRI_GRADES),
      nova: readList(params, LIST_PARAMS.nova, NOVA_GROUPS, Number as (raw: string) => (typeof NOVA_GROUPS)[number]),
      ecoscore: readList(params, LIST_PARAMS.ecoscore, ECO_GRADES),
      withoutAllergens: readList(params, LIST_PARAMS.withoutAllergens, null),
      labels: readList(params, LIST_PARAMS.labels, null),
      categories: readList(params, LIST_PARAMS.categories, null),
      brands: readList(params, LIST_PARAMS.brands, null),
      stores: readList(params, LIST_PARAMS.stores, null),
      ranges,
    },
    sort: readSort(params.get('sort')),
    view: params.get('view') === 'table' ? 'table' : 'cards',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    product: params.get('p') || null,
  };
}
