import { describe, expect, it } from 'vitest';
import { csp, withCsp } from '../vite/csp';
import { ONLINE_SHOPS } from './food/online/shops';

/**
 * Polityka bezpieczeństwa treści (CSP) a adresy w kodzie.
 *
 * CSP blokuje po cichu: zablokowana miniatura to szary prostokąt, zablokowane zapytanie to
 * „brak sieci”. Nikt tego nie zgłosi, bo nic się nie wywraca. Dlatego każdy `https://…`
 * w kodzie aplikacji musi być w polityce — albo na liście adresów, pod które aplikacja
 * tylko odsyła.
 */

// Kod jako tekst przez Vite (`?raw`), jak arkusz w teście kontrastu — bez typów node'a. Bez
// testów, których adresy nigdy nie idą do sieci, i bez service workera: CSP strony go nie dotyczy.
const SOURCES = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.*', '!./sw.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Tylko odnośniki: udostępnianie, wsparcie, adres aplikacji na obrazkach. Przeglądarka
 * przechodzi tam sama (w nowej karcie albo w aplikacji serwisu), a nawigacji CSP strony nie
 * ogranicza. Nowy adres trafia tu tylko wtedy, gdy aplikacja niczego z niego nie pobiera.
 */
const NAVIGATION = new Set([
  'wa.me',
  'twitter.com',
  'www.facebook.com',
  'buycoffee.to',
  // Kontakt z autorem: wsparcie spoza Polski, serwer na Discordzie i Instagram (`contact.ts`).
  'buymeacoffee.com',
  'discord.gg',
  'www.instagram.com',
  'instagram.com',
  'aleksanderdudek.github.io',
  // Jedzenie: źródła danych w stopce i strona produktu w Open Food Facts.
  'world.openfoodfacts.org',
  'pl.openfoodfacts.org',
  'prices.openfoodfacts.org',
  'www.openstreetmap.org',
  // Sklepy internetowe: odnośniki do sklepów i stron produktów, nic z nich nie jest pobierane.
  ...ONLINE_SHOPS.map((shop) => new URL(shop.url).hostname),
]);

/** Dyrektywa → jej wartości, z gotowego tekstu polityki. */
const directives = (policy: string): Map<string, string[]> =>
  new Map(
    policy.split(';').map((d) => {
      const [name = '', ...values] = d.trim().split(/\s+/);
      return [name, values];
    }),
  );

describe('CSP', () => {
  it('przepuszcza każdy obcy adres, z którego kod coś pobiera albo osadza', () => {
    const d = directives(csp());
    const allowed = new Set([...d.get('img-src')!, ...d.get('connect-src')!, ...d.get('frame-src')!]);
    const found = new Map<string, string>();
    for (const [file, text] of Object.entries(SOURCES)) {
      for (const [origin] of text.matchAll(/https:\/\/[a-z0-9.-]+/gi)) {
        if (!NAVIGATION.has(new URL(origin).hostname)) found.set(origin, file);
      }
    }
    // Pusta lista znaczyłaby, że wzorzec plików przestał cokolwiek łapać — test byłby pusty.
    expect(found.has('https://i.ytimg.com')).toBe(true);
    const blocked = [...found].filter(([origin]) => !allowed.has(origin)).map(([o, f]) => `${o} (${f})`);
    expect(blocked).toEqual([]);
  });

  it('dopisuje do connect-src serwer aplikacji — sam adres, bez ścieżki', () => {
    const connect = directives(csp('https://api.example.com/v1/')).get('connect-src')!;
    expect(connect).toContain('https://api.example.com');
    expect(connect.join(' ')).not.toContain('/v1');
  });

  it('bez serwera albo z niepoprawnym adresem nie dopisuje niczego i się nie wywraca', () => {
    expect(csp('')).toBe(csp());
    expect(csp('   ')).toBe(csp());
    expect(csp('to nie adres')).toBe(csp());
    expect(csp('mailto:ktos@example.com')).toBe(csp());
  });

  it('wstawia znacznik zaraz po kodowaniu znaków, przed czymkolwiek, co coś ładuje', () => {
    const html = '<head>\n    <meta charset="utf-8" />\n    <link rel="icon" href="./x.svg" />\n</head>';
    const out = withCsp(html, "default-src 'self'");
    expect(out).toContain(
      `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'" />\n    <link`,
    );
  });

  it('bez znacznika kodowania przerywa build zamiast wydać stronę bez polityki', () => {
    expect(() => withCsp('<head></head>', "default-src 'self'")).toThrow(/charset/);
  });
});
