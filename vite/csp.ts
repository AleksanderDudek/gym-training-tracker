import type { Plugin } from 'vite';

/**
 * Obce adresy, z którymi aplikacja rozmawia. Jedna lista: czyta ją i polityka, i test, który
 * pilnuje, żeby żaden `https://…` z kodu nie został przez nią po cichu zablokowany.
 */
export const ORIGINS = {
  // Zdjęcia produktów (Open Food Facts), kafelki mapy (OpenStreetMap), miniatury filmów (YouTube).
  img: ['https://images.openfoodfacts.org', 'https://tile.openstreetmap.org', 'https://i.ytimg.com'],
  // W pobliżu: Overpass i jego zapasowy serwer (sklepy i lokale), Nominatim (adres wpisany zamiast
  // lokalizacji). Obrazki z listy wyżej stoją tu drugi raz, bo
  // zrzut ekranu do wiadomości dla autora (html-to-image) pobiera je skryptem, żeby wkleić w obrazek —
  // bez tego miniatura filmu wyszłaby na zrzucie pustym prostokątem.
  connect: [
    'https://overpass-api.de',
    'https://overpass.private.coffee',
    'https://nominatim.openstreetmap.org',
    'https://images.openfoodfacts.org',
    'https://tile.openstreetmap.org',
    'https://i.ytimg.com',
  ],
  // Odtwarzacz filmów z ćwiczeniami: wersja bez ciasteczek i zwykła, gdyby osadzenie tam przekierowało.
  frame: ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
} as const;

/** Sam początek adresu (protokół, host, port) — albo nic, gdy adresu nie ma lub nie da się go odczytać. */
function originOf(url?: string): string | null {
  if (!url?.trim()) return null;
  try {
    const { origin } = new URL(url.trim());
    // Adresy bez hosta (`mailto:`, `data:`) mają pochodzenie „null” — tego nie ma po co dopisywać.
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Polityka bezpieczeństwa treści dla zbudowanej aplikacji. Serwer aplikacji (`VITE_API_URL`)
 * dochodzi do `connect-src`, gdy jest: w CI zmienna bywa pusta i wtedy aplikacja działa bez niego.
 * Style z `'unsafe-inline'`, bo React i rysunki do udostępniania ustawiają atrybut `style`.
 */
export function csp(apiUrl?: string): string {
  const api = originOf(apiUrl);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${ORIGINS.img.join(' ')}`,
    `connect-src 'self' ${[...ORIGINS.connect, ...(api ? [api] : [])].join(' ')}`,
    `frame-src ${ORIGINS.frame.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

const CHARSET = '<meta charset="utf-8" />';

/**
 * Wstawia politykę zaraz po kodowaniu znaków: znacznik `<meta>` obowiązuje dopiero od miejsca,
 * w którym stoi, więc wszystko, co coś ładuje, musi być pod nim. Bez znacznika kodowania build
 * staje — strona bez polityki wyszłaby bez żadnego ostrzeżenia.
 */
export function withCsp(html: string, policy: string): string {
  if (!html.includes(CHARSET)) throw new Error(`index.html: brak ${CHARSET} — CSP nie ma gdzie wejść`);
  return html.replace(CHARSET, `${CHARSET}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
}

/**
 * CSP jako `<meta>` (GitHub Pages nie ustawia nagłówków). Tylko w buildzie: tryb deweloperski
 * Vite'a wstrzykuje własne skrypty, które polityka by zablokowała.
 */
export function cspPlugin(apiUrl?: string): Plugin {
  const policy = csp(apiUrl);
  return {
    name: 'gym-tracker:csp',
    apply: 'build',
    transformIndexHtml: (html) => withCsp(html, policy),
  };
}
