import { SORT_LABELS, type MenuSort } from './sort';
import { MENU_CATEGORIES, type MenuCategory } from './types';

/** Lokale: the search across every chain, and the position open from it ("kfc/strips"). */
export interface RestaurantsState {
  q: string;
  item: string | null;
}

export function restaurantsToParams(state: RestaurantsState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.item) params.set('p', state.item);
  return params;
}

export function restaurantsFromParams(params: URLSearchParams): RestaurantsState {
  return { q: params.get('q') ?? '', item: params.get('p') || null };
}

/** One chain's menu: category, sort and the open position (Polish names: they are what a link shows). */
export interface ChainState {
  category: MenuCategory | null;
  sort: MenuSort;
  item: string | null;
}

export function chainToParams(state: ChainState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.category) params.set('kat', state.category);
  if (state.sort !== 'menu') params.set('sort', state.sort);
  if (state.item) params.set('p', state.item);
  return params;
}

export function chainFromParams(params: URLSearchParams): ChainState {
  const kat = params.get('kat');
  const sort = params.get('sort');
  return {
    category: kat && (MENU_CATEGORIES as readonly string[]).includes(kat) ? (kat as MenuCategory) : null,
    sort: sort && Object.hasOwn(SORT_LABELS, sort) ? (sort as MenuSort) : 'menu',
    item: params.get('p') || null,
  };
}
