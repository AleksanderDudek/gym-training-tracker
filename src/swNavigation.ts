/** A path taken literally in a RegExp: the scope is wherever the app is deployed, `+` or `(` included. */
const literal = (path: string): string => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Navigations the service worker must NOT answer with the app's `index.html`: pages and files that
 * open as themselves — the privacy policy (with or without a query), and anything under `data/` (the
 * OSM data's `LICENSE.txt` linked from „W pobliżu”, an index or a leaf opened directly). The app
 * routes by hash, so none of its own pages has a path under `data/`.
 *
 * Workbox tests each pattern against the path and query of the request (`pathname + search`, see
 * `NavigationRoute`), so the patterns start at the worker's scope: the app works under any path
 * (`base: './'`), a folder called `data` included — `/data/?src=homescreen` is then the app itself.
 * No imports: the service worker and a test both load it.
 */
export function navigationDenylist(scopePath: string): RegExp[] {
  const scope = literal(scopePath.endsWith('/') ? scopePath : `${scopePath}/`);
  return [new RegExp(`^${scope}privacy\\.html(?:\\?|$)`), new RegExp(`^${scope}data/`)];
}
