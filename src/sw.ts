/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

/*
 * Service worker GYM TRACKERA: aplikacja działa bez sieci.
 *
 * Wszystkie dane i tak siedzą w przeglądarce, więc offline brakuje tylko samej aplikacji i tego,
 * co przychodzi z zewnątrz. Każdy rodzaj plików ma swoją strategię:
 *
 * - Powłoka (skrypty, style, strona, ikony, manifest, kroje pisma) — zapisana w całości przy
 *   instalacji, z listy, którą wpisuje build (`self.__WB_MANIFEST`, vite-plugin-pwa). Offline
 *   działa więc już po pierwszej wizycie, a kopie poprzedniej wersji znikają po aktywacji nowej.
 * - Strona (nawigacja) — zawsze `index.html` z tej listy. Nowa wersja nie wchodzi sama: czeka, aż
 *   ktoś stuknie „Odśwież” na pasku (`UpdateBar`), a do tego czasu stare pliki zostają ważne.
 * - Baza produktów — najpierw kopia. Nazwa pliku ma hasz, więc nowa baza to nowy adres; trzymamy
 *   tylko ostatnią, bo każda waży kilka megabajtów.
 * - Zdjęcia produktów i kafelki mapy — najpierw kopia, z limitem liczby i wieku. Kafelki tylko
 *   obejrzane, nigdy pobierane zawczasu (tego wymagają zasady OpenStreetMap).
 *
 * Overpass, serwer aplikacji i filmy z YouTube'a idą prosto do sieci: offline i tak by nie ruszyły.
 * W trybie deweloperskim ten plik nie jest rejestrowany.
 */

const DAY = 24 * 3600;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Pierwsza wizyta: strona przechodzi pod opiekę od razu, nie dopiero po przeładowaniu — tak jak
// wcześniej. Przy aktualizacji niczego to nie przyspiesza: nowa wersja i tak czeka na zgodę.
clientsClaim();

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.includes('/data/products.') && url.pathname.endsWith('.json.gz'),
  new CacheFirst({
    cacheName: 'gt-food-data',
    plugins: [new ExpirationPlugin({ maxEntries: 1 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Tylko odpowiedzi 200: nieprzezroczystą (bez CORS) Chrome liczy do limitu miejsca po kilka MB.
registerRoute(
  /^https:\/\/images\.openfoodfacts\.org\//,
  new CacheFirst({
    cacheName: 'off-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * DAY }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

registerRoute(
  /^https:\/\/tile\.openstreetmap\.org\//,
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * DAY }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

/*
 * Kopie po poprzednim, ręcznie pisanym service workerze (do wersji 3.0). Mają jego nazwy, nie
 * Workboxa, więc `cleanupOutdatedCaches` ich nie widzi — bez tego zostałyby w przeglądarce na zawsze.
 */
const LEGACY_CACHE = /^gt-(shell|runtime)-|^gt-fonts$/;
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => LEGACY_CACHE.test(k)).map((k) => caches.delete(k)))),
  );
});

/** „Odśwież” na pasku nowej wersji: nowa wersja przejmuje stronę, a ta się przeładowuje. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/*
 * Przypomnienia (Web Push). Treść przychodzi zaszyfrowana z serwera przypomnień (`server/api`)
 * i jest gotowa do pokazania — service worker nie liczy niczego sam. Każde `push` musi
 * skończyć się powiadomieniem: Chrome inaczej pokazuje własne „strona zaktualizowana w tle”,
 * a Safari po kilku cichych wiadomościach odbiera subskrypcję.
 */
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: unknown; tag?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // Tylko trasy aplikacji — powiadomienie nie otwiera cudzych stron.
  const url = typeof data.url === 'string' && /^#\/[\w/-]*$/.test(data.url) ? data.url : '#/sesja';
  event.waitUntil(
    self.registration.showNotification(data.title || 'GYM TRACKER', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      // Ten sam rodzaj zastępuje poprzednie powiadomienie zamiast piętrzyć je w szufladzie.
      tag: data.tag || 'gym-tracker',
      lang: 'pl',
      data: { url },
    }),
  );
});

/** Stuknięcie otwiera aplikację na właściwym ekranie — w oknie, które już jest, jeśli jest. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(`./${event.notification.data?.url || '#/sesja'}`, self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = wins.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        await open.focus();
        if ('navigate' in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
