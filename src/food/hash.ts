/**
 * Stan stron jedzenia w adresie. Aplikacja trzyma trasy w części hash (`#/produkty`), więc
 * filtry, wyszukiwanie i otwarty produkt idą do zapytania WEWNĄTRZ hasha: `#/produkty?q=skyr&ns=a`.
 * Router porównuje same ścieżki (bez zapytania), więc zmiana filtrów nie jest przejściem
 * na inną stronę.
 */

/** `#/produkty?q=a` → `#/produkty`. */
export function hashPath(hash: string): string {
  const at = hash.indexOf('?');
  return at < 0 ? hash : hash.slice(0, at);
}

/** `#/produkty?q=a&ns=b` → parametry `q` i `ns`; bez zapytania — puste. */
export function hashQuery(hash: string): URLSearchParams {
  const at = hash.indexOf('?');
  return new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
}

/** Ścieżka z zapytaniem; bez parametrów sama ścieżka, żeby adres nie kończył się pustym `?`. */
export function hashWith(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
