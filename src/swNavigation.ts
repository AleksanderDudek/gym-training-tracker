/**
 * Navigations the service worker must NOT answer with the app's `index.html`: pages and files that
 * open as themselves — the privacy policy, and anything under `data/` (the OSM data's `LICENSE.txt`
 * linked from „W pobliżu”, an index or a leaf opened directly). The app routes by hash, so none of
 * its own pages has `/data/` in its path. No imports: the service worker and a test both load it.
 */
export const NAVIGATION_DENYLIST: RegExp[] = [/\/privacy\.html$/, /\/data\//];
