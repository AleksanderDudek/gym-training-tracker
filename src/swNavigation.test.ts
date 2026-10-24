import { describe, expect, it } from 'vitest';
import { navigationDenylist } from './swNavigation';
// The service worker as text (`?raw`): its navigation route must get the list built from its scope.
import swSource from './sw.ts?raw';

/**
 * Whether the worker leaves a navigation alone: Workbox's `NavigationRoute` tests the denylist
 * against `url.pathname + url.search` (no origin, no hash) — the same here.
 */
const denied = (scope: string, address: string) => {
  const url = new URL(address, 'https://aleksanderdudek.github.io');
  return navigationDenylist(scope).some((re) => re.test(url.pathname + url.search));
};

describe('service worker navigations', () => {
  it('on Pages: the app’s own pages get index.html; the privacy policy and the OSM data files open as themselves', () => {
    const scope = '/gym-training-tracker/';
    expect(denied(scope, '/gym-training-tracker/')).toBe(false);
    expect(denied(scope, '/gym-training-tracker/?src=homescreen')).toBe(false);
    expect(denied(scope, '/gym-training-tracker/index.html')).toBe(false);
    expect(denied(scope, '/gym-training-tracker/#/w-poblizu')).toBe(false);
    expect(denied(scope, '/gym-training-tracker/privacy.html')).toBe(true);
    expect(denied(scope, '/gym-training-tracker/privacy.html?x=1')).toBe(true);
    expect(denied(scope, '/gym-training-tracker/data/osm/v1/LICENSE.txt')).toBe(true);
    expect(denied(scope, '/gym-training-tracker/data/osm/v1/index.json')).toBe(true);
  });

  it('under a folder called data the app itself is no data file: the home screen icon still starts it offline', () => {
    const scope = '/data/';
    expect(denied(scope, '/data/')).toBe(false);
    expect(denied(scope, '/data/?src=homescreen#/sesja')).toBe(false);
    expect(denied(scope, '/data/index.html')).toBe(false);
    expect(denied(scope, '/data/privacy.html')).toBe(true);
    expect(denied(scope, '/data/data/osm/v1/LICENSE.txt')).toBe(true);
  });

  it('at the root of a server', () => {
    expect(denied('/', '/')).toBe(false);
    expect(denied('/', '/?utm_source=x')).toBe(false);
    expect(denied('/', '/data/osm/v1/index.json')).toBe(true);
    expect(denied('/', '/privacy.html')).toBe(true);
  });

  it('the scope is taken literally, whatever characters its path holds, and also without its last slash', () => {
    expect(denied('/kb+(beta)/', '/kb+(beta)/')).toBe(false);
    expect(denied('/kb+(beta)/', '/kb+(beta)/data/osm/v1/LICENSE.txt')).toBe(true);
    expect(denied('/kb+(beta)/', '/kb+(beta)/privacy.html')).toBe(true);
    expect(denied('/gym-training-tracker', '/gym-training-tracker/')).toBe(false);
    expect(denied('/gym-training-tracker', '/gym-training-tracker/privacy.html')).toBe(true);
  });

  it('the service worker builds the list from its own scope', () => {
    expect(swSource.match(/new NavigationRoute\(/g)).toHaveLength(1);
    expect(swSource).toMatch(
      /new NavigationRoute\(\s*createHandlerBoundToURL\('index\.html'\),\s*\{\s*denylist:\s*navigationDenylist\(\s*new URL\(\s*self\.registration\.scope\s*\)\.pathname\s*\),?\s*\}\s*\)/,
    );
  });

  it('the data licence it lets through is kept beside the OSM index, so once opened it opens offline too', () => {
    const cache = swSource.indexOf("cacheName: 'gt-osm-index'");
    const route = swSource.slice(swSource.lastIndexOf('registerRoute(', cache), swSource.indexOf('registerRoute(', cache));
    expect(route).toContain("url.pathname.endsWith('/data/osm/v1/LICENSE.txt')");
    expect(route).toContain("url.search === ''");
    // The index and the licence: room for both.
    expect(route).toContain('maxEntries: 2');
  });
});
