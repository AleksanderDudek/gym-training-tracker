import { useCallback } from 'react';
import { fromSearchParams, toSearchParams, type ViewState } from '../lib/url-state';
import { useUrlState, type Patch, type Update } from './useUrlState';

export type ViewStatePatch = Patch<ViewState>;
export type UpdateViewState = Update<ViewState>;

/** A change of filters or sort returns to page 1, unless it names a page. */
function resetPage(current: ViewState, changes: Partial<ViewState>, next: ViewState): ViewState {
  const resets =
    (changes.filters && changes.filters !== current.filters) || (changes.sort && changes.sort !== current.sort);
  return resets && changes.page === undefined ? { ...next, page: 1 } : next;
}

/** The product browser's state, in the URL; the last two close the product card and the scanner the way they opened. */
export function useViewState(): [ViewState, UpdateViewState, () => void, () => void] {
  const [state, update, closeEntry] = useUrlState(fromSearchParams, toSearchParams, resetPage);
  const closeProduct = useCallback(() => closeEntry({ product: null }), [closeEntry]);
  const closeScan = useCallback(() => closeEntry({ scan: null }), [closeEntry]);
  return [state, update, closeProduct, closeScan];
}
