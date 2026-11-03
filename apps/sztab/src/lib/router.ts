import { useEffect, useSyncExternalStore } from 'react';

/**
 * Trasy w ścieżce adresu (History API). Sztab to strona z kontem: linki z maila Supabase wracają
 * z `?code=` na zwykły adres, a hosting (Cloudflare Pages) oddaje `index.html` pod każdą ścieżką.
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
window.addEventListener('popstate', notify);

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to === location.pathname + location.search) return;
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.scrollTo(0, 0);
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocation(): { path: string; query: URLSearchParams } {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  const url = new URL(href, location.origin);
  return { path: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams };
}

/** `/podopieczni/:id` → `{ id }`, albo `null`. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const s = path.split('/');
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(':')) out[p[i]!.slice(1)] = decodeURIComponent(s[i]!);
    else if (p[i] !== s[i]) return null;
  }
  return out;
}

export function useRedirect(to: string | null): void {
  useEffect(() => {
    if (to) navigate(to, { replace: true });
  }, [to]);
}

/** Klik w odnośnik bez przeładowania strony; środkowy przycisk i Ctrl/⌘ otwierają kartę jak zwykle. */
export function linkClick(e: React.MouseEvent<HTMLAnchorElement>, to: string): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(to);
}
