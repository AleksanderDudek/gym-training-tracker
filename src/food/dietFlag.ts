/**
 * Znacznik „ten ktoś prowadzi dietę” w `localStorage`. Ekran Dziś czyta go, zanim cokolwiek
 * wczyta: bez znacznika karta jedzenia nie istnieje, a razem z nią paczka z Dexie i IndexedDB —
 * kto tylko trenuje, nie wczytuje ani nie uruchamia kodu dziennika jedzenia. (Pliki i tak leżą
 * w zapasie service workera, jak cała aplikacja na pracę offline — ale nic ich nie otwiera.) Plik
 * jest malutki i bez importów, bo trafia do głównej paczki razem z ekranem Dziś.
 *
 * Znacznik stawiają strony diety, gdy profil diety się zapisze albo znajdzie (np. profil
 * z Produktów PL na tej samej domenie), a zdejmuje go wyczyszczenie danych diety. Każdy dostęp
 * w `try`: tryb prywatny i zablokowana pamięć przeglądarki rzucają wyjątkiem.
 */
export const DIET_FLAG = 'gt:diet';

export function hasDiet(): boolean {
  try {
    return window.localStorage.getItem(DIET_FLAG) === '1';
  } catch {
    return false;
  }
}

export function markDiet(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(DIET_FLAG, '1');
    else window.localStorage.removeItem(DIET_FLAG);
  } catch {
    // Bez pamięci przeglądarki karta po prostu się nie pokaże — dziennik działa dalej.
  }
}
