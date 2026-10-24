/**
 * „Usuń wszystkie dane” a pamięć strony. Moduł, który pamięta coś z tego, co ktoś oglądał (wczytane
 * kawałki danych OSM „W pobliżu”), zapisuje się tu przy wczytaniu: jak to zapomnieć. Reset
 * (`src/food/backup.ts`) woła to, co się zapisało — więc tylko moduły, które strona już ma. Żadnego
 * dla resetu nie pobiera: moduł, którego strona nie wczytała, niczego nie pamięta.
 */

const forgetters = new Set<() => void>();

/** Zapisuje, jak zapomnieć to, co moduł pamięta — raz, gdy się wczytuje. */
export function onReset(forget: () => void): void {
  forgetters.add(forget);
}

/** Zapomina wszystko, co zapisały wczytane moduły; jeden, który zawiedzie, nie zatrzymuje reszty. */
export function forgetAll(): void {
  for (const forget of forgetters) {
    try {
      forget();
    } catch {
      // Reszta resetu (kopie, dziennik) i tak idzie dalej.
    }
  }
}
