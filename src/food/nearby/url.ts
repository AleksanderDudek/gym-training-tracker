import type { SortKey } from './eat';
import { DEFAULT_RADIUS, snapRadius } from './radius';

/** „Zjedz teraz” (places to eat for today's goal) or „Zakupy i przepisy” (shops and recipes). */
export type NearbyView = 'eat' | 'shops';

/**
 * The page's state in its query string. The POSITION is deliberately not
 * part of it: a shared link would tell whoever opens it where you were.
 */
export interface NearbyState {
  view: NearbyView;
  radius: number;
  store: string | null;
  product: string | null;
  /** The place whose card is open („Zjedz teraz”) - a public venue, not where you stand. */
  place: string | null;
  sort: SortKey;
  /** Show places known to be closed now. */
  closed: boolean;
  /** Show places without menu data. */
  unknown: boolean;
}

const VIEW_PARAM: Record<NearbyView, string> = { eat: 'zjedz', shops: 'sklepy' };
const SORT_PARAM: Record<SortKey, string> = { best: '', protein: 'bialko', near: 'blisko', light: 'lekko' };

export function nearbyToParams(state: NearbyState, defaultView: NearbyView = 'eat'): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== defaultView) params.set('widok', VIEW_PARAM[state.view]);
  if (state.radius !== DEFAULT_RADIUS) params.set('r', String(state.radius));
  if (state.store) params.set('sklep', state.store);
  if (state.product) params.set('p', state.product);
  if (state.place) params.set('miejsce', state.place);
  if (state.sort !== 'best') params.set('sort', SORT_PARAM[state.sort]);
  if (state.closed) params.set('zamkniete', '1');
  if (state.unknown) params.set('bez-danych', '1');
  return params;
}

const keyOf = <K extends string>(table: Record<K, string>, value: string | null, fallback: K): K =>
  ((Object.keys(table) as K[]).find((k) => table[k] === value) ?? fallback);

/**
 * `fallbackRadius`: what to use when the link names none (the last one used here); `defaultView`:
 * the view a link without `widok` opens (the last one used here).
 */
export function nearbyFromParams(
  params: URLSearchParams,
  fallbackRadius = DEFAULT_RADIUS,
  defaultView: NearbyView = 'eat',
): NearbyState {
  const r = params.get('r');
  return {
    view: keyOf(VIEW_PARAM, params.get('widok'), defaultView),
    radius: r === null ? snapRadius(fallbackRadius) : snapRadius(Number(r)),
    store: params.get('sklep') || null,
    product: params.get('p') || null,
    place: params.get('miejsce') || null,
    sort: keyOf(SORT_PARAM, params.get('sort') ?? '', 'best'),
    closed: params.get('zamkniete') === '1',
    unknown: params.get('bez-danych') === '1',
  };
}
