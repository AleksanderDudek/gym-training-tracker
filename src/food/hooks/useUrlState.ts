import { useCallback, useEffect, useRef, useState } from 'react';
import { hashPath, hashQuery, hashWith } from '../hash';

export type Patch<S> = Partial<S> | ((current: S) => Partial<S>);
export type Update<S> = (patch: Patch<S>, options?: { push?: boolean }) => void;

/** Marks a history entry this app pushed for an open detail. */
const DETAIL_ENTRY = 'produkty-pl:detail';

/**
 * A page's state, kept in the query INSIDE the hash (`#/produkty?q=skyr`): the
 * gym tracker routes by hash, and its router ignores the query, so a change
 * here is not a navigation. Ordinary changes REPLACE the history entry (typing
 * must not fill Back with keystrokes); `push` adds one, which is how opening a
 * product makes Back close it. `reconcile` lets a page derive fields from a
 * change (the product list returns to page 1 when its filters change).
 *
 * The page that owns the state is the hash path it was mounted on. Once the
 * address shows another page (the user moved on, and this one is about to
 * unmount), nothing is read from it or written to it.
 */
export function useUrlState<S>(
  read: (params: URLSearchParams) => S,
  write: (state: S) => URLSearchParams,
  reconcile: (current: S, changes: Partial<S>, next: S) => S = (_c, _ch, next) => next,
): [S, Update<S>, (fallback: Partial<S>) => void] {
  const [owner] = useState(() => hashPath(window.location.hash));
  const [state, setState] = useState(() => read(hashQuery(window.location.hash)));
  const pushNext = useRef(false);
  const codec = useRef({ read, write, reconcile });
  useEffect(() => {
    codec.current = { read, write, reconcile };
  });

  useEffect(() => {
    const onPopState = () => {
      if (hashPath(window.location.hash) !== owner) return;
      setState(codec.current.read(hashQuery(window.location.hash)));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [owner]);

  // The URL is written from state, never inside a state updater: React may
  // run updaters twice. history.pushState/replaceState fire no hashchange, so
  // the router does not see these writes.
  useEffect(() => {
    const push = pushNext.current;
    pushNext.current = false;
    // Without a hash path of its own the page has nowhere to keep its state in
    // the address; it still works, from memory.
    if (!owner || hashPath(window.location.hash) !== owner) return;
    const url = hashWith(owner, codec.current.write(state));
    if (url === window.location.hash) return;
    if (push) window.history.pushState(DETAIL_ENTRY, '', url);
    else window.history.replaceState(window.history.state, '', url);
  }, [state, owner]);

  const update = useCallback<Update<S>>((patch, options) => {
    if (options?.push) pushNext.current = true;
    setState((current) => {
      const changes = typeof patch === 'function' ? patch(current) : patch;
      return codec.current.reconcile(current, changes, { ...current, ...changes });
    });
  }, []);

  const closeEntry = useCallback(
    (fallback: Partial<S>) => {
      // Leave the way we came in when we pushed the entry; otherwise (a shared
      // link opened straight onto a detail) just apply the fallback.
      if (window.history.state === DETAIL_ENTRY) window.history.back();
      else update(fallback);
    },
    [update],
  );

  return [state, update, closeEntry];
}
