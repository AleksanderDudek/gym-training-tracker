/**
 * Wysokość karty jedzenia na ekranie Dziś, zmierzona na telefonach 320 i 390 px (nagłówek i zdanie
 * w jednej linii; dłuższe „… ponad cel” na 320 px dokłada linijkę). Karta przychodzi w osobnej
 * paczce i czyta IndexedDB, więc pojawia się chwilę po reszcie ekranu; zaślepka o tej wysokości
 * trzyma jej miejsce, a przekąska i cardio pod nią nie skaczą w dół. Karta ma tę samą najmniejszą
 * wysokość — zaślepka nigdy nie jest od niej wyższa, więc ekran nie podskakuje też do góry.
 */
export const FOOD_CARD_HEIGHT = 202;

/**
 * Miejsce na kartę jedzenia: to samo pudełko co karta (`.grp`, tło, dolna kreska), bez treści
 * i ukryte przed czytnikiem ekranu. Ten plik jest w głównej paczce (używa go ekran Dziś, zanim
 * paczka jedzenia przyjdzie), więc nie importuje niczego — także stylów dziennika.
 */
export function FoodCardPlaceholder() {
  return <div className="grp snackcard" aria-hidden="true" style={{ minHeight: FOOD_CARD_HEIGHT }} />;
}
