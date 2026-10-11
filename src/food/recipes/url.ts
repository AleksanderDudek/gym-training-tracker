import { KIND_LABELS, type RecipeKind } from './catalog';
import { TIER_LABELS, type TimeTier } from './tiers';

/** The recipes page's state, in its query string (Polish names: they are what a link shows). */
export interface RecipesState {
  store: string | null;
  kind: RecipeKind | null;
  /** How long it may take: `czas=szybkie`. */
  tier: TimeTier | null;
  /** The code of the product whose detail is open. */
  product: string | null;
}

export const DEFAULT_RECIPES_STATE: RecipesState = { store: null, kind: null, tier: null, product: null };

export function recipesToParams(state: RecipesState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.store) params.set('sklep', state.store);
  if (state.kind) params.set('typ', state.kind);
  if (state.tier) params.set('czas', state.tier);
  if (state.product) params.set('p', state.product);
  return params;
}

/** A value that is one of `labels`' own keys - not "constructor", which every object inherits. */
function oneOf<K extends string>(labels: Record<K, string>, value: string | null): K | null {
  return value && Object.hasOwn(labels, value) ? (value as K) : null;
}

export function recipesFromParams(params: URLSearchParams): RecipesState {
  return {
    store: params.get('sklep') || null,
    kind: oneOf(KIND_LABELS, params.get('typ')),
    tier: oneOf(TIER_LABELS, params.get('czas')),
    product: params.get('p') || null,
  };
}
