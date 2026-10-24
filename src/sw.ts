/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { navigationDenylist } from './swNavigation';
import { withoutDateHeader } from './swPlugins';

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
 * - Strona (nawigacja) — zawsze `index.html` z tej listy, poza polityką prywatności
 *   (`privacy.html`) i plikami spod `data/` (licencja danych OSM), które mają się otwierać same.
 *   Obie ścieżki liczone od zakresu service workera, nie od korzenia serwera: aplikacja działa pod
 *   dowolną ścieżką, także pod folderem `data/`.
 *   Nowa wersja nie wchodzi sama: czeka, aż ktoś stuknie „Odśwież” na pasku (`UpdateBar`) albo na
 *   ekranie awarii (`RootBoundary`), a do tego czasu stare pliki zostają ważne.
 * - Baza produktów — najpierw kopia. Nazwa pliku ma hasz, więc nowa baza to nowy adres; trzymamy
 *   tylko ostatnią, bo każda waży kilka megabajtów.
 * - Zdjęcia produktów i kafelki mapy — najpierw kopia, z limitem liczby i wieku. Kafelki tylko
 *   obejrzane, nigdy pobierane zawczasu (tego wymagają zasady OpenStreetMap).
 * - Czytnik kodów kreskowych (WebAssembly) — najpierw kopia, pobrany przy pierwszym skanie.
 * - Dane OSM „W pobliżu” (`data/osm/v1/`) — kawałki mapy najpierw z kopii (nazwa ma hasz treści,
 *   tylko oglądane okolice, 400 na 90 dni), indeks z kopii od razu i odświeżany w tle: nowe dane
 *   po wdrożeniu przychodzą same, bez paska „Nowa wersja”. Tak samo licencja danych
 *   (`LICENSE.txt`, odnośnik z „W pobliżu”): raz otwarta, otwiera się też bez sieci.
 *
 * Overpass, Open Food Facts, serwer aplikacji i filmy z YouTube'a idą prosto do sieci: offline i tak
 * by nie ruszyły.
 * W trybie deweloperskim ten plik nie jest rejestrowany.
 */

const DAY = 24 * 3600;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// Pierwsza wizyta: strona przechodzi pod opiekę od razu, nie dopiero po przeładowaniu — tak jak
// wcześniej. Przy aktualizacji niczego to nie przyspiesza: nowa wersja i tak czeka na zgodę.
// To, co strona pobrała przed przejęciem (baza produktów, paczka sklepów, kawałki danych OSM),
// poszło obok kopii — strona pobiera to wtedy jeszcze raz, już przez service worker
// (`src/swWarm.ts`, kawałki: `src/food/nearby/staticData.ts`).
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: navigationDenylist(new URL(self.registration.scope).pathname),
  }),
);

registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.includes('/data/products.') && url.pathname.endsWith('.json.gz'),
  new CacheFirst({
    cacheName: 'gt-food-data',
    plugins: [new ExpirationPlugin({ maxEntries: 1 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Produkty sklepów internetowych (`src/food/online/shopData`): paczka z haszem w nazwie, wczytywana
// razem z bazą produktów i tak samo trzymana — jedna kopia, bez miejsca w instalacji.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\/assets\/shopData-[\w-]+\.js$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'gt-shop-data',
    plugins: [new ExpirationPlugin({ maxEntries: 1 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Kawałki danych OSM „W pobliżu”: nazwa z haszem treści, więc kopia jest ważna, dopóki istnieje.
// Tylko oglądane okolice, z limitem — lista miejsc, które ktoś oglądał, nie rośnie bez końca.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\/data\/osm\/v1\/t\/\d+-\d+-\d+\.[0-9a-f]{10}\.json\.gz$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'gt-osm',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 90 * DAY, purgeOnQuotaError: true }),
      new CacheableResponsePlugin({ statuses: [200] }),
      // A leaf never changes under its name, so its age is how long ago it was LAST USED (what the
      // expiration keeps track of), not its `Date` header.
      withoutDateHeader,
    ],
  }),
);

// Indeks danych OSM i ich licencja (`LICENSE.txt`, odnośnik z „W pobliżu”) pod stałymi adresami:
// od razu z kopii, nowe w tle — licencja raz otwarta otwiera się też bez sieci. Adres z `?r=`
// (odświeżenie indeksu po zniknięciu kawałka po wdrożeniu) idzie prosto do sieci.
registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin &&
    url.search === '' &&
    (url.pathname.endsWith('/data/osm/v1/index.json') || url.pathname.endsWith('/data/osm/v1/LICENSE.txt')),
  new StaleWhileRevalidate({
    cacheName: 'gt-osm-index',
    plugins: [new ExpirationPlugin({ maxEntries: 2 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
);

// Czytnik kodów kreskowych (WebAssembly, ok. 1 MB) dla przeglądarek bez własnego: pobierany przy
// pierwszym skanie, nie przy instalacji — większość telefonów z Androidem go nie potrzebuje. Potem
// z kopii, także w sklepie bez zasięgu. Nazwa ma hasz, więc nowa wersja to nowy adres.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && /\/assets\/zxing_reader-[\w-]+\.wasm$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'gt-scanner',
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

/**
 * „Odśwież” na pasku nowej wersji albo na ekranie awarii: nowa wersja przejmuje stronę, a ta się
 * przeładowuje.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/*
 * Przypomnienia (Web Push). Treść przychodzi zaszyfrowana z serwera przypomnień (`server/api`)
 * i jest gotowa do pokazania — service worker nie liczy niczego sam. Każde `push` musi
 * skończyć się powiadomieniem: Chrome inaczej pokazuje własne „strona zaktualizowana w tle”,
 * a Safari po kilku cichych wiadomościach odbiera subskrypcję.
 */
/**
 * Język powiadomienia dla czytnika ekranu. Service worker nie widzi języka wybranego w ustawieniach,
 * a treść przychodzi gotowa, w języku aplikacji — polskie przypomnienia mają polskie litery już
 * w tytule („Dziś trening”, „Poranne ważenie”).
 */
const langOf = (text: string): string => (/[ąćęłńóśźż]/i.test(text) ? 'pl' : 'en');

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: unknown; tag?: string } = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // Tylko trasy aplikacji — powiadomienie nie otwiera cudzych stron.
  const url = typeof data.url === 'string' && /^#\/[\w/-]*$/.test(data.url) ? data.url : '#/sesja';
  const title = data.title || 'GYM TRACKER';
  const body = data.body || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      // Ten sam rodzaj zastępuje poprzednie powiadomienie zamiast piętrzyć je w szufladzie.
      tag: data.tag || 'gym-tracker',
      lang: langOf(`${title} ${body}`),
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
