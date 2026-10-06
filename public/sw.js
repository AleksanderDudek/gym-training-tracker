/*
 * Service worker GYM TRACKERA: aplikacja działa bez sieci.
 *
 * Wszystkie dane i tak siedzą w przeglądarce, więc jedyne, czego brakuje offline, to sama
 * aplikacja. Trzy strategie, każda do innego rodzaju plików:
 *
 * - Strona (nawigacja) — najpierw sieć, potem kopia. Nowe wdrożenie wchodzi od razu, gdy
 *   jest zasięg, a bez zasięgu otwiera się ostatnia znana wersja.
 * - Własne pliki (skrypty i style z haszem w nazwie, ikony) — najpierw kopia. Plik z haszem
 *   nigdy się nie zmienia, zmienia się tylko jego nazwa.
 * - Kroje pisma z Google Fonts — kopia od razu, odświeżenie w tle.
 *
 * Filmy z YouTube'a i odnośniki na zewnątrz idą prosto do sieci: offline i tak by nie ruszyły.
 */
/*
 * Wersję i listę plików wpisuje build (`vite.config.ts`, wtyczka `precache`). Każde wdrożenie
 * ma więc nową wersję: instalacja od razu zapisuje skrypt i style tej wersji — offline działa
 * już po pierwszej wizycie — a aktywacja kasuje kopie poprzedniej, także ikony i manifest,
 * które nie mają hasza w nazwie. W trybie deweloperskim ten plik nie jest rejestrowany.
 */
const VERSION = 'dev';
const BUILD_FILES = [];
const SHELL = `gt-shell-${VERSION}`;
const RUNTIME = `gt-runtime-${VERSION}`;
const FONTS = 'gt-fonts';
const SHELL_FILES = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg',
  ...BUILD_FILES,
];
const RUNTIME_LIMIT = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('gt-') && ![SHELL, RUNTIME, FONTS].includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Stare pliki z haszem nie są już potrzebne po wdrożeniu — trzymamy tylko ostatnie. */
async function trim(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((k) => cache.delete(k)));
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    // Kopią strony może zostać tylko strona — nie plik JSON czy skrypt otwarty w karcie
    // z tego samego katalogu, bo następne uruchomienie offline pokazałoby jego tekst.
    const html = (fresh.headers.get('content-type') || '').includes('text/html');
    if (fresh.ok && html) cache.put('./', fresh.clone());
    return fresh;
  } catch {
    return (await cache.match('./')) || (await cache.match(request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, fresh.clone());
    trim(RUNTIME, RUNTIME_LIMIT);
  }
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/*
 * Przypomnienia (Web Push). Treść przychodzi zaszyfrowana z serwera przypomnień (`server/push`)
 * i jest gotowa do pokazania — service worker nie liczy niczego sam. Każde `push` musi
 * skończyć się powiadomieniem: Chrome inaczej pokazuje własne „strona zaktualizowana w tle”,
 * a Safari po kilku cichych wiadomościach odbiera subskrypcję.
 */
self.addEventListener('push', (event) => {
  let data = {};
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
